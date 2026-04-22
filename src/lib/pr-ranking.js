/** @format */
// pr-ranking.js
// Pure helpers for ranking a set against lifetime / rolling-year top-N arrays.
// Safe to use anywhere in the app — no React, no context, no side effects.

import {
  getDisplayWeight,
  getCelebrationEmoji,
} from "@/lib/processing-utils";

/**
 * Find the 0-indexed rank a given weight would occupy in a precomputed top-lifts
 * array (already sorted heaviest-first). Returns null if the weight doesn't
 * crack the top 20. Used to badge a set as "Lifetime #3" / "12-month #7" etc.
 *
 * @param {Array<object>} topLifts - Sorted array of lift objects (heaviest first).
 * @param {number} weight - The candidate weight, in the user's display unit.
 * @param {boolean} isMetric - True if `weight` is in kg, false if lb.
 * @returns {number|null} 0-based rank (0..19), or null if outside the top 20.
 */
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

/**
 * Stable identity key for a set across persisted and in-flight states.
 * Prefers `rowIndex` (sheet-backed) then `_tempId` (optimistic) so the same
 * set maps to the same key before and after it syncs to Google Sheets.
 *
 * @param {object} set - Set object (may have `rowIndex` or `_tempId`).
 * @param {string} [fallback="pending"] - Returned when neither id is present.
 * @returns {string} A stable key usable in Maps/Sets/object keys.
 */
export function getSetIdentityKey(set, fallback = "pending") {
  if (set?.rowIndex != null) return `row:${set.rowIndex}`;
  if (set?._tempId) return `tmp:${set._tempId}`;
  return fallback;
}

/**
 * Overlay optimistic in-page field edits on a persisted set for ranking purposes.
 * The log page lets users edit reps/weight/unit before they sync to the sheet —
 * we want ranks to reflect the *displayed* values, not the last-saved ones.
 *
 * @param {object} set - Persisted set.
 * @param {{ reps?: number, weight?: number, unitType?: string, notes?: string, url?: string }} [optimisticFields]
 * @returns {object} The set with optimistic fields shallow-merged in (or the set unchanged).
 */
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

/**
 * Is the given YYYY-MM-DD date within the last 365 days from now? Used to
 * decide whether a set belongs in the rolling-year top-lifts lane alongside
 * the all-time lifetime lane.
 *
 * @param {string} date - `YYYY-MM-DD` date string.
 * @returns {boolean}
 */
export function isWithinRollingYear(date) {
  if (!date) return false;
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  return new Date(`${date}T00:00:00Z`) >= cutoff;
}

/**
 * Sort comparator for ranking lanes: heavier first, then earlier date (PR goes
 * to the lift who reached the weight first), then row/temp id as a stable
 * tiebreaker so rankings don't jitter between renders.
 *
 * @param {object} a - Lift entry.
 * @param {object} b - Lift entry.
 * @param {boolean} isMetric - True if weights should be compared in kg, false lb.
 * @returns {number} Standard comparator result.
 */
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
 *
 * @param {object} args
 * @param {object} args.set - The set being ranked (needs liftType, reps, weight).
 * @param {Array<object>} args.sets - All sets in the current session (for optimistic overlay).
 * @param {Record<string, object>} args.optimisticFieldsByKey - Keyed by `getSetIdentityKey(set)`.
 * @param {boolean} args.isMetric
 * @param {Record<string, Array<Array<object>>>} args.topLiftsByTypeAndReps -
 *   SWR-precomputed lifetime tops, indexed `[liftType][reps-1]`.
 * @param {Record<string, Array<Array<object>>>} args.topLiftsByTypeAndRepsLast12Months -
 *   Same shape, rolling 12-month window.
 * @returns {{ best: object|null, lifetime: object|null, yearly: object|null } | null}
 *   `best = lifetime ?? yearly`. Null if the set can't be ranked (bad input or reps out of 1..10).
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

/**
 * Non-optimistic variant of `getOptimisticRankingMeta` — ranks a raw
 * lift/reps/weight triple against the precomputed top-lift arrays directly.
 * Use this outside the log page (e.g. analyzer, history) where there are no
 * in-flight session edits to overlay.
 *
 * @param {object} args
 * @param {string} args.liftType
 * @param {number} args.reps - Must be 1..10.
 * @param {number} args.weight - In the user's display unit.
 * @param {boolean} args.isMetric
 * @param {Record<string, Array<Array<object>>>} args.topLiftsByTypeAndReps
 * @param {Record<string, Array<Array<object>>>} args.topLiftsByTypeAndRepsLast12Months
 * @returns {{ best: object|null, lifetime: object|null, yearly: object|null } | null}
 */
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
