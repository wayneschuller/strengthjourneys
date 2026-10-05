// Parse Fitbod workout CSV exports.
//
// Fitbod (Log tab → gear icon → Export Workout Data) produces one row per set
// with columns: Date, Exercise, Reps, Weight(kg), Duration(s), Distance(m),
// Incline, Resistance, isWarmup, Note, multiplier. Weight is always metric
// regardless of the user's display unit, and cardio/timed rows (duration or
// distance based, no reps/weight) are not strength sets and are skipped.
//
// A quiet format: it has no app guide and no mention in the unrecognized-format
// message, so nothing in the app offers it. It activates when someone drops a
// Fitbod export in. Follows the parser contract in import-dispatcher.js.

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

export const fitbodFormat = {
  ...requireImportSource("fitbod"),
  detect: isFitbodExport,
  parse: parseFitbodData,
};

// Fitbod's exact date/time string format isn't publicly documented, so this
// accepts both common shapes rather than assuming one: ISO-like
// ("2023-08-01" / "2023-08-01T08:15:00" / "2023-08-01 08:15:00") and US
// slash dates ("8/1/2023").
function normalizeFitbodDate(dateTimeString) {
  const raw = String(dateTimeString || "").trim();
  if (!raw) return null;

  const isoLikeMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoLikeMatch) {
    const year = Number(isoLikeMatch[1]);
    const month = Number(isoLikeMatch[2]);
    const day = Number(isoLikeMatch[3]);
    return isValidCalendarDate(year, month, day)
      ? `${isoLikeMatch[1]}-${isoLikeMatch[2]}-${isoLikeMatch[3]}`
      : null;
  }

  const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const month = Number(slashMatch[1]);
    const day = Number(slashMatch[2]);
    const year = Number(slashMatch[3]);
    return isValidCalendarDate(year, month, day)
      ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
      : null;
  }

  return null;
}

function getFitbodTime(dateTimeString) {
  const raw = String(dateTimeString || "").trim();
  const match = raw.match(/[T\s](\d{1,2}):(\d{2})(?::\d{2})?/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function isTruthyFlag(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function isFitbodExport(headers) {
  const normalized = headers.map(normalizeHeaderCell);
  return (
    normalized.includes("date") &&
    normalized.includes("exercise") &&
    normalized.includes("reps") &&
    normalized.some((header) => header.startsWith("weight(kg")) &&
    normalized.includes("iswarmup")
  );
}

// Fitbod stores kilograms even for a lifter working in pounds, so a 45 lb bar
// arrives as 20.41168092460379. Keep two decimals: enough for a half-kilo
// plate, and short of repeating a conversion artefact back at the lifter. A
// genuinely metric export rounds to itself.
function roundImportedWeight(weight) {
  return typeof weight === "number" ? Math.round(weight * 100) / 100 : weight;
}

function parseFitbodData(data, { importedAt = new Date() } = {}) {
  const headers = data[0] || [];
  const dateColumnIndex = findColumn(headers, "date");
  const exerciseColumnIndex = findColumn(headers, "exercise");
  const repsColumnIndex = findColumn(headers, "reps");
  const weightColumnIndex = headers.findIndex((header) =>
    normalizeHeaderCell(header).startsWith("weight(kg"),
  );
  const durationColumnIndex = findColumn(headers, "duration(s)");
  const distanceColumnIndex = findColumn(headers, "distance(m)");
  const isWarmupColumnIndex = findColumn(headers, "iswarmup");
  const noteColumnIndex = findColumn(headers, "note");

  const parsedData = [];
  const skippedByReason = {};
  const acceptedWorkouts = new Set();
  const anchoredWorkouts = new Set();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0 || row.every((cell) => cell === "")) continue;

    const rawDate = row[dateColumnIndex];
    const date = normalizeFitbodDate(rawDate);
    const time = getFitbodTime(rawDate);
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
      isDurationOrDistance:
        parseStrictNumber(row[durationColumnIndex]) != null ||
        parseStrictNumber(row[distanceColumnIndex]) != null,
    });
    if (skipReason) {
      countSkip(skippedByReason, skipReason);
      continue;
    }

    // Fitbod exports one timestamp per set rather than per workout, so there's
    // no reliable session boundary to anchor on. Tag once per calendar day
    // instead of once per set to avoid cluttering every row with the same
    // provenance note.
    const workoutKey = date;
    const isWorkoutAnchor = !anchoredWorkouts.has(workoutKey);
    const importProvenance = isWorkoutAnchor
      ? buildVisibleImportProvenance(fitbodFormat.name, importedAt)
      : null;
    anchoredWorkouts.add(workoutKey);
    acceptedWorkouts.add(workoutKey);

    const isWarmup = isTruthyFlag(row[isWarmupColumnIndex]);

    parsedData.push({
      date,
      liftType,
      rawLiftType: String(row[exerciseColumnIndex] || "").trim() || undefined,
      reps,
      weight: roundImportedWeight(weight),
      unitType: "kg",
      notes: buildNotes(
        time,
        isWarmup ? "Warmup" : null,
        row[noteColumnIndex],
        importProvenance,
      ),
    });
  }

  return {
    entries: parsedData,
    skippedByReason,
    workoutCount: acceptedWorkouts.size,
    unitType: "kg",
  };
}
