import {
  addDaysFromStr,
  getWeekKeyFromDateStr,
  subtractDaysFromStr,
} from "@/lib/date-utils";
import { recordTiming } from "@/lib/processing-utils";
import { estimateE1RM } from "@/lib/estimate-e1rm";

const MIN_STREAK_WEEKS = 3;
const MIN_SESSIONS_PER_WEEK = 3;
const TOP_PRS_PER_STREAK = 5;

// PR significance tiers (lower = more significant)
export const PR_TIER_STILL_STANDING = 1;
export const PR_TIER_LIFETIME_AT_TIME = 2;
export const PR_TIER_TWELVE_MONTH_AT_TIME = 3;

// Subtract one calendar year from a "yyyy-MM-dd" string. Feb 29 -> Feb 28.
function subtractOneYear(dateStr) {
  const y = parseInt(dateStr.slice(0, 4), 10) - 1;
  const m = dateStr.slice(5, 7);
  let d = dateStr.slice(8, 10);
  if (m === "02" && d === "29") d = "28";
  return `${y}-${m}-${d}`;
}

/**
 * Extract all qualifying streaks from a list of session dates.
 * A streak is N consecutive ISO-Mon weeks each with >= MIN_SESSIONS_PER_WEEK
 * sessions (3+), where N >= MIN_STREAK_WEEKS (3+). Returned in chronological
 * order (oldest first). The latest streak is marked isActive when its endWeek
 * touches the current or last-completed week.
 *
 * @param {string[]} allSessionDates - distinct session dates "yyyy-MM-dd" sorted asc
 * @param {object} [opts]
 * @param {string} [opts.referenceDate] - "yyyy-MM-dd" for "today" (default: now)
 * @returns {Array<{startWeek:string,endWeek:string,weeks:number,isActive:boolean}>}
 */
export function extractStreaks(allSessionDates, { referenceDate = null } = {}) {
  if (!allSessionDates || allSessionDates.length === 0) return [];

  const weekSessionCount = new Map();
  for (let i = 0; i < allSessionDates.length; i++) {
    const wk = getWeekKeyFromDateStr(allSessionDates[i]);
    weekSessionCount.set(wk, (weekSessionCount.get(wk) || 0) + 1);
  }

  const today =
    referenceDate ||
    (() => {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    })();
  const thisWeekKey = getWeekKeyFromDateStr(today);
  const lastCompletedWeek = subtractDaysFromStr(thisWeekKey, 7);

  const sortedWeekKeys = Array.from(weekSessionCount.keys()).sort();
  const earliestWeek = sortedWeekKeys[0];

  const streaks = [];
  let runStart = null;
  let runEnd = null;
  let runLen = 0;

  let cursor = earliestWeek;
  while (cursor <= thisWeekKey) {
    const count = weekSessionCount.get(cursor) || 0;
    const qualified = count >= MIN_SESSIONS_PER_WEEK;
    if (qualified) {
      if (runLen === 0) runStart = cursor;
      runEnd = cursor;
      runLen++;
    } else {
      if (runLen >= MIN_STREAK_WEEKS) {
        streaks.push({
          startWeek: runStart,
          endWeek: runEnd,
          weeks: runLen,
          isActive: false,
        });
      }
      runLen = 0;
      runStart = null;
      runEnd = null;
    }
    cursor = addDaysFromStr(cursor, 7);
  }

  if (runLen >= MIN_STREAK_WEEKS) {
    streaks.push({
      startWeek: runStart,
      endWeek: runEnd,
      weeks: runLen,
      isActive: false,
    });
  }

  // Active = the most recent streak whose endWeek is current or last-completed.
  if (streaks.length > 0) {
    const last = streaks[streaks.length - 1];
    if (last.endWeek >= lastCompletedWeek) last.isActive = true;
  }

  return streaks;
}

/**
 * Enrich each streak with total tonnage and a top-5 ranked list of PRs that
 * landed inside it. PRs are ranked by tier (still-standing > lifetime-at-time
 * > 12-month-at-time), then by E1RM descending. Mutates each streak object,
 * also returns the same array.
 *
 * @param {Array} streaks - from extractStreaks (chronological order)
 * @param {Array} parsedData - chronologically sorted lift entries
 * @param {Object} topLiftsByTypeAndReps - from processTopLiftsByTypeAndReps
 * @param {string} [e1rmFormula] - "Brzycki" by default
 */
export function enrichStreaks(
  streaks,
  parsedData,
  topLiftsByTypeAndReps,
  e1rmFormula = "Brzycki",
) {
  if (!streaks?.length || !parsedData?.length) return streaks;

  // Still-standing set: lifts that ARE the current all-time #1 for their (liftType, reps)
  const stillStanding = new Set();
  if (topLiftsByTypeAndReps) {
    Object.keys(topLiftsByTypeAndReps).forEach((liftType) => {
      const repsArr = topLiftsByTypeAndReps[liftType];
      for (let r = 0; r < 10; r++) {
        const top = repsArr?.[r]?.[0];
        if (top) {
          stillStanding.add(
            `${liftType}|${r + 1}|${top.date}|${top.weight}`,
          );
        }
      }
    });
  }

  // Streak buckets parallel to streaks (assumed already chronological)
  const buckets = streaks.map((s) => ({
    streak: s,
    startDate: s.startWeek,
    endDate: addDaysFromStr(s.endWeek, 6),
    tonnage: 0,
    candidates: [],
  }));
  // Reset target fields on the streak objects
  streaks.forEach((s) => {
    s.tonnage = 0;
    s.prs = [];
  });

  // Running maxes per (liftType|reps)
  const bestEver = new Map(); // → max weight ever
  const twelveMo = new Map(); // → array of {date, weight}, sorted asc by date

  let bucketIdx = 0;

  for (let i = 0; i < parsedData.length; i++) {
    const lift = parsedData[i];
    if (lift.isGoal) continue;
    if (!lift.date) continue;
    const reps = lift.reps;
    if (!reps || reps < 1 || reps > 10) continue;
    const weight = lift.weight ?? 0;
    if (weight <= 0) continue;

    const key = `${lift.liftType}|${reps}`;

    // Lifetime-at-time
    const prevBest = bestEver.get(key) ?? 0;
    const isLifetimeAtTime = weight > prevBest;
    if (isLifetimeAtTime) bestEver.set(key, weight);

    // 12-month-at-time (sliding window)
    const cutoff = subtractOneYear(lift.date);
    let arr = twelveMo.get(key);
    if (!arr) {
      arr = [];
      twelveMo.set(key, arr);
    }
    while (arr.length > 0 && arr[0].date < cutoff) arr.shift();
    let best12mo = 0;
    for (let j = 0; j < arr.length; j++) {
      if (arr[j].weight > best12mo) best12mo = arr[j].weight;
    }
    const is12moAtTime = weight > best12mo;
    arr.push({ date: lift.date, weight });

    // Find which streak (if any) contains this date. Pointer advances monotonically.
    while (
      bucketIdx < buckets.length &&
      buckets[bucketIdx].endDate < lift.date
    ) {
      bucketIdx++;
    }
    if (bucketIdx >= buckets.length) {
      // No more streaks ahead, but later lifts might still be missing tonnage.
      // We can early-break since parsedData is chronological.
      break;
    }
    const b = buckets[bucketIdx];
    if (lift.date < b.startDate) continue; // in a gap between streaks

    // Inside a streak window: accumulate tonnage and (if PR-worthy) capture
    b.tonnage += weight * reps;

    if (isLifetimeAtTime || is12moAtTime) {
      let tier;
      const stillKey = `${lift.liftType}|${reps}|${lift.date}|${weight}`;
      if (isLifetimeAtTime && stillStanding.has(stillKey)) {
        tier = PR_TIER_STILL_STANDING;
      } else if (isLifetimeAtTime) {
        tier = PR_TIER_LIFETIME_AT_TIME;
      } else {
        tier = PR_TIER_TWELVE_MONTH_AT_TIME;
      }
      const e1rm = estimateE1RM(reps, weight, e1rmFormula);
      b.candidates.push({
        date: lift.date,
        liftType: lift.liftType,
        reps,
        weight,
        unitType: lift.unitType,
        tier,
        e1rm,
      });
    }
  }

  // Rank + trim per streak
  buckets.forEach((b) => {
    b.candidates.sort((a, c) => {
      if (a.tier !== c.tier) return a.tier - c.tier;
      return c.e1rm - a.e1rm;
    });
    b.streak.tonnage = b.tonnage;
    b.streak.prs = b.candidates.slice(0, TOP_PRS_PER_STREAK);
    b.streak.prCount = b.candidates.length;
  });

  return streaks;
}

/**
 * Pipeline entry point: extract + enrich. Records timing into the shared
 * pipeline accumulator (flushed via flushTimings).
 *
 * @param {object} args
 * @param {Array}  args.parsedData
 * @param {string[]} args.allSessionDates
 * @param {Object} args.topLiftsByTypeAndReps
 * @param {string} [args.e1rmFormula]
 * @returns {Array} enriched streaks
 */
export function processStreakLeaderboard({
  parsedData,
  allSessionDates,
  topLiftsByTypeAndReps,
  e1rmFormula = "Brzycki",
}) {
  const startTime = performance.now();

  if (!allSessionDates?.length || !parsedData?.length) {
    recordTiming("Streak Leaderboard", performance.now() - startTime, "no data");
    return [];
  }

  const streaks = extractStreaks(allSessionDates);
  enrichStreaks(streaks, parsedData, topLiftsByTypeAndReps, e1rmFormula);

  recordTiming(
    "Streak Leaderboard",
    performance.now() - startTime,
    `${streaks.length} streaks`,
  );
  return streaks;
}
