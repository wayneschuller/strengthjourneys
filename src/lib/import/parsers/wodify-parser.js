// Wodify performance exports.
//
// Supports both:
// - legacy numeric-column exports, with Sets, Reps and Weight columns
// - public/help-center documented exports where the set/rep/load data is packed
//   into `Result` or `Fully Formatted Result`
//
// Follows the parser contract in import-dispatcher.js.
//
// One row holds several sets, so what is counted as left out is sets: the
// row's own set count when it has one, otherwise one. The legacy layout is
// checked against a real export, where the only sets left out are two logged
// at 0 kg. The public layout, and the reasons given for rows that are not
// weightlifting (a metcon's time, say), follow Wodify's documentation only.

import { normalizeDateInput } from "@/lib/date-utils";
import { requireImportSource } from "@/lib/import/import-sources";
import {
  buildNotes,
  countSkip,
  findExactColumn,
  getSetSkipReason,
  isDistanceOrTimeText,
  isValidLiftWeight,
  normalizeLiftTypeNames,
  parseLeadingInteger,
  parseLeadingNumber,
} from "@/lib/import/parsers/parser-utilities";

export const wodifyFormat = {
  ...requireImportSource("wodify"),
  detect: isWodifyExport,
  parse: parseWodifyData,
};

function isWodifyExport(headers) {
  const hasDate = headers.includes("Date");
  const hasLegacyColumns =
    headers.includes("Sets") &&
    headers.includes("Reps") &&
    headers.includes("Weight") &&
    headers.includes("UOMLabel");
  const hasPublicWeightliftingColumns =
    headers.includes("Component") &&
    headers.includes("Result") &&
    (headers.includes("Performance Result Type") ||
      headers.includes("Result Type Label"));
  const hasWodifyNameStyle = headers.some((header) =>
    /^Name\(\d+\)$/.test(header),
  );

  return (
    hasDate &&
    ((hasLegacyColumns && hasWodifyNameStyle) || hasPublicWeightliftingColumns)
  );
}

function getMovementColumnIndex(headers) {
  const explicit = findExactColumn(headers, [
    "Name(21)",
    "Component",
    "Movement",
    "Exercise",
  ]);
  if (explicit >= 0) return explicit;

  const numberedNameColumns = headers
    .map((header, index) => ({ header, index }))
    .filter(({ header }) => /^Name\(\d+\)$/.test(header))
    .sort((a, b) => {
      const aNum = Number.parseInt(a.header.match(/\d+/)?.[0] || "0", 10);
      const bNum = Number.parseInt(b.header.match(/\d+/)?.[0] || "0", 10);
      return bNum - aNum;
    });

  return numberedNameColumns[0]?.index ?? -1;
}

function parseUnit(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (!normalized) return null;
  if (normalized.startsWith("kg")) return "kg";
  if (normalized.startsWith("lb")) return "lb";
  return null;
}

// Reads "3 x 5 @ 100 kg" into its numbers, or null when the text is not a
// sets x reps @ load result. The caller decides whether they make a set.
function parseResultString(resultText, fallbackUnitType) {
  const normalized = String(resultText || "").trim();
  if (!normalized) return null;

  const standardMatch = normalized.match(
    /(\d+)\s*x\s*(\d+)\s*@\s*([\d.]+)(?:\s*(kg|lb|lbs))?/i,
  );
  if (!standardMatch) return null;

  return {
    sets: parseLeadingInteger(standardMatch[1]),
    reps: parseLeadingInteger(standardMatch[2]),
    weight: parseLeadingNumber(standardMatch[3]),
    unitType: parseUnit(standardMatch[4]) || fallbackUnitType,
  };
}

function isCompleteResult(liftType, result) {
  return Boolean(
    result &&
    result.sets &&
    result.reps &&
    isValidLiftWeight(liftType, result.weight) &&
    result.unitType,
  );
}

// Parse warmup/buildup sets from freeform Wodify Notes text.
// Returns an array of { reps, weight, unitType? } objects.
//
// Recognised fragment patterns (after splitting on comma / "then"):
//   "70"          → bare weight, 1 rep assumed
//   "72.5"        → bare decimal weight
//   "7@50"        → explicit reps @ weight
//   "5@75kg"      → reps @ weight with unit
//   "3x5@80"      → sets × reps @ weight
//
// Anything that doesn't match (text like "poor form", "Failed 105",
// "single sets", "In-house comp") is silently skipped.
function parseWarmupNotes(notesText, fallbackUnitType, fallbackReps, liftType) {
  if (!notesText) return [];

  const text = String(notesText).trim();
  if (!text) return [];

  // Split on commas or the word "then" (with optional surrounding whitespace)
  const fragments = text
    .split(/,|\bthen\b/i)
    .map((f) => f.trim())
    .filter(Boolean);

  const results = [];

  for (const fragment of fragments) {
    // Strip trailing punctuation (exclamation marks, periods, etc.)
    const cleaned = fragment.replace(/[!.;:]+$/, "").trim();
    if (!cleaned) continue;

    // Pattern: sets x reps @ weight [unit]  e.g. "3x5@80kg"
    const setsRepsWeightMatch = cleaned.match(
      /^(\d+)\s*x\s*(\d+)\s*@\s*([\d.]+)\s*(kg|lb|lbs)?$/i,
    );
    if (setsRepsWeightMatch) {
      const sets = parseLeadingInteger(setsRepsWeightMatch[1]) || 1;
      const reps = parseLeadingInteger(setsRepsWeightMatch[2]);
      const weight = parseLeadingNumber(setsRepsWeightMatch[3]);
      const unitType = parseUnit(setsRepsWeightMatch[4]) || fallbackUnitType;
      if (reps && isValidLiftWeight(liftType, weight)) {
        for (let s = 0; s < sets; s++) {
          results.push({ reps, weight, unitType });
        }
        continue;
      }
    }

    // Pattern: reps @ weight [unit]  e.g. "7@50", "5@75kg"
    const repsWeightMatch = cleaned.match(
      /^(\d+)\s*@\s*([\d.]+)\s*(kg|lb|lbs)?$/i,
    );
    if (repsWeightMatch) {
      const reps = parseLeadingInteger(repsWeightMatch[1]);
      const weight = parseLeadingNumber(repsWeightMatch[2]);
      const unitType = parseUnit(repsWeightMatch[3]) || fallbackUnitType;
      if (reps && isValidLiftWeight(liftType, weight)) {
        results.push({ reps, weight, unitType });
        continue;
      }
    }

    // Pattern: bare weight  e.g. "70", "72.5"
    const bareWeightMatch = cleaned.match(/^([\d.]+)$/);
    if (bareWeightMatch) {
      const weight = parseLeadingNumber(bareWeightMatch[1]);
      if (isValidLiftWeight(liftType, weight)) {
        results.push({
          reps: fallbackReps || 1,
          weight,
          unitType: fallbackUnitType,
        });
        continue;
      }
    }

    // Anything else is not a parseable warmup — skip silently.
  }

  return results;
}

function createSetEntries({
  date,
  liftType,
  rawLiftType,
  sets,
  reps,
  weight,
  unitType,
  notes,
}) {
  const entries = [];
  const totalSets = sets && sets > 0 ? sets : 1;

  for (let i = 1; i <= totalSets; i++) {
    const setNote = totalSets > 1 ? `Set ${i} of ${totalSets}` : undefined;
    entries.push({
      date,
      liftType,
      rawLiftType,
      reps,
      weight,
      unitType,
      notes: buildNotes(setNote, notes),
    });
  }

  return entries;
}

function parseWodifyData(data) {
  const headers = data[0] || [];
  const dateColumnIndex = findExactColumn(headers, ["Date"]);
  const setsColumnIndex = findExactColumn(headers, ["Sets"]);
  const repsColumnIndex = findExactColumn(headers, ["Reps"]);
  const weightColumnIndex = findExactColumn(headers, ["Weight"]);
  const unitColumnIndex = findExactColumn(headers, ["UOMLabel", "Label"]);
  const movementColumnIndex = getMovementColumnIndex(headers);
  const resultColumnIndex = findExactColumn(headers, [
    "Fully Formatted Result",
    "Formatted Result",
    "Result",
  ]);
  const notesColumnIndex = findExactColumn(headers, [
    "Notes",
    "Comment",
    "Full Comment",
  ]);
  const prDescriptionColumnIndex = findExactColumn(headers, [
    "Text",
    "Personal Record Description",
  ]);
  const descriptionColumnIndex = findExactColumn(headers, [
    "Description",
    "Component Description",
  ]);
  const performanceTypeColumnIndex = findExactColumn(headers, [
    "Performance Result Type Label",
    "Performance Result Type",
    "Result Type Label",
  ]);

  const parsedData = [];
  const skippedByReason = {};

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0 || row.every((cell) => cell === "")) continue;

    // A total is a sum Wodify worked out across lifts, not a set anyone
    // lifted, so it is neither imported nor counted.
    const performanceType = String(row[performanceTypeColumnIndex] || "")
      .trim()
      .toLowerCase();
    if (performanceType && performanceType.includes("total")) continue;

    const date = normalizeDateInput(row[dateColumnIndex], "en-US");
    const rawLiftType = String(row[movementColumnIndex] || "").trim();
    const liftType = rawLiftType ? normalizeLiftTypeNames(rawLiftType) : null;
    const notes = buildNotes(
      row[notesColumnIndex],
      row[prDescriptionColumnIndex],
      row[descriptionColumnIndex],
    );

    const unitTypeFromColumn = parseUnit(row[unitColumnIndex]);
    const sets = parseLeadingInteger(row[setsColumnIndex]);
    const reps = parseLeadingInteger(row[repsColumnIndex]);
    const weight = parseLeadingNumber(row[weightColumnIndex]);
    const rawNotes = String(row[notesColumnIndex] || "").trim();

    // The numeric columns first, then the result text. Whichever is complete
    // gives the main sets; when neither is, the one that offered anything is
    // still what the skip reason is read from.
    const fromColumns = { sets, reps, weight, unitType: unitTypeFromColumn };
    const fromResult = parseResultString(
      row[resultColumnIndex],
      unitTypeFromColumn,
    );
    const mainSets = isCompleteResult(liftType, fromColumns)
      ? fromColumns
      : isCompleteResult(liftType, fromResult)
        ? fromResult
        : null;
    const mainUnitType = mainSets?.unitType ?? unitTypeFromColumn;

    // Reps and a load can still fail to make sets, for want of a set count
    // or of a unit for the load.
    const candidate = mainSets ?? fromResult ?? fromColumns;
    const skipReason =
      getSetSkipReason({
        date,
        liftType,
        reps: candidate.reps,
        weight: candidate.weight,
        // A metcon is scored by the clock, not in sets of a lift.
        isDurationOrDistance: isDistanceOrTimeText(
          row[resultColumnIndex] ?? "",
        ),
      }) ??
      (mainSets ? null : candidate.unitType ? "missingReps" : "missingWeight");
    if (skipReason) {
      countSkip(
        skippedByReason,
        skipReason,
        candidate.sets > 0 ? candidate.sets : 1,
      );
      continue;
    }

    // Parse warmup/buildup sets from the Notes column (added before top set)
    const warmups = parseWarmupNotes(
      rawNotes,
      mainUnitType,
      mainSets.reps,
      liftType,
    );
    for (const warmup of warmups) {
      parsedData.push({
        date,
        liftType,
        rawLiftType,
        reps: warmup.reps,
        weight: warmup.weight,
        unitType: warmup.unitType || mainUnitType,
        notes: buildNotes("Warmup (from Wodify notes)", rawNotes),
      });
    }

    // Add the main (top) set entries last
    parsedData.push(
      ...createSetEntries({
        date,
        liftType,
        rawLiftType,
        sets: mainSets.sets,
        reps: mainSets.reps,
        weight: mainSets.weight,
        unitType: mainSets.unitType,
        notes,
      }),
    );
  }

  return { entries: parsedData, skippedByReason };
}
