// Hevy workout CSV exports.
//
// Publicly documented and community-observed Hevy exports are one row per set
// and carry the load in either a metric (`weight_kg`) or an imperial
// (`weight_lbs`) column. Follows the parser contract in import-dispatcher.js.

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
import {
  buildHevySetProvenance,
  buildVisibleImportProvenance,
} from "@/lib/import/provenance";

export const hevyFormat = {
  ...requireImportSource("hevy"),
  detect: isHevyExport,
  parse: parseHevyData,
};

function isHevyExport(headers) {
  const normalized = headers.map(normalizeHeaderCell);
  return (
    normalized.includes("start_time") &&
    normalized.includes("exercise_title") &&
    (normalized.includes("weight_kg") ||
      normalized.includes("weight_lbs") ||
      normalized.includes("weight_lb")) &&
    normalized.includes("reps")
  );
}

const HEVY_MONTHS = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function normalizeHevyDate(dateTimeString) {
  const raw = String(dateTimeString || "").trim();
  if (!raw) return null;

  const monthNameMatch = raw.match(
    /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2,4}),(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/,
  );
  if (monthNameMatch) {
    const day = Number.parseInt(monthNameMatch[1], 10);
    const month = HEVY_MONTHS[monthNameMatch[2].toLowerCase()];
    let year = Number.parseInt(monthNameMatch[3], 10);

    if (year < 100) {
      year += year < 71 ? 2000 : 1900;
    }

    if (isValidCalendarDate(year, month, day)) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
    return null;
  }

  const isoLikeMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoLikeMatch) {
    const year = Number(isoLikeMatch[1]);
    const month = Number(isoLikeMatch[2]);
    const day = Number(isoLikeMatch[3]);
    return isValidCalendarDate(year, month, day)
      ? `${isoLikeMatch[1]}-${isoLikeMatch[2]}-${isoLikeMatch[3]}`
      : null;
  }

  // Unknown formats are reported to the user instead of relying on the
  // browser's locale- and timezone-dependent Date parser.
  return null;
}

function getHevyTime(dateTimeString) {
  const raw = String(dateTimeString || "").trim();
  const monthNameTime = raw.match(/,\s*(\d{1,2}):(\d{2})(?::\d{2})?$/);
  const isoTime = raw.match(/[T\s](\d{2}):(\d{2})(?::\d{2})?/);
  const match = monthNameTime || isoTime;
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function buildHevyNotes({
  time,
  exerciseNotes,
  workoutDescription,
  setType,
  rpe,
  workoutTitle,
  setIndex,
  importProvenance,
}) {
  const details = buildNotes(
    exerciseNotes,
    workoutDescription,
    setType && setType.toLowerCase() !== "normal"
      ? `Set type: ${setType}`
      : null,
    rpe !== "" && rpe != null ? `RPE ${rpe}` : null,
    buildHevySetProvenance(workoutTitle, setIndex),
    importProvenance,
  );

  if (!time) return details;
  return details ? `${time} ${details}` : time;
}

function parseHevyData(data, { importedAt = new Date() } = {}) {
  const headers = data[0] || [];
  const startTimeColumnIndex = findColumn(headers, "start_time");
  const exerciseTitleColumnIndex = findColumn(headers, "exercise_title");
  const weightKgColumnIndex = findColumn(headers, "weight_kg");
  const weightLbColumnIndex = findColumn(headers, "weight_lbs", "weight_lb");
  const weightColumnIndex =
    weightKgColumnIndex >= 0 ? weightKgColumnIndex : weightLbColumnIndex;
  const unitType = weightKgColumnIndex >= 0 ? "kg" : "lb";
  const repsColumnIndex = findColumn(headers, "reps");
  const workoutTitleColumnIndex = findColumn(headers, "title");
  const workoutDescriptionColumnIndex = findColumn(headers, "description");
  const exerciseNotesColumnIndex = findColumn(headers, "exercise_notes");
  const setIndexColumnIndex = findColumn(headers, "set_index");
  const setTypeColumnIndex = findColumn(headers, "set_type");
  const rpeColumnIndex = findColumn(headers, "rpe");
  const distanceColumnIndex = findColumn(
    headers,
    "distance_km",
    "distance_miles",
    "distance_meters",
  );
  const durationColumnIndex = findColumn(headers, "duration_seconds");

  const parsedData = [];
  const skippedByReason = {};
  const acceptedWorkouts = new Set();
  const anchoredWorkouts = new Set();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0 || row.every((cell) => cell === "")) continue;

    const rawStartTime = row[startTimeColumnIndex];
    const date = normalizeHevyDate(rawStartTime);
    const time = getHevyTime(rawStartTime);
    const liftType = normalizeExportLiftType(row[exerciseTitleColumnIndex]);
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
      isDurationOrDistance:
        parseStrictNumber(row[durationColumnIndex]) != null ||
        parseStrictNumber(row[distanceColumnIndex]) != null,
    });
    if (skipReason) {
      countSkip(skippedByReason, skipReason);
      continue;
    }

    const workoutTitle = String(
      row[workoutTitleColumnIndex] || "Workout",
    ).trim();
    const workoutKey = `${String(rawStartTime || "").trim()}|${workoutTitle}`;
    const isWorkoutAnchor = !anchoredWorkouts.has(workoutKey);
    const importProvenance = isWorkoutAnchor
      ? buildVisibleImportProvenance(hevyFormat.name, importedAt)
      : null;
    anchoredWorkouts.add(workoutKey);
    acceptedWorkouts.add(workoutKey);

    parsedData.push({
      date,
      liftType,
      rawLiftType:
        String(row[exerciseTitleColumnIndex] || "").trim() || undefined,
      reps,
      weight,
      unitType,
      notes: buildHevyNotes({
        time,
        exerciseNotes: row[exerciseNotesColumnIndex],
        workoutDescription: row[workoutDescriptionColumnIndex],
        setType: String(row[setTypeColumnIndex] || "").trim(),
        rpe: row[rpeColumnIndex],
        workoutTitle,
        setIndex: parseStrictInteger(row[setIndexColumnIndex]),
        importProvenance,
      }),
    });
  }

  return {
    entries: parsedData,
    skippedByReason,
    workoutCount: acceptedWorkouts.size,
    unitType,
  };
}
