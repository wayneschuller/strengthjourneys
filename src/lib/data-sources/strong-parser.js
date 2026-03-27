import { recordTiming } from "@/lib/processing-utils";
import { normalizeLiftTypeNames } from "./parser-utilities";

function getColumnIndex(headers, candidates) {
  for (const candidate of candidates) {
    const index = headers.indexOf(candidate);
    if (index >= 0) return index;
  }
  return -1;
}

function findHeaderByPrefix(headers, prefixes) {
  return headers.find((header) => {
    const normalized = String(header || "")
      .trim()
      .toLowerCase();
    return prefixes.some((prefix) =>
      normalized.startsWith(prefix.toLowerCase()),
    );
  });
}

function parseNumber(value) {
  const parsed = Number.parseFloat(String(value || "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function parseInteger(value) {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeStrongDate(dateTimeString) {
  const match = String(dateTimeString || "")
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function normalizeStrongLiftType(rawLiftType) {
  const cleaned = String(rawLiftType || "")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  return normalizeLiftTypeNames(cleaned);
}

function extractUnitFromHeader(header) {
  const normalized = String(header || "").toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("(kg") || /\bkg\b/.test(normalized)) return "kg";
  if (
    normalized.includes("(lb") ||
    normalized.includes("(lbs") ||
    /\blbs?\b/.test(normalized)
  ) {
    return "lb";
  }
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

function inferStrongUnitType(data, weightColumnIndex, exerciseNameColumnIndex) {
  let kgScore = 0;
  let lbScore = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const weight = parseNumber(row[weightColumnIndex]);
    if (!weight || weight <= 0) continue;

    const exerciseName = String(
      row[exerciseNameColumnIndex] || "",
    ).toLowerCase();

    if ([20, 60, 100, 140, 180].includes(weight)) kgScore += 2;
    if ([45, 95, 135, 185, 225, 315].includes(weight)) lbScore += 2;
    if (exerciseName.includes("barbell") && weight === 20) kgScore += 3;
    if (exerciseName.includes("barbell") && weight === 45) lbScore += 3;
  }

  return kgScore > lbScore ? "kg" : "lb";
}

// Parse Strong CSV exports.
//
// Public samples show one row per set with `Date`, `Exercise Name`, `Weight`,
// and `Reps`. Strong exports do not expose units in the CSV, so we infer the
// most likely unit from common barbell warm-up/loading patterns and default to
// pounds if the file is ambiguous.
export function parseStrongData(data) {
  const startTime = performance.now();
  const headers = data[0] || [];
  const dateColumnIndex = getColumnIndex(headers, ["Date"]);
  const exerciseNameColumnIndex = getColumnIndex(headers, ["Exercise Name"]);
  const weightHeader = findHeaderByPrefix(headers, ["Weight"]);
  const weightColumnIndex = weightHeader ? headers.indexOf(weightHeader) : -1;
  const repsColumnIndex = getColumnIndex(headers, ["Reps"]);
  const notesColumnIndex = getColumnIndex(headers, ["Notes"]);
  const workoutNotesColumnIndex = getColumnIndex(headers, ["Workout Notes"]);
  const rpeColumnIndex = getColumnIndex(headers, ["RPE"]);

  const unitType =
    extractUnitFromHeader(weightHeader) ||
    inferStrongUnitType(data, weightColumnIndex, exerciseNameColumnIndex);
  const parsedData = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const date = normalizeStrongDate(row[dateColumnIndex]);
    const liftType = normalizeStrongLiftType(row[exerciseNameColumnIndex]);
    const reps = parseInteger(row[repsColumnIndex]);
    const weight = parseNumber(row[weightColumnIndex]);

    if (!date || !liftType) continue;
    if (!reps || reps <= 0 || !weight || weight <= 0) continue;

    parsedData.push({
      date,
      liftType,
      rawLiftType:
        String(row[exerciseNameColumnIndex] || "").trim() || undefined,
      reps,
      weight,
      unitType,
      notes: buildNotes(
        row[notesColumnIndex],
        row[workoutNotesColumnIndex],
        row[rpeColumnIndex] ? `RPE ${row[rpeColumnIndex]}` : null,
      ),
    });
  }

  parsedData.sort((a, b) => a.date.localeCompare(b.date));

  recordTiming(
    "Parse Strong",
    performance.now() - startTime,
    `${parsedData.length} lifts`,
  );

  return parsedData;
}
