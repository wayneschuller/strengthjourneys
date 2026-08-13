// Parse legacy and current StrongLifts workout-history CSV exports.
// StrongLifts changed from workout-wide rows to one exercise per row, so both
// layouts remain supported to avoid stranding older training histories.

import { recordTiming } from "@/lib/processing-utils";
import {
  isValidLiftWeight,
  normalizeLiftTypeNames,
} from "@/lib/data-sources/parser-utilities";

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

function parseNumber(value) {
  const parsed = Number.parseFloat(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function parseInteger(value) {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

// Accept both the MM/DD/YY legacy date and the yyyy/MM/dd current date.
function normalizeStrongliftsDate(dateString) {
  const raw = String(dateString || "").trim();
  if (!raw) return null;

  const match = raw.match(/^(\d{1,4})[/-](\d{1,2})[/-](\d{1,4})$/);
  if (!match) return null;

  const yearFirst = match[1].length === 4;
  let year = Number.parseInt(yearFirst ? match[1] : match[3], 10);
  const month = Number.parseInt(yearFirst ? match[2] : match[1], 10);
  const day = Number.parseInt(yearFirst ? match[3] : match[2], 10);

  if (!month || !day || !year) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  if (year < 100) {
    year += year < 71 ? 2000 : 1900;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function normalizeHeader(header) {
  return String(header || "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase();
}

function findHeaderIndex(headers, candidates) {
  const normalizedCandidates = new Set(candidates.map(normalizeHeader));
  return headers.findIndex((header) =>
    normalizedCandidates.has(normalizeHeader(header)),
  );
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

// Current exports repeat a reps/weight pair for every performed set. Match by
// set number rather than position so added summary columns do not affect import.
function buildCurrentSetBlocks(headers) {
  const blocks = new Map();

  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
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

export function isStrongliftsExport(headers) {
  const normalized = headers.map(normalizeHeader);
  const hasLegacyLayout =
    normalized.includes("date") &&
    normalized.some(
      (header) =>
        header === "body weight (kg)" || header === "body weight (lb)",
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

function parseCurrentStrongliftsData(data, headers) {
  const dateColumnIndex = headers.findIndex((header) => {
    const normalized = normalizeHeader(header);
    return normalized === "date" || normalized.startsWith("date (");
  });
  const exerciseColumnIndex = findHeaderIndex(headers, ["Exercise"]);
  const notesColumnIndex = findHeaderIndex(headers, ["Note", "Notes"]);
  const setBlocks = buildCurrentSetBlocks(headers);
  const parsedData = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const date = normalizeStrongliftsDate(row[dateColumnIndex]);
    const rawExerciseName = String(row[exerciseColumnIndex] || "").trim();
    const liftType = normalizeStrongliftsLiftType(rawExerciseName);
    if (!date || !liftType) continue;

    const notes =
      notesColumnIndex >= 0
        ? String(row[notesColumnIndex] || "").trim() || undefined
        : undefined;

    for (const block of setBlocks) {
      const reps = parseInteger(row[block.repsIndex]);
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

      if (!reps || reps <= 0 || !isValidLiftWeight(liftType, weight)) continue;

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

function parseLegacyStrongliftsData(data, headers) {
  const dateColumnIndex = findHeaderIndex(headers, ["Date"]);
  const noteColumnIndex = findHeaderIndex(headers, ["Note", "Notes"]);
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

  return parsedData;
}

export function parseStrongliftsData(data) {
  const startTime = performance.now();
  const headers = data[0] || [];
  const hasCurrentLayout =
    findHeaderIndex(headers, ["Exercise"]) >= 0 &&
    buildCurrentSetBlocks(headers).length > 0;
  const parsedData = hasCurrentLayout
    ? parseCurrentStrongliftsData(data, headers)
    : parseLegacyStrongliftsData(data, headers);

  parsedData.sort((a, b) => a.date.localeCompare(b.date));

  recordTiming(
    "Parse StrongLifts",
    performance.now() - startTime,
    `${parsedData.length} lifts`,
  );

  return parsedData;
}
