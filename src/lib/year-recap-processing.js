/** @format */

import { format } from "date-fns";
import {
  calculateSessionTonnageForDate,
  calculateLiftTypes,
} from "./processing-utils";
import { getGradeAndColor } from "./consistency-grades";
import { findLiftPositionInTopLifts } from "./processing-utils";

// --- Date helpers (adapted from section-top-cards) ---
function getWeekKeyFromDateStr(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  const dow = d.getUTCDay();
  const daysBack = (dow + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysBack);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysInMonth(y, month1Based) {
  if (month1Based === 2) {
    const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    return isLeap ? 29 : 28;
  }
  if ([4, 6, 9, 11].includes(month1Based)) return 30;
  return 31;
}

function subtractDaysFromStr(dateStr, n) {
  let y = parseInt(dateStr.slice(0, 4), 10);
  let m = parseInt(dateStr.slice(5, 7), 10);
  let d = parseInt(dateStr.slice(8, 10), 10);
  for (let i = 0; i < n; i++) {
    d--;
    if (d < 1) {
      m--;
      if (m < 1) {
        m = 12;
        y--;
      }
      d = daysInMonth(y, m);
    }
  }
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function addDaysFromStr(dateStr, n) {
  let y = parseInt(dateStr.slice(0, 4), 10);
  let m = parseInt(dateStr.slice(5, 7), 10);
  let d = parseInt(dateStr.slice(8, 10), 10);
  for (let i = 0; i < n; i++) {
    const maxD = daysInMonth(y, m);
    d++;
    if (d > maxD) {
      d = 1;
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }
  }
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Get unique years that have data (ascending).
 * @param {Array} parsedData
 * @returns {number[]}
 */
export function getYearsWithData(parsedData) {
  if (!parsedData || parsedData.length === 0) return [];

  const years = new Set();
  parsedData.forEach((entry) => {
    if (entry.isGoal || !entry.date) return;
    const year = new Date(entry.date + "T00:00:00Z").getFullYear();
    years.add(year);
  });

  return Array.from(years).sort((a, b) => a - b);
}

/**
 * Compute per-year metrics for the Strength Unwrapped recap.
 * @param {Array} parsedData - Sorted lift entries
 * @param {Object} topLiftsByTypeAndReps - PRs by lift type and rep range
 * @param {Array} liftTypes - From calculateLiftTypes
 * @param {number} year - Calendar year (e.g. 2024)
 * @param {string} preferredUnit - "lb" or "kg"
 * @returns {Object}
 */
export function computeYearRecapMetrics(
  parsedData,
  topLiftsByTypeAndReps,
  liftTypes,
  year,
  preferredUnit = "lb",
) {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  if (!parsedData || parsedData.length === 0) {
    return {
      sessionCount: 0,
      tonnage: 0,
      tonnageByUnit: {},
      mostTrainedLift: null,
      mostTrainedLiftSets: 0,
      mostTrainedLiftReps: 0,
      mostTrainedLiftSessions: 0,
      bestStreak: 0,
      consistencyGrade: null,
      consistencyPercentage: 0,
      prHighlights: [],
      monthlySessions: [],
      busiestMonth: null,
    };
  }

  const sessionDates = new Set();
  const sessionDatesByMonth = Array.from({ length: 12 }, () => new Set());
  let tonnageByUnit = {};
  const liftTypeSets = {};
  const liftTypeReps = {};
  const liftTypeSessionDates = {};

  parsedData.forEach((entry) => {
    if (entry.isGoal || !entry.date) return;
    if (entry.date < yearStart || entry.date > yearEnd) return;

    sessionDates.add(entry.date);

    const month = parseInt(entry.date.slice(5, 7), 10) - 1;
    sessionDatesByMonth[month].add(entry.date);

    const tonnage = (entry.weight ?? 0) * (entry.reps ?? 0);
    const u = entry.unitType || "lb";
    tonnageByUnit[u] = (tonnageByUnit[u] ?? 0) + tonnage;

    const lt = entry.liftType;
    liftTypeSets[lt] = (liftTypeSets[lt] ?? 0) + 1;
    liftTypeReps[lt] = (liftTypeReps[lt] ?? 0) + (entry.reps ?? 0);
    if (!liftTypeSessionDates[lt]) liftTypeSessionDates[lt] = new Set();
    liftTypeSessionDates[lt].add(entry.date);
  });

  const monthSessionCounts = sessionDatesByMonth.map((s) => s.size);

  const sessionCount = sessionDates.size;

  const unitKeys = Object.keys(tonnageByUnit);
  const primaryUnit = preferredUnit && unitKeys.includes(preferredUnit)
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

  const mostTrainedEntry = Object.keys(liftTypeSets).length > 0
    ? Object.entries(liftTypeSets).sort((a, b) => b[1] - a[1])[0]
    : null;
  const mostTrainedLift = mostTrainedEntry ? mostTrainedEntry[0] : null;
  const mostTrainedLiftSets = mostTrainedLift ? liftTypeSets[mostTrainedLift] : 0;
  const mostTrainedLiftReps = mostTrainedLift ? liftTypeReps[mostTrainedLift] : 0;
  const mostTrainedLiftSessions = mostTrainedLift && liftTypeSessionDates[mostTrainedLift]
    ? liftTypeSessionDates[mostTrainedLift].size
    : 0;

  const bestStreak = computeBestStreakForYear(
    Array.from(sessionDates).sort(),
    year,
  );

  const expectedSessions = Math.round((365 / 7) * 3);
  const consistencyPercentage = Math.min(
    100,
    Math.round((sessionCount / expectedSessions) * 100),
  );
  const consistencyGrade = getGradeAndColor(consistencyPercentage);

  const prHighlights = getPRHighlightsForYear(
    parsedData,
    topLiftsByTypeAndReps,
    yearStart,
    yearEnd,
  );

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const monthlySessions = monthSessionCounts.map((count, i) => ({
    month: monthNames[i],
    monthIndex: i,
    sessionCount: count,
  }));
  const maxMonthCount = Math.max(...monthSessionCounts);
  const busiestMonthIndex = monthSessionCounts.indexOf(maxMonthCount);
  const busiestMonth = busiestMonthIndex >= 0 ? monthNames[busiestMonthIndex] : null;

  return {
    sessionCount,
    tonnage,
    tonnageByUnit,
    primaryUnit,
    mostTrainedLift,
    mostTrainedLiftSets,
    mostTrainedLiftReps,
    mostTrainedLiftSessions,
    bestStreak,
    consistencyGrade,
    consistencyPercentage,
    prHighlights,
    monthlySessions,
    busiestMonth,
  };
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
    if (sessionCount >= 3) {
      tempStreak++;
      bestStreak = Math.max(bestStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
    weekKey = addDaysFromStr(weekKey, 7);
  }

  return bestStreak;
}

function getPRHighlightsForYear(
  parsedData,
  topLiftsByTypeAndReps,
  yearStart,
  yearEnd,
) {
  if (!topLiftsByTypeAndReps) return [];

  const yearPRs = [];

  Object.entries(topLiftsByTypeAndReps).forEach(([liftType, repRanges]) => {
    repRanges.forEach((prs, repsIndex) => {
      const reps = repsIndex + 1;
      (prs || []).forEach((pr) => {
        if (pr.date >= yearStart && pr.date <= yearEnd) {
          const { rank, annotation } = findLiftPositionInTopLifts(
            pr,
            topLiftsByTypeAndReps,
          );
          yearPRs.push({
            ...pr,
            reps,
            rank,
            annotation,
          });
        }
      });
    });
  });

  yearPRs.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return (b.weight ?? 0) - (a.weight ?? 0);
  });

  return yearPRs.slice(0, 5);
}

/**
 * Format tonnage for display (e.g. 1.2M, 250k).
 * @param {number} value
 * @returns {string}
 */
export function formatYearTonnage(value) {
  if (!value || value <= 0) return "0";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${Math.round(value / 1_000)}k`;
  return value.toLocaleString();
}

/**
 * Real-world equivalents for yearly tonnage (scaled for larger values).
 * Per unit type. Pick one where tonnage/weight >= 0.1.
 */
export const YEARLY_TONNAGE_EQUIVALENTS = {
  kg: [
    { name: "blue whale", weight: 150000, emoji: "🐋" },
    { name: "elephant", weight: 6000, emoji: "🐘" },
    { name: "school bus", weight: 5670, emoji: "🚌" },
    { name: "car", weight: 1500, emoji: "🚗" },
    { name: "cow", weight: 700, emoji: "🐄" },
    { name: "grand piano", weight: 300, emoji: "🎹" },
    { name: "vending machine", weight: 250, emoji: "🥤" },
    { name: "Eddie Hall", weight: 180, emoji: "🦍" },
    { name: "Labrador Retriever", weight: 30, emoji: "🐕" },
    { name: "rotisserie chicken", weight: 1.5, emoji: "🍗" },
  ],
  lb: [
    { name: "blue whale", weight: 330000, emoji: "🐋" },
    { name: "elephant", weight: 13200, emoji: "🐘" },
    { name: "school bus", weight: 12500, emoji: "🚌" },
    { name: "car", weight: 3300, emoji: "🚗" },
    { name: "cow", weight: 1540, emoji: "🐄" },
    { name: "grand piano", weight: 660, emoji: "🎹" },
    { name: "vending machine", weight: 550, emoji: "🥤" },
    { name: "Eddie Hall", weight: 400, emoji: "🦍" },
    { name: "Labrador Retriever", weight: 66, emoji: "🐕" },
    { name: "rotisserie chicken", weight: 3.3, emoji: "🍗" },
  ],
};

/**
 * Pick a tonnage equivalent for display. Valid where tonnage/weight >= 0.1.
 * @param {number} tonnage - Total tonnage
 * @param {string} unitType - "lb" or "kg"
 * @param {Object} ref - useRef for persistence
 * @param {string} key - Unique key (e.g. year)
 * @returns {{ name: string, count: number, emoji: string }|null}
 */
export function pickTonnageEquivalent(tonnage, unitType, ref, key) {
  const equivalents = YEARLY_TONNAGE_EQUIVALENTS[unitType] ?? YEARLY_TONNAGE_EQUIVALENTS.lb;
  const valid = equivalents.filter((eq) => tonnage / eq.weight >= 0.1);
  const candidates = valid.length > 0 ? valid : equivalents;

  if (ref.current && ref.current[key]) {
    return ref.current[key];
  }

  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  const result = {
    name: chosen.name,
    count: tonnage / chosen.weight,
    emoji: chosen.emoji,
  };
  if (!ref.current) ref.current = {};
  ref.current[key] = result;
  return result;
}
