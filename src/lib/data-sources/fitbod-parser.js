// Parse Fitbod workout CSV exports.
//
// Fitbod (Log tab → gear icon → Export Workout Data) produces one row per set
// with columns: Date, Exercise, Reps, Weight(kg), Duration(s), Distance(m),
// Incline, Resistance, isWarmup, Note, multiplier. Weight is always metric
// regardless of the user's display unit, and cardio/timed rows (duration or
// distance based, no reps/weight) are not strength sets and are skipped.
//
// Not documented in any public app guide — this parser only activates when a
// matching file is dropped in.

import { recordTiming } from "@/lib/processing-utils";
import {
  isBodyweightLoadLiftName,
  isValidLiftWeight,
  normalizeLiftTypeNames,
} from "@/lib/data-sources/parser-utilities";
import { buildVisibleImportProvenance } from "@/lib/import/provenance";

function normalizeHeader(header) {
  return String(header || "")
    .replace(/^﻿/, "")
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

function normalizeFitbodLiftType(rawLiftType) {
  const cleaned = String(rawLiftType || "")
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

function isTruthyFlag(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function incrementReason(reasons, reason) {
  reasons[reason] = (reasons[reason] || 0) + 1;
}

export function isFitbodExport(headers) {
  const normalized = headers.map(normalizeHeader);
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

// Parse Fitbod workout CSV exports.
export function parseFitbodData(data, { importedAt = new Date() } = {}) {
  const startTime = performance.now();
  const headers = data[0] || [];
  const dateColumnIndex = getColumnIndex(headers, "date");
  const exerciseColumnIndex = getColumnIndex(headers, "exercise");
  const repsColumnIndex = getColumnIndex(headers, "reps");
  const weightColumnIndex = headers.findIndex((header) =>
    normalizeHeader(header).startsWith("weight(kg"),
  );
  const durationColumnIndex = getColumnIndex(headers, "duration(s)");
  const distanceColumnIndex = getColumnIndex(headers, "distance(m)");
  const isWarmupColumnIndex = getColumnIndex(headers, "iswarmup");
  const noteColumnIndex = getColumnIndex(headers, "note");

  const parsedData = [];
  const skippedByReason = {};
  const acceptedWorkouts = new Set();
  const anchoredWorkouts = new Set();
  let sourceRows = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0 || row.every((cell) => cell === "")) continue;
    sourceRows++;

    const rawDate = row[dateColumnIndex];
    const date = normalizeFitbodDate(rawDate);
    const time = getFitbodTime(rawDate);
    const liftType = normalizeFitbodLiftType(row[exerciseColumnIndex]);
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

    // Fitbod exports one timestamp per set rather than per workout, so there's
    // no reliable session boundary to anchor on. Tag once per calendar day
    // instead of once per set to avoid cluttering every row with the same
    // provenance note.
    const workoutKey = date;
    const isWorkoutAnchor = !anchoredWorkouts.has(workoutKey);
    const importProvenance = isWorkoutAnchor
      ? buildVisibleImportProvenance("Fitbod", importedAt)
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

  parsedData.sort((a, b) => a.date.localeCompare(b.date));

  recordTiming(
    "Parse Fitbod",
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
      unitType: "kg",
    },
    enumerable: false,
  });

  return parsedData;
}
