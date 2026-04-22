/** @format */
// pr-ranking.js
// Pure helpers for ranking a set against lifetime / rolling-year top-N arrays.
// Safe to use anywhere in the app — no React, no context, no side effects.

import {
  getDisplayWeight,
  getCelebrationEmoji,
} from "@/lib/processing-utils";

export function getTop20Rank(topLifts, weight, isMetric) {
  if (!topLifts?.length || !weight) return null;

  const rank = topLifts.findIndex((lift) => {
    const { value } = getDisplayWeight(lift, isMetric);
    return weight > value;
  });

  if (rank !== -1) {
    return rank < 20 ? rank : null;
  }

  return topLifts.length < 20 ? topLifts.length : null;
}

export function getSetIdentityKey(set, fallback = "pending") {
  if (set?.rowIndex != null) return `row:${set.rowIndex}`;
  if (set?._tempId) return `tmp:${set._tempId}`;
  return fallback;
}

export function getEffectiveSetForRanking(set, optimisticFields) {
  if (!optimisticFields) return set;

  return {
    ...set,
    reps: optimisticFields.reps,
    weight: optimisticFields.weight,
    unitType: optimisticFields.unitType ?? set.unitType,
    notes: optimisticFields.notes ?? set.notes,
    URL: optimisticFields.url ?? set.URL,
  };
}

export function isWithinRollingYear(date) {
  if (!date) return false;
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  return new Date(`${date}T00:00:00Z`) >= cutoff;
}

export function compareRankingEntries(a, b, isMetric) {
  const aWeight = getDisplayWeight(a, isMetric).value;
  const bWeight = getDisplayWeight(b, isMetric).value;

  if (aWeight !== bWeight) return bWeight - aWeight;

  const aDate = a?.date ?? "";
  const bDate = b?.date ?? "";
  if (aDate !== bDate) return aDate.localeCompare(bDate);

  return String(a?.rowIndex ?? a?._tempId ?? "").localeCompare(
    String(b?.rowIndex ?? b?._tempId ?? ""),
  );
}

/**
 * The log page treats newly entered/edited sets as "already done" for UX.
 * We therefore rank against the precomputed SWR top-lift arrays as a baseline,
 * then locally replace current-session rows with their optimistic in-page values.
 * After a full SWR cycle, parsedData/topLifts* naturally converge to the same result.
 */
export function getOptimisticRankingMeta({
  set,
  sets,
  optimisticFieldsByKey,
  isMetric,
  topLiftsByTypeAndReps,
  topLiftsByTypeAndRepsLast12Months,
}) {
  const effectiveSet = getEffectiveSetForRanking(
    set,
    optimisticFieldsByKey[getSetIdentityKey(set)],
  );

  if (
    !effectiveSet?.liftType ||
    !effectiveSet?.reps ||
    effectiveSet.reps < 1 ||
    effectiveSet.reps > 10 ||
    !effectiveSet?.weight
  ) {
    return null;
  }

  const currentSessionSets = sets
    .map((sessionSet, index) =>
      getEffectiveSetForRanking(
        sessionSet,
        optimisticFieldsByKey[getSetIdentityKey(sessionSet, `set-${index}`)],
      ),
    )
    .filter(
      (sessionSet) =>
        (sessionSet?.reps ?? 0) > 0 && (sessionSet?.weight ?? 0) > 0,
    );

  const currentSessionRowIndices = new Set(
    currentSessionSets
      .map((sessionSet) => sessionSet?.rowIndex)
      .filter(Boolean),
  );

  const buildOptimisticLane = (baselineEntries, filterToYear = false) => {
    const baseline = (baselineEntries ?? []).filter(
      (entry) => !currentSessionRowIndices.has(entry?.rowIndex),
    );
    const optimisticSessionEntries = currentSessionSets.filter((sessionSet) => {
      if (sessionSet.reps !== effectiveSet.reps) return false;
      if (filterToYear && !isWithinRollingYear(sessionSet.date)) return false;
      return true;
    });

    return [...baseline, ...optimisticSessionEntries].sort((a, b) =>
      compareRankingEntries(a, b, isMetric),
    );
  };

  const lifetimeLane = buildOptimisticLane(
    topLiftsByTypeAndReps?.[effectiveSet.liftType]?.[effectiveSet.reps - 1],
  );
  const yearlyLane = buildOptimisticLane(
    topLiftsByTypeAndRepsLast12Months?.[effectiveSet.liftType]?.[
      effectiveSet.reps - 1
    ],
    true,
  );

  const effectiveKey = getSetIdentityKey(effectiveSet);
  const getRankForLane = (lane) => {
    const rank = lane.findIndex((entry, index) => {
      const entryKey = getSetIdentityKey(entry, `lane-${index}`);
      return entryKey === effectiveKey;
    });
    return rank !== -1 && rank < 20 ? rank : null;
  };

  const lifetimeRank = getRankForLane(lifetimeLane);
  const yearlyRank = getRankForLane(yearlyLane);

  const lifetime =
    lifetimeRank != null
      ? {
          scope: "lifetime",
          rank: lifetimeRank,
          emoji: getCelebrationEmoji(lifetimeRank),
          message: `${getCelebrationEmoji(lifetimeRank)} Lifetime #${lifetimeRank + 1} ${effectiveSet.reps}RM`,
        }
      : null;

  const yearly =
    yearlyRank != null
      ? {
          scope: "yearly",
          rank: yearlyRank,
          emoji: getCelebrationEmoji(yearlyRank),
          message: `${getCelebrationEmoji(yearlyRank)} 12-month #${yearlyRank + 1} ${effectiveSet.reps}RM`,
        }
      : null;

  return {
    best: lifetime ?? yearly,
    lifetime,
    yearly,
  };
}

export function getRankingMeta({
  liftType,
  reps,
  weight,
  isMetric,
  topLiftsByTypeAndReps,
  topLiftsByTypeAndRepsLast12Months,
}) {
  if (!liftType || !reps || reps < 1 || reps > 10 || !weight) return null;

  const lifetimeRank = getTop20Rank(
    topLiftsByTypeAndReps?.[liftType]?.[reps - 1],
    weight,
    isMetric,
  );
  const yearlyRank = getTop20Rank(
    topLiftsByTypeAndRepsLast12Months?.[liftType]?.[reps - 1],
    weight,
    isMetric,
  );

  const lifetime =
    lifetimeRank != null
      ? {
          scope: "lifetime",
          rank: lifetimeRank,
          emoji: getCelebrationEmoji(lifetimeRank),
          message: `${getCelebrationEmoji(lifetimeRank)} Lifetime #${lifetimeRank + 1} ${reps}RM`,
        }
      : null;

  const yearly =
    yearlyRank != null
      ? {
          scope: "yearly",
          rank: yearlyRank,
          emoji: getCelebrationEmoji(yearlyRank),
          message: `${getCelebrationEmoji(yearlyRank)} 12-month #${yearlyRank + 1} ${reps}RM`,
        }
      : null;

  const best = lifetime ?? yearly;

  return { best, lifetime, yearly };
}
