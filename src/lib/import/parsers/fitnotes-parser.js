// Parse FitNotes workout CSV exports.
//
// FitNotes (Settings → Export Data) writes one flat row per logged set:
// Date, Exercise, Category, Weight (kgs), Reps, Distance, Distance Unit, Time,
// Comment. The load column carries the lifter's unit in its own header, so a
// pounds export writes "Weight (lbs)" instead.
//
// Cardio and timed work arrives with a distance or a time and no reps, which
// has no place on a barbell timeline and is counted as skipped. Unweighted
// bodyweight work is written as a literal 0, so it imports only where the
// registry already knows the lift carries no load.
//
// Follows the parser contract in import-dispatcher.js.

import { requireImportSource } from "@/lib/import/import-sources";
import {
  buildNotes,
  countSkip,
  findColumn,
  getSetSkipReason,
  isBodyweightLoadLiftName,
  isValidCalendarDate,
  normalizeExportLiftType,
  normalizeHeaderCell,
  parseStrictInteger,
  parseStrictNumber,
} from "@/lib/import/parsers/parser-utilities";
import { buildVisibleImportProvenance } from "@/lib/import/provenance";

export const fitNotesFormat = {
  ...requireImportSource("fitnotes"),
  detect: isFitNotesExport,
  parse: parseFitNotesData,
};

// FitNotes writes an unambiguous yyyy-MM-dd, so there is no day/month order to
// settle here as there is for a StrongLifts export.
function normalizeFitNotesDate(dateString) {
  const match = String(dateString || "")
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return isValidCalendarDate(year, month, day)
    ? `${match[1]}-${match[2]}-${match[3]}`
    : null;
}

// The unit is only ever stated in the weight header, never in the cell.
function findWeightColumn(headers) {
  const index = headers.findIndex((header) =>
    normalizeHeaderCell(header).startsWith("weight"),
  );
  if (index < 0) return { index: -1, unitType: null };

  const header = normalizeHeaderCell(headers[index]);
  return { index, unitType: /\blbs?\b|pounds?/.test(header) ? "lb" : "kg" };
}

function isFitNotesExport(headers) {
  const normalized = headers.map(normalizeHeaderCell);
  return (
    normalized.includes("date") &&
    normalized.includes("exercise") &&
    normalized.includes("category") &&
    normalized.includes("reps") &&
    normalized.some((header) => header.startsWith("weight"))
  );
}

function parseFitNotesData(data, { importedAt = new Date() } = {}) {
  const headers = data[0] || [];
  const dateColumnIndex = findColumn(headers, "date");
  const exerciseColumnIndex = findColumn(headers, "exercise");
  const repsColumnIndex = findColumn(headers, "reps");
  const distanceColumnIndex = findColumn(headers, "distance");
  const timeColumnIndex = findColumn(headers, "time");
  const commentColumnIndex = findColumn(headers, "comment", "comments");
  const { index: weightColumnIndex, unitType } = findWeightColumn(headers);

  const parsedData = [];
  const skippedByReason = {};
  const acceptedWorkouts = new Set();
  const anchoredWorkouts = new Set();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0 || row.every((cell) => cell === "")) continue;

    const date = normalizeFitNotesDate(row[dateColumnIndex]);
    const liftType = normalizeExportLiftType(row[exerciseColumnIndex]);
    const reps = parseStrictInteger(row[repsColumnIndex]);
    const parsedWeight = parseStrictNumber(row[weightColumnIndex]);
    const weight =
      parsedWeight == null && isBodyweightLoadLiftName(liftType)
        ? 0
        : parsedWeight;

    const skipReason = getSetSkipReason({
      date,
      liftType,
      reps,
      weight,
      // A cardio row states a distance or a clock time rather than a number of
      // reps, and the clock time is not numeric, so both are read as text.
      isDurationOrDistance:
        String(row[distanceColumnIndex] ?? "").trim() !== "" ||
        String(row[timeColumnIndex] ?? "").trim() !== "",
    });
    if (skipReason) {
      countSkip(skippedByReason, skipReason);
      continue;
    }

    // FitNotes records a date but no session boundary or workout name, so
    // provenance is tagged once per calendar day rather than once per set.
    const isWorkoutAnchor = !anchoredWorkouts.has(date);
    const importProvenance = isWorkoutAnchor
      ? buildVisibleImportProvenance(fitNotesFormat.name, importedAt)
      : null;
    anchoredWorkouts.add(date);
    acceptedWorkouts.add(date);

    parsedData.push({
      date,
      liftType,
      rawLiftType: String(row[exerciseColumnIndex] || "").trim() || undefined,
      reps,
      weight,
      unitType,
      notes: buildNotes(row[commentColumnIndex], importProvenance),
    });
  }

  return {
    entries: parsedData,
    skippedByReason,
    workoutCount: acceptedWorkouts.size,
    unitType,
  };
}
