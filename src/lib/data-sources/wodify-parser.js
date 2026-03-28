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

    if (sets && reps && weight && weight > 0 && unitTypeFromColumn) {
      parsedData.push(
        ...createSetEntries({
          date,
          liftType,
          rawLiftType,
          sets,
          reps,
          weight,
          unitType: unitTypeFromColumn,
          notes,
        }),
      );
      continue;
    }

    const parsedResult = parseResultString(
      row[resultColumnIndex],
      unitTypeFromColumn,
    );
    if (!parsedResult) continue;

    parsedData.push(
      ...createSetEntries({
        date,
        liftType,
        rawLiftType,
        sets: parsedResult.sets,
        reps: parsedResult.reps,
        weight: parsedResult.weight,
        unitType: parsedResult.unitType,
        notes,
      }),
    );
  }

  parsedData.sort((a, b) => a.date.localeCompare(b.date));

  recordTiming(
    "Parse Wodify",
    performance.now() - startTime,
    `${parsedData.length} lifts`,
  );

  return parsedData;
}
