// Parse Fitbod workout CSV exports.
//
// Fitbod (Log tab → gear icon → Export Workout Data) produces one row per set
// with columns: Date, Exercise, Reps, Weight(kg), Duration(s), Distance(m),
// Incline, Resistance, isWarmup, Note, multiplier. Weight is always written
// in kilograms, even for a lifter working in pounds, so the file's own
// numbers decide which unit the lifter used (see detectFitbodUnit).
// Cardio/timed rows (duration or distance based, no reps/weight) are not
// strength sets and are skipped.
//
// A quiet format: it has no app guide and no mention in the unrecognized-format
// message, so nothing in the app offers it. It activates when someone drops a
// Fitbod export in. Follows the parser contract in import-dispatcher.js.

import { requireImportSource } from "@/lib/import/import-sources";
import {
  buildNotes,
  countSkip,
  countSkippedLift,
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

const LB_PER_KG = 2.20462262;

const isNearMultiple = (value, step, tolerance) =>
  Math.abs(value / step - Math.round(value / step)) * step <= tolerance;

/**
 * Fitbod stores kilograms even for a lifter working in pounds, so a 45 lb bar
 * arrives as 20.41168092460379. A pound lifter's loads convert back to whole
 * quarter pounds; a kilo lifter's are whole quarter kilos already. In the
 * real exports every pound-lifter weight converts back cleanly and almost
 * none sits on a quarter kilo, while a kilo log is the reverse, so the file
 * is read in pounds only when that pattern is plain.
 * @param {number[]} weights Every loaded weight in the file, in kg.
 * @returns {"lb"|"kg"}
 */
export function detectFitbodUnit(weights) {
  const loaded = weights.filter((weight) => weight > 0);
  if (loaded.length === 0) return "kg";
  const lbClean = loaded.filter((weight) =>
    isNearMultiple(weight * LB_PER_KG, 0.25, 0.02),
  ).length;
  const kgClean = loaded.filter((weight) =>
    isNearMultiple(weight, 0.25, 0.005),
  ).length;
  return lbClean / loaded.length >= 0.9 && kgClean / loaded.length < 0.5
    ? "lb"
    : "kg";
}

// Restores the lifter's own number. Pounds snap to the quarter pound they
// came from; anything else keeps two decimals, enough for a half-kilo plate
// and short of repeating a conversion artefact back at the lifter. A
// genuinely metric export rounds to itself.
function toImportedWeight(weight, unitType) {
  if (typeof weight !== "number") return weight;
  if (unitType === "lb") {
    const pounds = weight * LB_PER_KG;
    return isNearMultiple(pounds, 0.25, 0.02)
      ? Math.round(pounds * 4) / 4
      : Math.round(pounds * 100) / 100;
  }
  return Math.round(weight * 100) / 100;
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
  const unitType = detectFitbodUnit(
    data
      .slice(1)
      .map((row) => parseStrictNumber(row?.[weightColumnIndex]))
      .filter((weight) => typeof weight === "number"),
  );

  const parsedData = [];
  const skippedByReason = {};
  const skippedLifts = {};
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
      countSkippedLift(skippedLifts, skipReason, liftType);
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
      weight: toImportedWeight(weight, unitType),
      unitType,
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
    skippedLifts,
    workoutCount: acceptedWorkouts.size,
    unitType,
  };
}
