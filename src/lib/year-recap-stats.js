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
  parseYmdUtc,
} from "@/lib/date-utils";
import { getGradeAndColor, getTargetSessions } from "@/lib/consistency-grades";
import { findBestE1RMInWindow } from "@/lib/lift-bests";
import { LB_PER_KG, toKg } from "@/lib/weight-units";

// The consistency grade assumes a 3-sessions-per-week training habit.

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
    if (!entry.date) return;
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
  // Shares the Long Game target so a year cannot grade A here and A- on the
  // dashboard rings: three a week, less the fortnight off a year.
  const expectedSessions = Math.max(1, getTargetSessions(elapsedDays));
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
    if (!entry.date) return;
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
  const KG_PER_LB = 1 / LB_PER_KG;
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
    else if (u === "lb" && primaryUnit === "kg")
      prevYearTonnage += v * KG_PER_LB;
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
    if (!entry.date) return;
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
  const mostTrainedLiftSets = mostTrainedLift
    ? liftTypeSets[mostTrainedLift]
    : 0;
  const mostTrainedLiftReps = mostTrainedLift
    ? liftTypeReps[mostTrainedLift]
    : 0;
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

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/**
 * Every day of a year laid out as twelve Monday-first month grids, each
 * training day graded 1-4 by how many sets it held relative to the rest of the
 * lifter's year. Also the busiest month, which the calendar card headlines.
 *
 * @param {Array} parsedData - Parsed lift entries.
 * @param {number|string} year - Calendar year.
 * @param {Map} [meetDays] - From the data provider; meet days are marked.
 * @param {string} [todayYmd] - Override for "today" (testing).
 * @returns {{months: Array<{monthIndex: number, name: string, leadingBlanks: number,
 *   sessionCount: number, days: Array<{date: string, level: number, isMeet: boolean,
 *   isFuture: boolean}>}>, busiestMonthIndex: number|null, busiestMonthCount: number,
 *   trainingDays: number, meetCount: number}}
 */
export function computeTrainingCalendarForYear(
  parsedData,
  year,
  meetDays,
  todayYmd,
) {
  const yearNum = parseInt(year, 10);
  const today = todayYmd || formatDateToYmdLocal(new Date());
  const setsByDate = new Map();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  (parsedData || []).forEach((entry) => {
    if (!entry.date || entry.date < yearStart || entry.date > yearEnd) return;
    setsByDate.set(entry.date, (setsByDate.get(entry.date) ?? 0) + 1);
  });

  // Quartile cut points over this year's training days, so a lifter who does
  // twelve sets a session and one who does thirty both see the full range.
  const counts = Array.from(setsByDate.values()).sort((a, b) => a - b);
  const quantile = (q) =>
    counts.length ? counts[Math.floor((counts.length - 1) * q)] : 0;
  const cuts = [quantile(0.25), quantile(0.5), quantile(0.75)];
  const levelFor = (n) => {
    if (!n) return 0;
    if (n <= cuts[0]) return 1;
    if (n <= cuts[1]) return 2;
    if (n <= cuts[2]) return 3;
    return 4;
  };

  let meetCount = 0;
  const months = MONTH_NAMES.map((name, monthIndex) => {
    const month = monthIndex + 1;
    const firstYmd = `${year}-${String(month).padStart(2, "0")}-01`;
    const firstWeekday = (parseYmdUtc(firstYmd).getUTCDay() + 6) % 7;
    const days = [];
    let sessionCount = 0;
    for (let d = 1; d <= daysInMonth(yearNum, month); d++) {
      const date = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const sets = setsByDate.get(date) ?? 0;
      const isMeet = Boolean(meetDays?.has?.(date));
      if (sets > 0) sessionCount++;
      if (isMeet) meetCount++;
      days.push({
        date,
        level: levelFor(sets),
        isMeet,
        isFuture: date > today,
      });
    }
    return {
      monthIndex,
      name,
      leadingBlanks: firstWeekday,
      sessionCount,
      days,
    };
  });

  const busiestMonthCount = Math.max(0, ...months.map((m) => m.sessionCount));
  const busiestMonthIndex =
    busiestMonthCount > 0
      ? months.findIndex((m) => m.sessionCount === busiestMonthCount)
      : null;

  return {
    months,
    busiestMonthIndex,
    busiestMonthCount,
    trainingDays: setsByDate.size,
    meetCount,
  };
}

/**
 * Best estimated one-rep max for each Big Four lift in a year, beside the same
 * lift's best from the year before. Only lifts trained this year appear.
 *
 * @param {Array} parsedData - Parsed lift entries.
 * @param {number|string} year - Calendar year.
 * @param {string} [e1rmFormula] - e.g. "Brzycki".
 * @returns {{rows: Array<{liftType: string, best: {weight: number, unitType: string},
 *   prevBest: {weight: number, unitType: string}|null, gainKg: number|null}>,
 *   gainedCount: number, comparableCount: number}}
 */
export function computeStrengthGainsForYear(parsedData, year, e1rmFormula) {
  if (!parsedData || !year) {
    return { rows: [], gainedCount: 0, comparableCount: 0 };
  }
  const prevYear = parseInt(year, 10) - 1;
  const rows = [];
  BIG_FOUR_LIFT_TYPES.forEach((liftType) => {
    const thisYear = findBestE1RMInWindow(parsedData, liftType, {
      sinceDate: `${year}-01-01`,
      untilDate: `${year}-12-31`,
      e1rmFormula,
    });
    if (!thisYear.bestLift || thisYear.bestE1RMWeight <= 0) return;
    const lastYear = findBestE1RMInWindow(parsedData, liftType, {
      sinceDate: `${prevYear}-01-01`,
      untilDate: `${prevYear}-12-31`,
      e1rmFormula,
    });
    const best = {
      weight: thisYear.bestE1RMWeight,
      unitType: thisYear.unitType,
    };
    const prevBest =
      lastYear.bestLift && lastYear.bestE1RMWeight > 0
        ? { weight: lastYear.bestE1RMWeight, unitType: lastYear.unitType }
        : null;
    const gainKg = prevBest
      ? toKg(best.weight, best.unitType) -
        toKg(prevBest.weight, prevBest.unitType)
      : null;
    rows.push({ liftType, best, prevBest, gainKg });
  });
  return {
    rows,
    // Half a kilo, so a rounding wobble between two equal bests is not a gain.
    gainedCount: rows.filter((r) => r.gainKg != null && r.gainKg > 0.5).length,
    comparableCount: rows.filter((r) => r.prevBest).length,
  };
}

// Lifter types, checked in order; the first that fits names the year. Every
// one is something to be proud of, including the fallback, because a recap is
// a celebration and not an assessment.
const LIFTER_TYPES = [
  {
    id: "competitor",
    title: "The Competitor",
    fits: (p) => p.meetCount > 0,
    describe: (p) =>
      p.meetCount === 1
        ? "You took it to the platform this year."
        : `You took it to the platform ${p.meetCount} times this year.`,
  },
  {
    id: "metronome",
    title: "The Metronome",
    fits: (p) =>
      p.sessionCount >= 40 &&
      p.consistencyPercentage >= 90 &&
      p.bestStreak >= 8,
    describe: () => "Week in, week out. Your training ran like clockwork.",
  },
  {
    id: "momentum",
    title: "The Momentum Builder",
    fits: (p) =>
      p.prevYearCount >= 10 &&
      p.sessionCount >= 30 &&
      p.sessionCount >= p.prevYearCount * 1.5,
    describe: (p) =>
      `${Math.round((p.sessionCount / p.prevYearCount - 1) * 100)}% more sessions than the year before.`,
  },
  {
    id: "heavy",
    title: "The Heavy Hitter",
    fits: (p) => p.bigFourSets >= 50 && p.heavyShare >= 0.35,
    describe: (p) =>
      `${Math.round(p.heavyShare * 100)}% of your main lift sets were singles, doubles or triples.`,
  },
  {
    id: "volume",
    title: "The Volume Builder",
    fits: (p) => p.totalSets >= 100 && p.highRepShare >= 0.45,
    describe: (p) =>
      `Reps on reps. ${Math.round(p.highRepShare * 100)}% of your sets were 8 reps or more.`,
  },
  {
    id: "specialist",
    title: "The Specialist",
    fits: (p) => p.totalSets >= 60 && p.topLiftShare >= 0.4,
    describe: (p) =>
      `${p.topLift} took ${Math.round(p.topLiftShare * 100)}% of your sets. Pure devotion.`,
  },
  {
    id: "explorer",
    title: "The Explorer",
    fits: (p) => p.distinctLifts >= 25,
    describe: (p) =>
      `${p.distinctLifts} different lifts. You like to keep it interesting.`,
  },
  {
    id: "weekend",
    title: "The Weekend Lifter",
    fits: (p) => p.sessionCount >= 12 && p.weekendShare >= 0.5,
    describe: () => "Saturdays and Sundays belong to the barbell.",
  },
  {
    id: "all-rounder",
    title: "The All-Rounder",
    fits: (p) => p.bigFourBalanced,
    describe: () => "Squat, bench, deadlift and press. You trained the lot.",
  },
  {
    id: "builder",
    title: "The Steady Builder",
    fits: () => true,
    describe: () => "Session by session, you built something this year.",
  },
];

/**
 * The lifter's "type" for a year, Wrapped style, plus the training habits
 * behind it: favourite weekday, most common set, how many lifts.
 *
 * @param {Array} parsedData - Parsed lift entries.
 * @param {number|string} year - Calendar year.
 * @param {Map} [meetDays] - From the data provider.
 * @returns {null|{id: string, title: string, description: string,
 *   favouriteWeekday: string|null, weekdayCounts: number[], favouriteReps: number|null,
 *   distinctLifts: number, sessionCount: number}}
 *   Null when the year has too few sessions to say anything honest.
 */
export function computeLifterTypeForYear(parsedData, year, meetDays) {
  if (!parsedData || !year) return null;
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const sessionStats = computeSessionStatsForYear(parsedData, year);
  if (sessionStats.count < 3) return null;

  const sessionDates = new Set();
  const setsByLift = {};
  const repCounts = {};
  let totalSets = 0;
  let bigFourSets = 0;
  let heavySets = 0;
  let highRepSets = 0;
  parsedData.forEach((entry) => {
    if (!entry.date || entry.date < yearStart || entry.date > yearEnd) return;
    const reps = entry.reps ?? 0;
    if (reps < 1) return;
    sessionDates.add(entry.date);
    totalSets++;
    setsByLift[entry.liftType] = (setsByLift[entry.liftType] ?? 0) + 1;
    repCounts[reps] = (repCounts[reps] ?? 0) + 1;
    if (reps >= 8) highRepSets++;
    if (BIG_FOUR_LIFT_TYPES.includes(entry.liftType)) {
      bigFourSets++;
      if (reps <= 3) heavySets++;
    }
  });

  const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
  sessionDates.forEach((date) => {
    weekdayCounts[(parseYmdUtc(date).getUTCDay() + 6) % 7]++;
  });
  const maxWeekday = Math.max(...weekdayCounts);
  const favouriteWeekday =
    maxWeekday > 0 ? WEEKDAY_NAMES[weekdayCounts.indexOf(maxWeekday)] : null;

  const favouriteRepsEntry = Object.entries(repCounts).sort(
    (a, b) => b[1] - a[1] || a[0] - b[0],
  )[0];
  const topLiftEntry = Object.entries(setsByLift).sort(
    (a, b) => b[1] - a[1],
  )[0];
  const bigFourShares = BIG_FOUR_LIFT_TYPES.map((lt) =>
    bigFourSets ? (setsByLift[lt] ?? 0) / bigFourSets : 0,
  );

  const profile = {
    sessionCount: sessionStats.count,
    prevYearCount: sessionStats.prevYearCount ?? 0,
    consistencyPercentage: sessionStats.consistencyPercentage,
    bestStreak: sessionStats.bestStreak,
    meetCount: meetDays
      ? Array.from(meetDays.keys()).filter(
          (d) => d >= yearStart && d <= yearEnd,
        ).length
      : 0,
    totalSets,
    bigFourSets,
    heavyShare: bigFourSets ? heavySets / bigFourSets : 0,
    highRepShare: totalSets ? highRepSets / totalSets : 0,
    topLift: topLiftEntry?.[0] ?? null,
    topLiftShare: topLiftEntry && totalSets ? topLiftEntry[1] / totalSets : 0,
    distinctLifts: Object.keys(setsByLift).length,
    weekendShare: sessionDates.size
      ? (weekdayCounts[5] + weekdayCounts[6]) / sessionDates.size
      : 0,
    bigFourBalanced:
      bigFourSets >= 40 && bigFourShares.every((share) => share >= 0.15),
  };

  const type = LIFTER_TYPES.find((t) => t.fits(profile));
  return {
    id: type.id,
    title: type.title,
    description: type.describe(profile),
    favouriteWeekday,
    weekdayCounts,
    favouriteReps: favouriteRepsEntry ? Number(favouriteRepsEntry[0]) : null,
    distinctLifts: profile.distinctLifts,
    sessionCount: profile.sessionCount,
  };
}

/**
 * Plain-text version of the recap, for pasting into Reddit, Discord, or X where
 * an image is the wrong shape of share. Deliberately short: a handful of lines plus
 * attribution, so it survives a tweet-sized box without being truncated.
 *
 * @param {Object} params
 * @param {Array} params.parsedData - Parsed lift entries.
 * @param {number|string} params.year - Calendar year.
 * @param {boolean} params.isMetric - Display preference from useAthleteBio().
 * @returns {string}
 */
export function buildRecapSummaryText({
  parsedData,
  year,
  isMetric,
  meetDays,
}) {
  const stats = computeSessionStatsForYear(parsedData, year);
  const { tonnage, primaryUnit } = computeTonnageForYear(
    parsedData,
    year,
    isMetric ? "kg" : "lb",
  );
  const { mostTrainedLift } = computeMostTrainedLiftForYear(parsedData, year);
  const prs = getLifetimePRsAchievedInYear(parsedData, year);
  const lifterType = computeLifterTypeForYear(parsedData, year, meetDays);

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

  if (lifterType) {
    lines.push(`🧬 Lifter type: ${lifterType.title}`);
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

  lines.push("", `Made with Strength Journeys: ${RECAP_URL}`);

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
