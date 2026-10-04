/**
 * Pure selectors for deriving a single log-session view from parsed lift data.
 * Keep these data-focused so dashboard and future session surfaces can reuse
 * them without importing log-page UI code.
 */

import { getAverageLiftSessionTonnageFromPrecomputed } from "@/lib/processing-utils";
import { getDaysBetweenYmd } from "@/lib/date-utils";

// A set counts half as much every 60 days, so the add-lift gallery follows a
// program change within weeks while a long break keeps the old order intact.
const RECENT_LIFT_HALF_LIFE_DAYS = 60;

/**
 * For each lift type, the last date it was trained before `sessionDate` and a
 * recency-weighted set count. Sets on or after the session date are ignored,
 * so logging in the current session never reshuffles the add-lift gallery,
 * and a past date shows the history as it stood on that day.
 *
 * @returns {Object<string, {lastDate: string, recentSets: number}>}
 */
export function getLiftHistoryBeforeDate(parsedData, sessionDate) {
  const history = {};
  if (!parsedData || !sessionDate) return history;
  const weightByDate = new Map();
  for (const entry of parsedData) {
    if (entry.date >= sessionDate) continue;
    let weight = weightByDate.get(entry.date);
    if (weight === undefined) {
      const daysAgo = getDaysBetweenYmd(entry.date, sessionDate);
      weight = 0.5 ** (daysAgo / RECENT_LIFT_HALF_LIFE_DAYS);
      weightByDate.set(entry.date, weight);
    }
    const lift = history[entry.liftType];
    if (!lift) {
      history[entry.liftType] = { lastDate: entry.date, recentSets: weight };
      continue;
    }
    if (entry.date > lift.lastDate) lift.lastDate = entry.date;
    lift.recentSets += weight;
  }
  return history;
}

export function getSessionDates(parsedData) {
  if (!parsedData) return [];
  const seen = new Set();
  const dates = [];
  for (const entry of parsedData) {
    if (!seen.has(entry.date)) {
      seen.add(entry.date);
      dates.push(entry.date);
    }
  }
  return dates;
}

export function getUsedSessionUrls(sessionLiftsWithPending) {
  return new Set(
    Object.values(sessionLiftsWithPending ?? {})
      .flat()
      .map((set) => set.URL?.trim())
      .filter(Boolean),
  );
}

export function getPerLiftTonnageStats({
  sessionDate,
  sessionLiftsWithPending,
  sessionTonnageLookup,
}) {
  if (!sessionDate || !sessionTonnageLookup) return null;

  return Object.fromEntries(
    Object.entries(sessionLiftsWithPending).map(([liftType, sets]) => {
      const nativeUnitType = sets?.[0]?.unitType ?? "lb";
      const currentLiftTonnage = sets.reduce(
        (sum, set) => sum + (set.weight ?? 0) * (set.reps ?? 0),
        0,
      );
      const setCount = sets.length;
      const { average: avgLiftTonnage, sessionCount } =
        getAverageLiftSessionTonnageFromPrecomputed(
          sessionTonnageLookup.sessionTonnageByDateAndLift,
          sessionTonnageLookup.allSessionDates,
          sessionDate,
          liftType,
          nativeUnitType,
        );

      return [
        liftType,
        {
          currentLiftTonnage,
          avgLiftTonnage,
          sessionCount,
          setCount,
          shouldShowComparison:
            setCount >= 4 ||
            (avgLiftTonnage > 0 && currentLiftTonnage >= avgLiftTonnage * 0.4),
          pctDiff:
            avgLiftTonnage > 0
              ? ((currentLiftTonnage - avgLiftTonnage) / avgLiftTonnage) * 100
              : null,
          unitType: nativeUnitType,
        },
      ];
    }),
  );
}

export function getPrevSessionDate(sessionDates, sessionDate) {
  const earlier = sessionDates.filter((date) => date < sessionDate);
  return earlier.length ? earlier[earlier.length - 1] : null;
}

export function getNextSessionDate(sessionDates, sessionDate, todayIso) {
  const later = sessionDates.filter((date) => date > sessionDate);
  if (later.length) return later[0];
  return sessionDate < todayIso ? todayIso : null;
}
