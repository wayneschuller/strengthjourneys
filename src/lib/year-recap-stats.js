// Year recap statistics shared by the Strength Unwrapped slides and the text
// summary that users copy out of the recap footer.
//
// These computations used to live as private functions inside individual card
// components. They moved here so the text summary can quote exactly the same
// numbers the cards display — a summary that disagreed with the card it sits
// next to would be worse than no summary at all.
//
// Key constraint: everything is calendar-year based (Jan 1 - Dec 31), matching
// how the cards are titled. The one concession to a year in progress is the
// consistency denominator, which is pro-rated to the days elapsed so far (see
// computeSessionStatsForYear) — otherwise every lifter is graded against a full
// twelve months of training for the first eleven months of every year.

import {
  BIG_FOUR_LIFT_TYPES,
  getDisplayWeight,
  getLifetimePRsAchievedInYear,
  getLiftVolumeMultiplier,
} from "@/lib/processing-utils";
import {
  addDaysFromStr,
  daysInMonth,
  formatDateToYmdLocal,
  getWeekKeyFromDateStr,
} from "@/lib/date-utils";
import { getGradeAndColor } from "@/lib/consistency-grades";

// The consistency grade assumes a 3-sessions-per-week training habit.
const TARGET_SESSIONS_PER_WEEK = 3;

// A week counts towards a streak once it contains this many sessions.
const STREAK_SESSIONS_PER_WEEK = 3;

// Floor on the pro-rated denominator for a year in progress. In the first weeks
// of January a handful of days is too small a sample: one extra session could
// swing the grade from "." to A+. Grading against at least four weeks keeps early
// January grades stable without meaningfully affecting the rest of the year.
const MIN_ELAPSED_DAYS_FOR_GRADE = 28;

const RECAP_URL = "https://www.strengthjourneys.xyz/strength-year-in-review";

/**
 * Session count, best streak, and consistency grade for one calendar year.
 *
 * For a year still in progress the consistency denominator counts only the days
 * elapsed so far, so a lifter training 3x/week in August is graded on August's
 * eight months rather than on a full year they have not lived yet.
 *
 * @param {Array} parsedData - Parsed lift entries.
 * @param {number|string} year - Calendar year.
 * @param {string} [todayYmd] - Override for "today" (testing); defaults to the local date.
 * @returns {{count: number, prevYearCount: number|null, bestStreak: number,
 *   consistencyGrade: object|null, consistencyPercentage: number,
 *   expectedSessions: number, isPartialYear: boolean}}
 */
export function computeSessionStatsForYear(parsedData, year, todayYmd) {
  const empty = {
    count: 0,
    prevYearCount: null,
    bestStreak: 0,
    consistencyGrade: null,
    consistencyPercentage: 0,
    expectedSessions: 0,
    isPartialYear: false,
  };
  if (!parsedData || !year) return empty;

  const prevYear = String(parseInt(year, 10) - 1);
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const prevYearStart = `${prevYear}-01-01`;
  const prevYearEnd = `${prevYear}-12-31`;

  const sessionDates = new Set();
  const prevYearDates = new Set();

  parsedData.forEach((entry) => {
    if (entry.isGoal || !entry.date) return;
    if (entry.date >= yearStart && entry.date <= yearEnd) {
      sessionDates.add(entry.date);
    }
    if (entry.date >= prevYearStart && entry.date <= prevYearEnd) {
      prevYearDates.add(entry.date);
    }
  });

  const sortedDates = Array.from(sessionDates).sort();
  const count = sessionDates.size;
  const bestStreak = computeBestStreakForYear(sortedDates, year);

  const { elapsedDays, isPartialYear } = getElapsedDaysInYear(year, todayYmd);
  const expectedSessions = Math.max(
    1,
    Math.round((elapsedDays / 7) * TARGET_SESSIONS_PER_WEEK),
  );
  const consistencyPercentage = Math.min(
    100,
    Math.round((count / expectedSessions) * 100),
  );
  const consistencyGrade = getGradeAndColor(consistencyPercentage);
  const prevCount = prevYearDates.size;

  return {
    count,
    prevYearCount: prevCount > 0 ? prevCount : null,
    bestStreak,
    consistencyGrade,
    consistencyPercentage,
    expectedSessions,
    isPartialYear,
  };
}

/**
 * Total tonnage for a year, the previous year's total for comparison, and the
 * Big Four split. Mixed-unit histories are converted into the user's preferred
 * unit when that unit appears in the data, otherwise into whichever unit does.
 *
 * @param {Array} parsedData - Parsed lift entries.
 * @param {number|string} year - Calendar year.
 * @param {string} preferredUnit - "kg" or "lb".
 * @returns {{tonnage: number, primaryUnit: string, prevYearTonnage: number|null,
 *   tonnageByLift: Array<{liftType: string, tonnage: number}>}}
 */
export function computeTonnageForYear(parsedData, year, preferredUnit) {
  if (!parsedData || !year) {
    return {
      tonnage: 0,
      primaryUnit: preferredUnit || "lb",
      prevYearTonnage: null,
      tonnageByLift: [],
    };
  }
  const prevYear = String(parseInt(year, 10) - 1);
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const prevYearStart = `${prevYear}-01-01`;
  const prevYearEnd = `${prevYear}-12-31`;
  const tonnageByUnit = {};
  const prevYearTonnageByUnit = {};
  const tonnageByLiftRaw = {};
  parsedData.forEach((entry) => {
    if (entry.isGoal || !entry.date) return;
    const t = (entry.weight ?? 0) * (entry.reps ?? 0);
    const u = entry.unitType || "lb";
    if (entry.date >= yearStart && entry.date <= yearEnd) {
      tonnageByUnit[u] = (tonnageByUnit[u] ?? 0) + t;
      if (BIG_FOUR_LIFT_TYPES.includes(entry.liftType)) {
        if (!tonnageByLiftRaw[entry.liftType])
          tonnageByLiftRaw[entry.liftType] = {};
        tonnageByLiftRaw[entry.liftType][u] =
          (tonnageByLiftRaw[entry.liftType][u] ?? 0) + t;
      }
    }
    if (entry.date >= prevYearStart && entry.date <= prevYearEnd) {
      prevYearTonnageByUnit[u] = (prevYearTonnageByUnit[u] ?? 0) + t;
    }
  });
  const unitKeys = Object.keys(tonnageByUnit);
  const primaryUnit =
    preferredUnit && unitKeys.includes(preferredUnit)
      ? preferredUnit
      : unitKeys[0] || "lb";
  const KG_PER_LB = 1 / 2.2046;
  const LB_PER_KG = 2.2046;
  let tonnage = tonnageByUnit[primaryUnit] ?? 0;
  unitKeys.forEach((u) => {
    if (u === primaryUnit) return;
    const v = tonnageByUnit[u] ?? 0;
    if (u === "kg" && primaryUnit === "lb") tonnage += v * LB_PER_KG;
    else if (u === "lb" && primaryUnit === "kg") tonnage += v * KG_PER_LB;
  });
  const prevUnitKeys = Object.keys(prevYearTonnageByUnit);
  let prevYearTonnage = prevYearTonnageByUnit[primaryUnit] ?? 0;
  prevUnitKeys.forEach((u) => {
    if (u === primaryUnit) return;
    const v = prevYearTonnageByUnit[u] ?? 0;
    if (u === "kg" && primaryUnit === "lb") prevYearTonnage += v * LB_PER_KG;
    else if (u === "lb" && primaryUnit === "kg") prevYearTonnage += v * KG_PER_LB;
  });

  const tonnageByLift = BIG_FOUR_LIFT_TYPES.map((liftType) => {
    const byUnit = tonnageByLiftRaw[liftType] ?? {};
    let liftTonnage = byUnit[primaryUnit] ?? 0;
    Object.keys(byUnit).forEach((u) => {
      if (u === primaryUnit) return;
      const v = byUnit[u] ?? 0;
      if (u === "kg" && primaryUnit === "lb") liftTonnage += v * LB_PER_KG;
      else if (u === "lb" && primaryUnit === "kg") liftTonnage += v * KG_PER_LB;
    });
    return { liftType, tonnage: liftTonnage };
  }).filter((r) => r.tonnage > 0);

  return {
    tonnage,
    primaryUnit,
    prevYearTonnage: prevYearTonnage > 0 ? prevYearTonnage : null,
    tonnageByLift,
  };
}

/**
 * The lift trained most in a year, weighted by each lift's volume multiplier so
 * a deadlift set is not counted as equal work to a curl set.
 *
 * @param {Array} parsedData - Parsed lift entries.
 * @param {number|string} year - Calendar year.
 * @returns {{mostTrainedLift: string|null, mostTrainedLiftSets: number,
 *   mostTrainedLiftReps: number, mostTrainedLiftSessions: number, sessionCount: number}}
 */
export function computeMostTrainedLiftForYear(parsedData, year) {
  const empty = {
    mostTrainedLift: null,
    mostTrainedLiftSets: 0,
    mostTrainedLiftReps: 0,
    mostTrainedLiftSessions: 0,
    sessionCount: 0,
  };
  if (!parsedData || !year) return empty;
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const sessionDates = new Set();
  const liftTypeSets = {};
  const liftTypeReps = {};
  const liftTypeSessionDates = {};
  parsedData.forEach((entry) => {
    if (entry.isGoal || !entry.date) return;
    if (entry.date < yearStart || entry.date > yearEnd) return;
    sessionDates.add(entry.date);
    const lt = entry.liftType;
    liftTypeSets[lt] = (liftTypeSets[lt] ?? 0) + 1;
    liftTypeReps[lt] = (liftTypeReps[lt] ?? 0) + (entry.reps ?? 0);
    if (!liftTypeSessionDates[lt]) liftTypeSessionDates[lt] = new Set();
    liftTypeSessionDates[lt].add(entry.date);
  });
  const sessionCount = sessionDates.size;
  const mostTrainedEntry =
    Object.keys(liftTypeSets).length > 0
      ? Object.entries(liftTypeSets).sort(
          (a, b) =>
            b[1] * getLiftVolumeMultiplier(b[0]) -
            a[1] * getLiftVolumeMultiplier(a[0]),
        )[0]
      : null;
  const mostTrainedLift = mostTrainedEntry ? mostTrainedEntry[0] : null;
  const mostTrainedLiftSets = mostTrainedLift ? liftTypeSets[mostTrainedLift] : 0;
  const mostTrainedLiftReps = mostTrainedLift ? liftTypeReps[mostTrainedLift] : 0;
  const mostTrainedLiftSessions =
    mostTrainedLift && liftTypeSessionDates[mostTrainedLift]
      ? liftTypeSessionDates[mostTrainedLift].size
      : 0;
  return {
    mostTrainedLift,
    mostTrainedLiftSets,
    mostTrainedLiftReps,
    mostTrainedLiftSessions,
    sessionCount,
  };
}

/**
 * Plain-text version of the recap, for pasting into Reddit, Discord, or X where
 * an image is the wrong shape of share. Deliberately short: five lines plus
 * attribution, so it survives a tweet-sized box without being truncated.
 *
 * @param {Object} params
 * @param {Array} params.parsedData - Parsed lift entries.
 * @param {number|string} params.year - Calendar year.
 * @param {boolean} params.isMetric - Display preference from useAthleteBio().
 * @returns {string}
 */
export function buildRecapSummaryText({ parsedData, year, isMetric }) {
  const stats = computeSessionStatsForYear(parsedData, year);
  const { tonnage, primaryUnit } = computeTonnageForYear(
    parsedData,
    year,
    isMetric ? "kg" : "lb",
  );
  const { mostTrainedLift } = computeMostTrainedLiftForYear(parsedData, year);
  const prs = getLifetimePRsAchievedInYear(parsedData, year);

  const lines = [
    stats.isPartialYear
      ? `My ${year} in the gym so far 💪`
      : `My ${year} in the gym 💪`,
    "",
  ];

  const gradeSuffix =
    stats.consistencyGrade?.grade && stats.consistencyGrade.grade !== "."
      ? ` · consistency ${stats.consistencyGrade.grade}`
      : "";
  lines.push(
    `🗓️ ${stats.count.toLocaleString("en-US")} training session${stats.count === 1 ? "" : "s"}${gradeSuffix}`,
  );

  if (stats.bestStreak > 0) {
    lines.push(
      `🔥 Best streak: ${stats.bestStreak} week${stats.bestStreak === 1 ? "" : "s"} of ${STREAK_SESSIONS_PER_WEEK}+ sessions`,
    );
  }

  if (tonnage > 0) {
    lines.push(
      `🏋️ ${Math.round(tonnage).toLocaleString("en-US")} ${primaryUnit} lifted`,
    );
  }

  if (mostTrainedLift) {
    lines.push(`⭐ Most trained: ${mostTrainedLift}`);
  }

  if (prs.length > 0) {
    const shown = prs.slice(0, 3).map((pr) => {
      const { value, unit } = getDisplayWeight(pr, isMetric);
      return `${pr.liftType} ${pr.reps}@${value}${unit}`;
    });
    const remaining = prs.length - shown.length;
    lines.push(
      `🏆 Lifetime PRs: ${shown.join(", ")}${remaining > 0 ? ` (+${remaining} more)` : ""}`,
    );
  }

  lines.push("", `Made with Strength Journeys — ${RECAP_URL}`);

  return lines.join("\n");
}

// --- Supporting functions ---

/**
 * Days of `year` that have actually happened. A past year returns its full
 * length; the current year returns the day-of-year so far (floored, see
 * MIN_ELAPSED_DAYS_FOR_GRADE); a future year is treated as full length so
 * nothing divides by zero.
 */
function getElapsedDaysInYear(year, todayYmd) {
  const yearNum = parseInt(year, 10);
  const today = todayYmd || formatDateToYmdLocal(new Date());
  const currentYear = parseInt(today.slice(0, 4), 10);
  const fullYearDays = isLeapYear(yearNum) ? 366 : 365;

  if (yearNum !== currentYear) {
    return { elapsedDays: fullYearDays, isPartialYear: false };
  }

  const dayOfYear = getDayOfYear(today);
  return {
    elapsedDays: Math.max(MIN_ELAPSED_DAYS_FOR_GRADE, dayOfYear),
    isPartialYear: dayOfYear < fullYearDays,
  };
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function getDayOfYear(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  let days = d;
  for (let month = 1; month < m; month++) {
    days += daysInMonth(y, month);
  }
  return days;
}

function computeBestStreakForYear(sessionDates, year) {
  if (!sessionDates.length) return 0;
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const weekMap = new Map();
  const dateToWeekKey = new Map();
  sessionDates.forEach((dateStr) => {
    if (dateStr < yearStart || dateStr > yearEnd) return;
    let weekKey = dateToWeekKey.get(dateStr);
    if (weekKey === undefined) {
      weekKey = getWeekKeyFromDateStr(dateStr);
      dateToWeekKey.set(dateStr, weekKey);
    }
    if (!weekMap.has(weekKey)) weekMap.set(weekKey, new Set());
    weekMap.get(weekKey).add(dateStr);
  });
  const weekSessionCount = new Map();
  weekMap.forEach((dates, weekKey) => {
    weekSessionCount.set(weekKey, dates.size);
  });
  const firstMonday = getWeekKeyFromDateStr(yearStart);
  const lastMonday = getWeekKeyFromDateStr(yearEnd);
  let bestStreak = 0;
  let tempStreak = 0;
  let weekKey = firstMonday;
  while (weekKey <= lastMonday) {
    const sessionCount = weekSessionCount.get(weekKey) || 0;
    if (sessionCount >= STREAK_SESSIONS_PER_WEEK) {
      tempStreak++;
      bestStreak = Math.max(bestStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
    weekKey = addDaysFromStr(weekKey, 7);
  }
  return bestStreak;
}

export { STREAK_SESSIONS_PER_WEEK };
