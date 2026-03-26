import { recordTiming } from "@/lib/processing-utils";
import { normalizeLiftTypeNames } from "./parser-utilities";

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

function getColumnIndex(headers, name) {
  return headers.indexOf(name);
}

function parseNumber(value) {
  const parsed = Number.parseFloat(String(value || "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function parseInteger(value) {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
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

    if (day && month && year) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  const isoLikeMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoLikeMatch) {
    return `${isoLikeMatch[1]}-${isoLikeMatch[2]}-${isoLikeMatch[3]}`;
  }

  const native = new Date(raw);
  if (Number.isNaN(native.getTime())) return null;

  return `${native.getFullYear()}-${String(native.getMonth() + 1).padStart(2, "0")}-${String(native.getDate()).padStart(2, "0")}`;
}

function normalizeHevyLiftType(rawLiftType) {
  const cleaned = String(rawLiftType || "")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
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

// Parse Hevy workout CSV exports.
//
// Publicly documented/community-observed Hevy exports are one row per set and
// use `weight_kg`, `reps`, and `exercise_title` columns.
export function parseHevyData(data) {
  const startTime = performance.now();
  const headers = data[0] || [];
  const startTimeColumnIndex = getColumnIndex(headers, "start_time");
  const exerciseTitleColumnIndex = getColumnIndex(headers, "exercise_title");
  const weightColumnIndex = getColumnIndex(headers, "weight_kg");
  const repsColumnIndex = getColumnIndex(headers, "reps");
  const workoutDescriptionColumnIndex = getColumnIndex(headers, "description");
  const exerciseNotesColumnIndex = getColumnIndex(headers, "exercise_notes");
  const setTypeColumnIndex = getColumnIndex(headers, "set_type");
  const rpeColumnIndex = getColumnIndex(headers, "rpe");

  const parsedData = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const date = normalizeHevyDate(row[startTimeColumnIndex]);
    const liftType = normalizeHevyLiftType(row[exerciseTitleColumnIndex]);
    const reps = parseInteger(row[repsColumnIndex]);
    const weight = parseNumber(row[weightColumnIndex]);

    if (!date || !liftType) continue;
    if (!reps || reps <= 0 || !weight || weight <= 0) continue;

    parsedData.push({
      date,
      liftType,
      rawLiftType:
        String(row[exerciseTitleColumnIndex] || "").trim() || undefined,
      reps,
      weight,
      unitType: "kg",
      notes: buildNotes(
        row[exerciseNotesColumnIndex],
        row[workoutDescriptionColumnIndex],
        row[setTypeColumnIndex] && row[setTypeColumnIndex] !== "normal"
          ? `Set type: ${row[setTypeColumnIndex]}`
          : null,
        row[rpeColumnIndex] ? `RPE ${row[rpeColumnIndex]}` : null,
      ),
    });
  }

  parsedData.sort((a, b) => a.date.localeCompare(b.date));

  recordTiming(
    "Parse Hevy",
    performance.now() - startTime,
    `${parsedData.length} lifts`,
  );

  return parsedData;
}
