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

// Strong writes its headings in the app's language, so each column has a
// heading per language a real export has shown us. Add a language here from a
// real file, never a guess. The weight, distance and seconds headings can
// carry a unit, "Weight (kg)", so those match from the front.
const STRONG_HEADINGS = {
  date: ["date"],
  workoutName: ["workout name", "nom de l'entraînement"],
  exerciseName: ["exercise name", "nom de l'exercice"],
  setOrder: ["set order", "ordre de la série"],
  weight: ["weight", "poids"],
  reps: ["reps", "réps"],
  distance: ["distance"],
  seconds: ["seconds", "secondes"],
  notes: ["notes"],
  workoutNotes: ["workout notes"],
  rpe: ["rpe"],
};
const PREFIX_HEADINGS = new Set(["weight", "distance", "seconds"]);

// A set's order is its number, or a letter for its kind, in the app's
// language: É is the French échec. Each kind is still a set, so it is kept,
// and noted the way Hevy notes it. A failure single can be a lifter's best.
const STRONG_SET_TYPES = {
  W: "warmup",
  D: "dropset",
  F: "failure",
  É: "failure",
};

// Index of a Strong column in this header row, or -1.
function findStrongColumn(headers, key) {
  const names = STRONG_HEADINGS[key];
  const matchesFront = PREFIX_HEADINGS.has(key);
  return headers.findIndex((header) => {
    // Typographic apostrophes and decomposed accents read the same as typed.
    const normalized = String(header || "")
      .normalize("NFC")
      .replace(/\u2019/g, "'")
      .trim()
      .toLowerCase();
    return names.some((name) =>
      matchesFront ? normalized.startsWith(name) : normalized === name,
    );
  });
}

function isStrongExport(headers) {
  return ["date", "workoutName", "exerciseName", "weight", "reps"].every(
    (key) => findStrongColumn(headers, key) >= 0,
  );
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
  const dateColumnIndex = findStrongColumn(headers, "date");
  const workoutNameColumnIndex = findStrongColumn(headers, "workoutName");
  const exerciseNameColumnIndex = findStrongColumn(headers, "exerciseName");
  const setOrderColumnIndex = findStrongColumn(headers, "setOrder");
  const weightColumnIndex = findStrongColumn(headers, "weight");
  const weightHeader = headers[weightColumnIndex];
  const repsColumnIndex = findStrongColumn(headers, "reps");
  const distanceColumnIndex = findStrongColumn(headers, "distance");
  const secondsColumnIndex = findStrongColumn(headers, "seconds");
  const notesColumnIndex = findStrongColumn(headers, "notes");
  const workoutNotesColumnIndex = findStrongColumn(headers, "workoutNotes");
  const rpeColumnIndex = findStrongColumn(headers, "rpe");

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
    const setType = STRONG_SET_TYPES[setOrder.toUpperCase()];

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
        setType ? `Set type: ${setType}` : null,
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
