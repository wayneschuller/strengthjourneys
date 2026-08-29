/**
 * Derived "athlete story" numbers for a single lift.
 *
 * The lift journey card already had PRs, tiers and a chronology chart, but it
 * could not answer the questions a lifter actually asks about a lift they have
 * trained for years: how much have I moved in total, how long have I been at
 * it, and am I going up right now. Those all need one pass over parsedData in
 * the athlete's display units, which is what this module provides.
 *
 * Kept out of the card component so the card stays about layout and so the
 * same numbers can be reused elsewhere without duplicating the loop.
 */

import { estimateE1RM } from "@/lib/estimate-e1rm";
import { getDisplayWeight } from "@/lib/processing-utils";
import { formatDateToYmdLocal, subtractDaysFromStr } from "@/lib/date-utils";

// Two equal-length windows keep the momentum comparison honest for lifters who
// train sporadically: a short recent window against a long baseline would read
// as a decline every time someone takes a fortnight off.
export const MOMENTUM_WINDOW_DAYS = 90;

/**
 * Single pass over parsedData for one lift type.
 *
 * @param {Object} args
 * @param {Array} args.parsedData - Canonical parsed lift array.
 * @param {string} args.liftType - Lift to summarise (e.g. "Back Squat").
 * @param {boolean} args.isMetric - Athlete display-unit preference.
 * @param {string} args.e1rmFormula - E1RM equation name (e.g. "Brzycki").
 * @param {string} [args.todayYmd] - Injectable "today" for testing.
 * @returns {Object|null} Journey stats, or null when the athlete has no sets of this lift.
 */
export function summarizeLiftJourney({
  parsedData,
  liftType,
  isMetric,
  e1rmFormula = "Brzycki",
  todayYmd,
}) {
  if (!Array.isArray(parsedData) || parsedData.length === 0) return null;

  const today = todayYmd ?? formatDateToYmdLocal(new Date());
  const momentumStart = subtractDaysFromStr(today, MOMENTUM_WINDOW_DAYS);
  const priorStart = subtractDaysFromStr(today, MOMENTUM_WINDOW_DAYS * 2);

  const sessionDates = new Set();
  let totalSets = 0;
  let totalReps = 0;
  let tonnage = 0;
  let recentBestE1RM = 0;
  let priorBestE1RM = 0;
  let firstDate = null;
  let lastDate = null;

  for (const lift of parsedData) {
    if (lift.liftType !== liftType || lift.isGoal) continue;

    const { value: weight } = getDisplayWeight(lift, isMetric);

    totalSets += 1;
    totalReps += lift.reps;
    tonnage += weight * lift.reps;
    sessionDates.add(lift.date);
    if (!firstDate || lift.date < firstDate) firstDate = lift.date;
    if (!lastDate || lift.date > lastDate) lastDate = lift.date;

    // Only the two momentum windows need an E1RM estimate, so skip the maths
    // for the many years of sets that fall outside them.
    if (lift.date >= momentumStart) {
      const e1rm = estimateE1RM(lift.reps, weight, e1rmFormula);
      if (e1rm > recentBestE1RM) recentBestE1RM = e1rm;
    } else if (lift.date >= priorStart) {
      const e1rm = estimateE1RM(lift.reps, weight, e1rmFormula);
      if (e1rm > priorBestE1RM) priorBestE1RM = e1rm;
    }
  }

  if (totalSets === 0) return null;

  return {
    totalSets,
    totalReps,
    tonnage,
    firstDate,
    lastDate,
    sessionCount: sessionDates.size,
    daysSinceLast: lastDate ? daysBetweenYmd(lastDate, today) : null,
    recentBestE1RM,
    priorBestE1RM,
  };
}

function daysBetweenYmd(startDate, endDate) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.max(
    0,
    Math.round((new Date(endDate) - new Date(startDate)) / msPerDay),
  );
}
