/**
 * Best estimated one-rep-maxes read straight from the parsed log, for any date
 * window. Complements `findBestE1RM` in processing-utils, which answers the
 * all-time question from the precomputed top-lifts table.
 *
 * Callers never state a unit. Sets are ranked in kilograms so a log that mixes
 * kg and lb rows still picks the right winner, and each answer comes back in
 * the unit that set was logged in, the same `{ bestLift, bestE1RMWeight,
 * unitType }` shape as `findBestE1RM`. Convert at the edge with
 * `@/lib/weight-units` or `getDisplayWeight`.
 *
 * Plain barbell maths only: bodyweight-loaded lifts (pull ups, dips) need the
 * athlete's bodyweight and go through `estimateLiftE1RM` instead.
 */
import {
  addDaysFromStr,
  getDaysBetweenYmd,
  subtractDaysFromStr,
} from "@/lib/date-utils";
import { estimateE1RM } from "@/lib/estimate-e1rm";
import { toKg } from "@/lib/weight-units";

const NO_BEST = { bestLift: null, bestE1RMWeight: 0, unitType: "lb" };

/**
 * Best e1RM for one lift between two dates (both inclusive, both optional).
 *
 * @param {Array} parsedData - The app's parsed lift entries
 * @param {string} liftType - e.g. "Back Squat"
 * @param {{sinceDate?: string, untilDate?: string, e1rmFormula?: string}} [options]
 *   Dates are "YYYY-MM-DD". Leave both out for the all-time best.
 * @returns {{bestLift: Object|null, bestE1RMWeight: number, unitType: string}}
 */
export function findBestE1RMInWindow(
  parsedData,
  liftType,
  { sinceDate, untilDate, e1rmFormula } = {},
) {
  if (!parsedData?.length) return NO_BEST;

  let best = NO_BEST;
  let bestKg = 0;

  for (const entry of parsedData) {
    if (entry.liftType !== liftType || !isRealSet(entry)) continue;
    if (sinceDate && entry.date < sinceDate) continue;
    if (untilDate && entry.date > untilDate) continue;

    const e1rm = estimateE1RM(entry.reps, entry.weight, e1rmFormula);
    const e1rmKg = toKg(e1rm, entry.unitType);
    if (e1rmKg > bestKg) {
      bestKg = e1rmKg;
      best = {
        bestLift: entry,
        bestE1RMWeight: e1rm,
        unitType: entry.unitType || "lb",
      };
    }
  }

  return best;
}

/**
 * A lifter's rolling best e1RM over time, for the "how has this moved" charts.
 *
 * Sample dates run from `windowDays` after the first logged set to the last
 * one, spaced by career length (weekly under six months, fortnightly under two
 * years, monthly beyond), and always end on the last logged date so the chart
 * finishes where the lifter is today. Each sample holds the best e1RM per lift
 * inside the `windowDays` leading up to it, or null when that lift was not
 * trained in the window.
 *
 * @param {Array} parsedData - The app's parsed lift entries
 * @param {string[]} liftTypes - Lifts to track together on one timeline
 * @param {{windowDays?: number, e1rmFormula?: string}} [options]
 * @returns {Array<{date: string, bests: Object<string, {bestE1RMWeight: number, unitType: string}|null>}>}
 */
export function sampleRollingBestE1RMs(
  parsedData,
  liftTypes,
  { windowDays = 90, e1rmFormula } = {},
) {
  if (!parsedData?.length || !liftTypes?.length) return [];

  // Estimate once per set up front; the sampling loop below revisits them.
  const setsByLift = Object.fromEntries(liftTypes.map((type) => [type, []]));
  let firstDate = null;
  let lastDate = null;
  let setCount = 0;

  for (const entry of parsedData) {
    const sets = setsByLift[entry.liftType];
    if (!sets || !isRealSet(entry)) continue;

    const e1rm = estimateE1RM(entry.reps, entry.weight, e1rmFormula);
    sets.push({
      date: entry.date,
      e1rm,
      e1rmKg: toKg(e1rm, entry.unitType),
      unitType: entry.unitType || "lb",
    });
    if (!firstDate || entry.date < firstDate) firstDate = entry.date;
    if (!lastDate || entry.date > lastDate) lastDate = entry.date;
    setCount++;
  }

  if (setCount < 2) return [];

  for (const type of liftTypes) {
    setsByLift[type].sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
    );
  }

  const spanDays = getDaysBetweenYmd(firstDate, lastDate);
  const intervalDays = spanDays <= 180 ? 7 : spanDays <= 730 ? 14 : 30;

  // Start a full window in, so the first point has history to look back on.
  const sampleDates = [];
  let cursor = addDaysFromStr(firstDate, windowDays);
  while (cursor <= lastDate) {
    sampleDates.push(cursor);
    cursor = addDaysFromStr(cursor, intervalDays);
  }
  if (sampleDates[sampleDates.length - 1] !== lastDate) {
    sampleDates.push(lastDate);
  }

  // Samples only move forward, so each lift's window start never moves back.
  const windowStart = Object.fromEntries(liftTypes.map((type) => [type, 0]));

  return sampleDates.map((date) => {
    const cutoff = subtractDaysFromStr(date, windowDays);
    const bests = {};

    for (const type of liftTypes) {
      const sets = setsByLift[type];
      let i = windowStart[type];
      while (i < sets.length && sets[i].date < cutoff) i++;
      windowStart[type] = i;

      let best = null;
      for (; i < sets.length && sets[i].date <= date; i++) {
        if (!best || sets[i].e1rmKg > best.e1rmKg) best = sets[i];
      }
      bests[type] = best
        ? { bestE1RMWeight: best.e1rm, unitType: best.unitType }
        : null;
    }

    return { date, bests };
  });
}

// A set that was actually lifted: not a goal row, not a failed rep, and dated.
function isRealSet(entry) {
  return (
    !entry.isGoal && entry.reps > 0 && entry.weight > 0 && Boolean(entry.date)
  );
}
