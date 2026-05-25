/**
 * Pure selectors for deriving a single log-session view from parsed lift data.
 * Keep these data-focused so dashboard and future session surfaces can reuse
 * them without importing log-page UI code.
 */

import { getAverageLiftSessionTonnageFromPrecomputed } from "@/lib/processing-utils";
import { hasMatchingRealSetForPendingSet } from "@/lib/sheet-row-identity";

export function getSessionDates(parsedData) {
  if (!parsedData) return [];
  const seen = new Set();
  const dates = [];
  for (const entry of parsedData) {
    if (!entry.isGoal && !seen.has(entry.date)) {
      seen.add(entry.date);
      dates.push(entry.date);
    }
  }
  return dates;
}

export function groupSessionLifts(parsedData, sessionDate, deletedRowIndices) {
  if (!parsedData) return {};
  const entries = parsedData.filter(
    (entry) =>
      entry.date === sessionDate &&
      !entry.isGoal &&
      !deletedRowIndices.has(entry.rowIndex),
  );
  const grouped = {};
  for (const entry of entries) {
    if (!grouped[entry.liftType]) grouped[entry.liftType] = [];
    grouped[entry.liftType].push(entry);
  }
  return grouped;
}

export function pruneSyncedPendingSets({
  pendingSets,
  sessionLifts,
  deletedRowIndices,
}) {
  let changed = false;
  const next = {};
  for (const [liftType, sets] of Object.entries(pendingSets ?? {})) {
    const remaining = sets.filter(
      (set) =>
        !deletedRowIndices.has(set.rowIndex) &&
        (set._pending ||
          !hasMatchingRealSetForPendingSet(set, sessionLifts)),
    );
    if (remaining.length !== sets.length) changed = true;
    if (remaining.length) next[liftType] = remaining;
  }
  return changed ? next : pendingSets;
}

export function mergeSessionLiftsWithPending({
  sessionLifts,
  pendingSets,
  deletedRowIndices,
}) {
  const merged = { ...sessionLifts };
  for (const [liftType, sets] of Object.entries(pendingSets ?? {})) {
    const unique = sets.filter(
      (set) =>
        !deletedRowIndices.has(set.rowIndex) &&
        (set._pending ||
          !hasMatchingRealSetForPendingSet(set, sessionLifts)),
    );
    if (unique.length) {
      merged[liftType] = [...(merged[liftType] ?? []), ...unique];
    }
  }
  return merged;
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
            (avgLiftTonnage > 0 &&
              currentLiftTonnage >= avgLiftTonnage * 0.4),
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
