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

import { recordTiming } from "@/lib/processing-utils";
import {
  isBodyweightLoadLiftName,
  isValidLiftWeight,
  normalizeLiftTypeNames,
  normalizeDecimalComma,
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
  const raw = normalizeDecimalComma(value);
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

function normalizeFitNotesLiftType(rawLiftType) {
  const cleaned = String(rawLiftType || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  return normalizeLiftTypeNames(cleaned);
}

// The unit is only ever stated in the weight header, never in the cell.
function findWeightColumn(headers) {
  const index = headers.findIndex((header) =>
    normalizeHeader(header).startsWith("weight"),
  );
  if (index < 0) return { index: -1, unitType: null };

  const header = normalizeHeader(headers[index]);
  return { index, unitType: /\blbs?\b|pounds?/.test(header) ? "lb" : "kg" };
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

function incrementReason(reasons, reason) {
  reasons[reason] = (reasons[reason] || 0) + 1;
}

export function isFitNotesExport(headers) {
  const normalized = headers.map(normalizeHeader);
  return (
    normalized.includes("date") &&
    normalized.includes("exercise") &&
    normalized.includes("category") &&
    normalized.includes("reps") &&
    normalized.some((header) => header.startsWith("weight"))
  );
}

// Parse FitNotes workout CSV exports.
export function parseFitNotesData(data, { importedAt = new Date() } = {}) {
  const startTime = performance.now();
  const headers = data[0] || [];
  const dateColumnIndex = getColumnIndex(headers, "date");
  const exerciseColumnIndex = getColumnIndex(headers, "exercise");
  const repsColumnIndex = getColumnIndex(headers, "reps");
  const distanceColumnIndex = getColumnIndex(headers, "distance");
  const timeColumnIndex = getColumnIndex(headers, "time");
  const commentColumnIndex = getColumnIndex(headers, "comment", "comments");
  const { index: weightColumnIndex, unitType } = findWeightColumn(headers);

  const parsedData = [];
  const skippedByReason = {};
  const acceptedWorkouts = new Set();
  const anchoredWorkouts = new Set();
  let sourceRows = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0 || row.every((cell) => cell === "")) continue;
    sourceRows++;

    const date = normalizeFitNotesDate(row[dateColumnIndex]);
    const liftType = normalizeFitNotesLiftType(row[exerciseColumnIndex]);
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
      // A cardio row states a distance or a clock time rather than a number of
      // reps, and the clock time is not numeric, so both are read as text.
      const hasDurationOrDistance =
        String(row[distanceColumnIndex] ?? "").trim() !== "" ||
        String(row[timeColumnIndex] ?? "").trim() !== "";
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

    // FitNotes records a date but no session boundary or workout name, so
    // provenance is tagged once per calendar day rather than once per set.
    const isWorkoutAnchor = !anchoredWorkouts.has(date);
    const importProvenance = isWorkoutAnchor
      ? buildVisibleImportProvenance("FitNotes", importedAt)
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

  parsedData.sort((a, b) => a.date.localeCompare(b.date));

  recordTiming(
    "Parse FitNotes",
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
