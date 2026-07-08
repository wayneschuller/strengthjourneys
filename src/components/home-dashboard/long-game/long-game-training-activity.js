/**
 * Long Game training activity helpers build the date ranges and heatmap datasets
 * consumed by the dashboard card's daily, weekly, and monthly training views.
 */

import { format } from "date-fns";

import { coreLiftTypes } from "@/lib/processing-utils";

import {
  getCalendarYearWeekIndexFromWeekKey,
  getWeekKeyFromDateStr,
} from "@/lib/date-utils";

const TRAINING_HISTORY_TITLE_OPTIONS_STAGE1 = [
  "The Lifting Heatmap",
  "The Training Overview",
  "The Lifting Record",
  "The Training History",
  "The Strength Overview",
  "The Lifting Patterns",
  "The Consistency View",
  "The Activity History",
  "The Training Map",
  "The Full Picture",
];

// Medium term lifters get more identity based phrasing.
const TRAINING_HISTORY_TITLE_OPTIONS_STAGE2 = [
  "The Seasons of Training",
  "The Pattern of Consistency",
  "The Rhythm Taking Shape",
  "The Work Taking Shape",
  "The Years of Training",
  "The Momentum Over Time",
  "The Shape of Strength",
  "The Middle Miles",
  "The Consistency in Motion",
  "The Making of a Lifter",
];

// We intentionally get more poetic for long term lifters.
const TRAINING_HISTORY_TITLE_OPTIONS_STAGE3 = [
  "The Lifting Journey",
  "The Lifetime Under the Bar",
  "The Long Build",
  "The Years of Showing Up",
  "The Long Game",
  "The Year-by-Year Story",
  "The Work That Stayed",
  "The Proof of Consistency",
  "The Archive of Effort",
  "The Iron Remembers",
];

// Selects the title pool that matches the user's training history length.
// Stage 1 (<2 years): neutral/functional. Stage 2 (2–4 years): identity-based. Stage 3 (5+): poetic.
export function getTrainingHistoryTitleOptions(yearsCount) {
  if (yearsCount >= 5) return TRAINING_HISTORY_TITLE_OPTIONS_STAGE3;
  if (yearsCount >= 2) return TRAINING_HISTORY_TITLE_OPTIONS_STAGE2;
  return TRAINING_HISTORY_TITLE_OPTIONS_STAGE1;
}

// Scans parsedData in a single pass to find the earliest and latest lift dates,
// returned as "yyyy-MM-dd" strings for use as heatmap interval boundaries.
export function findTrainingHistoryDateBounds(parsedData) {
  if (!parsedData || parsedData.length === 0) {
    return null; // Return null for an empty array or invalid input
  }

  // parsedData[].date is already "YYYY-MM-DD", so string compare gives us the
  // min/max calendar date without constructing Dates (which would tempt local
  // getters and re-introduce the USA/EU off-by-one bug).
  let startDate = parsedData[0].date;
  let endDate = parsedData[0].date;

  parsedData.forEach((item) => {
    if (item.date < startDate) startDate = item.date;
    if (item.date > endDate) endDate = item.date;
  });

  return { startDate, endDate };
}

// Produces one Jan 1–Dec 31 interval per calendar year spanned by the user's data.
// Input strings are "yyyy-MM-dd". Each interval drives one Heatmap row in the daily view.
function buildCalendarYearDateRanges(startDateStr, endDateStr) {
  // Parse year directly from "YYYY-MM-DD" — avoids the UTC-parse-plus-local-getter
  // off-by-one that shifts Jan 1 entries to the prior year for USA/EU users.
  const startYear = parseInt(startDateStr.slice(0, 4), 10);
  const endYear = parseInt(endDateStr.slice(0, 4), 10);

  // Generate one range per calendar year
  const yearRanges = [];
  for (let year = startYear; year <= endYear; year++) {
    yearRanges.push({
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
    });
  }

  return yearRanges;
}

function shiftTrainingDateString(dateStr, dayDelta) {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + dayDelta);
  return format(date, "yyyy-MM-dd");
}

function getDaysBetweenTrainingDates(startDateStr, endDateStr) {
  const start = new Date(`${startDateStr}T00:00:00`);
  const end = new Date(`${endDateStr}T00:00:00`);
  return Math.max(
    0,
    Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
  );
}

function buildEarlyJourneyDateRange({
  startDate,
  endDate,
  minWindowDays,
  maxWindowDays,
  label,
}) {
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const historySpanDays = getDaysBetweenTrainingDates(startDate, endDate);

  if (historySpanDays < minWindowDays) {
    return {
      startDate: shiftTrainingDateString(todayStr, -(minWindowDays - 1)),
      endDate: todayStr,
      isFocused: true,
      label,
    };
  }

  const desiredStart = shiftTrainingDateString(todayStr, -(maxWindowDays - 1));
  return {
    startDate: startDate > desiredStart ? startDate : desiredStart,
    endDate: todayStr,
    isFocused: true,
    label,
  };
}

export function getVisibleTrainingDateRanges({
  startDate,
  endDate,
  dashboardStage,
}) {
  if (!startDate || !endDate) return [];

  if (dashboardStage === "starter_sample") {
    return [
      buildEarlyJourneyDateRange({
        startDate,
        endDate,
        minWindowDays: 21,
        maxWindowDays: 42,
        label: "first weeks",
      }),
    ];
  }

  if (dashboardStage === "first_real_week") {
    return [
      buildEarlyJourneyDateRange({
        startDate,
        endDate,
        minWindowDays: 28,
        maxWindowDays: 56,
        label: "early block",
      }),
    ];
  }

  if (dashboardStage === "first_month") {
    return [
      buildEarlyJourneyDateRange({
        startDate,
        endDate,
        minWindowDays: 42,
        maxWindowDays: 84,
        label: "first months",
      }),
    ];
  }

  return buildCalendarYearDateRanges(startDate, endDate);
}

// Aggregates parsedData into { [year]: { [weekNum]: { sessions, count } } }.
// sessions = distinct training days in that week; count is capped at 3 for color mapping
// (0 = none, 1 = 1 day, 2 = 2 days, 3 = 3+ days). In demo mode returns randomised data.
export function buildWeeklyTrainingActivityByYear(
  parsedData,
  startYear,
  endYear,
  isDemoMode,
) {
  if (isDemoMode) {
    const result = {};
    for (let year = startYear; year <= endYear; year++) {
      result[year] = {};
      for (let week = 1; week <= 53; week++) {
        const rand = Math.random();
        const count = rand < 0.25 ? 0 : rand < 0.42 ? 1 : rand < 0.6 ? 2 : 3;
        result[year][week] = { sessions: count, count };
      }
    }
    return result;
  }

  const weekMap = {};
  const dateToWeekKey = new Map();
  const yearWeekIndexCache = new Map();
  for (const lift of parsedData) {
    if (lift.isGoal) continue;
    const year = parseInt(lift.date.substring(0, 4));
    if (year < startYear || year > endYear) continue;
    let weekKey = dateToWeekKey.get(lift.date);
    if (weekKey === undefined) {
      weekKey = getWeekKeyFromDateStr(lift.date);
      dateToWeekKey.set(lift.date, weekKey);
    }
    const yearWeekCacheKey = `${year}:${weekKey}`;
    let weekNum = yearWeekIndexCache.get(yearWeekCacheKey);
    if (weekNum === undefined) {
      weekNum = getCalendarYearWeekIndexFromWeekKey(year, weekKey);
      yearWeekIndexCache.set(yearWeekCacheKey, weekNum);
    }
    if (!weekMap[year]) weekMap[year] = {};
    if (!weekMap[year][weekNum])
      weekMap[year][weekNum] = { sessionDays: new Set() };
    weekMap[year][weekNum].sessionDays.add(lift.date);
  }

  const result = {};
  for (const [yearStr, weeks] of Object.entries(weekMap)) {
    result[yearStr] = {};
    for (const [weekStr, week] of Object.entries(weeks)) {
      const sessions = week.sessionDays.size;
      result[yearStr][weekStr] = { sessions, count: Math.min(sessions, 3) };
    }
  }
  return result;
}

// Aggregates parsedData into { [year]: { [month]: { activeWeeks, count, weekBreakdown } } }.
// activeWeeks = distinct calendar weeks in that month with at least one session; count capped at 4.
// weekBreakdown is sorted chronologically and drives the per-week rows in the monthly tooltip.
// In demo mode returns randomised data with a realistic active-month distribution.
export function buildMonthlyTrainingActivityByYear(
  parsedData,
  startYear,
  endYear,
  isDemoMode,
) {
  if (isDemoMode) {
    const result = {};
    for (let year = startYear; year <= endYear; year++) {
      result[year] = {};
      for (let month = 1; month <= 12; month++) {
        const rand = Math.random();
        const count =
          rand < 0.12
            ? 0
            : rand < 0.28
              ? 1
              : rand < 0.5
                ? 2
                : rand < 0.75
                  ? 3
                  : 4;
        const weekBreakdown = Array.from({ length: count }, () => ({
          sessions: Math.floor(Math.random() * 4) + 1,
        }));
        result[year][month] = {
          activeWeeks: count,
          count,
          totalSessions: weekBreakdown.reduce(
            (sum, week) => sum + week.sessions,
            0,
          ),
          weekBreakdown,
        };
      }
    }
    return result;
  }

  // Per week within each month, collect unique training days (dates)
  const monthMap = {};
  const dateToWeekKey = new Map();
  for (const lift of parsedData) {
    if (lift.isGoal) continue;
    const year = parseInt(lift.date.substring(0, 4));
    if (year < startYear || year > endYear) continue;
    const month = parseInt(lift.date.substring(5, 7));
    let weekKey = dateToWeekKey.get(lift.date);
    if (weekKey === undefined) {
      weekKey = getWeekKeyFromDateStr(lift.date);
      dateToWeekKey.set(lift.date, weekKey);
    }
    if (!monthMap[year]) monthMap[year] = {};
    if (!monthMap[year][month]) monthMap[year][month] = {};
    if (!monthMap[year][month][weekKey])
      monthMap[year][month][weekKey] = new Set();
    monthMap[year][month][weekKey].add(lift.date);
  }

  const result = {};
  for (const [yearStr, months] of Object.entries(monthMap)) {
    result[yearStr] = {};
    for (const [monthStr, weekData] of Object.entries(months)) {
      // Sort by week number so tooltip rows are chronological
      const weekBreakdown = Object.entries(weekData)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([weekKey, days]) => ({ weekKey, sessions: days.size }));
      const activeWeeks = weekBreakdown.length;
      result[yearStr][monthStr] = {
        activeWeeks,
        count: Math.min(activeWeeks, 4),
        totalSessions: weekBreakdown.reduce(
          (sum, week) => sum + week.sessions,
          0,
        ),
        weekBreakdown,
      };
    }
  }
  return result;
}

// Volume-based heatmap level:
// Level 0: No activity (no entry)
// Level 1: Light session (1-3 sets)
// Level 2: Moderate session (4-8 sets)
// Parse "YYYY-MM-DD" as local midnight, not UTC.
// new Date("2025-03-15") is UTC midnight which shifts dates in negative-UTC
// timezones (US, Americas). This helper avoids that by using the Date constructor
// with explicit year/month/day in local time.
export function parseTrainingDateAsLocalDate(dateStr) {
  const y = +dateStr.slice(0, 4);
  const m = +dateStr.slice(5, 7) - 1;
  const d = +dateStr.slice(8, 10);
  return new Date(y, m, d);
}

// Level 3: Heavy session (9+ sets) OR non-core lift PR
// Level 4: Core lift PR (strongest visual emphasis)
function getDailyTrainingHeatmapIntensity(totalSets, hasPR, hasCoreLiftPR) {
  if (hasCoreLiftPR) return 4;
  if (totalSets >= 9 || hasPR) return 3;
  if (totalSets >= 4) return 2;
  return 1;
}

// Builds the heatmap value array for one calendar year from parsedData.
// Single O(n) pass produces { date, count, sessionData } entries where count = getDailyTrainingHeatmapIntensity()
// and sessionData carries PR and set details for tooltip rendering.
// In demo mode returns randomised counts across the full date range to fill the grid attractively.
export function buildDailyTrainingHeatmapDays(
  parsedData,
  startDate,
  endDate,
  isDemoMode,
) {
  // Generate a full interval of random data for demo mode because it looks good
  if (isDemoMode) {
    const demoHeatmapData = [];
    const start = parseTrainingDateAsLocalDate(startDate).getTime();
    const end = parseTrainingDateAsLocalDate(endDate).getTime();
    const oneDay = 24 * 60 * 60 * 1000; // milliseconds in a day

    // Function to get a random count based on specified probabilities
    const getRandomCount = () => {
      const rand = Math.random();
      if (rand < 0.6) return 0; // 60% chance of being 0
      if (rand < 0.75) return 1;
      if (rand < 0.88) return 2;
      if (rand < 0.96) return 3;
      return 4;
    };

    for (let currentTime = start; currentTime <= end; currentTime += oneDay) {
      const count = getRandomCount();
      const d = new Date(currentTime);
      demoHeatmapData.push({
        date: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
        dateKey: format(d, "yyyy-MM-dd"),
        count: count,
        sessionData: null,
      });
    }

    return demoHeatmapData;
  }

  // Build per-day data in a single O(n) pass
  const dayMap = {};

  for (const lift of parsedData) {
    if (lift.date < startDate || lift.date > endDate) continue;
    if (lift.isGoal) continue;

    const dateStr = lift.date;
    if (!dayMap[dateStr]) {
      dayMap[dateStr] = {
        totalSets: 0,
        prs: [],
        liftsByType: {},
        hasPR: false,
        hasCoreLiftPR: false,
      };
    }

    const day = dayMap[dateStr];
    day.totalSets++;

    if (!day.liftsByType[lift.liftType]) {
      day.liftsByType[lift.liftType] = [];
    }
    day.liftsByType[lift.liftType].push({
      reps: lift.reps,
      weight: lift.weight,
      unitType: lift.unitType,
    });

    if (lift.isHistoricalPR) {
      day.hasPR = true;
      day.prs.push({
        liftType: lift.liftType,
        reps: lift.reps,
        weight: lift.weight,
        unitType: lift.unitType,
      });
      if (coreLiftTypes.includes(lift.liftType)) {
        day.hasCoreLiftPR = true;
      }
    }
  }

  const heatmapData = Object.entries(dayMap).map(([date, day]) => ({
    date: parseTrainingDateAsLocalDate(date),
    dateKey: date,
    count: getDailyTrainingHeatmapIntensity(
      day.totalSets,
      day.hasPR,
      day.hasCoreLiftPR,
    ),
    sessionData: {
      totalSets: day.totalSets,
      uniqueLifts: Object.keys(day.liftsByType).length,
      prs: day.prs,
      liftsByType: day.liftsByType,
    },
  }));

  return heatmapData;
}
