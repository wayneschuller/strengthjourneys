import {
  differenceInCalendarDays,
  differenceInCalendarMonths,
  differenceInCalendarYears,
  format,
  parseISO,
} from "date-fns";

import { addDaysFromStr, getWeekKeyFromDateStr, subtractDaysFromStr } from "@/lib/date-utils";
import { JOURNEY_COMPLIMENT_POOLS } from "@/lib/home-dashboard/inspiration-card-copy";

export function formatJourneyLength(startDate) {
  const today = new Date();
  const start = parseISO(startDate);

  const years = differenceInCalendarYears(today, start);
  const months = differenceInCalendarMonths(today, start) % 12;
  const days = differenceInCalendarDays(today, start) % 30;

  if (years > 0) {
    const pluralizedYears = `${years} year${years > 1 ? "s" : ""}`;
    const compliment = getJourneyComplimentFromPool({ years, startDate, today });
    return `${pluralizedYears} of ${compliment}`;
  }

  if (months > 0) {
    const compliment = getJourneyComplimentFromPool({ years: 0, startDate, today });
    return `${months} month${months > 1 ? "s" : ""} of ${compliment}`;
  }

  const compliment = getJourneyComplimentFromPool({ years: 0, startDate, today });
  return `${days} day${days !== 1 ? "s" : ""} of ${compliment}`;
}

export function getJourneyComplimentFromPool({ years, startDate, today }) {
  let poolKey = "underOneYear";
  let pool = JOURNEY_COMPLIMENT_POOLS.underOneYear;

  if (years >= 10) {
    poolKey = "tenPlusYears";
    pool = JOURNEY_COMPLIMENT_POOLS.tenPlusYears;
  } else if (years >= 5) {
    poolKey = "fiveToTenYears";
    pool = JOURNEY_COMPLIMENT_POOLS.fiveToTenYears;
  } else if (years >= 3) {
    poolKey = "threeToFiveYears";
    pool = JOURNEY_COMPLIMENT_POOLS.threeToFiveYears;
  } else if (years >= 1) {
    poolKey = "oneToTwoYears";
    pool = JOURNEY_COMPLIMENT_POOLS.oneToTwoYears;
  }

  if (typeof window !== "undefined") {
    try {
      const storageKey = `journey-compliment:${startDate}:${poolKey}`;
      const storedIndex = window.sessionStorage.getItem(storageKey);

      if (storedIndex !== null) {
        const parsedIndex = Number.parseInt(storedIndex, 10);
        if (
          Number.isInteger(parsedIndex) &&
          parsedIndex >= 0 &&
          parsedIndex < pool.length
        ) {
          return pool[parsedIndex];
        }
      }

      const randomIndex = Math.floor(Math.random() * pool.length);
      window.sessionStorage.setItem(storageKey, String(randomIndex));
      return pool[randomIndex];
    } catch {
      // Fall through to deterministic fallback if sessionStorage is unavailable.
    }
  }

  const seed = `${startDate}-${poolKey}-${format(today, "yyyy-MM-dd")}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }

  return pool[hash % pool.length];
}

export function calculateTotalStats(liftTypes) {
  if (!liftTypes) return { totalSets: 0, totalReps: 0 };

  return liftTypes.reduce(
    (acc, lift) => ({
      totalSets: acc.totalSets + lift.totalSets,
      totalReps: acc.totalReps + lift.totalReps,
    }),
    { totalSets: 0, totalReps: 0 },
  );
}

export function calculateLifetimeTonnageFromLookup(
  sessionTonnageLookup,
  preferredUnit = "lb",
) {
  const allSessionDates = sessionTonnageLookup?.allSessionDates ?? [];
  const sessionTonnageByDate = sessionTonnageLookup?.sessionTonnageByDate ?? {};

  if (allSessionDates.length === 0) {
    return {
      totalByUnit: {},
      primaryUnit: preferredUnit || "lb",
      primaryTotal: 0,
      sessionCount: 0,
      averagePerSession: 0,
      hasTwelveMonthsOfData: false,
      lastYearPrimaryTotal: 0,
    };
  }

  const totalByUnit = {};
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const twelveMonthsAgoStr = subtractDaysFromStr(todayStr, 365);
  const lastYearByUnit = {};
  const earliestDateStr = allSessionDates[0] ?? null;
  const latestDateStr = allSessionDates[allSessionDates.length - 1] ?? null;

  for (let i = 0; i < allSessionDates.length; i++) {
    const date = allSessionDates[i];
    const tonnageByUnit = sessionTonnageByDate[date];
    if (!tonnageByUnit) continue;

    const unitKeys = Object.keys(tonnageByUnit);
    for (let j = 0; j < unitKeys.length; j++) {
      const unit = unitKeys[j];
      const tonnage = tonnageByUnit[unit] ?? 0;
      if (!tonnage) continue;
      totalByUnit[unit] = (totalByUnit[unit] ?? 0) + tonnage;
      if (date >= twelveMonthsAgoStr && date <= todayStr) {
        lastYearByUnit[unit] = (lastYearByUnit[unit] ?? 0) + tonnage;
      }
    }
  }

  const unitKeys = Object.keys(totalByUnit);
  const primaryUnit = preferredUnit || unitKeys[0] || "lb";

  let primaryTotal = 0;
  const KG_PER_LB = 1 / 2.2046;
  const LB_PER_KG = 2.2046;

  unitKeys.forEach((unit) => {
    const value = totalByUnit[unit] ?? 0;
    if (!value) return;

    if (unit === primaryUnit) {
      primaryTotal += value;
      return;
    }

    if (unit === "kg" && primaryUnit === "lb") {
      primaryTotal += value * LB_PER_KG;
    } else if (unit === "lb" && primaryUnit === "kg") {
      primaryTotal += value * KG_PER_LB;
    } else {
      primaryTotal += value;
    }
  });

  let hasTwelveMonthsOfData = false;
  let lastYearPrimaryTotal = 0;
  if (earliestDateStr && latestDateStr) {
    const earliestDate = new Date(earliestDateStr + "T00:00:00Z");
    const latestDate = new Date(latestDateStr + "T00:00:00Z");
    const diffDays =
      (latestDate.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24);
    hasTwelveMonthsOfData = diffDays >= 365;
  }

  if (hasTwelveMonthsOfData) {
    const lastYearKeys = Object.keys(lastYearByUnit);
    lastYearKeys.forEach((unit) => {
      const value = lastYearByUnit[unit] ?? 0;
      if (!value) return;

      if (unit === primaryUnit) {
        lastYearPrimaryTotal += value;
      } else if (unit === "kg" && primaryUnit === "lb") {
        lastYearPrimaryTotal += value * LB_PER_KG;
      } else if (unit === "lb" && primaryUnit === "kg") {
        lastYearPrimaryTotal += value * KG_PER_LB;
      } else {
        lastYearPrimaryTotal += value;
      }
    });
  }

  const averagePerSession =
    allSessionDates.length > 0
      ? Math.round(primaryTotal / allSessionDates.length)
      : 0;

  return {
    totalByUnit,
    primaryUnit,
    primaryTotal,
    sessionCount: allSessionDates.length,
    averagePerSession,
    hasTwelveMonthsOfData,
    lastYearPrimaryTotal,
  };
}

export function formatLifetimeTonnage(value) {
  if (!value || value <= 0) return "0";

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 10_000) {
    return `${Math.round(value / 1_000)}k`;
  }

  return value.toLocaleString();
}

export function calculateSessionMomentumFromDates(allSessionDates) {
  if (!allSessionDates || allSessionDates.length === 0) {
    return {
      recentSessions: 0,
      previousSessions: 0,
      sessionDelta: 0,
      percentageChange: 0,
      windowDays: 90,
    };
  }

  const windowDays = 90;
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const recentStartStr = subtractDaysFromStr(todayStr, windowDays - 1);
  const previousStartStr = subtractDaysFromStr(todayStr, windowDays * 2 - 1);

  const recentSessionDates = new Set();
  const previousSessionDates = new Set();

  for (let i = 0; i < allSessionDates.length; i++) {
    const dateStr = allSessionDates[i];
    if (dateStr >= recentStartStr && dateStr <= todayStr) {
      recentSessionDates.add(dateStr);
    } else if (dateStr >= previousStartStr && dateStr < recentStartStr) {
      previousSessionDates.add(dateStr);
    }
  }

  const recentSessions = recentSessionDates.size;
  const previousSessions = previousSessionDates.size;
  const sessionDelta = recentSessions - previousSessions;

  let percentageChange = 0;
  if (previousSessions > 0) {
    percentageChange = Math.round(
      ((recentSessions - previousSessions) / previousSessions) * 100,
    );
  } else if (recentSessions > 0) {
    percentageChange = 100;
  }

  return {
    recentSessions,
    previousSessions,
    sessionDelta,
    percentageChange,
    windowDays,
  };
}

export function calculateStreakFromDates(allSessionDates) {
  if (!allSessionDates || allSessionDates.length === 0) {
    return { currentStreak: 0, bestStreak: 0, sessionsThisWeek: 0 };
  }

  const dateToWeekKey = new Map();
  const weekMap = new Map();

  for (let i = 0; i < allSessionDates.length; i++) {
    const dateStr = allSessionDates[i];
    let weekKey = dateToWeekKey.get(dateStr);
    if (weekKey === undefined) {
      weekKey = getWeekKeyFromDateStr(dateStr);
      dateToWeekKey.set(dateStr, weekKey);
    }
    if (!weekMap.has(weekKey)) weekMap.set(weekKey, new Set());
    weekMap.get(weekKey).add(dateStr);
  }

  const weekSessionCount = new Map();
  weekMap.forEach((dates, weekKey) => {
    weekSessionCount.set(weekKey, dates.size);
  });

  const weekKeys = Array.from(weekSessionCount.keys()).sort();
  if (weekKeys.length === 0) {
    return { currentStreak: 0, bestStreak: 0, sessionsThisWeek: 0 };
  }

  const oldestWeek = weekKeys[0];
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const thisWeekKey = getWeekKeyFromDateStr(todayStr);
  const sessionsThisWeek = weekSessionCount.get(thisWeekKey) || 0;

  let currentStreak = 0;
  const thisWeekIsQualified = sessionsThisWeek >= 3;
  if (thisWeekIsQualified) currentStreak = 1;

  const lastCompleteWeekKey = subtractDaysFromStr(thisWeekKey, 7);
  let weekKey = lastCompleteWeekKey;
  while (weekKey >= oldestWeek) {
    const sessionCount = weekSessionCount.get(weekKey) || 0;
    if (sessionCount >= 3) {
      currentStreak++;
    } else {
      break;
    }
    weekKey = subtractDaysFromStr(weekKey, 7);
  }

  let bestStreak = 0;
  let tempStreak = 0;
  weekKey = oldestWeek;
  const bestStreakEndWeek = thisWeekIsQualified ? thisWeekKey : lastCompleteWeekKey;

  while (weekKey <= bestStreakEndWeek) {
    const sessionCount = weekSessionCount.get(weekKey) || 0;
    if (sessionCount >= 3) {
      tempStreak++;
      bestStreak = Math.max(bestStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
    weekKey = addDaysFromStr(weekKey, 7);
  }

  return { currentStreak, bestStreak, sessionsThisWeek };
}
