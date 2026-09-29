/**
 * Ranks the big four by which one the athlete is due to train next, and
 * proposes a linear-progression top set for each.
 *
 * "Due" reads the athlete's own rhythm from the last couple of months: a lift
 * squatted every 3 days is due sooner after 3 days than a deadlift pulled once
 * a week. The proposed top set comes from the lift block's own target logic,
 * so the number on the card is the one the block offers once the lift starts.
 */

import { BIG_FOUR_LIFT_TYPES } from "@/lib/lifts/lift-registry";
import { getDaysBetweenYmd } from "@/lib/date-utils";
import {
  RECENT_TOP_SET_SESSION_LIMIT,
  getRecentTopSetHistory,
  getTargetTopSetSummary,
} from "@/components/log/lift-block-coaching-state";

// The rhythm window. Long enough to hold a few sessions of a weekly lift,
// short enough that last season's split doesn't set today's order.
const RHYTHM_WINDOW_DAYS = 60;

// After this long away, one more increment isn't the honest next step. The
// card shows what was lifted last and leaves the jump out.
const STALE_TOP_SET_DAYS = 42;

/**
 * @param {Object} params
 * @param {Array} params.parsedData - The athlete's parsed lifts.
 * @param {string} params.referenceDate - YYYY-MM-DD, usually today.
 * @param {boolean} params.isMetric
 * @returns {Array<{
 *   liftType: string,
 *   lastDate: string|null,
 *   daysSince: number|null,
 *   cadenceDays: number|null,
 *   isDue: boolean,
 *   lastTopSet: {reps: number, weight: number}|null,
 *   nextTopSet: {reps: number, weight: number}|null,
 *   unit: string,
 * }>} All four lifts, most due first. Empty when none has been trained.
 */
export function getBigFourNextUp({ parsedData, referenceDate, isMetric }) {
  if (!Array.isArray(parsedData) || !referenceDate) return [];

  const unit = isMetric ? "kg" : "lb";
  const minIncrement = isMetric ? 2.5 : 5;
  const priorByLift = Object.fromEntries(
    BIG_FOUR_LIFT_TYPES.map((liftType) => [liftType, []]),
  );
  for (const entry of parsedData) {
    if (entry.isGoal || !entry.date || entry.date >= referenceDate) continue;
    priorByLift[entry.liftType]?.push(entry);
  }

  const lifts = BIG_FOUR_LIFT_TYPES.map((liftType, registryIndex) => {
    const prior = priorByLift[liftType];
    const dates = [...new Set(prior.map((e) => e.date))].sort();
    const lastDate = dates.at(-1) ?? null;
    const daysSince = lastDate
      ? getDaysBetweenYmd(lastDate, referenceDate)
      : null;
    const cadenceDays = getCadenceDays(dates, referenceDate);

    const history = getRecentTopSetHistory({
      prior,
      isMetric,
      limit: RECENT_TOP_SET_SESSION_LIMIT,
    });
    const last = history.at(-1) ?? null;
    const target = getTargetTopSetSummary({
      topSetHistory: history,
      minIncrement,
    });
    const isStale = daysSince === null || daysSince > STALE_TOP_SET_DAYS;

    return {
      liftType,
      registryIndex,
      lastDate,
      daysSince,
      cadenceDays,
      // Out of the rhythm entirely, so it ranks after the lifts in rotation.
      dueRatio: cadenceDays ? daysSince / cadenceDays : null,
      isDue: Boolean(cadenceDays) && daysSince >= cadenceDays,
      lastTopSet: last ? { reps: last.reps, weight: last.weight } : null,
      nextTopSet:
        target && !isStale
          ? {
              reps: target.reps,
              // Rounded to the plates, since a kg log viewed in lb would
              // otherwise propose something like 221.6lb.
              weight:
                Math.round((target.weight + minIncrement) / minIncrement) *
                minIncrement,
            }
          : null,
      unit,
    };
  });

  if (lifts.every((lift) => !lift.lastDate)) return [];

  return lifts
    .sort((a, b) => {
      if (a.dueRatio !== null && b.dueRatio !== null) {
        return b.dueRatio - a.dueRatio || b.daysSince - a.daysSince;
      }
      if (a.dueRatio !== null) return -1;
      if (b.dueRatio !== null) return 1;
      // Outside the rhythm: the more recently trained lift is the likelier
      // comeback, and never-trained lifts keep registry order at the end.
      if (a.lastDate && b.lastDate) return b.lastDate.localeCompare(a.lastDate);
      if (a.lastDate || b.lastDate) return a.lastDate ? -1 : 1;
      return a.registryIndex - b.registryIndex;
    })
    .map(({ registryIndex: _index, dueRatio: _ratio, ...lift }) => lift);
}

/**
 * The lift's typical days between sessions inside the rhythm window, or null
 * when it wasn't trained there. The median ignores one missed week. A lift
 * trained once in the window counts the window as its interval, so it still
 * ranks, just as a slow one.
 */
function getCadenceDays(dates, referenceDate) {
  const recent = dates.filter(
    (date) => getDaysBetweenYmd(date, referenceDate) <= RHYTHM_WINDOW_DAYS,
  );
  if (recent.length === 0) return null;
  if (recent.length === 1) return RHYTHM_WINDOW_DAYS / 2;

  const gaps = recent
    .slice(1)
    .map((date, i) => getDaysBetweenYmd(recent[i], date))
    .sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  return gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2;
}

/** "5@152.5kg", the app's usual shorthand for a set. */
export function formatNextUpSet(set, unit) {
  if (!set) return null;
  return `${set.reps}@${set.weight}${unit}`;
}
