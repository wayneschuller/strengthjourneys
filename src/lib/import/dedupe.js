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
 *
 * Some of what is left is still not new. A lifter who also kept the sheet by
 * hand has the same sessions there under their own exercise names, loads and
 * set counts, and no rule can match those safely. What can be seen is that a
 * set about to be added is for a lift the sheet already has that day, which
 * an ordinary re-import never produces: it adds whole new sessions. Those are
 * counted (overlapCount) so the lifter is asked before they go in.
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

// Fewer sets than this for a lift already logged that day is an edited set or
// a second session, and asking about one row would only be noise.
const OVERLAP_WORTH_ASKING_ABOUT = 5;

function shiftDate(date, offset) {
  if (offset === 0) return date;
  return offset > 0
    ? addDaysFromStr(date, offset)
    : subtractDaysFromStr(date, -offset);
}

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
function claimSetsLoggedNearby(
  entries,
  existingContentCounts,
  matchedLiftDays,
) {
  const liftDays = new Map();
  for (const entry of entries) {
    const normalizedEntry = normalizeComparableEntry(entry);
    const liftDayKey = `${normalizedEntry.date}|${normalizedEntry.liftType}`;
    if (!liftDays.has(liftDayKey)) liftDays.set(liftDayKey, []);
    liftDays.get(liftDayKey).push({ entry, normalizedEntry });
  }

  const loggedNearby = new Set();
  for (const sets of liftDays.values()) {
    const { date, liftType } = sets[0].normalizedEntry;

    for (const offset of SCHEDULED_DATE_OFFSETS) {
      const nearbyDate = shiftDate(date, offset);

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
      matchedLiftDays.add(`${nearbyDate}|${liftType}`);
      break;
    }
  }

  return loggedNearby;
}

// Of the sets about to be added, how many are for a lift the sheet already
// has on that day, or within reach of it for a source with scheduled dates.
//
// A nearby day only counts when the import did not match that lift there
// itself. Squats the sheet holds on Monday because this same file put them
// there say nothing about Wednesday's squats being a repeat; squats the
// lifter typed in on Tuesday at a different load do.
function countSetsForLiftsAlreadyLogged(
  newEntries,
  loggedLiftDays,
  matchedLiftDays,
  hasScheduledDates,
) {
  const offsets = hasScheduledDates ? [0, ...SCHEDULED_DATE_OFFSETS] : [0];
  const overlapsByLiftDay = new Map();
  let count = 0;

  for (const entry of newEntries) {
    const { date, liftType } = normalizeComparableEntry(entry);
    const liftDayKey = `${date}|${liftType}`;
    if (!overlapsByLiftDay.has(liftDayKey)) {
      overlapsByLiftDay.set(
        liftDayKey,
        offsets.some((offset) => {
          const loggedKey = `${shiftDate(date, offset)}|${liftType}`;
          return (
            loggedLiftDays.has(loggedKey) &&
            (offset === 0 || !matchedLiftDays.has(loggedKey))
          );
        }),
      );
    }
    if (overlapsByLiftDay.get(liftDayKey)) count++;
  }

  return count;
}

/**
 * Splits an import into the sets the sheet lacks and the ones it already has.
 *
 * @param {Object[]} importedData
 * @param {Object[]} existingData The linked sheet's parsed rows
 * @param {{ formatId?: string }} [source] Which format the import came from.
 *   Only matters for a source with scheduled dates.
 * @returns {{ newEntries: Object[], skippedCount: number, nearbyCount: number,
 *   overlapCount: number, conflictCount: number, conflicts: Object[] }}
 *   `skippedCount` is every set already in the sheet. `nearbyCount` is how
 *   many of those were found on a nearby day, not the same one, so the lifter
 *   can be told. `overlapCount` is how many of `newEntries` are for a lift
 *   the sheet already has that day, so the lifter can be asked first.
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
  // Every lift-day the sheet holds, and those this import matched there.
  const loggedLiftDays = new Set();
  const matchedLiftDays = new Set();

  for (const entry of Array.isArray(existingData) ? existingData : []) {
    const normalizedEntry = normalizeComparableEntry(entry);
    if (!normalizedEntry) continue;
    const contentKey = joinComparableKey(normalizedEntry);
    incrementCount(existingContentCounts, contentKey);
    loggedLiftDays.add(`${normalizedEntry.date}|${normalizedEntry.liftType}`);

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
    const normalizedEntry = normalizeComparableEntry(entry);
    if (!normalizedEntry) continue;
    const contentKey = joinComparableKey(normalizedEntry);
    const liftDayKey = `${normalizedEntry.date}|${normalizedEntry.liftType}`;

    const sourceKey = getImportedSourceIdentity(entry);
    const sourceContentCounts = sourceKey
      ? existingSourceCounts.get(sourceKey)
      : null;

    if (sourceContentCounts && consumeCount(sourceContentCounts, contentKey)) {
      consumeCount(existingContentCounts, contentKey);
      matchedLiftDays.add(liftDayKey);
      skippedCount++;
      continue;
    }

    // The same readable Hevy source facts now point at changed set content.
    // Do not silently duplicate or overwrite it; let the UI surface the conflict.
    if (sourceContentCounts && sourceContentCounts.size > 0) {
      consumeAnySourceContent(sourceContentCounts, existingContentCounts);
      matchedLiftDays.add(liftDayKey);
      conflicts.push(entry);
      continue;
    }

    if (consumeCount(existingContentCounts, contentKey)) {
      matchedLiftDays.add(liftDayKey);
      skippedCount++;
      continue;
    }

    newEntries.push(entry);
  }

  // Same-day matches come first and claim their sheet rows, so a workout the
  // sheet holds on its own day is never spent on a neighbour's.
  const hasScheduledDates = Boolean(
    getImportSource({ formatId }).scheduledDates,
  );
  const loggedNearby = hasScheduledDates
    ? claimSetsLoggedNearby(newEntries, existingContentCounts, matchedLiftDays)
    : new Set();
  const entriesToAdd = hasScheduledDates
    ? newEntries.filter((entry) => !loggedNearby.has(entry))
    : newEntries;

  return {
    newEntries: entriesToAdd,
    skippedCount: skippedCount + loggedNearby.size,
    nearbyCount: loggedNearby.size,
    overlapCount: countSetsForLiftsAlreadyLogged(
      entriesToAdd,
      loggedLiftDays,
      matchedLiftDays,
      hasScheduledDates,
    ),
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

// What to put to the lifter before a merge adds sets for lifts the sheet
// already has those days, or "" when there are too few to be worth asking.
export function describeOverlappingSets(overlapCount, newCount, formatId) {
  if (overlapCount < OVERLAP_WORTH_ASKING_ABOUT) return "";
  const which =
    overlapCount === newCount
      ? `All ${overlapCount.toLocaleString()} of these sets are`
      : `${overlapCount.toLocaleString()} of these ${newCount.toLocaleString()} sets are`;
  const when = getImportSource({ formatId }).scheduledDates
    ? "on the same day or within 3 days"
    : "on the same day";
  return `${which} for a lift your sheet already has ${when}. If you logged those sessions yourself, they are likely the same training written a little differently.`;
}

export function analyzeImportedEntries(importedData, existingData, source) {
  const importedEntries = Array.isArray(importedData) ? importedData : [];
  const {
    newEntries,
    skippedCount,
    nearbyCount,
    overlapCount,
    conflictCount,
    conflicts,
  } = deduplicateImportedEntries(importedEntries, existingData, source);

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
    overlapCount,
    conflictCount,
    conflicts,
  };
}
