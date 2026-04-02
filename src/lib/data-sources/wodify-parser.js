import { normalizeDateInput } from "@/lib/date-utils";
import { recordTiming } from "@/lib/processing-utils";
import { normalizeLiftTypeNames } from "@/lib/data-sources/parser-utilities";

function getColumnIndex(headers, candidates) {
  for (const candidate of candidates) {
    const index = headers.indexOf(candidate);
    if (index >= 0) return index;
  }
  return -1;
}

function getMovementColumnIndex(headers) {
  const explicit = getColumnIndex(headers, [
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

function parseInteger(value) {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseNumber(value) {
  const parsed = Number.parseFloat(String(value || "").trim());
  return Number.isFinite(parsed) ? parsed : null;
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

function buildNotes(...parts) {
  const unique = [];
  parts.forEach((part) => {
    const trimmed = String(part || "").trim();
    if (!trimmed) return;
    if (!unique.includes(trimmed)) unique.push(trimmed);
  });
  return unique.length > 0 ? unique.join(" | ") : undefined;
}

function parseResultString(resultText, fallbackUnitType) {
  const normalized = String(resultText || "").trim();
  if (!normalized) return null;

  const standardMatch = normalized.match(
    /(\d+)\s*x\s*(\d+)\s*@\s*([\d.]+)(?:\s*(kg|lb|lbs))?/i,
  );
  if (standardMatch) {
    const sets = parseInteger(standardMatch[1]);
    const reps = parseInteger(standardMatch[2]);
    const weight = parseNumber(standardMatch[3]);
    const unitType = parseUnit(standardMatch[4]) || fallbackUnitType;
    if (sets && reps && weight && weight > 0 && unitType) {
      return { sets, reps, weight, unitType };
    }
  }

  return null;
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
function parseWarmupNotes(notesText, fallbackUnitType) {
  if (!notesText) return [];

  const text = String(notesText).trim();
  if (!text) return [];

  // Split on commas or the word "then" (with optional surrounding whitespace)
  const fragments = text.split(/,|\bthen\b/i).map((f) => f.trim()).filter(Boolean);

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
      const sets = parseInteger(setsRepsWeightMatch[1]) || 1;
      const reps = parseInteger(setsRepsWeightMatch[2]);
      const weight = parseNumber(setsRepsWeightMatch[3]);
      const unitType = parseUnit(setsRepsWeightMatch[4]) || fallbackUnitType;
      if (reps && weight && weight > 0) {
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
      const reps = parseInteger(repsWeightMatch[1]);
      const weight = parseNumber(repsWeightMatch[2]);
      const unitType = parseUnit(repsWeightMatch[3]) || fallbackUnitType;
      if (reps && weight && weight > 0) {
        results.push({ reps, weight, unitType });
        continue;
      }
    }

    // Pattern: bare weight  e.g. "70", "72.5"
    const bareWeightMatch = cleaned.match(/^([\d.]+)$/);
    if (bareWeightMatch) {
      const weight = parseNumber(bareWeightMatch[1]);
      if (weight && weight > 0) {
        results.push({ reps: 1, weight, unitType: fallbackUnitType });
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

// Parse Wodify performance exports.
//
// Supports both:
// - legacy numeric-column exports like the provided sample
// - public/help-center documented exports where the set/rep/load data is packed
//   into `Result` or `Fully Formatted Result`
export function parseWodifyData(data) {
  const startTime = performance.now();
  const headers = data[0] || [];
  const dateColumnIndex = getColumnIndex(headers, ["Date"]);
  const setsColumnIndex = getColumnIndex(headers, ["Sets"]);
  const repsColumnIndex = getColumnIndex(headers, ["Reps"]);
  const weightColumnIndex = getColumnIndex(headers, ["Weight"]);
  const unitColumnIndex = getColumnIndex(headers, ["UOMLabel", "Label"]);
  const movementColumnIndex = getMovementColumnIndex(headers);
  const resultColumnIndex = getColumnIndex(headers, [
    "Fully Formatted Result",
    "Formatted Result",
    "Result",
  ]);
  const notesColumnIndex = getColumnIndex(headers, [
    "Notes",
    "Comment",
    "Full Comment",
  ]);
  const prDescriptionColumnIndex = getColumnIndex(headers, [
    "Text",
    "Personal Record Description",
  ]);
  const descriptionColumnIndex = getColumnIndex(headers, [
    "Description",
    "Component Description",
  ]);
  const performanceTypeColumnIndex = getColumnIndex(headers, [
    "Performance Result Type Label",
    "Performance Result Type",
    "Result Type Label",
  ]);

  const parsedData = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const date = normalizeDateInput(row[dateColumnIndex], "en-US");
    if (!date) continue;

    const rawLiftType = String(row[movementColumnIndex] || "").trim();
    if (!rawLiftType) continue;

    const performanceType = String(row[performanceTypeColumnIndex] || "")
      .trim()
      .toLowerCase();
    if (performanceType && performanceType.includes("total")) continue;

    const liftType = normalizeLiftTypeNames(rawLiftType);
    const notes = buildNotes(
      row[notesColumnIndex],
      row[prDescriptionColumnIndex],
      row[descriptionColumnIndex],
    );

    const unitTypeFromColumn = parseUnit(row[unitColumnIndex]);
    const sets = parseInteger(row[setsColumnIndex]);
    const reps = parseInteger(row[repsColumnIndex]);
    const weight = parseNumber(row[weightColumnIndex]);
    const rawNotes = String(row[notesColumnIndex] || "").trim();

    let mainSets = null;
    let mainUnitType = unitTypeFromColumn;

    if (sets && reps && weight && weight > 0 && unitTypeFromColumn) {
      mainSets = { sets, reps, weight, unitType: unitTypeFromColumn };
    } else {
      const parsedResult = parseResultString(
        row[resultColumnIndex],
        unitTypeFromColumn,
      );
      if (parsedResult) {
        mainSets = parsedResult;
        mainUnitType = parsedResult.unitType;
      }
    }

    if (!mainSets) continue;

    // Add the main (top) set entries
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

    // Parse warmup/buildup sets from the Notes column
    const warmups = parseWarmupNotes(rawNotes, mainUnitType);
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
  }

  parsedData.sort((a, b) => a.date.localeCompare(b.date));

  recordTiming(
    "Parse Wodify",
    performance.now() - startTime,
    `${parsedData.length} lifts`,
  );

  return parsedData;
}
