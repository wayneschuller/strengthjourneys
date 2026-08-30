/**
 * Picks the sets worth showing back to an athlete for one lift.
 *
 * The old rule was "any all-time rep PR in the last four weeks", which fails
 * exactly where this card matters most. An athlete twelve years into a lift
 * sets an all-time rep PR a few times a year, so four weeks of their training
 * usually contains none and the section renders empty — while a beginner three
 * months in gets a wall of them. Either way the athlete learns nothing about
 * the last month of work.
 *
 * So instead: rank by estimated 1RM, widen the window until there is enough
 * material to rank, and space the picks out in time. That last part is the
 * same heuristic the charts use to label their peaks (see selectTopPoints in
 * chart-visuals.js) — take the best, then refuse anything too close to it, so
 * five highlights describe five moments rather than five sets from one good
 * afternoon.
 */

import { estimateE1RM } from "@/lib/estimate-e1rm";
import { getDisplayWeight } from "@/lib/processing-utils";
import { formatDateToYmdLocal, subtractDaysFromStr } from "@/lib/date-utils";

// Tried smallest-first. The first window holding enough separate training days
// to be worth ranking wins, so someone on a six-week rotation still gets a
// real list rather than an empty one.
//
// Three months is the floor rather than one, because a month of a single lift
// is one training block: the top five sets in it tend to be the same wave
// climbing, and four of them say nothing the fifth did not. A quarter is long
// enough to hold a deload, a peak and a return, which is a story. It also
// matches DORMANT_AFTER_DAYS, so "recent" means the same span in the heading
// as it does in the decision to show recent work at all.
export const HIGHLIGHT_WINDOWS = [
  { days: 91, label: "last 3 months" },
  { days: 182, label: "last 6 months" },
  { days: 365, label: "last 12 months" },
];

// Past this, "recent" is a lie. A lift untouched for a quarter gets its career
// highlights instead, under a heading that says so.
export const DORMANT_AFTER_DAYS = 91;

/**
 * @param {Object} args
 * @param {Array} args.parsedData - Canonical parsed lift array.
 * @param {string} args.liftType - Lift to summarise (e.g. "Back Squat").
 * @param {boolean} args.isMetric - Athlete display-unit preference.
 * @param {string} [args.e1rmFormula] - E1RM equation name.
 * @param {Array<Array>} [args.topLiftsByReps] - topLiftsByTypeAndReps[liftType],
 *   used only to annotate a pick that also happens to be an all-time rep PR.
 * @param {string} [args.todayYmd] - Injectable "today" for testing.
 * @param {number} [args.limit=5] - Most highlights to return.
 * @param {number} [args.minSessions=4] - Training days a window needs to qualify.
 * @returns {{scope: "recent"|"career", windowLabel: string, highlights: Array}|null}
 */
export function buildLiftHighlights({
  parsedData,
  liftType,
  isMetric,
  e1rmFormula = "Brzycki",
  topLiftsByReps,
  todayYmd,
  limit = 5,
  minSessions = 4,
}) {
  if (!Array.isArray(parsedData) || parsedData.length === 0) return null;

  const today = todayYmd ?? formatDateToYmdLocal(new Date());

  const sets = [];
  for (const lift of parsedData) {
    if (lift.liftType !== liftType || lift.isGoal) continue;
    const { value: weight, unit } = getDisplayWeight(lift, isMetric);
    if (!(weight > 0) || !(lift.reps > 0)) continue;
    sets.push({
      date: lift.date,
      reps: lift.reps,
      weight,
      unit,
      url: typeof lift.URL === "string" ? lift.URL : null,
      e1rm: estimateE1RM(lift.reps, weight, e1rmFormula),
      prKey: prKeyOf(lift),
    });
  }
  if (sets.length === 0) return null;

  const lastDate = sets.reduce(
    (latest, set) => (set.date > latest ? set.date : latest),
    sets[0].date,
  );

  // Career mode covers both "hasn't touched it in months" and "has barely
  // touched it at all" — in each case there is no recent story to tell, and
  // the athlete's best-ever work is the honest thing to show instead.
  let pool = null;
  let windowLabel = "all time";
  let scope = "career";

  if (daysBetweenYmd(lastDate, today) <= DORMANT_AFTER_DAYS) {
    for (const window of HIGHLIGHT_WINDOWS) {
      const start = subtractDaysFromStr(today, window.days);
      const inWindow = sets.filter((set) => set.date >= start);
      if (countDates(inWindow) >= minSessions) {
        pool = inWindow;
        windowLabel = window.label;
        scope = "recent";
        break;
      }
    }
  }
  if (!pool) pool = sets;

  const prRanks = buildPRRankMap(topLiftsByReps);

  return {
    scope,
    windowLabel,
    highlights: pickSpacedBest(pool, limit).map((set) => ({
      date: set.date,
      reps: set.reps,
      weight: set.weight,
      unit: set.unit,
      e1rm: set.e1rm,
      url: set.url,
      prRank: prRanks.get(set.prKey) ?? null,
    })),
  };
}

/**
 * Best first, then anything too close in time to an already-chosen pick is
 * skipped in favour of the next best somewhere else.
 *
 * The separation scales with how much time the pool actually covers, so the
 * same rule gives roughly one pick per couple of days across a month and one
 * per training era across a career. Floored at a day so two sets from the same
 * session can never both appear, capped so a long history still fills the list.
 */
function pickSpacedBest(pool, limit) {
  const dates = pool.map((set) => set.date);
  const spanDays = daysBetweenYmd(
    dates.reduce((a, b) => (a < b ? a : b)),
    dates.reduce((a, b) => (a > b ? a : b)),
  );
  const separation = Math.min(Math.max(Math.round(spanDays / 12), 1), 180);

  // Ties break towards the earlier session — that is the day it was earned.
  const ranked = [...pool].sort(
    (a, b) => b.e1rm - a.e1rm || (a.date < b.date ? -1 : 1),
  );

  const chosen = [];
  for (const set of ranked) {
    if (chosen.length === limit) break;
    const clear = chosen.every(
      (taken) => Math.abs(daysBetweenYmd(set.date, taken.date)) >= separation,
    );
    if (clear) chosen.push(set);
  }

  return chosen.sort((a, b) => (a.date > b.date ? -1 : 1));
}

/**
 * Maps a set to its standing in the athlete's all-time list for that rep count,
 * so a highlight that is also a rep PR can say so. Sets that never charted are
 * simply absent — most highlights in a long career are not PRs, and the row
 * falls back to the E1RM that got it picked.
 */
function buildPRRankMap(topLiftsByReps) {
  const ranks = new Map();
  if (!Array.isArray(topLiftsByReps)) return ranks;

  for (const repRange of topLiftsByReps) {
    if (!Array.isArray(repRange)) continue;
    repRange.forEach((lift, index) => {
      const key = prKeyOf(lift);
      // Same weight and reps on the same day is the same achievement; keep the
      // best standing rather than whichever row happened to come last.
      if (!ranks.has(key)) ranks.set(key, index);
    });
  }
  return ranks;
}

// Raw stored weight, not display units: this key has to match between
// parsedData and the top-lift tables, and rounding into kg/lb would not.
function prKeyOf(lift) {
  return `${lift.date}|${lift.reps}|${lift.weight}|${lift.unitType}`;
}

function countDates(sets) {
  return new Set(sets.map((set) => set.date)).size;
}

function daysBetweenYmd(startDate, endDate) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((new Date(endDate) - new Date(startDate)) / msPerDay);
}
