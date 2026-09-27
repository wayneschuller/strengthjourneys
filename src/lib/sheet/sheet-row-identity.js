/**
 * Identity checks for optimistic sheet rows.
 * These helpers prevent stale parsed data from replacing newly inserted rows
 * just because Google Sheets reused a row index during a structural write.
 */

export function hasMatchingRealSetForPendingSet(pendingSet, sessionLifts) {
  if (!pendingSet?.rowIndex) return false;

  return Object.values(sessionLifts ?? {}).some((sets) =>
    sets.some((realSet) => doSetsRepresentSameLoggedSet(pendingSet, realSet)),
  );
}

export function doSetsRepresentSameLoggedSet(pendingSet, realSet) {
  if (!pendingSet?.rowIndex || pendingSet.rowIndex !== realSet?.rowIndex) {
    return false;
  }

  return (
    pendingSet.date === realSet.date &&
    pendingSet.liftType === realSet.liftType &&
    Number(pendingSet.reps) === Number(realSet.reps) &&
    Number(pendingSet.weight) === Number(realSet.weight) &&
    (pendingSet.unitType ?? "") === (realSet.unitType ?? "") &&
    normalizeOptionalSheetText(pendingSet.notes) ===
      normalizeOptionalSheetText(realSet.notes) &&
    normalizeOptionalSheetText(pendingSet.URL) ===
      normalizeOptionalSheetText(realSet.URL)
  );
}

function normalizeOptionalSheetText(value) {
  return String(value ?? "").trim();
}
