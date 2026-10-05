/**
 * The big-picture numbers the import preview opens with: how long the lifter
 * has trained, how much they have moved, the meets they entered, and a few
 * things about their history they have probably never seen counted.
 *
 * This is the first screen a lifter sees after handing over a file, and the
 * point where they decide whether to keep going, so every number here should
 * be one they would repeat to a training partner. Nothing is recomputed from
 * the raw rows: it all reads the summaries UserLiftingDataProvider already
 * holds, so the story costs almost nothing on a twenty-thousand-set log.
 *
 * Pure, so it can run against a real exported log in Node.
 */

import { calculateLifetimeTonnageFromLookup } from "@/lib/home-dashboard/inspiration-card-metrics";
import { getMeetTotalKg } from "@/lib/meet-detection";
import { toKg } from "@/lib/weight-units";

// Things a lifetime of tonnage can be counted in, heaviest first. The story
// uses the heaviest one the lifter has moved at least twice over.
const TONNAGE_EQUIVALENTS = {
  kg: [
    { name: "blue whale", weight: 150000, emoji: "🐋" },
    { name: "school bus", weight: 5670, emoji: "🚌" },
    { name: "car", weight: 1500, emoji: "🚗" },
    { name: "grand piano", weight: 300, emoji: "🎹" },
  ],
  lb: [
    { name: "blue whale", weight: 330000, emoji: "🐋" },
    { name: "school bus", weight: 12500, emoji: "🚌" },
    { name: "car", weight: 3300, emoji: "🚗" },
    { name: "grand piano", weight: 660, emoji: "🎹" },
  ],
};

// A plate a side is 45lb or 20kg on a 45lb or 20kg bar, read in whichever
// unit the set was logged in: a 180kg deadlift is four plates, and so is 405lb.
const PLATE_LOADING = {
  kg: { bar: 20, plate: 20 },
  lb: { bar: 45, plate: 45 },
};

// The big four by the names lifters use for a plate milestone.
const PLATE_LIFTS = [
  { liftType: "Deadlift", name: "deadlift" },
  { liftType: "Back Squat", name: "squat" },
  { liftType: "Bench Press", name: "bench" },
  { liftType: "Strict Press", name: "press" },
];

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// Below this many training days a favourite day is noise, not a habit.
const MIN_SESSIONS_FOR_FAVOURITE_DAY = 12;

/**
 * @param {Object} args - Summaries from useUserLiftingData().
 * @param {Array} args.liftTypes
 * @param {Object} args.sessionTonnageLookup
 * @param {Map} args.meetDays
 * @param {Array} args.streakLeaderboard
 * @param {Object} args.topLiftsByTypeAndReps
 * @param {boolean} args.isMetric - Unit for lifetime tonnage.
 * @returns {Object|null} Null when there is no dated training to describe.
 */
export function buildImportStory({
  liftTypes,
  sessionTonnageLookup,
  meetDays,
  streakLeaderboard,
  topLiftsByTypeAndReps,
  isMetric,
}) {
  const dates = sessionTonnageLookup?.allSessionDates ?? [];
  if (dates.length === 0) return null;

  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];
  let totalSets = 0;
  let totalReps = 0;
  for (const lift of liftTypes ?? []) {
    totalSets += lift.totalSets;
    totalReps += lift.totalReps || 0;
  }

  return {
    firstDate,
    lastDate,
    sessionCount: dates.length,
    exerciseCount: liftTypes?.length ?? 0,
    totalSets,
    totalReps,
    journey: getJourneyLength(firstDate, lastDate),
    tonnage: getLifetimeTonnage(sessionTonnageLookup, isMetric),
    meets: getMeets(meetDays),
    longestStreak: getLongestStreak(streakLeaderboard),
    // liftTypes arrives sorted by sets, most trained first.
    mostTrainedLift: liftTypes?.length > 1 ? liftTypes[0] : null,
    ...getCalendarHabits(dates),
    plateMilestones: getPlateMilestones(topLiftsByTypeAndReps),
  };
}

/**
 * A count with its noun: "1 year", "8 months".
 */
export function pluralize(count, noun) {
  return `${count.toLocaleString()} ${noun}${count === 1 ? "" : "s"}`;
}

// First to last logged day, not first day to today: an old export describes
// the years it covers, and a lifter who stopped in 2022 did not train since.
function getJourneyLength(firstDate, lastDate) {
  const [y1, m1, d1] = firstDate.split("-").map(Number);
  const [y2, m2, d2] = lastDate.split("-").map(Number);
  let months = (y2 - y1) * 12 + (m2 - m1);
  if (d2 < d1) months -= 1;
  const years = Math.floor(months / 12);
  const extraMonths = months % 12;

  if (years >= 1) {
    return {
      value: pluralize(years, "year"),
      detail: extraMonths > 0 ? `and ${pluralize(extraMonths, "month")}` : null,
    };
  }
  if (months >= 1) return { value: pluralize(months, "month"), detail: null };
  const days =
    Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 864e5) +
    1;
  return { value: pluralize(days, "day"), detail: null };
}

function getLifetimeTonnage(sessionTonnageLookup, isMetric) {
  const unit = isMetric ? "kg" : "lb";
  const { primaryTotal } = calculateLifetimeTonnageFromLookup(
    sessionTonnageLookup,
    unit,
  );
  if (!(primaryTotal > 0)) return null;

  const match = TONNAGE_EQUIVALENTS[unit].find(
    (thing) => primaryTotal / thing.weight >= 2,
  );
  const count = match ? primaryTotal / match.weight : 0;
  return {
    total: primaryTotal,
    unit,
    equivalent: match
      ? {
          // Small counts keep a decimal so 2.4 whales is not rounded to 2.
          count: count >= 10 ? Math.round(count) : Math.round(count * 10) / 10,
          name: match.name,
          emoji: match.emoji,
        }
      : null,
  };
}

// Newest meet first, with the best total picked out when any meet has one.
function getMeets(meetDays) {
  if (!meetDays || meetDays.size === 0) return null;
  const list = [];
  let best = null;
  for (const [date, meet] of meetDays) {
    const entry = { date, ...meet, totalKg: getMeetTotalKg(meet.topSets) };
    list.push(entry);
    if (entry.totalKg !== null && (!best || entry.totalKg > best.totalKg)) {
      best = entry;
    }
  }
  list.sort((a, b) => (a.date < b.date ? 1 : -1));
  return { count: list.length, list, best };
}

function getLongestStreak(streakLeaderboard) {
  let longest = null;
  for (const streak of streakLeaderboard ?? []) {
    if (!longest || streak.weeks > longest.weeks) longest = streak;
  }
  return longest
    ? { weeks: longest.weeks, startWeek: longest.startWeek }
    : null;
}

// The year with the most training days and the weekday trained most often,
// in one pass over the session dates.
function getCalendarHabits(dates) {
  const byYear = new Map();
  const byDay = new Array(7).fill(0);
  for (const date of dates) {
    const year = date.slice(0, 4);
    byYear.set(year, (byYear.get(year) ?? 0) + 1);
    const [y, m, d] = date.split("-").map(Number);
    byDay[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] += 1;
  }

  let biggestYear = null;
  // One calendar year has no other year to be bigger than.
  if (byYear.size > 1) {
    for (const [year, sessions] of byYear) {
      if (!biggestYear || sessions > biggestYear.sessions) {
        biggestYear = { year, sessions };
      }
    }
  }

  let favouriteDay = null;
  if (dates.length >= MIN_SESSIONS_FOR_FAVOURITE_DAY) {
    const top = byDay.indexOf(Math.max(...byDay));
    favouriteDay = { name: DAY_NAMES[top], sessions: byDay[top] };
  }

  return { biggestYear, favouriteDay };
}

// How many plates a side the lifter has had on the bar for each big four
// lift, most plates first. Any rep count counts: the bar was loaded and moved.
function getPlateMilestones(topLiftsByTypeAndReps) {
  if (!topLiftsByTypeAndReps) return [];
  const milestones = [];
  for (const { liftType, name } of PLATE_LIFTS) {
    let heaviest = null;
    for (const bucket of topLiftsByTypeAndReps[liftType] ?? []) {
      const set = bucket?.[0];
      if (!set || !(set.weight > 0)) continue;
      if (
        !heaviest ||
        toKg(set.weight, set.unitType) >
          toKg(heaviest.weight, heaviest.unitType)
      ) {
        heaviest = set;
      }
    }
    if (!heaviest) continue;
    const loading = PLATE_LOADING[heaviest.unitType] ?? PLATE_LOADING.lb;
    const plates = Math.floor(
      (heaviest.weight - loading.bar) / (2 * loading.plate),
    );
    if (plates >= 1) milestones.push({ liftType, name, plates, set: heaviest });
  }
  return milestones.sort((a, b) => b.plates - a.plates);
}
