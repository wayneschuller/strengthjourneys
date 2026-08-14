/*
 * Pure import-profile state transitions shared by the KV writer and validation.
 * The profile intentionally stores ritual metadata only, never workout contents.
 */

import { getImportSource } from "@/lib/import/import-sources";

const MAX_RECENT_IMPORTS = 4;

function asCount(value) {
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function latestDate(first, second) {
  if (!first) return second || null;
  if (!second) return first;
  return first > second ? first : second;
}

function getCadenceLabel(recentImportDates = []) {
  if (recentImportDates.length < 3) return null;
  const gaps = recentImportDates
    .slice(1)
    .map((value, index) => {
      const current = new Date(value).getTime();
      const previous = new Date(recentImportDates[index]).getTime();
      return Math.round((current - previous) / 86_400_000);
    })
    .filter((gap) => Number.isFinite(gap) && gap >= 0);
  if (gaps.length < 2) return null;
  const averageGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  if (averageGap <= 10) return "approximately weekly";
  if (averageGap <= 18) return "approximately fortnightly";
  return "an occasional update";
}

export function buildNextImportProfile(
  currentProfile,
  {
    formatId,
    formatName,
    sheetId,
    checkedAt,
    latestWorkoutDate,
    insertedRows = 0,
    outcome = "merged",
  },
) {
  const normalizedSheetId = normalizeSheetId(sheetId);
  const existingProfile = currentProfile || {};
  // Freshness describes the currently linked archive. If the user switches to
  // another Sheet, start a new ritual profile instead of claiming that dates
  // imported into the old Sheet exist in the new one.
  const current =
    existingProfile.lastSheetId &&
    normalizedSheetId &&
    existingProfile.lastSheetId !== normalizedSheetId
      ? {}
      : existingProfile;
  const source = getImportSource({ formatId, formatName });
  const currentSources =
    current.sources &&
    typeof current.sources === "object" &&
    !Array.isArray(current.sources)
      ? current.sources
      : {};
  const sourceProfile = currentSources[source.id] || {};
  const didMerge = asCount(insertedRows) > 0 && outcome === "merged";
  const successfulImportCount =
    asCount(current.successfulImportCount) + (didMerge ? 1 : 0);
  const sourceImportCount =
    asCount(sourceProfile.importCount) + (didMerge ? 1 : 0);
  const existingRecentImportDates = Array.isArray(current.recentImportDates)
    ? current.recentImportDates
    : [];
  const recentImportDates = didMerge
    ? [...existingRecentImportDates, checkedAt].slice(
        -MAX_RECENT_IMPORTS,
      )
    : existingRecentImportDates;

  let relationship = "freshness_check";
  if (didMerge && successfulImportCount === 1) relationship = "first_import";
  else if (didMerge && asCount(sourceProfile.importCount) > 0) {
    relationship = "repeat_same_source";
  } else if (didMerge && asCount(current.successfulImportCount) > 0) {
    relationship = "new_source";
  } else if (outcome === "conflicts_only") {
    relationship = "conflicts_only";
  }

  const nextProfile = {
    version: 1,
    firstImportAt: current.firstImportAt || (didMerge ? checkedAt : null),
    lastImportCheckedAt: checkedAt,
    lastImportMergedAt: didMerge
      ? checkedAt
      : current.lastImportMergedAt || null,
    successfulImportCount,
    lastSheetId: normalizedSheetId || current.lastSheetId || null,
    lastSourceId: source.id,
    lastSourceName: source.name,
    latestImportedWorkoutDate: latestDate(
      current.latestImportedWorkoutDate,
      latestWorkoutDate,
    ),
    recentImportDates,
    sources: {
      ...currentSources,
      [source.id]: {
        importCount: sourceImportCount,
        lastCheckedAt: checkedAt,
        lastMergedAt: didMerge ? checkedAt : sourceProfile.lastMergedAt || null,
        latestWorkoutDate: latestDate(
          sourceProfile.latestWorkoutDate,
          latestWorkoutDate,
        ),
      },
    },
  };

  return {
    profile: nextProfile,
    relationship,
    relationshipLabel: getRelationshipLabel({
      relationship,
      sourceName: source.name,
      sourceImportCount,
      successfulImportCount,
    }),
    cadenceLabel: getCadenceLabel(recentImportDates),
    previousCheckedAt: sourceProfile.lastCheckedAt || null,
    previousWorkoutDate: sourceProfile.latestWorkoutDate || null,
  };
}

function normalizeSheetId(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getRelationshipLabel({
  relationship,
  sourceName,
  sourceImportCount,
  successfulImportCount,
}) {
  if (relationship === "first_import") return "First saved import";
  if (relationship === "repeat_same_source") {
    return `${ordinal(sourceImportCount)} successful ${sourceName} import`;
  }
  if (relationship === "new_source") {
    return `First ${sourceName} import after ${successfulImportCount - 1} saved import${successfulImportCount === 2 ? "" : "s"} from other sources`;
  }
  if (relationship === "conflicts_only") {
    return `Repeat ${sourceName} check with changed sets to review`;
  }
  return `Repeat ${sourceName} check; already up to date`;
}

function ordinal(value) {
  const remainder100 = value % 100;
  if (remainder100 >= 11 && remainder100 <= 13) return `${value}th`;
  if (value % 10 === 1) return `${value}st`;
  if (value % 10 === 2) return `${value}nd`;
  if (value % 10 === 3) return `${value}rd`;
  return `${value}th`;
}
