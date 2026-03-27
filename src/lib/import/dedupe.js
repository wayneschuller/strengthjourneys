/**
 * Canonical import dedupe helpers.
 * These exist so preview-time merge analysis matches the exact Strength
 * Journeys shape we write into Google Sheets, instead of comparing raw parser
 * output that may differ in unit/default formatting details.
 */

import { normalizeLiftTypeNames } from "@/lib/data-sources/import-dispatcher";

function normalizeComparableEntry(entry) {
  if (!entry || entry.isGoal) return null;

  const date = String(entry.date || "").trim();
  const liftType = normalizeLiftTypeNames(String(entry.liftType || "").trim());
  const reps = Number(entry.reps) || 0;
  const weight = Math.round(Number(entry.weight || 0) * 100);
  const unitType = String(entry.unitType || "kg")
    .trim()
    .toLowerCase();

  if (!date || !liftType || !reps || !weight) return null;

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

export function deduplicateImportedEntries(importedData, existingData) {
  if (!Array.isArray(existingData) || existingData.length === 0) {
    return {
      newEntries: Array.isArray(importedData)
        ? importedData.filter((entry) => !entry?.isGoal)
        : [],
      skippedCount: 0,
    };
  }

  const existingKeys = new Set(
    existingData
      .map(buildComparableLiftKey)
      .filter((key) => typeof key === "string" && key.length > 0),
  );

  const newEntries = [];
  let skippedCount = 0;

  for (const entry of Array.isArray(importedData) ? importedData : []) {
    if (entry?.isGoal) continue;
    const key = buildComparableLiftKey(entry);
    if (!key) continue;
    if (existingKeys.has(key)) skippedCount++;
    else newEntries.push(entry);
  }

  return { newEntries, skippedCount };
}

export function analyzeImportedEntries(importedData, existingData) {
  const importedEntries = Array.isArray(importedData)
    ? importedData.filter((entry) => !entry?.isGoal)
    : [];
  const { newEntries, skippedCount } = deduplicateImportedEntries(
    importedEntries,
    existingData,
  );

  const importedCount = importedEntries.length;
  const newEntriesCount = newEntries.length;
  const duplicateCount = skippedCount;

  let status = "all_new";
  if (!Array.isArray(existingData) || existingData.length === 0) {
    status = "no_comparison";
  } else if (importedCount === 0) {
    status = "empty";
  } else if (newEntriesCount === 0) {
    status = "already_in_linked_sheet";
  } else if (duplicateCount > 0) {
    status = "partial_overlap";
  }

  return {
    status,
    importedCount,
    newEntries,
    newEntriesCount,
    duplicateCount,
  };
}
