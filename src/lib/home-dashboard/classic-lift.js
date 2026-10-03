/**
 * Classic lift: picks one memorable big-four lift from the lifter's whole log
 * for the story of the day.
 *
 * A small rule engine, rebuilt in October 2026 to replace a large scoring
 * model whose note keywords never matched and whose final pick was a uniform
 * draw from seventy-odd near-identical heavy singles. The rules:
 *
 * - Moments, not sets. A session gives at most one classic lift, so a day of
 *   heavy singles is one memory, not five. The exception is a meet day, which
 *   gives one per lift: the squat, bench and deadlift of a meet are three
 *   separate memories.
 * - Sources a lifter recognises: meet days, lifetime bests at 1, 3 and 5
 *   reps, the first time over a plate milestone, the best lift of each year,
 *   and heavy sets on video.
 * - Labels a lifter would say out loud ("Your first 200kg deadlift"), never
 *   engine terms.
 * - The pick is weighted by score and spread across the years, so a twelve
 *   year log does not keep returning to its peak year.
 *
 * Note text plays no part in the scoring. It is shown as the commentary, in
 * the lifter's own words, which says more than any keyword match could.
 *
 * Everything here is pure so it can run against a real exported log in Node.
 */

import { estimateE1RM } from "@/lib/estimate-e1rm";
import { BIG_FOUR_LIFT_TYPES } from "@/lib/lifts/lift-registry";
import { toKg } from "@/lib/weight-units";

const LB_PER_KG = 2.20462;

// Plate milestones: one to five plates a side, in the units the lifter reads.
// 200kg and 500lb join them because every lifter counts those too.
const MILESTONES = {
  kg: [60, 100, 140, 180, 200, 220, 260, 300],
  lb: [135, 225, 315, 405, 495, 500, 585, 675],
};

const LIFT_NOUNS = {
  "Back Squat": "squat",
  "Bench Press": "bench",
  Deadlift: "deadlift",
  "Strict Press": "press",
};

const PR_REP_LABELS = { 1: "single", 3: "triple", 5: "set of 5" };

// Base scores per source, before the video and note bonuses. A meet is the
// biggest day in most lifters' logs; a year's best is the gentlest memory.
const SOURCE_SCORES = {
  meet: 100,
  lifetimePr: { 1: 95, 3: 85, 5: 80 },
  milestone: 70,
  yearBest: 55,
  filmed: 50,
};
const VIDEO_BONUS = 15;
const NOTE_BONUS = 5;

// A filmed set counts as a source when it is within this share of the
// lifter's best estimated max for that lift.
const FILMED_SHARE_OF_BEST = 0.9;
const FILMED_PER_YEAR = 3;

// A year needs this many sessions of a lift before its best is a memory
// rather than an accident of a few stray sets.
const YEAR_BEST_MIN_SESSIONS = 6;

/**
 * Picks one classic lift from buildClassicLiftCandidates' list: a year first
 * (weighted by its strongest memory), then a lift within it (weighted by
 * score). Squaring the scores keeps the best memories ahead without making a
 * year's best impossible, and choosing the year first stops a twelve-year
 * log from living in its peak year.
 *
 * @param {Array} candidates
 * @param {() => number} [random=Math.random] - Injectable for tests.
 * @returns {{lift:Object, label:string, source:string, score:number}|null}
 */
export function pickClassicLiftFrom(candidates, random = Math.random) {
  if (!candidates?.length) return null;

  const byYear = new Map();
  for (const candidate of candidates) {
    const year = candidate.lift.date.slice(0, 4);
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push(candidate);
  }

  const years = Array.from(byYear.values()).map((list) => ({
    list,
    weight: Math.max(...list.map((candidate) => candidate.score)) ** 2,
  }));
  const { list } = weightedChoice(years, (year) => year.weight, random);
  return weightedChoice(list, (candidate) => candidate.score ** 2, random);
}

/**
 * Every classic lift candidate, one per session (one per lift on meet days),
 * best first. Exported so the rules can be checked against real logs.
 *
 * @param {Object} params
 * @param {Array} params.parsedData - Canonical lift objects.
 * @param {boolean} params.isMetric - Milestones are counted in kg or lb plates.
 * @param {Map} [params.meetDays] - From lib/meet-detection.js, via the data provider.
 */
export function buildClassicLiftCandidates({ parsedData, isMetric, meetDays }) {
  if (!Array.isArray(parsedData) || parsedData.length === 0) return [];

  const sessions = groupBigFourSessions(parsedData, meetDays);
  if (sessions.length === 0) return [];

  const milestoneUnit = isMetric ? "kg" : "lb";
  const raw = [];

  // Pass one: the chronological walk. Milestones need order ("the first
  // time"), and lifetime bests and each lift's best estimate fall out of the
  // same walk.
  const lifetimeBest = {}; // liftType -> reps -> { kg, entry }
  const bestE1rmKg = {}; // liftType -> kg
  const milestonesPassed = {}; // liftType -> highest milestone index passed
  const firstSessionDate = {}; // liftType -> date it was first logged
  const yearly = {}; // `${liftType}|${year}` -> { sessions, best: { e1rmKg, entry } }

  for (const { date, entries, isMeet } of sessions) {
    const year = date.slice(0, 4);
    const liftsToday = new Set();

    for (const entry of entries) {
      const { liftType, reps } = entry;
      const kg = toKg(entry.weight, entry.unitType);
      const e1rmKg = toKg(
        estimateE1RM(reps, entry.weight, "Brzycki"),
        entry.unitType,
      );
      liftsToday.add(liftType);
      firstSessionDate[liftType] ??= date;

      if (PR_REP_LABELS[reps]) {
        lifetimeBest[liftType] ??= {};
        const current = lifetimeBest[liftType][reps];
        if (!current || kg > current.kg) {
          lifetimeBest[liftType][reps] = { kg, entry };
        }
      }

      if (reps <= 10) {
        bestE1rmKg[liftType] = Math.max(bestE1rmKg[liftType] ?? 0, e1rmKg);
      }
      // A year's best is a heavy set, not a high-rep estimate: a 9-rep bench
      // can out-estimate a triple and still not be the one anyone remembers.
      const yearKey = `${liftType}|${year}`;
      yearly[yearKey] ??= { sessions: new Set(), best: null };
      if (
        reps <= 5 &&
        (!yearly[yearKey].best || e1rmKg > yearly[yearKey].best.e1rmKg)
      ) {
        yearly[yearKey].best = { e1rmKg, entry };
      }

      const milestones = MILESTONES[milestoneUnit];
      const liftedInUnit =
        milestoneUnit === "kg" ? kg : Math.round(kg * LB_PER_KG * 10) / 10;
      const previousIndex = milestonesPassed[liftType] ?? -1;
      let passedIndex = previousIndex;
      while (
        passedIndex + 1 < milestones.length &&
        liftedInUnit >= milestones[passedIndex + 1]
      ) {
        passedIndex++;
      }
      // Only the top milestone crossed is a memory: a first 180kg squat does
      // not also "first" 140. And the first session of a lift in the log is
      // where the lifter started, not something they achieved.
      if (passedIndex > previousIndex && date !== firstSessionDate[liftType]) {
        raw.push({
          source: "milestone",
          entry,
          score: SOURCE_SCORES.milestone + passedIndex * 3,
          label: `Your first ${milestones[passedIndex]}${milestoneUnit} ${LIFT_NOUNS[liftType]}`,
        });
      }
      milestonesPassed[liftType] = passedIndex;
    }

    for (const liftType of liftsToday) {
      yearly[`${liftType}|${year}`]?.sessions.add(date);
    }

    if (isMeet) {
      const { topSets } = meetDays.get(date);
      for (const liftType of liftsToday) {
        raw.push({
          source: "meet",
          entry: topSets[liftType],
          score: SOURCE_SCORES.meet,
          label: `Meet day ${LIFT_NOUNS[liftType]}`,
        });
      }
    }
  }

  // Pass two: sources that need the whole log first.
  for (const byReps of Object.values(lifetimeBest)) {
    for (const [reps, { entry }] of Object.entries(byReps)) {
      raw.push({
        source: "lifetimePr",
        entry,
        score: SOURCE_SCORES.lifetimePr[reps],
        label: `Still your best ${PR_REP_LABELS[reps]}`,
      });
    }
  }

  for (const [key, { sessions: liftSessions, best }] of Object.entries(
    yearly,
  )) {
    if (!best || liftSessions.size < YEAR_BEST_MIN_SESSIONS) continue;
    const [liftType, year] = key.split("|");
    // Stronger years make better memories: up to ten points for a year whose
    // best came close to the lifter's all-time best.
    const shareOfBest = best.e1rmKg / (bestE1rmKg[liftType] || best.e1rmKg);
    raw.push({
      source: "yearBest",
      entry: best.entry,
      score: SOURCE_SCORES.yearBest + Math.round(shareOfBest * 10),
      label: `Your best ${LIFT_NOUNS[liftType]} of ${year}`,
    });
  }

  // Filmed heavy sets: a lifter who films everything would otherwise fill
  // the list with them, so each year keeps only its three strongest.
  const filmedByYear = new Map();
  for (const { entries, isMeet } of sessions) {
    if (isMeet) continue; // Meet days already give one per lift.
    for (const entry of entries) {
      if (!getVideoUrl(entry) || entry.reps > 10) continue;
      const share =
        toKg(
          estimateE1RM(entry.reps, entry.weight, "Brzycki"),
          entry.unitType,
        ) / (bestE1rmKg[entry.liftType] || Infinity);
      if (share < FILMED_SHARE_OF_BEST) continue;
      const year = entry.date.slice(0, 4);
      if (!filmedByYear.has(year)) filmedByYear.set(year, []);
      filmedByYear.get(year).push({ entry, share });
    }
  }
  for (const filmed of filmedByYear.values()) {
    filmed
      .sort((a, b) => b.share - a.share)
      .slice(0, FILMED_PER_YEAR)
      .forEach(({ entry }) =>
        raw.push({
          source: "filmed",
          entry,
          score: SOURCE_SCORES.filmed,
          label: `A heavy ${LIFT_NOUNS[entry.liftType]} on video`,
        }),
      );
  }

  // One memory per session, or per lift on a meet day. On a meet day the meet
  // wins, but keeps what else made the lift special: "Your first 200kg
  // deadlift, on meet day" says more than "Meet day deadlift".
  const meetDates = new Set(
    sessions.filter((session) => session.isMeet).map((session) => session.date),
  );
  const byMoment = new Map();
  for (const candidate of raw) {
    const { entry } = candidate;
    const key = meetDates.has(entry.date)
      ? `${entry.date}|${entry.liftType}`
      : entry.date;
    if (!byMoment.has(key)) byMoment.set(key, []);
    byMoment.get(key).push({
      ...candidate,
      score:
        candidate.score +
        (getVideoUrl(entry) ? VIDEO_BONUS : 0) +
        (entry.notes?.trim() ? NOTE_BONUS : 0),
    });
  }

  return Array.from(byMoment.values())
    .map((moment) => {
      moment.sort((a, b) => b.score - a.score);
      const [best] = moment;
      const meet = moment.find((candidate) => candidate.source === "meet");
      const other = moment.find((candidate) => candidate.source !== "meet");
      const label = meet && other ? `${other.label}, on meet day` : best.label;
      const lift = meet ? meet.entry : best.entry;
      return { lift, label, source: best.source, score: best.score };
    })
    .sort((a, b) => b.score - a.score || (a.lift.date < b.lift.date ? 1 : -1));
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function weightedChoice(items, getWeight, random) {
  const total = items.reduce((sum, item) => sum + getWeight(item), 0);
  let threshold = random() * total;
  for (const item of items) {
    threshold -= getWeight(item);
    if (threshold <= 0) return item;
  }
  return items[items.length - 1];
}

// Big-four sets grouped by date, oldest first, each date flagged when the
// data provider's meetDays says it was a meet.
function groupBigFourSessions(parsedData, meetDays) {
  const bigFour = new Set(BIG_FOUR_LIFT_TYPES);
  const entriesByDate = new Map();
  for (const entry of parsedData) {
    if (entry.isGoal || !entry.date || !bigFour.has(entry.liftType)) continue;
    if (!(entry.reps >= 1) || !(entry.weight > 0)) continue;
    if (!entriesByDate.has(entry.date)) entriesByDate.set(entry.date, []);
    entriesByDate.get(entry.date).push(entry);
  }

  return Array.from(entriesByDate.keys())
    .sort()
    .map((date) => ({
      date,
      isMeet: meetDays?.has(date) ?? false,
      entries: entriesByDate.get(date),
    }));
}

// Sheets carry the column as URL; some imports spell it url.
export function getVideoUrl(lift) {
  return lift?.URL || lift?.url || null;
}
