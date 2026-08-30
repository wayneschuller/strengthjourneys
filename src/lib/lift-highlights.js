/**
 * Picks the sets worth showing back to an athlete for one lift, and works out
 * what to say about each one.
 *
 * The original rule was "any all-time rep PR in the last four weeks", which
 * fails hardest on the athletes this card is for: twelve years into a lift you
 * set an all-time rep PR a few times a year, so four weeks of training usually
 * contains none and the section renders empty.
 *
 * Ranking purely by estimated 1RM fixed the empty list but introduced its own
 * blind spot. E1RM flattens a heavy single and a hard-won set of eight into one
 * number, and the set of eight loses — so the first time an athlete grinds out
 * their best-ever 8RM, the thing they would actually want to hear about, it
 * never makes the list. A first-ever 8RM is a bigger event than a single that
 * happens to estimate two kilos higher.
 *
 * So a set earns its place by whichever claim it can make, strongest first:
 * an all-time PR at its rep count, the best estimate of the window, a return
 * to a weight it has not touched in years, and only then raw E1RM. Selection
 * and wording come from the same judgement — a row's reason for being there is
 * exactly what it says about itself.
 *
 * Picks are then spaced out in time, the same heuristic the charts use to
 * choose which peaks to label (see selectTopPoints in chart-visuals.js), so
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

// How far down an all-time rep-count list still counts as an achievement worth
// announcing. Past fifth best, "#9 best 5RM ever" is a statistic, not news.
const PR_DEPTH = 5;

// A weight at a rep count the athlete has not equalled in this long reads as a
// comeback rather than a normal session.
const DROUGHT_DAYS = 365;

// A set has to reach this share of its own session's best estimate before any
// claim it makes counts. Ramp-up sets are technically PRs at rep counts the
// athlete never works — the first session ever logged sets a "best 10RM" with
// an empty bar — and announcing those buries the real news. Judging a set
// against its own day rather than against the athlete's all-time best is what
// lets a comeback quarter at 70% of peak still have highlights.
const SERIOUS_SET_FRACTION = 0.75;

/**
 * @param {Object} args
 * @param {Array} args.parsedData - Canonical parsed lift array.
 * @param {string} args.liftType - Lift to summarise (e.g. "Back Squat").
 * @param {boolean} args.isMetric - Athlete display-unit preference.
 * @param {string} [args.e1rmFormula] - E1RM equation name.
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

  // Standings are always against the athlete's whole history for this lift,
  // never against the window — "best ever" has to mean ever.
  const repHistory = buildRepHistory(sets);
  const sessionBests = buildSessionBests(sets);
  const bestPoolE1RM = pool.reduce((best, set) => Math.max(best, set.e1rm), 0);

  const described = pool.map((set) => ({
    ...set,
    ...describeSet(set, {
      repHistory,
      sessionBests,
      bestPoolE1RM,
      // "Top estimated 1RM" on its own is ambiguous in a list whose period
      // changes: the row has to name the span it won, not leave the reader to
      // find it in the heading above.
      periodNote:
        scope === "recent"
          ? `Top est. 1RM, ${windowLabel}`
          : "Best est. 1RM ever",
    }),
  }));

  return {
    scope,
    windowLabel,
    highlights: pickSpacedBest(described, limit).map((set) => ({
      date: set.date,
      reps: set.reps,
      weight: set.weight,
      unit: set.unit,
      e1rm: set.e1rm,
      url: set.url,
      emoji: set.emoji,
      note: set.note,
    })),
  };
}

/**
 * What this set can claim, and how strongly.
 *
 * Priority drives selection as well as wording, which is the point: a set is
 * in the list because of the sentence next to it. Lower sorts first.
 *
 *   0  first time ever at this weight for this rep count
 *   1  the best estimated 1RM in the window — the headline of the period,
 *      always worth a slot even when nothing about it is a PR, and named for
 *      the span it actually won
 *   2  equalled a personal best rather than setting one
 *   3  second through fifth best ever at this rep count
 *   4  heaviest at this rep count in a year or more — a comeback, which E1RM
 *      alone would never surface
 *   5  no claim beyond being heavy; the row shows its estimate instead
 */
function describeSet(
  set,
  { repHistory, sessionBests, bestPoolE1RM, periodNote },
) {
  const sessionBest = sessionBests.get(set.date) ?? set.e1rm;
  if (set.e1rm < sessionBest * SERIOUS_SET_FRACTION) return PLAIN;

  const history = repHistory.get(set.reps);
  const rank = history ? history.weights.indexOf(set.weight) : -1;
  const isBestEver = rank === 0;
  const firstAchieved = history?.firstDateByWeight.get(set.weight);

  if (isBestEver && firstAchieved === set.date) {
    return { priority: 0, emoji: "🥇", note: `Best ${set.reps}RM ever` };
  }

  if (set.e1rm === bestPoolE1RM) {
    return { priority: 1, emoji: "📈", note: periodNote };
  }

  if (isBestEver) {
    return {
      priority: 2,
      emoji: "🔁",
      note: `Matched your best ${set.reps}RM`,
    };
  }

  if (rank > 0 && rank < PR_DEPTH) {
    return {
      priority: 3,
      emoji: RANK_EMOJI[rank],
      note: `#${rank + 1} best ${set.reps}RM ever`,
    };
  }

  const drought = daysSinceEqualled(set, history);
  if (drought != null && drought >= DROUGHT_DAYS) {
    return {
      priority: 4,
      emoji: "⏳",
      note: `Heaviest ${set.reps}RM in ${formatDrought(drought)}`,
    };
  }

  return PLAIN;
}

// No claim beyond being heavy; the row shows its estimate instead.
const PLAIN = { priority: 5, emoji: null, note: null };

const RANK_EMOJI = ["🥇", "🥈", "🥉", "💪", "👌"];

/** Best estimate of each training day, for the ramp-up test above. */
function buildSessionBests(sets) {
  const bests = new Map();
  for (const set of sets) {
    const best = bests.get(set.date);
    if (best == null || set.e1rm > best) bests.set(set.date, set.e1rm);
  }
  return bests;
}

/**
 * Days back to the last time this athlete lifted this weight or more for this
 * many reps, or null if they never had. Walks backwards from the set's own
 * position, so the usual answer — "last week" — costs a couple of comparisons;
 * only a genuine comeback scans far.
 */
function daysSinceEqualled(set, history) {
  if (!history) return null;
  const { byDate } = history;
  const index = byDate.findIndex(
    (entry) => entry.date === set.date && entry.weight === set.weight,
  );
  if (index < 0) return null;

  for (let i = index - 1; i >= 0; i -= 1) {
    if (byDate[i].weight >= set.weight) {
      return daysBetweenYmd(byDate[i].date, set.date);
    }
  }
  return null;
}

function formatDrought(days) {
  const years = Math.floor(days / 365.25);
  return years >= 2 ? `${years} years` : "over a year";
}

/**
 * Per rep count: every distinct weight the athlete has hit, heaviest first,
 * plus when each was first reached and the whole date-ordered sequence.
 *
 * Ranking distinct weights rather than individual sets is deliberate. Three
 * work sets at the same weight on the same day are one achievement, and a list
 * that calls them first, second and third best would push the genuine runner-up
 * out of the top five.
 */
function buildRepHistory(sets) {
  const history = new Map();

  for (const set of sets) {
    if (!history.has(set.reps)) {
      history.set(set.reps, {
        weights: [],
        firstDateByWeight: new Map(),
        byDate: [],
      });
    }
    const entry = history.get(set.reps);
    entry.byDate.push({ date: set.date, weight: set.weight });

    const firstSeen = entry.firstDateByWeight.get(set.weight);
    if (firstSeen == null) {
      entry.weights.push(set.weight);
      entry.firstDateByWeight.set(set.weight, set.date);
    } else if (set.date < firstSeen) {
      entry.firstDateByWeight.set(set.weight, set.date);
    }
  }

  for (const entry of history.values()) {
    entry.weights.sort((a, b) => b - a);
    entry.byDate.sort((a, b) => (a.date < b.date ? -1 : 1));
  }
  return history;
}

/**
 * Strongest claim first, spaced out in time, and as many different rep schemes
 * as the data will give.
 *
 * Three rules, in order of how much they matter:
 *
 * - Never the same sentence twice. Ranking alone will happily return "Matched
 *   your best 3RM" three times, which reads as a bug rather than a highlight.
 * - One rep count per pass, so "best 8RM, top single, heaviest 5RM in years"
 *   wins over five rows about the same rep scheme. Only a preference: a second
 *   pass fills the remaining slots for an athlete who genuinely only ever does
 *   fives, rather than leaving them with a list of one.
 * - Anything too close in time to an already-chosen pick gives way to the next
 *   best somewhere else. The separation scales with how much time the pool
 *   actually covers, so the same rule gives roughly one pick per week across a
 *   quarter and one per training era across a career. Floored at a day so two
 *   sets from the same session can never both appear, capped so a long history
 *   still fills the list.
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
    (a, b) =>
      a.priority - b.priority || b.e1rm - a.e1rm || (a.date < b.date ? -1 : 1),
  );

  const chosen = [];
  const usedNotes = new Set();
  const usedReps = new Set();

  // First pass takes only sets that have something to say, one rep count each.
  // Letting a claimless set win a slot on rep-count novelty is how an empty-bar
  // set of ten — the only ten an athlete has ever logged — ends up billed as a
  // highlight. The second pass drops both rules and fills what is left on merit.
  const take = (claimedFreshRepsOnly) => {
    for (const set of ranked) {
      if (chosen.length === limit) return;
      if (chosen.includes(set)) continue;
      if (claimedFreshRepsOnly && (!set.note || usedReps.has(set.reps)))
        continue;
      if (set.note && usedNotes.has(set.note)) continue;
      const clear = chosen.every(
        (taken) => Math.abs(daysBetweenYmd(set.date, taken.date)) >= separation,
      );
      if (!clear) continue;

      chosen.push(set);
      usedReps.add(set.reps);
      if (set.note) usedNotes.add(set.note);
    }
  };

  take(true);
  take(false);

  return chosen.sort((a, b) => (a.date > b.date ? -1 : 1));
}

function countDates(sets) {
  return new Set(sets.map((set) => set.date)).size;
}

function daysBetweenYmd(startDate, endDate) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((new Date(endDate) - new Date(startDate)) / msPerDay);
}
