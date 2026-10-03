/**
 * Story of the day: finds the moments in a lifter's log worth leading the home
 * dashboard with, and ranks them.
 *
 * Event stories (a PR this week, a meet anniversary, the day they started
 * lifting, a plate milestone within reach, lifetime bests set this year, a PR
 * anniversary) only exist when the log earns them, and always
 * outrank the summary stories (journey length, tonnage, momentum and the
 * like) the line falls back on. That ranking is what keeps a new lifter from
 * being shown lifetime stats they do not have yet.
 *
 * Anniversaries look back over the last seven days rather than only today, so
 * someone who opens the app twice a week still hears about the meet they did
 * three years ago on Tuesday.
 *
 * Everything here is pure so it can run against a real exported log in Node.
 */

import { estimateE1RM } from "@/lib/estimate-e1rm";
import { BIG_FOUR_LIFT_TYPE_SET } from "@/lib/lifts/lift-registry";
import { subtractDaysFromStr } from "@/lib/date-utils";
import { MILESTONES } from "@/lib/home-dashboard/classic-lift";
import { toKg } from "@/lib/weight-units";

export const ANNIVERSARY_WINDOW_DAYS = 7;
export const RECENT_PR_WINDOW_DAYS = 7;
// How far back "recent form" looks when judging whether a milestone is in reach.
const RECENT_FORM_DAYS = 42;
// Recent form must estimate at least this share of the milestone.
const MILESTONE_REACH_SHARE = 0.95;
const LB_PER_KG = 2.20462;

const BIG_FOUR_ORDER = [
  "Back Squat",
  "Bench Press",
  "Deadlift",
  "Strict Press",
];
const LIFT_NOUNS = {
  "Back Squat": "squat",
  "Bench Press": "bench",
  Deadlift: "deadlift",
  "Strict Press": "press",
};

// Event scores sit above anything a summary story can reach
// (SUMMARY_MAX_SCORE), so a real moment always leads.
const STORY_SCORES = {
  recentPr: 100,
  meetAnniversary: 95,
  journeyBirthday: 90,
  milestoneInReach: 80,
  yearPrs: 75,
  prAnniversary: 70,
};
export const SUMMARY_MAX_SCORE = 60;

// Rep counts that mean something to a lifter, in the order we would brag
// about them. A 7RM PR is real but rarely the headline.
const HEADLINE_REPS = [1, 3, 5, 2, 10, 8, 4, 6];

/**
 * Builds the ranked event stories for today. Summary stories are ranked by the
 * caller with rankSummaryStories and merged after these.
 *
 * @param {Object} params
 * @param {Array} params.parsedData - Canonical lift objects, oldest first.
 * @param {Object} params.topLiftsByTypeAndReps - liftType -> [reps-1] -> best-first sets.
 * @param {Map} [params.meetDays] - From lib/meet-detection.js, via the data provider.
 * @param {boolean} [params.isMetric] - Milestones are counted in kg or lb plates.
 * @param {string} params.todayStr - Local YYYY-MM-DD.
 * @returns {Array<Object>} Stories, best first.
 */
export function buildEventStories({
  parsedData,
  topLiftsByTypeAndReps,
  meetDays,
  isMetric = false,
  todayStr,
}) {
  if (!Array.isArray(parsedData) || parsedData.length === 0 || !todayStr) {
    return [];
  }

  const stories = [
    findRecentPrStory(topLiftsByTypeAndReps, todayStr),
    findMilestoneInReachStory(parsedData, isMetric, todayStr),
    findYearPrsStory(topLiftsByTypeAndReps, todayStr),
    ...findAnniversaryStories(
      parsedData,
      topLiftsByTypeAndReps,
      meetDays,
      todayStr,
    ),
  ].filter(Boolean);

  return stories.sort((a, b) => b.score - a.score);
}

/**
 * Gives summary stories a score that shuffles once a day, so the fallback
 * rotation changes daily but holds still between page loads.
 *
 * @param {string[]} keys - Summary story keys, in the stage's preferred order.
 * @param {string} todayStr
 * @returns {Array<{id:string, kind:"summary", score:number}>}
 */
export function rankSummaryStories(keys, todayStr) {
  return keys
    .map((key, index) => ({
      id: key,
      kind: "summary",
      // The stage's order still counts for a little, the day's seed for more.
      score:
        SUMMARY_MAX_SCORE -
        20 -
        index * 2 +
        (hashString(`${todayStr}:${key}`) % 20),
    }))
    .sort((a, b) => b.score - a.score);
}

/**
 * The best heavy set (5 reps or fewer, by estimated max in real load) of each
 * Big Four lift so far this calendar year, in squat, bench, deadlift, press
 * order. Feeds the "best of the year" summary story.
 *
 * @param {Array} parsedData
 * @param {string} todayStr - Local YYYY-MM-DD.
 * @returns {Array<Object>} Lift objects.
 */
export function getYearBestSets(parsedData, todayStr) {
  const yearStart = `${todayStr.slice(0, 4)}-01-01`;
  const best = {};
  for (const entry of parsedData ?? []) {
    if (!entry.date || entry.date < yearStart) continue;
    if (entry.date > todayStr || !BIG_FOUR_LIFT_TYPE_SET.has(entry.liftType)) {
      continue;
    }
    if (!(entry.reps >= 1) || entry.reps > 5 || !(entry.weight > 0)) continue;
    const e1rmKg = toKg(
      estimateE1RM(entry.reps, entry.weight, "Brzycki"),
      entry.unitType,
    );
    if (!best[entry.liftType] || e1rmKg > best[entry.liftType].e1rmKg) {
      best[entry.liftType] = { e1rmKg, entry };
    }
  }
  return BIG_FOUR_ORDER.map((liftType) => best[liftType]?.entry).filter(
    Boolean,
  );
}

// ─── Event finders ─────────────────────────────────────────────────────────

// The next plate milestone above a lift's best ever set, when recent form
// says it is close: the best estimated max of the last six weeks reaches 95%
// of it. The closest such milestone across the Big Four wins. Framed as
// something within reach, never as a gap.
function findMilestoneInReachStory(parsedData, isMetric, todayStr) {
  const unit = isMetric ? "kg" : "lb";
  const milestones = MILESTONES[unit];
  const toUnit = (kg) => (isMetric ? kg : kg * LB_PER_KG);
  const recentStart = subtractDaysFromStr(todayStr, RECENT_FORM_DAYS - 1);

  const heaviestKg = {};
  const recentBest = {};
  for (const entry of parsedData) {
    if (!entry.date || entry.date > todayStr) continue;
    if (!BIG_FOUR_LIFT_TYPE_SET.has(entry.liftType)) continue;
    if (!(entry.reps >= 1) || !(entry.weight > 0)) continue;
    const kg = toKg(entry.weight, entry.unitType);
    heaviestKg[entry.liftType] = Math.max(heaviestKg[entry.liftType] ?? 0, kg);
    if (entry.date >= recentStart && entry.reps <= 10) {
      const e1rmKg = toKg(
        estimateE1RM(entry.reps, entry.weight, "Brzycki"),
        entry.unitType,
      );
      if (
        !recentBest[entry.liftType] ||
        e1rmKg > recentBest[entry.liftType].e1rmKg
      ) {
        recentBest[entry.liftType] = { e1rmKg, entry };
      }
    }
  }

  let best = null;
  for (const [liftType, recent] of Object.entries(recentBest)) {
    const heaviest = toUnit(heaviestKg[liftType]);
    const milestone = milestones.find((value) => value > heaviest + 0.01);
    if (!milestone) continue;
    const estimate = toUnit(recent.e1rmKg);
    if (estimate < milestone * MILESTONE_REACH_SHARE) continue;
    const reach = estimate / milestone;
    if (!best || reach > best.reach) {
      best = { liftType, milestone, reach, recent, estimate };
    }
  }
  if (!best) return null;

  return {
    id: `milestone-in-reach:${best.liftType}:${best.milestone}${unit}`,
    kind: "milestoneInReach",
    score: STORY_SCORES.milestoneInReach,
    liftType: best.liftType,
    liftNoun: LIFT_NOUNS[best.liftType],
    milestone: best.milestone,
    unit,
    lift: best.recent.entry,
    date: best.recent.entry.date,
    estimate: Math.round(best.estimate * 2) / 2,
    daysAgo: getDaysBetween(best.recent.entry.date, todayStr),
  };
}

// Lifetime bests at 1, 3 and 5 reps on the Big Four set this calendar year,
// each beating a best from an earlier year. A first-ever set at a rep count
// is not counted, so a lifter in their first year is not told everything is
// a lifetime best.
function findYearPrsStory(topLiftsByTypeAndReps, todayStr) {
  if (!topLiftsByTypeAndReps) return null;
  const year = todayStr.slice(0, 4);
  const yearStart = `${year}-01-01`;

  const prs = [];
  for (const liftType of BIG_FOUR_ORDER) {
    for (const reps of [1, 3, 5]) {
      const sets = topLiftsByTypeAndReps[liftType]?.[reps - 1];
      const top = sets?.[0];
      if (!top || top.date < yearStart || top.date > todayStr) continue;
      if (!sets.some((set) => set.date < yearStart)) continue;
      prs.push(top);
    }
  }
  if (prs.length === 0) return null;

  const latest = prs.reduce((a, b) => (b.date > a.date ? b : a));
  return {
    id: `year-prs:${year}:${prs.length}`,
    kind: "yearPrs",
    score: STORY_SCORES.yearPrs,
    year,
    prs,
    date: latest.date,
    lift: latest,
  };
}

function findRecentPrStory(topLiftsByTypeAndReps, todayStr) {
  if (!topLiftsByTypeAndReps) return null;
  const windowStart = subtractDaysFromStr(todayStr, RECENT_PR_WINDOW_DAYS - 1);

  let best = null;
  for (const [liftType, byReps] of Object.entries(topLiftsByTypeAndReps)) {
    HEADLINE_REPS.forEach((reps, repRank) => {
      const sets = byReps?.[reps - 1];
      const top = sets?.[0];
      if (!top) return;
      if (top.date < windowStart || top.date > todayStr) return;
      // A first-ever set at a rep count beats nothing, and a heavier set from
      // the same session is just the top set, so the PR needs a best from an
      // earlier day that it outweighs in real load.
      const previous = sets.find((set) => set.date < top.date);
      if (
        !previous ||
        toKg(top.weight, top.unitType) <=
          toKg(previous.weight, previous.unitType)
      ) {
        return;
      }

      const rank =
        (BIG_FOUR_LIFT_TYPE_SET.has(liftType) ? 0 : 100) + repRank * 10;
      if (!best || rank < best.rank) {
        best = { rank, liftType, top, previous };
      }
    });
  }
  if (!best) return null;

  const { liftType, top, previous } = best;
  return {
    id: `recent-pr:${liftType}:${top.reps}:${top.date}`,
    kind: "recentPr",
    score: STORY_SCORES.recentPr,
    liftType,
    date: top.date,
    lift: top,
    previous,
    daysAgo: getDaysBetween(top.date, todayStr),
  };
}

function findAnniversaryStories(
  parsedData,
  topLiftsByTypeAndReps,
  meetDays,
  todayStr,
) {
  const windowByMonthDay = buildAnniversaryWindow(todayStr);
  const firstEntry = parsedData.find((entry) => entry.date);

  const sessionsByDate = new Map();
  for (let i = 0; i < parsedData.length; i++) {
    const entry = parsedData[i];
    if (!entry.date) continue;
    const match = windowByMonthDay.get(entry.date.slice(5));
    if (!match) continue;
    const yearsAgo = match.year - Number(entry.date.slice(0, 4));
    if (yearsAgo < 1) continue;
    if (!sessionsByDate.has(entry.date)) sessionsByDate.set(entry.date, []);
    sessionsByDate.get(entry.date).push(entry);
  }

  const stories = [];

  if (firstEntry) {
    const match = windowByMonthDay.get(firstEntry.date.slice(5));
    const yearsAgo = match
      ? match.year - Number(firstEntry.date.slice(0, 4))
      : 0;
    if (match && yearsAgo >= 1) {
      stories.push({
        id: `journey-birthday:${firstEntry.date}`,
        kind: "journeyBirthday",
        score: STORY_SCORES.journeyBirthday,
        liftType: firstEntry.liftType,
        date: firstEntry.date,
        lift: firstEntry,
        yearsAgo,
        daysAgo: match.daysAgo,
      });
    }
  }

  // The most recent meet in the window wins if a lifter somehow competed on
  // two of these seven days across different years.
  let meet = null;
  for (const [date, meetDay] of meetDays ?? []) {
    const match = windowByMonthDay.get(date.slice(5));
    if (!match || match.year - Number(date.slice(0, 4)) < 1) continue;
    if (!meet || date > meet.date) meet = { date, meetDay, match };
  }
  if (meet) {
    stories.push({
      id: `meet-anniversary:${meet.date}`,
      kind: "meetAnniversary",
      score: STORY_SCORES.meetAnniversary,
      date: meet.date,
      meetName: meet.meetDay.name,
      // Squat, bench, deadlift, the order a meet runs in.
      bestSingles: MEET_LIFT_ORDER.map(
        (liftType) => meet.meetDay.topSets[liftType],
      ).filter(Boolean),
      yearsAgo: meet.match.year - Number(meet.date.slice(0, 4)),
      daysAgo: meet.match.daysAgo,
    });
  }

  const prAnniversary = findPrAnniversary(
    sessionsByDate,
    windowByMonthDay,
    topLiftsByTypeAndReps,
  );
  if (prAnniversary) stories.push(prAnniversary);

  return stories;
}

// The most brag-worthy set that was a PR on the day, with a bonus when it is
// still the lifetime best.
function findPrAnniversary(
  sessionsByDate,
  windowByMonthDay,
  topLiftsByTypeAndReps,
) {
  let best = null;
  for (const [date, entries] of sessionsByDate) {
    for (const entry of entries) {
      if (!entry.isHistoricalPR) continue;
      const repRank = HEADLINE_REPS.indexOf(entry.reps);
      if (repRank === -1) continue;

      const lifetimeTop =
        topLiftsByTypeAndReps?.[entry.liftType]?.[entry.reps - 1]?.[0];
      const isStillBest =
        !!lifetimeTop &&
        lifetimeTop.date === entry.date &&
        lifetimeTop.weight === entry.weight;
      // Among PRs that have since been beaten, the one closest to today's
      // best is the better memory: a near-lifetime single beats a first-year
      // one.
      const shareOfLifetimeBest =
        lifetimeTop?.weight > 0 ? entry.weight / lifetimeTop.weight : 0;
      const rank =
        (BIG_FOUR_LIFT_TYPE_SET.has(entry.liftType) ? 0 : 100) +
        (isStillBest ? 0 : 20 + (1 - Math.min(1, shareOfLifetimeBest)) * 60) +
        repRank * 10;

      if (!best || rank < best.rank) {
        best = { rank, date, entry, isStillBest };
      }
    }
  }
  if (!best) return null;

  const match = windowByMonthDay.get(best.date.slice(5));
  return {
    id: `pr-anniversary:${best.entry.liftType}:${best.entry.reps}:${best.date}`,
    kind: "prAnniversary",
    score: STORY_SCORES.prAnniversary + (best.isStillBest ? 5 : 0),
    liftType: best.entry.liftType,
    date: best.date,
    lift: best.entry,
    isStillBest: best.isStillBest,
    yearsAgo: match.year - Number(best.date.slice(0, 4)),
    daysAgo: match.daysAgo,
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

// MM-DD for today and the six days before it, each remembering its own year
// and how many days back it is. The year matters in the first week of
// January, when part of the window sits in last year.
function buildAnniversaryWindow(todayStr) {
  const window = new Map();
  for (let daysAgo = 0; daysAgo < ANNIVERSARY_WINDOW_DAYS; daysAgo++) {
    const dateStr = subtractDaysFromStr(todayStr, daysAgo);
    window.set(dateStr.slice(5), {
      year: Number(dateStr.slice(0, 4)),
      daysAgo,
    });
  }
  return window;
}

const MEET_LIFT_ORDER = [
  "Back Squat",
  "Bench Press",
  "Deadlift",
  "Strict Press",
];

function getDaysBetween(fromStr, toStr) {
  const from = Date.UTC(
    Number(fromStr.slice(0, 4)),
    Number(fromStr.slice(5, 7)) - 1,
    Number(fromStr.slice(8, 10)),
  );
  const to = Date.UTC(
    Number(toStr.slice(0, 4)),
    Number(toStr.slice(5, 7)) - 1,
    Number(toStr.slice(8, 10)),
  );
  return Math.round((to - from) / 86400000);
}

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}
