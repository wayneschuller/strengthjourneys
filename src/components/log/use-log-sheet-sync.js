/**
 * Sheet sync state and Google Sheets write operations for the log page.
 * The hook keeps row-shifting mutations serialized so optimistic rows do not
 * overwrite or disappear while Google Sheets is reindexing rows.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReadLocalStorage } from "usehooks-ts";

import { getDefaultBarbellWeight } from "@/lib/barbell-defaults";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import {
  groupSessionLifts,
  mergeSessionLiftsWithPending,
  pruneSyncedPendingSets,
} from "@/lib/log-session-selectors";
import { getDisplayWeight } from "@/lib/processing-utils";

import {
  buildSheetSnapshotFromFields,
  buildSheetSnapshotFromSetLike,
  getAutoTimestampNotes,
  getCellValueForField,
  getEditableSetFields,
  readApiError,
  snapshotToEditableFields,
} from "@/components/log/sheet-snapshot-utils";
import { logSheetTimings } from "@/components/log/timing-log";

function getPriorOpeningSet({ parsedData, liftType, sessionDate, isMetric }) {
  if (!Array.isArray(parsedData)) return null;

  const priorLiftRows = parsedData.filter(
    (entry) =>
      entry.liftType === liftType &&
      entry.date < sessionDate &&
      !entry.isGoal &&
      (entry.reps ?? 0) > 0 &&
      (entry.weight ?? 0) > 0,
  );
  if (!priorLiftRows.length) return null;

  const lastDate = priorLiftRows.reduce(
    (latest, entry) => (!latest || entry.date > latest ? entry.date : latest),
    null,
  );
  const openingSet = priorLiftRows
    .filter((entry) => entry.date === lastDate)
    .sort((a, b) => {
      if (Number.isFinite(a.rowIndex) && Number.isFinite(b.rowIndex)) {
        return a.rowIndex - b.rowIndex;
      }

      return priorLiftRows.indexOf(a) - priorLiftRows.indexOf(b);
    })[0];

  if (!openingSet) return null;

  const { value, unit } = getDisplayWeight(openingSet, isMetric);

  return {
    reps: openingSet.reps,
    weight: value,
    unitType: unit,
  };
}

export function useLogSheetSync({
  sheetInfo,
  parsedData,
  sessionDate,
  sessionDates,
  todayIso,
  isMetric,
  sex,
  mutate,
  toast,
}) {
  const storedBarType =
    useReadLocalStorage(LOCAL_STORAGE_KEYS.WARMUPS_BAR_TYPE, {
      initializeWithValue: false,
    }) ?? null;
  const defaultBarWeight = getDefaultBarbellWeight({
    isMetric,
    sex,
    storedBarType,
  });
  const [syncState, setSyncState] = useState("idle"); // idle | saving | saved | error
  const [isStructuralSaving, setIsStructuralSaving] = useState(false);
  // Row deletes reindex the visible list. A very fast double-click can hit the
  // intended row first, then hit the next row after the list collapses. Keep
  // the per-set trash buttons disabled for a short beat after delete completion
  // so pointer follow-through cannot immediately delete the shifted row.
  const [isDeleteCooldownActive, setIsDeleteCooldownActive] = useState(false);
  // Optimistic pending sets: { [liftType]: [pendingSetObj, ...] }
  // _pending: true  -> in-flight (show spinner)
  // _pending: false -> confirmed (rowIndex known, waiting for parsedData to catch up)
  const [pendingSets, setPendingSets] = useState({});
  const pendingSetsRef = useRef({});
  const queuedEditOpsRef = useRef([]);
  const queuedStructuralActionRef = useRef(null);
  const [deletedRowIndices, setDeletedRowIndices] = useState(new Set());

  // Structural mutation guard: prevents concurrent row-shifting API calls
  // (addSet, addLift, deleteSet) that could race on stale row indices.
  // Non-structural updates (PATCH to edit reps/weight/notes) target a fixed
  // rowIndex and never shift other rows, so they bypass this guard.
  // Keep the ref as the source of truth for race protection, and mirror it to
  // state so structural controls can visibly disable while row indices settle.
  const structuralSavingRef = useRef(false);
  const savedTimerRef = useRef(null);
  const deleteCooldownTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (deleteCooldownTimerRef.current) {
        clearTimeout(deleteCooldownTimerRef.current);
      }
      if (savedTimerRef.current) {
        clearTimeout(savedTimerRef.current);
      }
    };
  }, []);

  // Wrapper that keeps pendingSetsRef synchronously in sync. Queue draining reads
  // the ref immediately after state changes, so update it before scheduling the
  // React state update.
  const setPendingSetsSync = useCallback((updater) => {
    const next =
      typeof updater === "function" ? updater(pendingSetsRef.current) : updater;
    pendingSetsRef.current = next;
    setPendingSets(next);
    return next;
  }, []);

  const resetOptimisticSessionState = useCallback(() => {
    setPendingSetsSync({});
    setDeletedRowIndices(new Set());
  }, [setPendingSetsSync]);

  const queueStructuralAction = useCallback((action) => {
    queuedStructuralActionRef.current = action;
  }, []);

  const sessionLifts = useMemo(
    () => groupSessionLifts(parsedData, sessionDate, deletedRowIndices),
    [parsedData, sessionDate, deletedRowIndices],
  );

  // When parsedData catches up, remove confirmed rows from pendingSets.
  // Match more than rowIndex because stale SWR data can briefly contain the
  // pre-insert row at the newly assigned rowIndex.
  useEffect(() => {
    setPendingSetsSync((prev) =>
      pruneSyncedPendingSets({
        pendingSets: prev,
        sessionLifts,
        deletedRowIndices,
      }),
    );
  }, [sessionLifts, deletedRowIndices, setPendingSetsSync]);

  const sessionLiftsWithPending = useMemo(
    () =>
      mergeSessionLiftsWithPending({
        sessionLifts,
        pendingSets,
        deletedRowIndices,
      }),
    [sessionLifts, pendingSets, deletedRowIndices],
  );

  // Revalidate SWR data when the user leaves the log page so the dashboard
  // picks up any sets/lifts added during the session. Individual writes
  // deliberately skip mutate() to avoid mid-session flicker (see addSet).
  useEffect(() => {
    return () => {
      mutate();
    };
  }, [mutate]);

  // --- Sync helpers ---
  // Sync strategy note:
  // These client calls are intentionally operation-oriented, not pure REST.
  // The dangerous thing in this UI is not "updating a resource", it is
  // mutating a sparse Google Sheet where row position is unstable during
  // insert/delete flows. So the client talks to explicit sheet operations:
  // - edit-cell
  // - edit-row
  // - insert-row
  // - delete-row
  //
  // Structural ops (addSet/addLift/deleteSet) still gate on structuralSavingRef.
  // Non-structural edits are queued behind that gate when needed so they do not
  // blindly write against a row index while a local row-shifting operation is
  // still in flight.

  function markSaving() {
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    setSyncState("saving");
  }

  function markSaved() {
    setSyncState("saved");
    savedTimerRef.current = setTimeout(() => setSyncState("idle"), 2000);
    flushQueuedSync();
  }

  function markError() {
    setSyncState("error");
    savedTimerRef.current = setTimeout(() => setSyncState("idle"), 3000);
    flushQueuedSync();
  }

  function markStructuralSaving() {
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    structuralSavingRef.current = true;
    setIsStructuralSaving(true);
    setSyncState("saving");
  }

  function markStructuralSaved() {
    structuralSavingRef.current = false;
    setIsStructuralSaving(false);
    setSyncState("saved");
    savedTimerRef.current = setTimeout(() => setSyncState("idle"), 2000);
    // Flush any queued sync that was waiting for the structural op to finish
    flushQueuedSync();
  }

  function markStructuralError() {
    structuralSavingRef.current = false;
    setIsStructuralSaving(false);
    setSyncState("error");
    savedTimerRef.current = setTimeout(() => setSyncState("idle"), 3000);
    // Still attempt to flush — the structural op failed but queued edits
    // to already-confirmed rows are independent and should still land.
    flushQueuedSync();
  }

  function startDeleteCooldown() {
    if (deleteCooldownTimerRef.current)
      clearTimeout(deleteCooldownTimerRef.current);
    setIsDeleteCooldownActive(true);
    deleteCooldownTimerRef.current = setTimeout(() => {
      setIsDeleteCooldownActive(false);
      deleteCooldownTimerRef.current = null;
    }, 700);
  }

  const updatePendingSet = useCallback(
    (tempId, fields, queuedSync) => {
      let updatedSet = null;
      setPendingSetsSync((prev) => {
        let changed = false;
        const next = {};
        for (const [lt, sets] of Object.entries(prev)) {
          next[lt] = sets.map((s) => {
            if (s._tempId !== tempId) return s;
            changed = true;
            updatedSet = {
              ...s,
              reps: fields.reps,
              weight: fields.weight,
              unitType: fields.unitType ?? s.unitType,
              notes: fields.notes ?? "",
              URL: fields.url ?? "",
              _queuedSync: queuedSync,
            };
            return updatedSet;
          });
        }
        return changed ? next : prev;
      });
      return updatedSet;
    },
    [setPendingSetsSync],
  );

  const clearPendingQueuedSync = useCallback(
    (tempId, syncedFields = null) => {
      if (!tempId) return;
      setPendingSetsSync((prev) => {
        let changed = false;
        const next = {};
        for (const [lt, sets] of Object.entries(prev)) {
          next[lt] = sets.map((s) => {
            if (s._tempId !== tempId) return s;
            if (!s._queuedSync && !syncedFields) return s;
            changed = true;
            return {
              ...s,
              _queuedSync: false,
              _serverSnapshot: syncedFields
                ? buildSheetSnapshotFromFields(syncedFields, s)
                : s._serverSnapshot,
            };
          });
        }
        return changed ? next : prev;
      });
    },
    [setPendingSetsSync],
  );

  const abandonPendingQueuedSync = useCallback(
    (tempId, fallbackSnapshot = null) => {
      if (!tempId) return;
      const fallbackFields = fallbackSnapshot
        ? snapshotToEditableFields(fallbackSnapshot)
        : null;

      setPendingSetsSync((prev) => {
        let changed = false;
        const next = {};
        for (const [lt, sets] of Object.entries(prev)) {
          next[lt] = sets.map((s) => {
            if (s._tempId !== tempId) return s;
            if (!s._queuedSync && !fallbackFields) return s;
            changed = true;

            if (!fallbackFields) {
              return {
                ...s,
                _queuedSync: false,
              };
            }

            return {
              ...s,
              reps: fallbackFields.reps,
              weight: fallbackFields.weight,
              unitType: fallbackFields.unitType ?? s.unitType,
              notes: fallbackFields.notes ?? "",
              URL: fallbackFields.url ?? "",
              _queuedSync: false,
              _serverSnapshot: fallbackSnapshot,
            };
          });
        }
        return changed ? next : prev;
      });
    },
    [setPendingSetsSync],
  );

  // Promote the first still-pending row for a liftType to confirmed with a real rowIndex.
  const promoteFirstPending = useCallback(
    (liftType, rowIndex) => {
      setPendingSetsSync((prev) => {
        if (!prev[liftType]) return prev;
        let promoted = false;
        const next = prev[liftType].map((s) => {
          if (!promoted && s._pending) {
            promoted = true;
            return { ...s, _pending: false, rowIndex };
          }
          return s;
        });
        return { ...prev, [liftType]: next };
      });
    },
    [setPendingSetsSync],
  );

  const persistSetCellUpdate = useCallback(
    async (rowIndex, field, beforeSnapshot, value) => {
      if (!sheetInfo?.ssid) return;
      markSaving();
      const t0 = performance.now();
      try {
        const res = await fetch("/api/sheet/edit-cell", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ssid: sheetInfo.ssid,
            rowIndex,
            field,
            value,
            before: beforeSnapshot,
          }),
        });
        if (!res.ok) {
          const apiError = await readApiError(res, "Update failed");
          if (apiError.code === "PRECONDITION_FAILED") {
            console.error("[sheet/edit-cell] preflight verification failed", {
              rowIndex,
              field,
              beforeSnapshot,
              actual: apiError.actual,
              message: apiError.message,
            });
            toast({
              title: "Sheet changed before the edit landed",
              description:
                "This edit was blocked to avoid writing to the wrong row. Refresh the log and try again.",
              variant: "destructive",
              duration: 8000,
            });
            markError();
            return;
          }
          throw new Error(apiError.message || "Update failed");
        }
        markSaved();
      } catch (err) {
        console.error("[sheet/edit-cell] updateSet failed:", err);
        markError();
      }
      logSheetTimings(
        "updateSet",
        [{ name: "POST /api/sheet/edit-cell", ms: performance.now() - t0 }],
        performance.now() - t0,
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- markSaved/markError are stable local sync helpers
    [sheetInfo?.ssid, toast],
  );

  const persistSetRowUpdate = useCallback(
    async (rowIndex, beforeSnapshot, afterSnapshot, tempId = null) => {
      if (!sheetInfo?.ssid) return;
      markSaving();
      const t0 = performance.now();
      try {
        const res = await fetch("/api/sheet/edit-row", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ssid: sheetInfo.ssid,
            rowIndex,
            before: beforeSnapshot,
            after: afterSnapshot,
          }),
        });
        if (!res.ok) {
          const apiError = await readApiError(res, "Update failed");
          if (apiError.code === "PRECONDITION_FAILED") {
            console.error("[sheet/edit-row] preflight verification failed", {
              rowIndex,
              beforeSnapshot,
              afterSnapshot,
              actual: apiError.actual,
              message: apiError.message,
            });
            toast({
              title: "Sheet changed before the edit landed",
              description:
                "This edit was blocked to avoid writing to the wrong row. Refresh the log and try again.",
              variant: "destructive",
              duration: 8000,
            });
            abandonPendingQueuedSync(tempId, beforeSnapshot);
            if (tempId) void mutate();
            markError();
            return;
          }
          throw new Error(apiError.message || "Update failed");
        }
        clearPendingQueuedSync(tempId, snapshotToEditableFields(afterSnapshot));
        markSaved();
      } catch (err) {
        console.error("[sheet/edit-row] updateSet failed:", err);
        abandonPendingQueuedSync(tempId, beforeSnapshot);
        if (tempId) void mutate();
        markError();
      }
      logSheetTimings(
        "updateSet",
        [{ name: "POST /api/sheet/edit-row", ms: performance.now() - t0 }],
        performance.now() - t0,
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- markSaved/markError are stable local sync helpers
    [
      sheetInfo?.ssid,
      clearPendingQueuedSync,
      abandonPendingQueuedSync,
      toast,
      mutate,
    ],
  );

  const drainQueuedEditOp = useCallback(() => {
    if (structuralSavingRef.current) return;
    const queuedOp = queuedEditOpsRef.current.shift();
    if (!queuedOp) return;
    if (queuedOp.kind === "cell") {
      void persistSetCellUpdate(
        queuedOp.rowIndex,
        queuedOp.field,
        queuedOp.beforeSnapshot,
        queuedOp.value,
      );
      return;
    }
    void persistSetRowUpdate(
      queuedOp.rowIndex,
      queuedOp.beforeSnapshot,
      queuedOp.afterSnapshot,
      queuedOp.tempId ?? null,
    );
  }, [persistSetCellUpdate, persistSetRowUpdate]);

  // Drain queued sync: find the first pending set that has a real rowIndex
  // and a queued edit, then fire the verified row update. Called from the
  // effect below AND
  // from markStructuralSaved/Error so edits that were blocked during a
  // structural op are never permanently lost.
  // The callback participates in the structural-save callback cycle, so its
  // explicit dependencies are safer than compiler-inferred memoization here.
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const flushQueuedSync = useCallback(() => {
    if (structuralSavingRef.current) return;
    const queuedSet = Object.values(pendingSetsRef.current)
      .flat()
      .find((s) => !s._pending && s.rowIndex && s._queuedSync);
    if (queuedSet) {
      void persistSetRowUpdate(
        queuedSet.rowIndex,
        queuedSet._serverSnapshot ??
          buildSheetSnapshotFromFields(
            getEditableSetFields(queuedSet),
            queuedSet,
          ),
        buildSheetSnapshotFromFields(
          getEditableSetFields(queuedSet),
          queuedSet,
        ),
        queuedSet._tempId,
      );
      return;
    }
    drainQueuedEditOp();
  }, [drainQueuedEditOp, persistSetRowUpdate]);

  // Also trigger on pendingSets changes (e.g. when a row gets promoted and
  // its queued edit can now fire).
  useEffect(() => {
    flushQueuedSync();
  }, [pendingSets, flushQueuedSync]);

  // --- API calls ---

  // updateSet: fire-and-forget — no await mutate(), SWR will sync on next focus.
  // Pending optimistic rows can be edited before the insert call returns; those
  // edits are queued on the temp row and flushed once it gets a real rowIndex.
  const updateSet = useCallback(
    async (setRef, update) => {
      if (!sheetInfo?.ssid) return;

      const pendingSet = setRef.tempId
        ? Object.values(pendingSetsRef.current)
            .flat()
            .find((s) => s._tempId === setRef.tempId)
        : null;
      const rowIndex = pendingSet?.rowIndex ?? setRef.rowIndex;
      const nextFields = update.nextFields;

      if (pendingSet) {
        updatePendingSet(
          setRef.tempId,
          nextFields,
          !rowIndex || structuralSavingRef.current,
        );
      }

      if (!rowIndex) {
        return;
      }

      if (pendingSet) {
        if (!structuralSavingRef.current) {
          void persistSetRowUpdate(
            rowIndex,
            pendingSet._serverSnapshot ??
              buildSheetSnapshotFromFields(
                getEditableSetFields(pendingSet),
                pendingSet,
              ),
            buildSheetSnapshotFromFields(nextFields, pendingSet),
            setRef.tempId ?? null,
          );
        }
        return;
      }

      const beforeSnapshot = buildSheetSnapshotFromFields(
        update.beforeFields,
        setRef.set,
      );
      if (structuralSavingRef.current) {
        queuedEditOpsRef.current.push({
          kind: "cell",
          rowIndex,
          field: update.field,
          value: getCellValueForField(update.field, nextFields),
          beforeSnapshot,
        });
        return;
      }

      void persistSetCellUpdate(
        rowIndex,
        update.field,
        beforeSnapshot,
        getCellValueForField(update.field, nextFields),
      );
    },
    [
      sheetInfo?.ssid,
      updatePendingSet,
      persistSetCellUpdate,
      persistSetRowUpdate,
    ],
  );

  // deleteSet: removes a single set row from the sheet.
  // The API now decides promotion from the raw target row + raw next row.
  // This lets delete stay correct for both sparse sheets and sheets where the
  // user manually repeats Date / Lift Type more often than the app would.
  const deleteSet = useCallback(
    async (set) => {
      if (!sheetInfo?.ssid || !set.rowIndex) return;
      if (structuralSavingRef.current) return;
      markStructuralSaving();

      let removedPendingRows = [];

      // Optimistically hide the row immediately
      setDeletedRowIndices((prev) => new Set([...prev, set.rowIndex]));
      setPendingSetsSync((prev) => {
        let changed = false;
        const next = {};
        removedPendingRows = [];
        for (const [lt, sets] of Object.entries(prev)) {
          const remaining = sets.filter((pendingSet) => {
            const shouldRemove = pendingSet.rowIndex === set.rowIndex;
            if (shouldRemove) {
              changed = true;
              removedPendingRows.push(pendingSet);
            }
            return !shouldRemove;
          });
          if (remaining.length) next[lt] = remaining;
          if (remaining.length !== sets.length) changed = true;
        }
        return changed ? next : prev;
      });
      const timings = [];
      const t0 = performance.now();
      const beforeSnapshot = buildSheetSnapshotFromFields(
        getEditableSetFields(set),
        set,
      );
      try {
        const tApi = performance.now();
        const res = await fetch("/api/sheet/delete-row", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ssid: sheetInfo.ssid,
            rowIndex: set.rowIndex,
            before: beforeSnapshot,
          }),
        });
        timings.push({
          name: "POST /api/sheet/delete-row",
          ms: performance.now() - tApi,
        });
        const data = await res.json();
        if (!res.ok) {
          if (data?.code === "PRECONDITION_FAILED") {
            console.error("[sheet/delete-row] preflight verification failed", {
              rowIndex: set.rowIndex,
              before: buildSheetSnapshotFromFields(
                getEditableSetFields(set),
                set,
              ),
              actual: data?.actual ?? null,
              message: data?.error || "Delete failed",
            });
            setDeletedRowIndices((prev) => {
              const next = new Set(prev);
              next.delete(set.rowIndex);
              return next;
            });
            if (removedPendingRows.length) {
              setPendingSetsSync((prev) => {
                const next = { ...prev };
                removedPendingRows.forEach((pendingSet) => {
                  const key = pendingSet.liftType;
                  next[key] = [...(next[key] ?? []), pendingSet];
                });
                return next;
              });
            }
            toast({
              title: "Delete blocked to protect the sheet",
              description:
                "The target row no longer matched what the log expected. Refresh the log and try again.",
              variant: "destructive",
              duration: 8000,
            });
            markStructuralError();
            return;
          }
          throw new Error(data.error || "Delete failed");
        }

        // The deletedRowIndices filter keeps the row hidden in the UI while the
        // background revalidation refreshes canonical row indices. Keep the
        // row-shift guard active until that refresh lands so queued edits/adds
        // do not resume against stale positions.
        await mutate();
        // Clear the hide-flag now that parsedData has settled. If we leave the
        // rowIndex in deletedRowIndices indefinitely, a future insert that gets
        // assigned the same rowIndex (sheets renumber after deletion) will be
        // immediately hidden by the cleanup effect and sessionLiftsWithPending.
        setDeletedRowIndices((prev) => {
          const next = new Set(prev);
          next.delete(set.rowIndex);
          return next;
        });
        startDeleteCooldown();
        markStructuralSaved();
      } catch (err) {
        console.error("[sheet/delete-row] deleteSet failed:", err);
        // Restore the row on failure
        setDeletedRowIndices((prev) => {
          const next = new Set(prev);
          next.delete(set.rowIndex);
          return next;
        });
        if (removedPendingRows.length) {
          setPendingSetsSync((prev) => {
            const next = { ...prev };
            removedPendingRows.forEach((pendingSet) => {
              const key = pendingSet.liftType;
              next[key] = [...(next[key] ?? []), pendingSet];
            });
            return next;
          });
        }
        markStructuralError();
      }
      logSheetTimings("deleteSet", timings, performance.now() - t0);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- markStructural* are stable function declarations
    [sheetInfo?.ssid, toast, setPendingSetsSync, mutate],
  );

  // Add a new set to an existing lift block.
  // Optimistic: row appears immediately with spinner, promoted to confirmed on success.
  const addSet = useCallback(
    async (liftType, prevSet) => {
      if (!sheetInfo?.ssid || !parsedData) return;
      if (structuralSavingRef.current) {
        queueStructuralAction({
          kind: "addSet",
          liftType,
          prevSet: prevSet ?? null,
        });
        return;
      }

      const unitType = prevSet?.unitType ?? (isMetric ? "kg" : "lb");
      const reps = prevSet?.reps ?? 5;
      const weight = prevSet?.weight ?? defaultBarWeight;

      // Compute insertion position BEFORE adding to pending, so we can include
      // confirmed-pending rows (promoted on previous successful adds) in the calculation.
      const confirmedPendingRows = (
        pendingSetsRef.current[liftType] ?? []
      ).filter((s) => !s._pending && s.rowIndex);
      const parsedRows = parsedData.filter(
        (e) =>
          e.date === sessionDate &&
          e.liftType === liftType &&
          !e.isGoal &&
          e.rowIndex,
      );
      const predecessorRow = [...parsedRows, ...confirmedPendingRows].reduce(
        (latest, row) =>
          !latest || row.rowIndex > latest.rowIndex ? row : latest,
        null,
      );
      const insertAfterRowIndex = predecessorRow?.rowIndex ?? null;
      const beforeSnapshot = buildSheetSnapshotFromSetLike(predecessorRow);

      // Stable temp key so the SetRow component keeps the same React key through
      // the in-flight → confirmed transition (avoiding a remount/flash).
      const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      // Auto-timestamp: 24h clock in the notes column (e.g. "14:35 ")
      const notes =
        prevSet && Object.prototype.hasOwnProperty.call(prevSet, "notes")
          ? (prevSet.notes ?? "")
          : getAutoTimestampNotes();

      // Show optimistic row immediately (in-flight)
      setPendingSetsSync((prev) => ({
        ...prev,
        [liftType]: [
          ...(prev[liftType] ?? []),
          {
            date: sessionDate,
            liftType,
            reps,
            weight,
            unitType,
            notes,
            rowIndex: null,
            isGoal: false,
            isHistoricalPR: false,
            _pending: true,
            _tempId: tempId,
            _serverSnapshot: buildSheetSnapshotFromFields(
              { reps, weight, unitType, notes, url: "" },
              { date: sessionDate, liftType },
            ),
          },
        ],
      }));
      const timings = [];
      const t0 = performance.now();
      markStructuralSaving();

      try {
        const tApi = performance.now();
        const res = await fetch("/api/sheet/insert-row", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ssid: sheetInfo.ssid,
            rows: [["", "", String(reps), `${weight}${unitType}`, notes, ""]],
            insertAfterRowIndex,
            before: beforeSnapshot,
          }),
        });
        timings.push({
          name: "POST /api/sheet/insert-row",
          ms: performance.now() - tApi,
        });
        const data = await res.json();
        if (!res.ok) {
          if (data?.code === "PRECONDITION_FAILED") {
            console.error("[sheet/insert-row] preflight verification failed", {
              rowIndex: insertAfterRowIndex,
              beforeSnapshot,
              actual: data?.actual ?? null,
              message: data?.error || "Add set failed",
            });
            // If indices drifted, immediately revalidate so a retry can succeed.
            // Keep this lightweight: we already removed the optimistic in-flight row below.
            void mutate();
          }
          throw new Error(data.error || "Add set failed");
        }
        const { firstRowIndex } = data;
        // Promote pending → confirmed with the real rowIndex so the optimistic
        // row dedupes cleanly when parsedData catches up.
        promoteFirstPending(liftType, firstRowIndex);
        // Release the structural guard immediately — the promoted row already has
        // the correct rowIndex, so queued follow-ups can compute positions safely.
        // Fire revalidation in the background (no await) to avoid a race where a
        // concurrent focus-triggered SWR fetch overwrites fresh data with stale
        // data and removes the confirmed-pending row from both pendingSets and
        // sessionLifts.
        markStructuralSaved();
        void mutate();
      } catch (err) {
        console.error("[sheet/insert-row] addSet failed:", err);
        // Remove the failed pending row
        setPendingSetsSync((prev) => {
          const next = { ...prev };
          if (next[liftType])
            next[liftType] = next[liftType].filter((s) => !s._pending);
          if (!next[liftType]?.length) delete next[liftType];
          return next;
        });
        markStructuralError();
      }
      logSheetTimings("addSet", timings, performance.now() - t0);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- markStructural* are stable function declarations
    [
      sheetInfo?.ssid,
      parsedData,
      sessionDate,
      isMetric,
      defaultBarWeight,
      setPendingSetsSync,
      promoteFirstPending,
      queueStructuralAction,
      mutate,
    ],
  );

  // Add a brand-new lift type to the session.
  // Border is only drawn for the very first row of a brand-new session date.
  const addLift = useCallback(
    async (liftType) => {
      if (!sheetInfo?.ssid || !parsedData) return;
      if (structuralSavingRef.current) {
        queueStructuralAction({ kind: "addLift", liftType });
        return;
      }

      const existingSets = sessionLiftsWithPending[liftType] ?? [];
      if (existingSets.length > 0) {
        const lastExistingSet =
          [...existingSets].reverse().find((set) => !set._pending) ??
          existingSets[existingSets.length - 1];
        await addSet(liftType, lastExistingSet ?? null);
        return;
      }

      const openingSet =
        getPriorOpeningSet({ parsedData, liftType, sessionDate, isMetric }) ??
        null;
      const unitType = openingSet?.unitType ?? (isMetric ? "kg" : "lb");
      const weight = openingSet?.weight ?? defaultBarWeight;
      const reps = openingSet?.reps ?? 5;

      // Read pending state BEFORE updating it, so hasPendingForDate accurately
      // reflects whether any prior lift has already been added to this session.
      const currentPending = pendingSetsRef.current;
      const hasPendingForDate = Object.values(currentPending).some((sets) =>
        sets.some((s) => s.date === sessionDate),
      );

      const sessionRows = parsedData.filter(
        (e) => e.date === sessionDate && !e.isGoal && e.rowIndex,
      );

      // Also include confirmed-pending row indices for correct insertion position
      const confirmedPendingSessionRows = Object.values(currentPending)
        .flat()
        .filter((s) => s.date === sessionDate && !s._pending && s.rowIndex)
        .map((s) => s);
      const allSessionRows = [...sessionRows, ...confirmedPendingSessionRows];

      const hasExistingSession = allSessionRows.length > 0 || hasPendingForDate;

      let predecessorRow = null;
      let topExistingRow = null;

      if (hasExistingSession) {
        // Existing session: insert after the last row of this session
        predecessorRow = allSessionRows.reduce(
          (latest, row) =>
            !latest || row.rowIndex > latest.rowIndex ? row : latest,
          null,
        );
      } else {
        // New session: find correct chronological insertion point.
        // Sheet is newest-first (low rowIndex = newer). For a historical
        // date, insert after the last row whose date is still newer.
        const allRows = [
          ...parsedData.filter((e) => e.rowIndex && !e.isGoal),
          ...Object.values(currentPending)
            .flat()
            .filter((s) => !s._pending && s.rowIndex),
        ];
        const newerRows = allRows.filter((e) => e.date > sessionDate);
        if (newerRows.length > 0) {
          predecessorRow = newerRows.reduce(
            (best, row) => (!best || row.rowIndex > best.rowIndex ? row : best),
            null,
          );
        }
        // Fallback: topExistingRow for beforeSnapshot when inserting at top
        topExistingRow = allRows.reduce(
          (top, row) => (!top || row.rowIndex < top.rowIndex ? row : top),
          null,
        );
      }

      const insertAfterRowIndex = predecessorRow?.rowIndex ?? null;
      const beforeSnapshot = buildSheetSnapshotFromSetLike(
        predecessorRow ?? topExistingRow,
      );

      const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      // Auto-timestamp: 24h clock in the notes column (e.g. "14:35 ")
      const notes = getAutoTimestampNotes();

      // Show optimistic lift block immediately (in-flight)
      setPendingSetsSync((prev) => ({
        ...prev,
        [liftType]: [
          ...(prev[liftType] ?? []),
          {
            date: sessionDate,
            liftType,
            reps,
            weight,
            unitType,
            notes,
            rowIndex: null,
            isGoal: false,
            isHistoricalPR: false,
            _pending: true,
            _tempId: tempId,
            _serverSnapshot: buildSheetSnapshotFromFields(
              { reps, weight, unitType, notes, url: "" },
              { date: sessionDate, liftType },
            ),
          },
        ],
      }));
      const timings = [];
      const t0 = performance.now();
      markStructuralSaving();

      const row = [
        hasExistingSession ? "" : sessionDate,
        liftType,
        String(reps),
        `${weight}${unitType}`,
        notes,
        "",
      ];

      try {
        const tApi = performance.now();
        const res = await fetch("/api/sheet/insert-row", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ssid: sheetInfo.ssid,
            rows: [row],
            insertAfterRowIndex,
            newSession: !hasExistingSession,
            before: beforeSnapshot,
          }),
        });
        timings.push({
          name: "POST /api/sheet/insert-row",
          ms: performance.now() - tApi,
        });
        const data = await res.json();
        if (!res.ok) {
          if (data?.code === "PRECONDITION_FAILED") {
            console.error("[sheet/insert-row] preflight verification failed", {
              rowIndex: insertAfterRowIndex,
              beforeSnapshot,
              actual: data?.actual ?? null,
              message: data?.error || "Failed",
            });
            void mutate();
          }
          throw new Error(data.error || "Failed");
        }
        const { firstRowIndex } = data;
        promoteFirstPending(liftType, firstRowIndex);
        markStructuralSaved();
        void mutate();
      } catch (err) {
        console.error("[sheet/insert-row] addLift failed:", err);
        setPendingSetsSync((prev) => {
          const next = { ...prev };
          if (next[liftType])
            next[liftType] = next[liftType].filter((s) => !s._pending);
          if (!next[liftType]?.length) delete next[liftType];
          return next;
        });
        markStructuralError();
      }
      logSheetTimings("addLift", timings, performance.now() - t0);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- markStructural* are stable function declarations
    [
      sheetInfo?.ssid,
      parsedData,
      sessionDate,
      isMetric,
      defaultBarWeight,
      setPendingSetsSync,
      promoteFirstPending,
      sessionLiftsWithPending,
      addSet,
      queueStructuralAction,
      mutate,
    ],
  );

  useEffect(() => {
    // Structural actions (insert/delete row ranges) cannot safely run in
    // parallel because row indices shift. Rather than dropping a fast follow-up
    // click, keep the latest requested add action here and replay it once the
    // current structural op settles.
    if (structuralSavingRef.current) return;
    if (syncState !== "saved" && syncState !== "error") return;

    const queuedAction = queuedStructuralActionRef.current;
    if (!queuedAction) return;

    queuedStructuralActionRef.current = null;

    if (queuedAction.kind === "addSet") {
      void addSet(queuedAction.liftType, queuedAction.prevSet ?? null);
      return;
    }

    void addLift(queuedAction.liftType);
  }, [syncState, addSet, addLift]);

  const deleteSession = useCallback(async () => {
    if (!sheetInfo?.ssid || !parsedData || structuralSavingRef.current) {
      return { deleted: false, nextDate: null };
    }
    markStructuralSaving();

    const sessionRows = parsedData
      .filter((e) => e.date === sessionDate && !e.isGoal && e.rowIndex)
      .map((e) => e.rowIndex);

    if (!sessionRows.length) {
      markStructuralError();
      return { deleted: false, nextDate: null };
    }

    const minRow = Math.min(...sessionRows);
    const maxRow = Math.max(...sessionRows);

    const otherRows = parsedData
      .filter((e) => e.date !== sessionDate && !e.isGoal && e.rowIndex)
      .map((e) => e.rowIndex);

    const rowsAfter = otherRows.filter((r) => r > maxRow);
    const nearestAfter = rowsAfter.length ? Math.min(...rowsAfter) : null;
    const endRow = nearestAfter ? nearestAfter - 1 : maxRow;

    const timings = [];
    const t0 = performance.now();
    let result = { deleted: false, nextDate: null };

    try {
      const tApi = performance.now();
      const res = await fetch("/api/sheet/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ssid: sheetInfo.ssid,
          startRowIndex: minRow,
          endRowIndex: endRow,
          expectedDate: sessionDate,
        }),
      });
      timings.push({
        name: "DELETE /api/sheet/delete",
        ms: performance.now() - tApi,
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.warning) console.warn("[sheet/delete]", data.warning);
        throw new Error(data.error || "Delete failed");
      }
      await mutate();
      markStructuralSaved();
      const remainingDates = sessionDates.filter((d) => d !== sessionDate);
      result = {
        deleted: true,
        nextDate: remainingDates.length
          ? remainingDates[remainingDates.length - 1]
          : todayIso,
      };
    } catch (err) {
      console.error("[sheet/delete] deleteSession failed:", err);
      markStructuralError();
    }
    logSheetTimings("deleteSession", timings, performance.now() - t0);
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- markStructural* are stable function declarations
  }, [
    sheetInfo?.ssid,
    parsedData,
    sessionDate,
    sessionDates,
    todayIso,
    mutate,
  ]);

  return {
    syncState,
    isStructuralSaving,
    isDeleteCooldownActive,
    sessionLifts,
    sessionLiftsWithPending,
    resetOptimisticSessionState,
    updateSet,
    deleteSet,
    addSet,
    addLift,
    deleteSession,
  };
}
