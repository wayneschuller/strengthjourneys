import { recordTiming } from "@/lib/processing-utils";
import {
  isValidLiftWeight,
  normalizeLiftTypeNames,
} from "@/lib/data-sources/parser-utilities";

// Parse StrongLifts 5x5 app CSV exports.
//
// The StrongLifts 5x5 app (distinct from the Strong app) emits a "wide" CSV
// with one row per workout. Header shape (sample from a real 2018 export):
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
// We pivot wide → long: each non-empty (exercise, set) pair becomes one
// LiftEntry. Empty exercises and empty sets are skipped.

function parseNumber(value) {
  const parsed = Number.parseFloat(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function parseInteger(value) {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

// Convert MM/DD/YY or MM/DD/YYYY to ISO YYYY-MM-DD.
// Two-digit years use the same pivot Hevy does: 00-70 → 20YY, 71-99 → 19YY.
function normalizeStrongliftsDate(dateString) {
  const raw = String(dateString || "").trim();
  if (!raw) return null;

  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!match) return null;

  const month = Number.parseInt(match[1], 10);
  const day = Number.parseInt(match[2], 10);
  let year = Number.parseInt(match[3], 10);

  if (!month || !day || !year) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  if (year < 100) {
    year += year < 71 ? 2000 : 1900;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function normalizeStrongliftsLiftType(rawLiftType) {
  const cleaned = String(rawLiftType || "")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  return normalizeLiftTypeNames(cleaned);
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

export function parseStrongliftsData(data) {
  const startTime = performance.now();
  const headers = data[0] || [];

  const dateColumnIndex = headers.findIndex(
    (h) => String(h || "").trim().toLowerCase() === "date",
  );
  const noteColumnIndex = headers.findIndex(
    (h) => String(h || "").trim().toLowerCase() === "note",
  );

  const blocks = buildExerciseBlocks(headers);
  const parsedData = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const date = normalizeStrongliftsDate(row[dateColumnIndex]);
    if (!date) continue;

    const workoutNote =
      noteColumnIndex >= 0
        ? String(row[noteColumnIndex] || "").trim() || undefined
        : undefined;

    for (const block of blocks) {
      const rawExerciseName = String(row[block.exerciseIndex] || "").trim();
      if (!rawExerciseName) continue;

      const liftType = normalizeStrongliftsLiftType(rawExerciseName);
      if (!liftType) continue;

      const weightKg =
        block.weightKgIndex >= 0 ? parseNumber(row[block.weightKgIndex]) : null;
      const weightLb =
        block.weightLbIndex >= 0 ? parseNumber(row[block.weightLbIndex]) : null;

      let weight = null;
      let unitType = null;
      if (isValidLiftWeight(liftType, weightKg)) {
        weight = weightKg;
        unitType = "kg";
      } else if (isValidLiftWeight(liftType, weightLb)) {
        weight = weightLb;
        unitType = "lb";
      }

      if (!isValidLiftWeight(liftType, weight)) continue;

      for (const setIndex of block.setIndices) {
        const reps = parseInteger(row[setIndex]);
        if (!reps || reps <= 0) continue;

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

  parsedData.sort((a, b) => a.date.localeCompare(b.date));

  recordTiming(
    "Parse StrongLifts",
    performance.now() - startTime,
    `${parsedData.length} lifts`,
  );

  return parsedData;
}
