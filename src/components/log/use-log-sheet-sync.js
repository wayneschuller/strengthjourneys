/**
 * React binding for the log page's Google Sheets sync.
 *
 * The sync itself lives outside React: log-sync-engine.js decides, and
 * log-sync-store.js sends. This file gives that store a browser (fetch, SWR,
 * timers, toasts), feeds it each snapshot the data provider delivers, and
 * turns the lifter's taps into queued changes.
 *
 * The store is one per tab, not one per page, so a set added a moment before
 * the lifter changes date or leaves the log still reaches the sheet.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useReadLocalStorage } from "usehooks-ts";

import {
  getLatestSheetReadAt,
  requireFullSheetRead,
} from "@/hooks/use-userlift-data";
import { getDefaultBarbellWeight } from "@/lib/barbell-defaults";
import { parseData } from "@/lib/import/import-dispatcher";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { getDisplayWeight } from "@/lib/processing-utils";
import {
  applySnapshot,
  createEngineState,
  getSyncSummary,
  projectSession,
} from "@/lib/sheet/log-sync-engine";
import {
  createLogSyncStore,
  sendSheetRequest,
} from "@/lib/sheet/log-sync-store";

import { getAutoTimestampNotes } from "@/components/log/sheet-snapshot-utils";
import { logSheetTimings } from "@/components/log/timing-log";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

// What the store borrows from whichever page last rendered. SWR's bound
// mutate stays valid for the life of the app-level data provider, so the
// queue keeps draining after the log page has unmounted.
const bridge = { mutate: null, toast: null, failureListeners: new Set() };

const store = createLogSyncStore({
  now: () => performance.now(),
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (handle) => clearTimeout(handle),
  isReady: () => Boolean(bridge.mutate),

  // Every write goes through SWR's mutate, with the cache left alone. That is
  // what makes SWR throw away any read that overlapped the write, so a
  // snapshot it does deliver was read entirely before or entirely after.
  async send(plan) {
    const startedAt = performance.now();
    const request = sendSheetRequest(plan, (url, init) => fetch(url, init));
    const tracked = Promise.resolve(
      bridge.mutate?.(request, { populateCache: false, revalidate: false }),
    ).catch(() => {});
    const result = await request;
    // Wait for SWR to close the mutation before anything asks it to read.
    await tracked;
    // A read that began while this write was in flight may have fetched the
    // rows as they were before it, so it cannot count as the full read the
    // write is owed.
    requireFullSheetRead();
    const elapsed = performance.now() - startedAt;
    logSheetTimings(
      `${plan.method} ${plan.url} (${result.kind})`,
      [{ name: plan.url, ms: elapsed }],
      elapsed,
    );
    return result;
  },

  async refresh(needRows) {
    const data = await Promise.resolve(bridge.mutate?.()).catch(() => null);
    const readAt = getLatestSheetReadAt();
    if (!data?.values || readAt === null) return null;
    return { readAt, rows: needRows ? parseData(data.values) : null };
  },

  onFailure(event) {
    bridge.toast?.(getFailureToast(event));
    bridge.failureListeners.forEach((listener) => listener(event));
  },
});

// How long changes may sit unsent before the lifter is told why.
const STALL_NOTICE_MS = 8000;

const EMPTY_STATE = createEngineState();
const getServerState = () => EMPTY_STATE;

let pageListenersInstalled = false;

// Installed once and left in place: they have to outlive the log page for the
// same reason the store does.
function installPageListeners() {
  if (pageListenersInstalled || typeof window === "undefined") return;
  pageListenersInstalled = true;
  window.addEventListener("online", () => store.retryNow());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") store.flush();
    else store.retryNow();
  });
  window.addEventListener("pagehide", () => store.flush());
  window.addEventListener("beforeunload", (event) => {
    if (!store.hasUnsentChanges()) return;
    store.flush();
    event.preventDefault();
    event.returnValue = "";
  });
}

/**
 * @param {object} options
 * @param {string|null|undefined} options.ssid The lifter's linked sheet, null
 *   once we know there is none, undefined while that is still loading.
 * @param {boolean} options.canWrite True when `parsedData` is that sheet's
 *   own rows, not the demo and not an import preview.
 */
export function useLogSheetSync({
  ssid,
  canWrite,
  parsedData,
  parsedDataReadAt,
  sheetColumns,
  sessionDate,
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
  const storeState = useSyncExternalStore(
    store.subscribe,
    store.getState,
    getServerState,
  );
  const isLive = Boolean(canWrite && ssid && Array.isArray(parsedData));

  // Hand each snapshot to the store before paint, so the queue and the rows
  // it is drawn over never spend a frame out of step.
  useIsomorphicLayoutEffect(() => {
    if (ssid === undefined) return;
    bridge.mutate = mutate;
    bridge.toast = toast;
    installPageListeners();
    store.configure(ssid);
    if (!isLive) return;
    store.snapshot(
      { rows: parsedData, readAt: parsedDataReadAt, columns: sheetColumns },
      sessionDate,
    );
  }, [
    ssid,
    isLive,
    parsedData,
    parsedDataReadAt,
    sheetColumns,
    sessionDate,
    mutate,
    toast,
  ]);

  useEffect(() => store.attach(), []);

  // The same step the effect above commits, worked out during render: the
  // first paint after a snapshot arrives already shows it, and the server
  // render of the demo log needs no store at all.
  const viewState = useMemo(() => {
    const snapshot = {
      rows: parsedData ?? null,
      readAt: parsedDataReadAt,
      columns: sheetColumns,
    };
    if (!isLive || storeState.ssid !== ssid) {
      return applySnapshot(
        EMPTY_STATE,
        { rows: snapshot.rows, readAt: null },
        sessionDate,
      );
    }
    return applySnapshot(storeState, snapshot, sessionDate);
  }, [
    isLive,
    storeState,
    ssid,
    parsedData,
    parsedDataReadAt,
    sheetColumns,
    sessionDate,
  ]);

  const sessionLifts = useMemo(
    () => projectSession(viewState, sessionDate),
    [viewState, sessionDate],
  );

  const summary = useMemo(() => getSyncSummary(storeState), [storeState]);
  const isDeletingSession = summary.deletingSessionDates.includes(sessionDate);

  // --- Status for the header indicator ---

  // "saved" and "error" are moments, not states, so they are raised from the
  // store's own notifications and cleared on a timer.
  const [flash, setFlash] = useState(null);
  const flashTimerRef = useRef(null);
  useEffect(() => {
    let hadPending = store.hasUnsentChanges();
    let handedBack = false;
    let stallTimer = null;
    let stallToastShown = false;
    const show = (kind, ms) => {
      clearTimeout(flashTimerRef.current);
      setFlash(kind);
      flashTimerRef.current = setTimeout(() => setFlash(null), ms);
    };
    const unsubscribe = store.subscribe(() => {
      const { pending, stalled } = getSyncSummary(store.getState());
      if (pending > 0) {
        hadPending = true;
        // One dropped request settles itself within seconds and needs no
        // announcement. Speak up only when the wait goes on.
        if (stalled && !stallTimer && !stallToastShown) {
          stallTimer = setTimeout(() => {
            stallTimer = null;
            if (!getSyncSummary(store.getState()).stalled) return;
            stallToastShown = true;
            bridge.toast?.({
              title: "Saving is waiting on the connection",
              description:
                "Your changes are held here and will reach your sheet as soon as it answers. Keep this tab open until the tick shows.",
              duration: 8000,
            });
          }, STALL_NOTICE_MS);
        }
        return;
      }
      clearTimeout(stallTimer);
      stallTimer = null;
      stallToastShown = false;
      if (hadPending) {
        hadPending = false;
        // A queue that emptied by handing a change back did not save it.
        if (!handedBack) show("saved", 2000);
        handedBack = false;
      }
    });
    const onFailure = () => {
      handedBack = true;
      show("error", 3000);
    };
    bridge.failureListeners.add(onFailure);
    return () => {
      unsubscribe();
      bridge.failureListeners.delete(onFailure);
      clearTimeout(flashTimerRef.current);
      clearTimeout(stallTimer);
    };
  }, []);

  const syncState =
    flash === "error"
      ? "error"
      : summary.pending > 0
        ? summary.stalled
          ? "waiting"
          : "saving"
        : (flash ?? "idle");

  // --- Changes ---

  // Deleting a row closes the gap under the pointer, and a fast double-click
  // would land its second click on the row that moved up. Hold the trash
  // buttons for a beat after each delete.
  const [isDeleteCooldownActive, setIsDeleteCooldownActive] = useState(false);
  const deleteCooldownTimerRef = useRef(null);
  useEffect(() => () => clearTimeout(deleteCooldownTimerRef.current), []);

  // A sheet need not have a Notes or a URL column. Then there is nowhere to
  // keep either, so neither is queued: a timestamp or a link that could not
  // be written would show until the next read and then vanish.
  const hasNotesColumn = sheetColumns?.notes != null;
  const hasUrlColumn = sheetColumns?.url != null;

  const addSet = useCallback(
    (liftType, prevSet) => {
      if (!isLive) return;
      // Notes come only from the custom draft row, where the lifter typed
      // them. Every other add is stamped with the time it was logged, so
      // callers repeating an earlier set pass its reps and weight alone.
      const notes =
        prevSet && Object.prototype.hasOwnProperty.call(prevSet, "notes")
          ? (prevSet.notes ?? "")
          : getAutoTimestampNotes();
      store.addSet({
        date: sessionDate,
        liftType,
        fields: {
          reps: prevSet?.reps ?? 5,
          weight: prevSet?.weight ?? defaultBarWeight,
          unitType: prevSet?.unitType ?? (isMetric ? "kg" : "lb"),
          notes: hasNotesColumn ? notes : "",
          url: "",
        },
      });
    },
    [isLive, sessionDate, defaultBarWeight, isMetric, hasNotesColumn],
  );

  // Add a lift to the session: another set if the lift is already there,
  // otherwise its first set, opened at the weight it opened with last time.
  const addLift = useCallback(
    async (liftType) => {
      if (!isLive) return;
      const existingSets = sessionLifts[liftType] ?? [];
      if (existingSets.length > 0) {
        const lastSet =
          [...existingSets].reverse().find((set) => !set._pending) ??
          existingSets[existingSets.length - 1];
        // Repeat its reps and weight, not its notes: the new set is stamped
        // with its own time.
        addSet(liftType, {
          reps: lastSet.reps,
          weight: lastSet.weight,
          unitType: lastSet.unitType,
        });
        return;
      }

      const openingSet = getPriorOpeningSet({
        parsedData,
        liftType,
        sessionDate,
        isMetric,
      });
      store.addSet({
        date: sessionDate,
        liftType,
        fields: {
          reps: openingSet?.reps ?? 5,
          weight: openingSet?.weight ?? defaultBarWeight,
          unitType: openingSet?.unitType ?? (isMetric ? "kg" : "lb"),
          notes: hasNotesColumn ? getAutoTimestampNotes() : "",
          url: "",
        },
      });
    },
    [
      isLive,
      sessionLifts,
      addSet,
      parsedData,
      sessionDate,
      isMetric,
      defaultBarWeight,
      hasNotesColumn,
    ],
  );

  /** @param {string} key The row's `_key`. @param {object} patch Changed fields. */
  const updateSet = useCallback(
    (key, patch) => {
      if (!isLive) return;
      const writable = { ...patch };
      if (!hasNotesColumn) delete writable.notes;
      if (!hasUrlColumn) delete writable.url;
      if (!Object.keys(writable).length) return;
      store.editSet({ date: sessionDate, key, patch: writable });
    },
    [isLive, sessionDate, hasNotesColumn, hasUrlColumn],
  );

  const deleteSet = useCallback(
    (key) => {
      if (!isLive) return;
      store.deleteSet({ date: sessionDate, key });
      clearTimeout(deleteCooldownTimerRef.current);
      setIsDeleteCooldownActive(true);
      deleteCooldownTimerRef.current = setTimeout(
        () => setIsDeleteCooldownActive(false),
        700,
      );
    },
    [isLive, sessionDate],
  );

  // The log stays on the date it was showing: the emptied day goes back to
  // its lift suggestions, ready to be logged again.
  // Resolves once the sheet has answered, whichever way.
  const deleteSession = useCallback(async () => {
    if (!isLive) return false;
    return store.deleteSession({ date: sessionDate });
  }, [isLive, sessionDate]);

  return {
    syncState,
    isDeletingSession,
    isDeleteCooldownActive,
    sessionLifts,
    updateSet,
    deleteSet,
    addSet,
    addLift,
    deleteSession,
  };
}

function getFailureToast({ op, reason }) {
  if (op.kind === "deleteSession") {
    return {
      title: "That session is still in your sheet",
      description:
        "Its rows changed before the delete went through. The log shows your sheet as it stands, so the delete is ready to try again.",
      variant: "destructive",
      duration: 8000,
    };
  }
  const what =
    op.kind === "insert"
      ? `A new ${op.liftType ?? ""} set`.replace("  ", " ")
      : op.kind === "delete"
        ? "A deleted set"
        : "An edit";
  return {
    title: `${what} did not reach your sheet`,
    description:
      reason === "rejected"
        ? "Google Sheets turned the change down. The log shows your sheet as it stands."
        : "Your sheet changed before it could save. The log shows your sheet as it stands, so make the change again and it will go through.",
    variant: "destructive",
    duration: 8000,
  };
}

function getPriorOpeningSet({ parsedData, liftType, sessionDate, isMetric }) {
  if (!Array.isArray(parsedData)) return null;

  const priorLiftRows = parsedData.filter(
    (entry) =>
      entry.liftType === liftType &&
      entry.date < sessionDate &&
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
