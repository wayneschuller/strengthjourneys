// Legacy and current StrongLifts 5x5 workout-history CSV exports. Not the
// Strong app, which has its own parser.
// StrongLifts changed from workout-wide rows to one exercise per row, so both
// layouts remain supported to avoid stranding older training histories.
// Follows the parser contract in import-dispatcher.js.
//
// One row holds several sets in both layouts, so what is counted as left out
// is a set, not a row: each cell where reps were written down that could not
// become an entry. A set column left blank was never a set.

import { requireImportSource } from "@/lib/import/import-sources";
import {
  countSkip,
  findColumn,
  getSetSkipReason,
  isValidLiftWeight,
  normalizeExportLiftType,
  normalizeHeaderCell,
  parseLeadingInteger,
  parseLeadingNumber,
} from "@/lib/import/parsers/parser-utilities";

// Legacy exports use a "wide" row per workout. Header shape from a 2018 export:
//
//   Date, Note, Body Weight (KG), Body Weight (LB),
//   Exercise 1, Weight (KG), Weight (LB), Set 1, Set 2, Set 3, Set 4, Set 5,
//   Exercise 2, Weight (KG), Weight (LB), Set 1, Set 2, Set 3, Set 4, Set 5,
//   ... (up to Exercise 5)
//
// Each "Set N" column holds the rep count for that set (not the weight). The
// weight for the exercise is in the single Weight (KG)/Weight (LB) column
// preceding the set columns; only the column matching the user's active unit
// is populated, the other is blank. Dates are MM/DD/YY (US format).
//
// Current exports use one row per exercise and pair columns such as
// `Set 1 (Reps)` with `Set 1 (KG)`. Both layouts are pivoted into LiftEntry rows.

export const strongliftsFormat = {
  ...requireImportSource("stronglifts"),
  detect: isStrongliftsExport,
  parse: parseStrongliftsData,
};

// Accept the MM/DD/YY legacy date, the same legacy shape written DD/MM/YYYY
// outside the US, and the yyyy/MM/dd current date. The caller settles the
// day/month order for the whole file first, see detectDayFirstDates.
function normalizeStrongliftsDate(dateString, dayFirst = false) {
  const raw = String(dateString || "").trim();
  if (!raw) return null;

  const match = raw.match(/^(\d{1,4})[/-](\d{1,2})[/-](\d{1,4})$/);
  if (!match) return null;

  const yearFirst = match[1].length === 4;
  let year = Number.parseInt(yearFirst ? match[1] : match[3], 10);
  let month;
  let day;
  if (yearFirst) {
    month = Number.parseInt(match[2], 10);
    day = Number.parseInt(match[3], 10);
  } else if (dayFirst) {
    day = Number.parseInt(match[1], 10);
    month = Number.parseInt(match[2], 10);
  } else {
    month = Number.parseInt(match[1], 10);
    day = Number.parseInt(match[2], 10);
  }

  if (!month || !day || !year) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  if (year < 100) {
    year += year < 71 ? 2000 : 1900;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// A legacy export carries no locale, so the day/month order has to come from
// the column itself. A component above 12 can only be a day, which settles the
// whole file. Read as US order otherwise, which is what the legacy format
// documents, and also when a column contradicts itself.
function detectDayFirstDates(data, dateColumnIndex) {
  if (dateColumnIndex < 0) return false;

  let firstAboveTwelve = false;
  let secondAboveTwelve = false;

  for (let i = 1; i < data.length; i++) {
    const raw = String(data[i]?.[dateColumnIndex] || "").trim();
    const match = raw.match(/^(\d{1,4})[/-](\d{1,2})[/-](\d{1,4})$/);
    if (!match || match[1].length === 4) continue;

    if (Number.parseInt(match[1], 10) > 12) firstAboveTwelve = true;
    if (Number.parseInt(match[2], 10) > 12) secondAboveTwelve = true;
  }

  return firstAboveTwelve && !secondAboveTwelve;
}

// Walk the header row and collect the column layout for each exercise block.
// Returns an array of blocks describing where to find each exercise's name,
// weight, and set columns. Tolerant of formats with more or fewer than 5
// exercises by scanning all "Exercise N" headers.
function buildExerciseBlocks(headers) {
  const blocks = [];

  headers.forEach((header, index) => {
    if (!/^Exercise\s+\d+$/i.test(String(header || "").trim())) return;

    const block = {
      exerciseIndex: index,
      weightKgIndex: -1,
      weightLbIndex: -1,
      setIndices: [],
    };

    for (let j = index + 1; j < headers.length; j++) {
      const nextHeader = String(headers[j] || "").trim();
      if (/^Exercise\s+\d+$/i.test(nextHeader)) break;

      const lower = nextHeader.toLowerCase();
      if (lower.startsWith("weight") && lower.includes("kg")) {
        block.weightKgIndex = j;
      } else if (lower.startsWith("weight") && lower.includes("lb")) {
        block.weightLbIndex = j;
      } else if (/^set\s+\d+$/i.test(nextHeader)) {
        block.setIndices.push(j);
      }
    }

    if (block.setIndices.length > 0) blocks.push(block);
  });

  return blocks;
}

// Current exports repeat a reps/weight pair for every performed set. Match by
// set number rather than position so added summary columns do not affect import.
function buildCurrentSetBlocks(headers) {
  const blocks = new Map();

  headers.forEach((header, index) => {
    const normalized = normalizeHeaderCell(header);
    const setMatch = normalized.match(/^set\s+(\d+)\s*(?:\(([^)]+)\)|(.*))$/);
    if (!setMatch) return;

    const setNumber = Number.parseInt(setMatch[1], 10);
    const qualifier = `${setMatch[2] || ""} ${setMatch[3] || ""}`.trim();
    const block = blocks.get(setNumber) || {
      repsIndex: -1,
      weightKgIndex: -1,
      weightLbIndex: -1,
    };

    if (/\breps?\b/.test(qualifier)) {
      block.repsIndex = index;
    } else if (/\bkg\b|kilograms?/.test(qualifier)) {
      block.weightKgIndex = index;
    } else if (/\blbs?\b|pounds?/.test(qualifier)) {
      block.weightLbIndex = index;
    }

    blocks.set(setNumber, block);
  });

  return [...blocks.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, block]) => block)
    .filter(
      (block) =>
        block.repsIndex >= 0 &&
        (block.weightKgIndex >= 0 || block.weightLbIndex >= 0),
    );
}

function isStrongliftsExport(headers) {
  const normalized = headers.map(normalizeHeaderCell);
  const hasLegacyLayout =
    normalized.includes("date") &&
    normalized.some(
      (header) =>
        header === "body weight" ||
        header === "body weight (kg)" ||
        header === "body weight (lb)",
    ) &&
    normalized.some((header) => /^exercise\s+\d+$/.test(header)) &&
    normalized.some((header) => /^set\s+\d+$/.test(header));

  const hasCurrentLayout =
    normalized.some(
      (header) => header === "date" || header.startsWith("date ("),
    ) &&
    normalized.includes("exercise") &&
    buildCurrentSetBlocks(headers).length > 0;

  return hasLegacyLayout || hasCurrentLayout;
}

// Each exercise carries its load twice, in kilograms and in pounds, with only
// the lifter's own unit filled in. Take the one that holds a usable load.
// When neither does, hand back whatever was written so the skip reason can
// tell an empty cell from a zero.
function pickWeight(row, block, liftType) {
  const weightKg =
    block.weightKgIndex >= 0
      ? parseLeadingNumber(row[block.weightKgIndex])
      : null;
  const weightLb =
    block.weightLbIndex >= 0
      ? parseLeadingNumber(row[block.weightLbIndex])
      : null;

  if (isValidLiftWeight(liftType, weightKg)) {
    return { weight: weightKg, unitType: "kg" };
  }
  if (isValidLiftWeight(liftType, weightLb)) {
    return { weight: weightLb, unitType: "lb" };
  }
  return { weight: weightKg ?? weightLb, unitType: null };
}

function isBlankCell(value) {
  return String(value ?? "").trim() === "";
}

function parseCurrentStrongliftsData(data, headers, skippedByReason) {
  const dateColumnIndex = headers.findIndex((header) => {
    const normalized = normalizeHeaderCell(header);
    return normalized === "date" || normalized.startsWith("date (");
  });
  const exerciseColumnIndex = findColumn(headers, "Exercise");
  const notesColumnIndex = findColumn(headers, "Note", "Notes");
  const setBlocks = buildCurrentSetBlocks(headers);
  const dayFirst = detectDayFirstDates(data, dateColumnIndex);
  const parsedData = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const date = normalizeStrongliftsDate(row[dateColumnIndex], dayFirst);
    const rawExerciseName = String(row[exerciseColumnIndex] || "").trim();
    const liftType = normalizeExportLiftType(rawExerciseName);

    const notes =
      notesColumnIndex >= 0
        ? String(row[notesColumnIndex] || "").trim() || undefined
        : undefined;

    for (const block of setBlocks) {
      if (isBlankCell(row[block.repsIndex])) continue;

      const reps = parseLeadingInteger(row[block.repsIndex]);
      const { weight, unitType } = pickWeight(row, block, liftType);

      const skipReason = getSetSkipReason({ date, liftType, reps, weight });
      if (skipReason) {
        countSkip(skippedByReason, skipReason);
        continue;
      }

      parsedData.push({
        date,
        liftType,
        rawLiftType: rawExerciseName,
        reps,
        weight,
        unitType,
        notes,
      });
    }
  }

  return parsedData;
}

function parseLegacyStrongliftsData(data, headers, skippedByReason) {
  const dateColumnIndex = findColumn(headers, "Date");
  const noteColumnIndex = findColumn(headers, "Note", "Notes");
  const blocks = buildExerciseBlocks(headers);
  const dayFirst = detectDayFirstDates(data, dateColumnIndex);
  const parsedData = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const date = normalizeStrongliftsDate(row[dateColumnIndex], dayFirst);

    const workoutNote =
      noteColumnIndex >= 0
        ? String(row[noteColumnIndex] || "").trim() || undefined
        : undefined;

    for (const block of blocks) {
      // A workout with fewer exercises leaves its later blocks empty.
      const rawExerciseName = String(row[block.exerciseIndex] || "").trim();
      if (!rawExerciseName) continue;

      const liftType = normalizeExportLiftType(rawExerciseName);
      const { weight, unitType } = pickWeight(row, block, liftType);

      for (const setIndex of block.setIndices) {
        if (isBlankCell(row[setIndex])) continue;

        const reps = parseLeadingInteger(row[setIndex]);
        const skipReason = getSetSkipReason({ date, liftType, reps, weight });
        if (skipReason) {
          countSkip(skippedByReason, skipReason);
          continue;
        }

        parsedData.push({
          date,
          liftType,
          rawLiftType: rawExerciseName,
          reps,
          weight,
          unitType,
          notes: workoutNote,
        });
      }
    }
  }

  return parsedData;
}

function parseStrongliftsData(data) {
  const headers = data[0] || [];
  const hasCurrentLayout =
    findColumn(headers, "Exercise") >= 0 &&
    buildCurrentSetBlocks(headers).length > 0;
  const skippedByReason = {};
  const parsedData = hasCurrentLayout
    ? parseCurrentStrongliftsData(data, headers, skippedByReason)
    : parseLegacyStrongliftsData(data, headers, skippedByReason);

  return { entries: parsedData, skippedByReason };
}
