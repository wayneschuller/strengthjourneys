// Strong CSV exports.
//
// Public samples show one row per set with `Date`, `Exercise Name`, `Weight`,
// and `Reps`. Strong exports do not expose units in the CSV, so we infer the
// most likely unit from common barbell warm-up/loading patterns and default to
// pounds if the file is ambiguous. Not the StrongLifts 5x5 app, which has its
// own parser. Follows the parser contract in import-dispatcher.js.
//
// Besides sets, the file holds cardio and timed work (no reps, a distance or
// a number of seconds) and, in newer exports, the rest between sets as a row
// of its own. The first is counted as left out. The second was never a set.

import { requireImportSource } from "@/lib/import/import-sources";
import {
  buildNotes,
  countSkip,
  findExactColumn,
  getSetSkipReason,
  normalizeExportLiftType,
  parseLeadingInteger,
  parseLeadingNumber,
} from "@/lib/import/parsers/parser-utilities";

export const strongFormat = {
  ...requireImportSource("strong"),
  detect: isStrongExport,
  parse: parseStrongData,
};

function isStrongExport(headers) {
  const lower = headers.map((header) =>
    String(header || "")
      .toLowerCase()
      .trim(),
  );
  return (
    lower.includes("date") &&
    lower.includes("workout name") &&
    lower.includes("exercise name") &&
    lower.some((header) => header.startsWith("weight")) &&
    lower.includes("reps")
  );
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

function normalizeStrongDate(dateTimeString) {
  const match = String(dateTimeString || "")
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
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

function inferStrongUnitType(data, weightColumnIndex, exerciseNameColumnIndex) {
  let kgScore = 0;
  let lbScore = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const weight = parseLeadingNumber(row[weightColumnIndex]);
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

function parseStrongData(data) {
  const headers = data[0] || [];
  const dateColumnIndex = findExactColumn(headers, ["Date"]);
  const workoutNameColumnIndex = findExactColumn(headers, ["Workout Name"]);
  const exerciseNameColumnIndex = findExactColumn(headers, ["Exercise Name"]);
  const setOrderColumnIndex = findExactColumn(headers, ["Set Order"]);
  const weightHeader = findHeaderByPrefix(headers, ["Weight"]);
  const weightColumnIndex = weightHeader ? headers.indexOf(weightHeader) : -1;
  const repsColumnIndex = findExactColumn(headers, ["Reps"]);
  const distanceColumnIndex = headers.indexOf(
    findHeaderByPrefix(headers, ["Distance"]),
  );
  const secondsColumnIndex = headers.indexOf(
    findHeaderByPrefix(headers, ["Seconds"]),
  );
  const notesColumnIndex = findExactColumn(headers, ["Notes"]);
  const workoutNotesColumnIndex = findExactColumn(headers, ["Workout Notes"]);
  const rpeColumnIndex = findExactColumn(headers, ["RPE"]);

  const unitType =
    extractUnitFromHeader(weightHeader) ||
    inferStrongUnitType(data, weightColumnIndex, exerciseNameColumnIndex);
  const parsedData = [];
  const skippedByReason = {};
  const acceptedWorkouts = new Set();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0 || row.every((cell) => cell === "")) continue;

    // The rest between two sets, not a set: neither imported nor counted.
    const setOrder = String(row[setOrderColumnIndex] ?? "").trim();
    if (/^rest timer$/i.test(setOrder)) continue;

    const date = normalizeStrongDate(row[dateColumnIndex]);
    const liftType = normalizeExportLiftType(row[exerciseNameColumnIndex]);
    const reps = parseLeadingInteger(row[repsColumnIndex]);
    const weight = parseLeadingNumber(row[weightColumnIndex]);

    const skipReason = getSetSkipReason({
      date,
      liftType,
      reps,
      weight,
      isDurationOrDistance:
        parseLeadingNumber(row[distanceColumnIndex]) > 0 ||
        parseLeadingNumber(row[secondsColumnIndex]) > 0,
    });
    if (skipReason) {
      countSkip(skippedByReason, skipReason);
      continue;
    }

    // Every set of a workout repeats its start time and its name.
    acceptedWorkouts.add(
      `${String(row[dateColumnIndex] || "").trim()}|${String(row[workoutNameColumnIndex] || "").trim()}`,
    );

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

  return {
    entries: parsedData,
    skippedByReason,
    workoutCount: acceptedWorkouts.size,
    unitType,
  };
}
