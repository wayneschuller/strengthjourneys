/**
 * Canonical import dedupe helpers.
 * These exist so preview-time merge analysis matches the exact Strength
 * Journeys shape we write into Google Sheets, instead of comparing raw parser
 * output that may differ in unit/default formatting details.
 */

import { normalizeLiftTypeNames } from "@/lib/data-sources/import-dispatcher";
import { isValidLiftWeight } from "@/lib/data-sources/parser-utilities";
import { getImportedSourceIdentity } from "@/lib/import/provenance";

function normalizeComparableEntry(entry) {
  if (!entry || entry.isGoal) return null;

  const date = String(entry.date || "").trim();
  const liftType = normalizeLiftTypeNames(String(entry.liftType || "").trim());
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
    !isValidLiftWeight(liftType, numericWeight)
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

export function buildComparableLiftKey(entry) {
  const normalizedEntry = normalizeComparableEntry(entry);
  if (!normalizedEntry) return null;

  return [
    normalizedEntry.date,
    normalizedEntry.liftType,
    normalizedEntry.reps,
    normalizedEntry.weight,
    normalizedEntry.unitType,
  ].join("|");
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

export function deduplicateImportedEntries(importedData, existingData) {
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
    if (entry?.isGoal) continue;
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

  return {
    newEntries,
    skippedCount,
    conflictCount: conflicts.length,
    conflicts,
  };
}

export function analyzeImportedEntries(importedData, existingData) {
  const importedEntries = Array.isArray(importedData)
    ? importedData.filter((entry) => !entry?.isGoal)
    : [];
  const { newEntries, skippedCount, conflictCount, conflicts } =
    deduplicateImportedEntries(importedEntries, existingData);

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
    conflictCount,
    conflicts,
  };
}
