import { recordTiming } from "@/lib/processing-utils";
import {
  isBodyweightLoadLiftName,
  isValidLiftWeight,
  normalizeLiftTypeNames,
} from "@/lib/data-sources/parser-utilities";
import {
  buildHevySetProvenance,
  buildVisibleImportProvenance,
} from "@/lib/import/provenance";

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

function normalizeHeader(header) {
  return String(header || "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase();
}

function getColumnIndex(headers, ...names) {
  const normalizedHeaders = headers.map(normalizeHeader);
  return normalizedHeaders.findIndex((header) => names.includes(header));
}

function parseNumber(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseInteger(value) {
  const raw = String(value ?? "").trim();
  if (!/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function isValidCalendarDate(year, month, day) {
  if (!year || !month || !day) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

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

function normalizeHevyLiftType(rawLiftType) {
  const cleaned = String(rawLiftType || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;

  const explicitBarbellAliases = {
    "bench press (barbell)": "Bench Press",
    "deadlift (barbell)": "Deadlift",
    "overhead press (barbell)": "Strict Press",
    "military press (barbell)": "Strict Press",
    "squat (barbell)": "Back Squat",
  };
  const explicitAlias = explicitBarbellAliases[cleaned.toLowerCase()];
  if (explicitAlias) return explicitAlias;

  return normalizeLiftTypeNames(cleaned);
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

function incrementReason(reasons, reason) {
  reasons[reason] = (reasons[reason] || 0) + 1;
}

// Parse Hevy workout CSV exports.
//
// Publicly documented/community-observed Hevy exports are one row per set and
// expose either metric (`weight_kg`) or imperial (`weight_lbs`) load columns.
export function parseHevyData(data, { importedAt = new Date() } = {}) {
  const startTime = performance.now();
  const headers = data[0] || [];
  const startTimeColumnIndex = getColumnIndex(headers, "start_time");
  const exerciseTitleColumnIndex = getColumnIndex(headers, "exercise_title");
  const weightKgColumnIndex = getColumnIndex(headers, "weight_kg");
  const weightLbColumnIndex = getColumnIndex(
    headers,
    "weight_lbs",
    "weight_lb",
  );
  const weightColumnIndex =
    weightKgColumnIndex >= 0 ? weightKgColumnIndex : weightLbColumnIndex;
  const unitType = weightKgColumnIndex >= 0 ? "kg" : "lb";
  const repsColumnIndex = getColumnIndex(headers, "reps");
  const workoutTitleColumnIndex = getColumnIndex(headers, "title");
  const workoutDescriptionColumnIndex = getColumnIndex(headers, "description");
  const exerciseNotesColumnIndex = getColumnIndex(headers, "exercise_notes");
  const setIndexColumnIndex = getColumnIndex(headers, "set_index");
  const setTypeColumnIndex = getColumnIndex(headers, "set_type");
  const rpeColumnIndex = getColumnIndex(headers, "rpe");
  const distanceColumnIndex = getColumnIndex(
    headers,
    "distance_km",
    "distance_miles",
    "distance_meters",
  );
  const durationColumnIndex = getColumnIndex(headers, "duration_seconds");

  const parsedData = [];
  const skippedByReason = {};
  const acceptedWorkouts = new Set();
  const anchoredWorkouts = new Set();
  let sourceRows = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0 || row.every((cell) => cell === "")) continue;
    sourceRows++;

    const rawStartTime = row[startTimeColumnIndex];
    const date = normalizeHevyDate(rawStartTime);
    const time = getHevyTime(rawStartTime);
    const liftType = normalizeHevyLiftType(row[exerciseTitleColumnIndex]);
    const reps = parseInteger(row[repsColumnIndex]);
    const parsedWeight = parseNumber(row[weightColumnIndex]);
    const weight =
      parsedWeight == null && isBodyweightLoadLiftName(liftType)
        ? 0
        : parsedWeight;

    if (!date) {
      incrementReason(skippedByReason, "invalidDate");
      continue;
    }
    if (!liftType) {
      incrementReason(skippedByReason, "missingExercise");
      continue;
    }
    if (!reps || reps <= 0) {
      const hasDurationOrDistance =
        parseNumber(row[durationColumnIndex]) != null ||
        parseNumber(row[distanceColumnIndex]) != null;
      incrementReason(
        skippedByReason,
        hasDurationOrDistance ? "unsupportedDurationOrDistance" : "missingReps",
      );
      continue;
    }
    if (!isValidLiftWeight(liftType, weight)) {
      incrementReason(
        skippedByReason,
        parsedWeight == null ? "missingWeight" : "invalidWeight",
      );
      continue;
    }

    const workoutTitle = String(
      row[workoutTitleColumnIndex] || "Workout",
    ).trim();
    const workoutKey = `${String(rawStartTime || "").trim()}|${workoutTitle}`;
    const isWorkoutAnchor = !anchoredWorkouts.has(workoutKey);
    const importProvenance = isWorkoutAnchor
      ? buildVisibleImportProvenance("Hevy", importedAt)
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
        setIndex: parseInteger(row[setIndexColumnIndex]),
        importProvenance,
      }),
    });
  }

  parsedData.sort((a, b) => a.date.localeCompare(b.date));

  recordTiming(
    "Parse Hevy",
    performance.now() - startTime,
    `${parsedData.length} lifts`,
  );

  Object.defineProperty(parsedData, "importDiagnostics", {
    value: {
      sourceRows,
      parsedRows: parsedData.length,
      skippedRows: sourceRows - parsedData.length,
      skippedByReason,
      workoutCount: acceptedWorkouts.size,
      unitType,
    },
    enumerable: false,
  });

  return parsedData;
}
