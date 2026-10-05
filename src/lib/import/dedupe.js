/**
 * Canonical import dedupe helpers.
 * These exist so preview-time merge analysis matches the exact Strength
 * Journeys shape we write into Google Sheets, instead of comparing raw parser
 * output that may differ in unit/default formatting details.
 *
 * A set is a duplicate when the sheet already holds the same lift, reps and
 * load on the same date. One kind of source needs more than that: a coach's
 * app dates a workout by its schedule, so the same sets sit in the sheet a
 * day or more away (see claimSetsLoggedNearby below). That allowance is for
 * those sources only. Tried on real histories from apps a lifter logs in
 * themselves, it called up to a third of genuine sets duplicates, because
 * people repeat a lift at the same load within a few days.
 */

import { addDaysFromStr, subtractDaysFromStr } from "@/lib/date-utils";
import { normalizeLiftTypeNames } from "@/lib/import/import-dispatcher";
import { getImportSource } from "@/lib/import/import-sources";
import {
  isValidLiftWeight,
  normalizeLiftTypeLookupKey,
} from "@/lib/import/parsers/parser-utilities";
import { getImportedSourceIdentity } from "@/lib/import/provenance";

// How far a scheduled workout can sit from the day it was lifted and still be
// taken for the same one. Nearest day first, and the later day on a tie: a
// lifter ahead of their coach's time zone logs a session the day after its
// schedule far more often than the day before.
const SCHEDULED_DATE_OFFSETS = [1, -1, 2, -2, 3, -3];

// A log holds tens of thousands of sets and a few hundred lift names, and
// this runs while the import preview renders, so each name is worked out once.
const comparableLiftNames = new Map();

function getComparableLiftName(rawLiftType) {
  let names = comparableLiftNames.get(rawLiftType);
  if (!names) {
    const liftName = normalizeLiftTypeNames(rawLiftType);
    // A lift outside the registry keeps whatever spelling it arrived with,
    // so names are compared the way the registry looks them up: case, accents
    // and punctuation aside. A hand-typed "Dumbbell lateral raise" is the
    // same lift as an app's "Dumbbell Lateral Raise".
    names = { liftName, liftType: normalizeLiftTypeLookupKey(liftName) };
    comparableLiftNames.set(rawLiftType, names);
  }
  return names;
}

function normalizeComparableEntry(entry) {
  if (!entry) return null;

  const date = String(entry.date || "").trim();
  const { liftName, liftType } = getComparableLiftName(
    String(entry.liftType || "").trim(),
  );
  const reps = Number(entry.reps) || 0;
  const numericWeight = Number(entry.weight);
  const weight = Math.round(numericWeight * 100);
  const unitType = String(entry.unitType || "kg")
    .trim()
    .toLowerCase();

  if (
    !date ||
    !liftType ||
    !reps ||
    !isValidLiftWeight(liftName, numericWeight)
  ) {
    return null;
  }

  return {
    date,
    liftType,
    reps,
    weight,
    unitType,
  };
}

function joinComparableKey(normalizedEntry, date = normalizedEntry.date) {
  return [
    date,
    normalizedEntry.liftType,
    normalizedEntry.reps,
    normalizedEntry.weight,
    normalizedEntry.unitType,
  ].join("|");
}

export function buildComparableLiftKey(entry) {
  const normalizedEntry = normalizeComparableEntry(entry);
  if (!normalizedEntry) return null;

  return joinComparableKey(normalizedEntry);
}

function incrementCount(counts, key) {
  if (!key) return;
  counts.set(key, (counts.get(key) || 0) + 1);
}

function consumeCount(counts, key) {
  const count = counts.get(key) || 0;
  if (count <= 0) return false;
  if (count === 1) counts.delete(key);
  else counts.set(key, count - 1);
  return true;
}

function getSourceContentCounts(sourceCounts, sourceKey) {
  if (!sourceCounts.has(sourceKey)) {
    sourceCounts.set(sourceKey, new Map());
  }
  return sourceCounts.get(sourceKey);
}

function consumeAnySourceContent(sourceContentCounts, contentCounts) {
  for (const [contentKey, count] of sourceContentCounts.entries()) {
    if (count <= 0) continue;
    consumeCount(sourceContentCounts, contentKey);
    consumeCount(contentCounts, contentKey);
    return;
  }
}

// For a source whose dates are a schedule: finds the imported sets the sheet
// already holds on a nearby day, and claims those sheet rows so no other
// imported set can match them too.
//
// The unit is one lift on one day. Every set of it has to be found, on a
// single day within reach, among the sheet rows nothing else has claimed. A
// partial match proves little, since a lift done twice in a week shares most
// of its sets with itself, so those stay new.
function claimSetsLoggedNearby(entries, existingContentCounts) {
  const liftDays = new Map();
  for (const entry of entries) {
    const normalizedEntry = normalizeComparableEntry(entry);
    const liftDayKey = `${normalizedEntry.date}|${normalizedEntry.liftType}`;
    if (!liftDays.has(liftDayKey)) liftDays.set(liftDayKey, []);
    liftDays.get(liftDayKey).push({ entry, normalizedEntry });
  }

  const loggedNearby = new Set();
  for (const sets of liftDays.values()) {
    const { date } = sets[0].normalizedEntry;

    for (const offset of SCHEDULED_DATE_OFFSETS) {
      const nearbyDate =
        offset > 0
          ? addDaysFromStr(date, offset)
          : subtractDaysFromStr(date, -offset);

      const needed = new Map();
      for (const { normalizedEntry } of sets) {
        incrementCount(needed, joinComparableKey(normalizedEntry, nearbyDate));
      }
      const allThere = [...needed].every(
        ([key, count]) => (existingContentCounts.get(key) || 0) >= count,
      );
      if (!allThere) continue;

      for (const [key, count] of needed) {
        for (let i = 0; i < count; i++)
          consumeCount(existingContentCounts, key);
      }
      for (const { entry } of sets) loggedNearby.add(entry);
      break;
    }
  }

  return loggedNearby;
}

/**
 * Splits an import into the sets the sheet lacks and the ones it already has.
 *
 * @param {Object[]} importedData
 * @param {Object[]} existingData The linked sheet's parsed rows
 * @param {{ formatId?: string }} [source] Which format the import came from.
 *   Only matters for a source with scheduled dates.
 * @returns {{ newEntries: Object[], skippedCount: number, nearbyCount: number,
 *   conflictCount: number, conflicts: Object[] }} `skippedCount` is every set
 *   already in the sheet. `nearbyCount` is how many of those were found on a
 *   nearby day, not the same one, so the lifter can be told.
 */
export function deduplicateImportedEntries(
  importedData,
  existingData,
  { formatId } = {},
) {
  // A count-aware comparison preserves legitimate repeated sets such as
  // 3x5@100. Existing rows consume imported occurrences one-for-one, while
  // newly accepted rows never become duplicates of later rows in the file.
  const existingContentCounts = new Map();
  const existingSourceCounts = new Map();

  for (const entry of Array.isArray(existingData) ? existingData : []) {
    const contentKey = buildComparableLiftKey(entry);
    if (!contentKey) continue;
    incrementCount(existingContentCounts, contentKey);

    const sourceKey = getImportedSourceIdentity(entry);
    if (sourceKey) {
      incrementCount(
        getSourceContentCounts(existingSourceCounts, sourceKey),
        contentKey,
      );
    }
  }

  const newEntries = [];
  const conflicts = [];
  let skippedCount = 0;

  for (const entry of Array.isArray(importedData) ? importedData : []) {
    const contentKey = buildComparableLiftKey(entry);
    if (!contentKey) continue;

    const sourceKey = getImportedSourceIdentity(entry);
    const sourceContentCounts = sourceKey
      ? existingSourceCounts.get(sourceKey)
      : null;

    if (sourceContentCounts && consumeCount(sourceContentCounts, contentKey)) {
      consumeCount(existingContentCounts, contentKey);
      skippedCount++;
      continue;
    }

    // The same readable Hevy source facts now point at changed set content.
    // Do not silently duplicate or overwrite it; let the UI surface the conflict.
    if (sourceContentCounts && sourceContentCounts.size > 0) {
      consumeAnySourceContent(sourceContentCounts, existingContentCounts);
      conflicts.push(entry);
      continue;
    }

    if (consumeCount(existingContentCounts, contentKey)) {
      skippedCount++;
      continue;
    }

    newEntries.push(entry);
  }

  // Same-day matches come first and claim their sheet rows, so a workout the
  // sheet holds on its own day is never spent on a neighbour's.
  if (!getImportSource({ formatId }).scheduledDates) {
    return {
      newEntries,
      skippedCount,
      nearbyCount: 0,
      conflictCount: conflicts.length,
      conflicts,
    };
  }

  const loggedNearby = claimSetsLoggedNearby(newEntries, existingContentCounts);
  return {
    newEntries: newEntries.filter((entry) => !loggedNearby.has(entry)),
    skippedCount: skippedCount + loggedNearby.size,
    nearbyCount: loggedNearby.size,
    conflictCount: conflicts.length,
    conflicts,
  };
}

// One sentence for the lifter when sets were matched on a nearby day, to sit
// after whatever the screen says about duplicates. Empty when there were none.
export function describeNearbyDuplicates(nearbyCount, formatName) {
  if (!nearbyCount) return "";
  const sets = `${nearbyCount.toLocaleString()} ${nearbyCount === 1 ? "set" : "sets"}`;
  return ` ${formatName} dates a workout by its schedule, so ${sets} matched what you logged up to 3 days either side.`;
}

export function analyzeImportedEntries(importedData, existingData, source) {
  const importedEntries = Array.isArray(importedData) ? importedData : [];
  const { newEntries, skippedCount, nearbyCount, conflictCount, conflicts } =
    deduplicateImportedEntries(importedEntries, existingData, source);

  const importedCount = importedEntries.length;
  const newEntriesCount = newEntries.length;
  const duplicateCount = skippedCount;

  let status = "all_new";
  if (!Array.isArray(existingData) || existingData.length === 0) {
    status = "no_comparison";
  } else if (importedCount === 0) {
    status = "empty";
  } else if (newEntriesCount === 0 && conflictCount === 0) {
    status = "already_in_linked_sheet";
  } else if (duplicateCount > 0 || conflictCount > 0) {
    status = "partial_overlap";
  }

  return {
    status,
    importedCount,
    newEntries,
    newEntriesCount,
    duplicateCount,
    nearbyCount,
    conflictCount,
    conflicts,
  };
}
