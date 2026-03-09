import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { useReadLocalStorage } from "usehooks-ts";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { LiftStrengthLevel } from "@/components/analyzer/session-exercise-block";
import { estimateE1RM } from "@/lib/estimate-e1rm";
import { getReadableDateString, getDisplayWeight, devLog } from "@/lib/processing-utils";
import { generateSessionSets } from "@/lib/warmups";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Dumbbell,
  Check,
  Copy,
  Info,
  Loader2,
  X,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";

// --- Big Four lifts with SVG icons ---

const BIG_FOUR = [
  { name: "Back Squat", icon: "/back_squat.svg" },
  { name: "Bench Press", icon: "/bench_press.svg" },
  { name: "Deadlift", icon: "/deadlift.svg" },
  { name: "Strict Press", icon: "/strict_press.svg" },
];

const isDev = process.env.NEXT_PUBLIC_STRENGTH_JOURNEYS_ENV === "development";

// Color-coded timing log for sheet API calls.
// Single-step calls print one line; multi-step calls print a grouped breakdown + total.
// Also pushes an entry to the optional addLogEntry callback for the UI activity panel.
function logSheetTimings(label, timings, totalMs, addLogEntry) {
  if (!isDev) return;
  const total = Math.round(totalMs);
  const color = total < 500 ? "#22c55e" : total < 1500 ? "#f59e0b" : "#ef4444";

  if (timings.length <= 1) {
    console.log(
      `%c📡 ${label}%c  %c${total}ms`,
      "font-weight:bold",
      "color:inherit",
      `color:${color};font-weight:bold`,
    );
  } else {
    const nameWidth = Math.max(...timings.map((t) => t.name.length));
    console.groupCollapsed(
      `%c📡 ${label}%c  %c${total}ms`,
      "font-weight:bold",
      "color:inherit",
      `color:${color};font-weight:bold`,
    );
    timings.forEach((t) => {
      const ms = Math.round(t.ms);
      const c = ms < 500 ? "#22c55e" : ms < 1500 ? "#f59e0b" : "#ef4444";
      console.log(
        `  %c${t.name.padEnd(nameWidth)}%c  %c${String(ms).padStart(5)}ms`,
        "font-weight:bold",
        "color:inherit",
        `color:${c};font-weight:bold`,
      );
    });
    const divider = "─".repeat(nameWidth + 10);
    console.log(`  ${divider}`);
    console.log(
      `  %c${"Total".padEnd(nameWidth)}%c  %c${String(total).padStart(5)}ms`,
      "font-weight:bold",
      "color:inherit",
      `color:${color};font-weight:bold`,
    );
    console.groupEnd();
  }

  // Push to UI activity panel
  if (addLogEntry) {
    const detail = timings.length > 1
      ? timings.map((t) => `${t.name} ${Math.round(t.ms)}ms`).join(" → ")
      : "";
    addLogEntry({ type: "timing", label, total, detail, color });
  }
}

export default function LogSessionPage() {
  const { status: authStatus } = useSession();
  const router = useRouter();
  const { parsedData, sheetInfo, mutate, isLoading, topLiftsByTypeAndReps, topLiftsByTypeAndRepsLast12Months } = useUserLiftingData();
  const { isMetric, toggleIsMetric } = useAthleteBio();
  const { toast } = useToast();

  // Activity log for the debug panel (dev only)
  const [activityLog, setActivityLog] = useState([]);
  const addLogEntry = useCallback((entry) => {
    const ts = new Date();
    const time = `${String(ts.getHours()).padStart(2, "0")}:${String(ts.getMinutes()).padStart(2, "0")}:${String(ts.getSeconds()).padStart(2, "0")}.${String(ts.getMilliseconds()).padStart(3, "0")}`;
    setActivityLog((prev) => [...prev.slice(-200), { ...entry, time }]);
  }, []);

  // Use local time — new Date().toISOString() is UTC, which causes off-by-one in AU/Asia/Pacific
  const todayIso = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }, []);

  const [sessionDate, setSessionDate] = useState(todayIso);
  const [syncState, setSyncState] = useState("idle"); // idle | saving | saved | error
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // Optimistic pending sets: { [liftType]: [pendingSetObj, ...] }
  // _pending: true  → in-flight (show spinner)
  // _pending: false → confirmed (rowIndex known, waiting for parsedData to catch up)
  const [pendingSets, setPendingSets] = useState({});
  const pendingSetsRef = useRef({});
  const [deletedRowIndices, setDeletedRowIndices] = useState(new Set());

  // Mutation guard: prevents concurrent sheet API calls that could race on
  // stale row indices. Every mutation path (addSet, addLift, deleteSet,
  // updateSet) checks savingRef.current and bails silently if true.
  // The UI is fully optimistic — rows appear/disappear instantly and API calls
  // are sub-800ms, so the guard window is imperceptible during normal use.
  // It only blocks spammy rapid clicks that would fire multiple calls with
  // the same stale parsedData snapshot (which can drift row indices).
  // This is a ref (not state) so the guard works without triggering re-renders
  // — buttons stay visually enabled, clicks are just silently dropped.
  // Set to true in markSaving(), cleared in markSaved()/markError().
  const savingRef = useRef(false);
  const savedTimerRef = useRef(null);

  // Wrapper that keeps pendingSetsRef synchronously in sync.
  // Using the setState callback form means the updater runs synchronously inside
  // React's reconciler, so the ref is always current before the next render.
  const setPendingSetsSync = useCallback((updater) => {
    setPendingSets((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      pendingSetsRef.current = next;
      return next;
    });
  }, []);

  // Sync date from URL param after hydration
  useEffect(() => {
    if (router.query.date && typeof router.query.date === "string") {
      setSessionDate(router.query.date);
    }
  }, [router.query.date]);

  const navigateToDate = useCallback(
    (date) => {
      setSessionDate(date);
      setShowDeleteConfirm(false);
      setPendingSetsSync({});
      setDeletedRowIndices(new Set());
      router.replace(
        { pathname: "/log", query: date !== todayIso ? { date } : {} },
        undefined,
        { shallow: true },
      );
    },
    [router, todayIso, setPendingSetsSync],
  );

  // All unique session dates from parsedData (ascending)
  const sessionDates = useMemo(() => {
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
  }, [parsedData]);

  // Current session entries grouped by lift type (real confirmed data)
  // Excludes optimistically deleted rows so they vanish from the UI immediately.
  const sessionLifts = useMemo(() => {
    if (!parsedData) return {};
    const entries = parsedData.filter(
      (e) => e.date === sessionDate && !e.isGoal && !deletedRowIndices.has(e.rowIndex),
    );
    const grouped = {};
    for (const entry of entries) {
      if (!grouped[entry.liftType]) grouped[entry.liftType] = [];
      grouped[entry.liftType].push(entry);
    }
    return grouped;
  }, [parsedData, sessionDate, deletedRowIndices]);

  // When parsedData catches up, remove confirmed (non-pending) rows from pendingSets
  // to avoid doubling once the real data arrives.
  useEffect(() => {
    const realRowIndices = new Set(
      Object.values(sessionLifts)
        .flatMap((sets) => sets.map((s) => s.rowIndex).filter(Boolean)),
    );
    setPendingSetsSync((prev) => {
      let changed = false;
      const next = {};
      for (const [lt, sets] of Object.entries(prev)) {
        // Keep rows that are still in-flight OR whose rowIndex isn't in real data yet
        const remaining = sets.filter(
          (s) => s._pending || !realRowIndices.has(s.rowIndex),
        );
        if (remaining.length !== sets.length) changed = true;
        if (remaining.length) next[lt] = remaining;
      }
      return changed ? next : prev;
    });
  }, [sessionLifts, setPendingSetsSync]);

  // Merge real data with optimistic pending sets.
  // Deduplication: skip confirmed-pending rows whose rowIndex is already in sessionLifts.
  const sessionLiftsWithPending = useMemo(() => {
    const realRowIndices = new Set(
      Object.values(sessionLifts)
        .flatMap((sets) => sets.map((s) => s.rowIndex).filter(Boolean)),
    );
    const merged = { ...sessionLifts };
    for (const [lt, sets] of Object.entries(pendingSets)) {
      const unique = sets.filter(
        (s) => s._pending || !realRowIndices.has(s.rowIndex),
      );
      if (unique.length) {
        merged[lt] = [...(merged[lt] ?? []), ...unique];
      }
    }
    return merged;
  }, [sessionLifts, pendingSets]);

  const hasSession = Object.keys(sessionLiftsWithPending).length > 0;
  const isToday = sessionDate === todayIso;

  const prevSessionDate = useMemo(() => {
    const earlier = sessionDates.filter((d) => d < sessionDate);
    return earlier.length ? earlier[earlier.length - 1] : null;
  }, [sessionDates, sessionDate]);

  const nextSessionDate = useMemo(() => {
    const later = sessionDates.filter((d) => d > sessionDate);
    if (later.length) return later[0];
    // No future session, but if we're viewing a past date, allow navigating to today
    if (sessionDate < todayIso) return todayIso;
    return null;
  }, [sessionDates, sessionDate, todayIso]);

  // --- Unit mismatch nudge ---
  // If 100% of the user's sheet data is in one unit but their SJ preference is
  // the opposite, show a one-time toast so they can switch back easily.
  const unitNudgeShown = useRef(false);
  useEffect(() => {
    if (!parsedData?.length || unitNudgeShown.current) return;
    const realEntries = parsedData.filter((e) => !e.isGoal && e.unitType);
    if (!realEntries.length) return;
    const kgCount = realEntries.filter((e) => e.unitType === "kg").length;
    const allKg = kgCount === realEntries.length;
    const allLb = kgCount === 0;
    const sheetUnit = allKg ? "kg" : allLb ? "lb" : null;
    if (!sheetUnit) return; // mixed units — no nudge
    const prefUnit = isMetric ? "kg" : "lb";
    if (sheetUnit === prefUnit) return; // no mismatch
    unitNudgeShown.current = true;
    toast({
      title: `Your spreadsheet is 100% ${sheetUnit}`,
      description: `New sets will be logged in ${prefUnit}. Switch to ${sheetUnit}?`,
      duration: 10000,
      action: (
        <ToastAction altText={`Switch to ${sheetUnit}`} onClick={() => toggleIsMetric()}>
          Use {sheetUnit}
        </ToastAction>
      ),
    });
  }, [parsedData, isMetric, toast, toggleIsMetric]);

  // Revalidate SWR data when the user leaves the log page so the dashboard
  // picks up any sets/lifts added during the session. Individual writes
  // deliberately skip mutate() to avoid mid-session flicker (see addSet).
  useEffect(() => {
    return () => mutate();
  }, [mutate]);

  // --- Sync helpers ---

  function markSaving() {
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savingRef.current = true;
    setSyncState("saving");
  }

  function markSaved() {
    savingRef.current = false;
    setSyncState("saved");
    savedTimerRef.current = setTimeout(() => setSyncState("idle"), 2000);
  }

  function markError() {
    savingRef.current = false;
    setSyncState("error");
    savedTimerRef.current = setTimeout(() => setSyncState("idle"), 3000);
  }

  // Promote the first still-pending row for a liftType to confirmed with a real rowIndex.
  const promoteFirstPending = useCallback((liftType, rowIndex) => {
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
  }, [setPendingSetsSync]);

  // --- API calls ---

  // updateSet: fire-and-forget — no await mutate(), SWR will sync on next focus.
  // The SetRow component manages its own optimistic display via pendingReps/pendingWeight.
  const updateSet = useCallback(
    async (rowIndex, fields) => {
      if (!sheetInfo?.ssid) return;
      markSaving();
      const t0 = performance.now();
      try {
        const res = await fetch("/api/sheet/log-set", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ssid: sheetInfo.ssid, rowIndex, ...fields }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Update failed");
        // Do NOT call mutate() here — the SetRow component manages its own
        // optimistic display via pendingReps/pendingWeight. SWR's
        // revalidateOnFocus will sync when the user leaves the page.
        markSaved();
      } catch (err) {
        console.error("[sheet/log-set] updateSet failed:", err);
        markError();
      }
      logSheetTimings("updateSet", [{ name: "PATCH /api/sheet/log-set", ms: performance.now() - t0 }], performance.now() - t0, addLogEntry);
    },
    [sheetInfo?.ssid, addLogEntry],
  );

  // deleteSet: removes a single set row from the sheet.
  // Handles anchor-row promotion so date/liftType inheritance stays intact.
  const deleteSet = useCallback(
    async (set) => {
      if (!sheetInfo?.ssid || !parsedData || !set.rowIndex || savingRef.current) return;

      // All confirmed rows for this session, sorted ascending by sheet position.
      const sessionSets = parsedData
        .filter((e) => e.date === set.date && !e.isGoal && e.rowIndex)
        .sort((a, b) => a.rowIndex - b.rowIndex);

      const isFirstOfSession = sessionSets[0]?.rowIndex === set.rowIndex;

      // Sets for this lift type within the session, sorted ascending.
      const liftSets = sessionSets.filter((e) => e.liftType === set.liftType);
      const isFirstOfLift = liftSets[0]?.rowIndex === set.rowIndex;

      // Build promoteTo payload when the deleted row is an anchor.
      // The row immediately below (rowIndex + 1 before deletion) becomes the new anchor.
      let promoteTo = null;
      if (isFirstOfSession && sessionSets.length > 1) {
        // First row of session: next session row needs date + liftType.
        const next = sessionSets[1];
        promoteTo = { rowIndex: next.rowIndex, date: set.date, liftType: set.liftType };
      } else if (isFirstOfLift && liftSets.length > 1) {
        // First row of lift type (not first of session): next lift row needs liftType.
        const next = liftSets[1];
        promoteTo = { rowIndex: next.rowIndex, liftType: set.liftType };
      }

      // Optimistically hide the row immediately
      addLogEntry({ type: "action", label: "deleteSet", detail: `row ${set.rowIndex} · ${set.liftType} · ${set.reps}×${set.weight}` });
      setDeletedRowIndices((prev) => new Set([...prev, set.rowIndex]));
      markSaving();
      const timings = [];
      const t0 = performance.now();
      try {
        const tApi = performance.now();
        const res = await fetch("/api/sheet/log-set", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ssid: sheetInfo.ssid, rowIndex: set.rowIndex, expectedDate: set.date, promoteTo }),
        });
        timings.push({ name: "DELETE /api/sheet/log-set", ms: performance.now() - tApi });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Delete failed");

        // Surface index drift warning as a toast
        if (data.warning) {
          devLog(`⚠️ ${data.warning}`);
          addLogEntry({ type: "warning", label: "INDEX DRIFT", detail: data.warning });
          toast({
            title: "Index drift detected",
            description: data.warning,
            variant: "destructive",
            duration: 8000,
          });
        }

        // Do NOT call mutate() here — same reasoning as addSet: firing a
        // revalidation mid-session causes parsedData churn and flicker.
        // The deletedRowIndices filter keeps the row hidden in the UI.
        // SWR's revalidateOnFocus will sync when the user leaves the page.
        markSaved();
      } catch (err) {
        console.error("[sheet/log-set] deleteSet failed:", err);
        // Restore the row on failure
        setDeletedRowIndices((prev) => {
          const next = new Set(prev);
          next.delete(set.rowIndex);
          return next;
        });
        markError();
      }
      logSheetTimings("deleteSet", timings, performance.now() - t0, addLogEntry);
    },
    [sheetInfo?.ssid, parsedData, toast, addLogEntry],
  );

  // Add a new set to an existing lift block.
  // Optimistic: row appears immediately with spinner, promoted to confirmed on success.
  const addSet = useCallback(
    async (liftType, prevSet) => {
      if (!sheetInfo?.ssid || !parsedData || savingRef.current) return;

      const unitType = prevSet?.unitType ?? (isMetric ? "kg" : "lb");
      const reps = prevSet?.reps ?? 5;
      const weight = prevSet?.weight ?? (isMetric ? 20 : 45);

      // Compute insertion position BEFORE adding to pending, so we can include
      // confirmed-pending rows (promoted on previous successful adds) in the calculation.
      const confirmedPendingRows = (pendingSetsRef.current[liftType] ?? [])
        .filter((s) => !s._pending && s.rowIndex)
        .map((s) => s.rowIndex);
      const parsedRows = parsedData
        .filter((e) => e.date === sessionDate && e.liftType === liftType && !e.isGoal && e.rowIndex)
        .map((e) => e.rowIndex);
      const allKnownRows = [...parsedRows, ...confirmedPendingRows];
      const insertAfterRowIndex = allKnownRows.length ? Math.max(...allKnownRows) : null;

      // Stable temp key so the SetRow component keeps the same React key through
      // the in-flight → confirmed transition (avoiding a remount/flash).
      const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      // Show optimistic row immediately (in-flight)
      addLogEntry({ type: "action", label: "addSet", detail: `${liftType} · ${reps}×${weight}${unitType} · after row ${insertAfterRowIndex}` });
      setPendingSetsSync((prev) => ({
        ...prev,
        [liftType]: [
          ...(prev[liftType] ?? []),
          { date: sessionDate, liftType, reps, weight, unitType, rowIndex: null, isGoal: false, isHistoricalPR: false, _pending: true, _tempId: tempId },
        ],
      }));
      markSaving();
      const timings = [];
      const t0 = performance.now();

      try {
        const tApi = performance.now();
        const res = await fetch("/api/sheet/log-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ssid: sheetInfo.ssid,
            rows: [["", "", String(reps), `${weight}${unitType}`, "", ""]],
            insertAfterRowIndex,
          }),
        });
        timings.push({ name: "POST /api/sheet/log-session", ms: performance.now() - tApi });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Add set failed");
        const { firstRowIndex } = data;
        // Promote pending → confirmed with real rowIndex.
        // Do NOT call mutate() here — firing a revalidation mid-session causes parsedData
        // to update while confirmed-pending rows are still present, which creates a brief
        // intermediate state where the row appears to disappear and reappear.
        // SWR's natural revalidateOnFocus will sync when the user leaves the page.
        promoteFirstPending(liftType, firstRowIndex);
        markSaved();
      } catch (err) {
        console.error("[sheet/log-session] addSet failed:", err);
        // Remove the failed pending row
        setPendingSetsSync((prev) => {
          const next = { ...prev };
          if (next[liftType]) next[liftType] = next[liftType].filter((s) => !s._pending);
          if (!next[liftType]?.length) delete next[liftType];
          return next;
        });
        markError();
      }
      logSheetTimings("addSet", timings, performance.now() - t0, addLogEntry);
    },
    [sheetInfo?.ssid, parsedData, sessionDate, isMetric, setPendingSetsSync, promoteFirstPending, addLogEntry],
  );

  // Add a brand-new lift type to the session.
  // Border is only drawn for the very first row of a brand-new session date.
  const addLift = useCallback(
    async (liftType) => {
      if (!sheetInfo?.ssid || !parsedData || savingRef.current) return;

      const unitType = isMetric ? "kg" : "lb";
      const weight = isMetric ? 20 : 45;
      const reps = 5;

      // Read pending state BEFORE updating it, so hasPendingForDate accurately
      // reflects whether any prior lift has already been added to this session.
      const currentPending = pendingSetsRef.current;
      const hasPendingForDate = Object.values(currentPending).some((sets) =>
        sets.some((s) => s.date === sessionDate),
      );

      const sessionRows = parsedData
        .filter((e) => e.date === sessionDate && !e.isGoal && e.rowIndex)
        .map((e) => e.rowIndex);

      // Also include confirmed-pending row indices for correct insertion position
      const confirmedPendingSessionRows = Object.values(currentPending)
        .flat()
        .filter((s) => s.date === sessionDate && !s._pending && s.rowIndex)
        .map((s) => s.rowIndex);
      const allSessionRows = [...sessionRows, ...confirmedPendingSessionRows];

      const hasExistingSession = allSessionRows.length > 0 || hasPendingForDate;
      const insertAfterRowIndex = hasExistingSession ? Math.max(...allSessionRows) : null;

      const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      // Show optimistic lift block immediately (in-flight)
      addLogEntry({ type: "action", label: "addLift", detail: `${liftType} · ${reps}×${weight}${unitType} · after row ${insertAfterRowIndex} · ${hasExistingSession ? "existing session" : "new session"}` });
      setPendingSetsSync((prev) => ({
        ...prev,
        [liftType]: [
          ...(prev[liftType] ?? []),
          { date: sessionDate, liftType, reps, weight, unitType, rowIndex: null, isGoal: false, isHistoricalPR: false, _pending: true, _tempId: tempId },
        ],
      }));
      markSaving();
      const timings = [];
      const t0 = performance.now();

      const row = [
        hasExistingSession ? "" : sessionDate,
        liftType,
        String(reps),
        `${weight}${unitType}`,
        "",
        "",
      ];

      try {
        const tApi = performance.now();
        const res = await fetch("/api/sheet/log-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ssid: sheetInfo.ssid,
            rows: [row],
            insertAfterRowIndex,
            newSession: !hasExistingSession,
          }),
        });
        timings.push({ name: "POST /api/sheet/log-session", ms: performance.now() - tApi });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed");
        const { firstRowIndex } = data;
        // See addSet for why we don't call mutate() here.
        promoteFirstPending(liftType, firstRowIndex);
        markSaved();
      } catch (err) {
        console.error("[sheet/log-session] addLift failed:", err);
        setPendingSetsSync((prev) => {
          const next = { ...prev };
          if (next[liftType]) next[liftType] = next[liftType].filter((s) => !s._pending);
          if (!next[liftType]?.length) delete next[liftType];
          return next;
        });
        markError();
      }
      logSheetTimings("addLift", timings, performance.now() - t0, addLogEntry);
    },
    [sheetInfo?.ssid, parsedData, sessionDate, isMetric, setPendingSetsSync, promoteFirstPending, addLogEntry],
  );

  const deleteSession = useCallback(async () => {
    if (!sheetInfo?.ssid || !parsedData || savingRef.current) return;

    const sessionRows = parsedData
      .filter((e) => e.date === sessionDate && !e.isGoal && e.rowIndex)
      .map((e) => e.rowIndex);

    if (!sessionRows.length) return;

    const minRow = Math.min(...sessionRows);
    const maxRow = Math.max(...sessionRows);

    const otherRows = parsedData
      .filter((e) => e.date !== sessionDate && !e.isGoal && e.rowIndex)
      .map((e) => e.rowIndex);

    const rowsAfter = otherRows.filter((r) => r > maxRow);
    const nearestAfter = rowsAfter.length ? Math.min(...rowsAfter) : null;
    const endRow = nearestAfter ? nearestAfter - 1 : maxRow;

    addLogEntry({ type: "action", label: "deleteSession", detail: `${sessionDate} · rows ${minRow}–${endRow} (${endRow - minRow + 1} rows)` });
    markSaving();
    const timings = [];
    const t0 = performance.now();

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
      timings.push({ name: "DELETE /api/sheet/delete", ms: performance.now() - tApi });
      const data = await res.json();
      if (!res.ok) {
        if (data.warning) addLogEntry({ type: "warning", label: "deleteSession", detail: data.warning });
        throw new Error(data.error || "Delete failed");
      }
      await mutate();
      markSaved();
      setShowDeleteConfirm(false);
      const remainingDates = sessionDates.filter((d) => d !== sessionDate);
      if (remainingDates.length) {
        navigateToDate(remainingDates[remainingDates.length - 1]);
      } else {
        navigateToDate(todayIso);
      }
    } catch (err) {
      console.error("[sheet/delete] deleteSession failed:", err);
      markError();
    }
    logSheetTimings("deleteSession", timings, performance.now() - t0, addLogEntry);
  }, [sheetInfo?.ssid, parsedData, sessionDate, sessionDates, todayIso, mutate, navigateToDate, addLogEntry]);

  // --- Render ---

  if (!isDev) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <Dumbbell className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Coming Soon</h1>
        <p className="text-muted-foreground">
          This feature is under development.
        </p>
        <Button asChild>
          <Link href="/">Back to Home</Link>
        </Button>
      </div>
    );
  }

  if (authStatus === "unauthenticated") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <Dumbbell className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Log a Session</h1>
        <p className="text-muted-foreground">
          Sign in with Google to log your lifting sessions.
        </p>
        <Button asChild>
          <Link href="/">Get Started</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-3 sm:px-4 lg:grid-cols-[minmax(0,42rem)_1fr]">
    <div className="pb-24">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border/40 bg-background/95 py-3 backdrop-blur-sm">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          disabled={!prevSessionDate}
          onClick={() => navigateToDate(prevSessionDate)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex-1 text-center">
          <h1 className="text-lg font-semibold leading-tight">
            {isToday ? "Today" : getReadableDateString(sessionDate, true)}
          </h1>
          {isToday ? (
            <p className="text-xs text-muted-foreground">
              {getReadableDateString(sessionDate, true)}
            </p>
          ) : (
            <button
              className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              onClick={() => navigateToDate(todayIso)}
            >
              Back to today
            </button>
          )}
        </div>

        <SyncIndicator state={syncState} />

        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          disabled={!nextSessionDate}
          onClick={() => navigateToDate(nextSessionDate)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>


      {/* Empty state */}
      {!isLoading && !hasSession && (
        <div className="mt-6 flex flex-col items-center gap-6">
          <div className="space-y-1 text-center">
            <h2 className="text-xl font-semibold">
              {isToday ? "Start today's session" : "Start a session for this date"}
            </h2>
            <p className="text-sm text-muted-foreground">
              Pick a lift to begin.
            </p>
          </div>

          {/* Big Four — tap to add directly */}
          <div className="grid w-full grid-cols-2 gap-4 sm:grid-cols-4">
            {BIG_FOUR.map(({ name, icon }) => (
              <button
                key={name}
                title={`Start with ${name}`}
                onClick={() => addLift(name)}
                className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card px-4 py-6 shadow-sm transition-colors hover:border-primary hover:bg-muted/40 active:scale-95 md:gap-5 md:py-8"
              >
                <Image src={icon} alt={name} width={80} height={80} className="h-20 w-20 md:h-28 md:w-28" />
                <span className="text-sm font-medium leading-tight">{name}</span>
              </button>
            ))}
          </div>

          <AddLiftButton parsedData={parsedData} onAddLift={addLift} label="Add other lift type" />
        </div>
      )}

      {/* Lift blocks */}
      {hasSession && (
        <div className="space-y-5">
          {Object.entries(sessionLiftsWithPending).map(([liftType, sets]) => (
            <LiftBlock
              key={liftType}
              liftType={liftType}
              sets={sets}
              parsedData={parsedData}
              sessionDate={sessionDate}
              isMetric={isMetric}
              topLiftsByTypeAndReps={topLiftsByTypeAndReps}
              topLiftsByTypeAndRepsLast12Months={topLiftsByTypeAndRepsLast12Months}
              onUpdateSet={updateSet}
              onDeleteSet={deleteSet}
              onAddSet={(prevSet) => addSet(liftType, prevSet)}
            />
          ))}

          <AddLiftButton parsedData={parsedData} onAddLift={addLift} />

          {/* Delete session */}
          <div className="flex justify-center pt-2">
            {!showDeleteConfirm ? (
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-muted-foreground hover:text-destructive"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="h-4 w-4" />
                Delete this session
              </Button>
            ) : (
              <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Delete all rows for {sessionDate}?
                </p>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={deleteSession}
                  disabled={syncState === "saving"}
                >
                  Delete
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
    <ActivityPanel entries={activityLog} />
    </div>
  );
}

// --- Activity log panel (dev only) ---

const API_DESCRIPTIONS = {
  addSet: {
    action: "Add set to existing lift block",
    api: "POST /api/sheet/log-session",
    sheets: "sheets.spreadsheets.batchUpdate (insertDimension + updateCells)",
  },
  addLift: {
    action: "Add new lift type to session",
    api: "POST /api/sheet/log-session",
    sheets: "sheets.spreadsheets.batchUpdate (insertDimension + updateCells + optional border)",
  },
  deleteSet: {
    action: "Delete a set row",
    api: "DELETE /api/sheet/log-set",
    sheets: "sheets.values.get (pre-read) → optional values.update (promote anchor) → batchUpdate (deleteDimension)",
  },
  updateSet: {
    action: "Edit reps, weight, or notes",
    api: "PATCH /api/sheet/log-set",
    sheets: "sheets.values.update (cols C–F)",
  },
};

function ActivityPanel({ entries }) {
  const scrollRef = useRef(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries.length]);

  const copyLog = useCallback(() => {
    const header = `SJ Sheet API Log — ${new Date().toISOString()}\n${"─".repeat(60)}`;
    const lines = entries.map((e) => {
      if (e.type === "warning") return `[${e.time}] ⚠ ${e.label}: ${e.detail}`;
      if (e.type === "action") return `[${e.time}] → ${e.label}: ${e.detail}`;
      // timing
      return `[${e.time}] ✓ ${e.label}: ${e.total}ms${e.detail ? ` | ${e.detail}` : ""}`;
    });
    navigator.clipboard.writeText(`${header}\n${lines.join("\n")}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [entries]);

  return (
    <div className="sticky top-0 hidden max-h-[50vh] flex-col rounded-lg border bg-card lg:flex">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Google Sheets API Monitor</span>
        <div className="flex items-center gap-2">
          {entries.length > 0 && (
            <button
              onClick={copyLog}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
          )}
          <span className="text-xs tabular-nums text-muted-foreground">{entries.length}</span>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto text-xs">
        {entries.length === 0 && (
          <div className="px-3 py-8 text-center text-muted-foreground/50">
            <p>Sheet API calls will appear here as you add, edit, and delete sets.</p>
            <p className="mt-2 text-muted-foreground/30">Each entry shows the UI action, the SJ API endpoint, and the Google Sheets calls it makes.</p>
          </div>
        )}
        {entries.map((entry, i) => {
          const desc = API_DESCRIPTIONS[entry.label];
          if (entry.type === "warning") {
            return (
              <div key={i} className="border-b border-border/20 bg-destructive/10 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-destructive">{entry.label}</span>
                </div>
                <p className="mt-1 break-all text-destructive/80">{entry.detail}</p>
              </div>
            );
          }
          if (entry.type === "action") {
            return (
              <div key={i} className="border-b border-border/20 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-blue-500 dark:text-blue-400">{desc?.action ?? entry.label}</span>
                </div>
                <p className="mt-0.5 break-all text-muted-foreground">{entry.detail}</p>
                {desc && (
                  <div className="mt-1 space-y-0.5 rounded bg-muted/50 px-2 py-1 text-muted-foreground">
                    <p><span className="text-foreground/70">SJ API:</span> {desc.api}</p>
                    <p><span className="text-foreground/70">Sheets:</span> {desc.sheets}</p>
                  </div>
                )}
              </div>
            );
          }
          // timing entry
          return (
            <div key={i} className="border-b border-border/20 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="shrink-0 font-mono text-muted-foreground/50">{entry.time}</span>
                <span className="font-semibold text-foreground">{desc?.action ?? entry.label}</span>
                <span
                  className="ml-auto shrink-0 font-mono font-bold tabular-nums"
                  style={{ color: entry.color }}
                >
                  {entry.total}ms
                </span>
              </div>
              {entry.detail && (
                <p className="mt-0.5 font-mono text-muted-foreground">{entry.detail}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Sync indicator ---

function SyncIndicator({ state }) {
  if (state === "idle") return <div className="w-8" />;
  return (
    <div className="flex w-8 items-center justify-center">
      {state === "saving" && (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      )}
      {state === "saved" && (
        <Check className="h-4 w-4 text-green-500" />
      )}
      {state === "error" && (
        <X className="h-4 w-4 text-destructive" />
      )}
    </div>
  );
}

// --- Lift block ---

function LiftBlock({ liftType, sets, parsedData, sessionDate, isMetric, topLiftsByTypeAndReps, topLiftsByTypeAndRepsLast12Months, onUpdateSet, onDeleteSet, onAddSet }) {
  const { status: authStatus } = useSession();
  const { age, bodyWeight, sex, standards } = useAthleteBio();
  const e1rmFormula =
    useReadLocalStorage(LOCAL_STORAGE_KEYS.FORMULA, {
      initializeWithValue: false,
    }) ?? "Brzycki";
  const hasBioData =
    age && bodyWeight && standards && Object.keys(standards).length > 0;

  // Only use confirmed (non-pending) sets for last-set reference
  const realSets = sets.filter((s) => !s._pending);
  const lastRealSet = realSets[realSets.length - 1];
  const bigFourEntry = BIG_FOUR.find((b) => b.name === liftType);

  // Show a one-time hint for new users (first ~20 sessions)
  const showSuggestionHint = useMemo(() => {
    if (!parsedData) return false;
    const dates = new Set();
    for (const e of parsedData) {
      if (!e.isGoal) dates.add(e.date);
    }
    return dates.size <= 20;
  }, [parsedData]);

  // Read warmup settings from localStorage (shared with warmup calculator page)
  const storedBarType =
    useReadLocalStorage(LOCAL_STORAGE_KEYS.WARMUPS_BAR_TYPE, {
      initializeWithValue: false,
    }) ?? "standard";
  const storedPlatePreference =
    useReadLocalStorage(LOCAL_STORAGE_KEYS.WARMUPS_PLATE_PREFERENCE, {
      initializeWithValue: false,
    }) ?? "blue";

  // Smart set suggestions: generate warmup progression from last session's top set
  const suggestions = useMemo(() => {
    if (!parsedData) return null;

    const unitType = isMetric ? "kg" : "lb";
    const barWeight = storedBarType === "womens" ? (isMetric ? 15 : 35) : (isMetric ? 20 : 45);
    const minIncrement = isMetric ? 2.5 : 5;

    // Find last session's sets for this lift (same logic as LiftSuggestions)
    const prior = parsedData.filter(
      (e) => e.liftType === liftType && e.date < sessionDate && !e.isGoal,
    );
    if (!prior.length) return null;
    const lastDate = prior[prior.length - 1].date;
    const lastSets = prior.filter((e) => e.date === lastDate);

    // Find the top set from last session (heaviest weight)
    let topSet = lastSets[0];
    for (const s of lastSets) {
      // Convert to user's current unit for comparison
      const { value } = getDisplayWeight(s, isMetric);
      const { value: topValue } = getDisplayWeight(topSet, isMetric);
      if (value > topValue) topSet = s;
    }

    const { value: lastTopWeight } = getDisplayWeight(topSet, isMetric);
    const topReps = topSet.reps;
    if (!lastTopWeight || lastTopWeight <= 0) return null;

    // Assume progressive overload: target is last session's top + one increment
    const topWeight = lastTopWeight + minIncrement;

    // Generate the full warmup progression using shared algorithm
    const progression = generateSessionSets(
      topWeight,
      topReps,
      barWeight,
      isMetric,
      storedPlatePreference,
    );

    // Determine where the lifter is based on already-logged sets
    const loggedWeights = sets.filter((s) => !s._pending && s.weight > 0)
      .map((s) => {
        const { value } = getDisplayWeight(s, isMetric);
        return value;
      });

    // Find the next warmup set they haven't done yet
    // Match by finding the first progression set whose weight exceeds all logged weights
    let nextWarmupIdx = 0;
    if (loggedWeights.length > 0) {
      const maxLogged = Math.max(...loggedWeights);
      // Find first progression set with weight > maxLogged
      nextWarmupIdx = progression.findIndex((s) => s.weight > maxLogged);
      if (nextWarmupIdx === -1) nextWarmupIdx = progression.length; // past the top
    }

    const atOrPastTop = nextWarmupIdx >= progression.length;
    const maxLogged = loggedWeights.length > 0 ? Math.max(...loggedWeights) : 0;
    const lastRealSets = sets.filter((s) => !s._pending && s.weight > 0);
    const lastLoggedWeight = lastRealSets.length > 0
      ? getDisplayWeight(lastRealSets[lastRealSets.length - 1], isMetric).value
      : 0;
    const lastLoggedReps = lastRealSets[lastRealSets.length - 1]?.reps ?? topReps;

    // Detect drop set mode: last logged weight is below the session's peak
    const inDropSetMode = atOrPastTop && lastLoggedWeight < maxLogged;

    // Helper: check if a suggested set would be a PR
    const checkPR = (reps, weight) => {
      if (reps < 1 || reps > 10) return null;
      const allTimeBest = topLiftsByTypeAndReps?.[liftType]?.[reps - 1]?.[0];
      const yearlyBest = topLiftsByTypeAndRepsLast12Months?.[liftType]?.[reps - 1]?.[0];
      // Convert PR weights to current unit for comparison
      if (allTimeBest) {
        const { value: bestWeight } = getDisplayWeight(allTimeBest, isMetric);
        if (weight > bestWeight) return "lifetime PR";
      }
      if (yearlyBest) {
        const { value: bestWeight } = getDisplayWeight(yearlyBest, isMetric);
        if (weight > bestWeight) return "yearly PR";
      }
      return null;
    };

    const result = [];

    if (!atOrPastTop) {
      // Warmup phase: suggest next warmup set
      const nextSet = progression[nextWarmupIdx];
      const prHint = checkPR(nextSet.reps, nextSet.weight);
      result.push({
        label: `${nextSet.reps}@${nextSet.weight}${unitType}`,
        sublabel: nextSet.isTopSet ? "top set" : "warmup",
        prHint,
        reps: nextSet.reps,
        weight: nextSet.weight,
        unitType,
        variant: nextSet.isTopSet ? "primary" : "secondary",
      });

      // Also offer skipping ahead to the top set if not already the next suggestion
      if (!nextSet.isTopSet) {
        const topProgSet = progression[progression.length - 1];
        const topPrHint = checkPR(topProgSet.reps, topProgSet.weight);
        result.push({
          label: `${topProgSet.reps}@${topProgSet.weight}${unitType}`,
          sublabel: "top set",
          prHint: topPrHint,
          reps: topProgSet.reps,
          weight: topProgSet.weight,
          unitType,
          variant: "outline",
        });
      }
    } else if (inDropSetMode) {
      // Drop set mode: weight is descending — only offer repeat at current drop weight
      result.push({
        label: `${lastLoggedReps}@${lastLoggedWeight}${unitType}`,
        sublabel: "drop set",
        reps: lastLoggedReps,
        weight: lastLoggedWeight,
        unitType,
        variant: "secondary",
      });
    } else {
      // Working phase: suggest repeat, increment, and drop set
      result.push({
        label: `${lastLoggedReps}@${lastLoggedWeight}${unitType}`,
        sublabel: "repeat",
        reps: lastLoggedReps,
        weight: lastLoggedWeight,
        unitType,
        variant: "secondary",
      });
      const incrWeight = lastLoggedWeight + minIncrement;
      const incrPrHint = checkPR(lastLoggedReps, incrWeight);
      result.push({
        label: `${lastLoggedReps}@${incrWeight}${unitType}`,
        sublabel: `+${minIncrement}`,
        prHint: incrPrHint,
        reps: lastLoggedReps,
        weight: incrWeight,
        unitType,
        variant: "outline",
      });
      // Drop set: ~80% of current weight, rounded to nearest increment
      const dropWeight = Math.round((lastLoggedWeight * 0.8) / minIncrement) * minIncrement;
      if (dropWeight >= barWeight && dropWeight < lastLoggedWeight) {
        result.push({
          label: `${lastLoggedReps}@${dropWeight}${unitType}`,
          sublabel: "drop set",
          reps: lastLoggedReps,
          weight: dropWeight,
          unitType,
          variant: "outline",
        });
      }
    }

    return result;
  }, [parsedData, liftType, sessionDate, isMetric, sets, storedBarType, storedPlatePreference, topLiftsByTypeAndReps, topLiftsByTypeAndRepsLast12Months]);

  // Find the set index with the heaviest e1RM for the strength badge
  const canShowStrength = authStatus === "authenticated" && hasBioData;
  const bestE1rmIndex = useMemo(() => {
    if (!canShowStrength) return -1;
    let bestIdx = -1;
    let bestVal = 0;
    sets.forEach((s, i) => {
      const reps = s.reps ?? 0;
      const weight = s.weight ?? 0;
      if (reps > 0 && weight > 0) {
        const e1rm = estimateE1RM(reps, weight, e1rmFormula);
        if (e1rm > bestVal) { bestVal = e1rm; bestIdx = i; }
      }
    });
    return bestIdx;
  }, [sets, canShowStrength, e1rmFormula]);

  // Compute the minimum weight column width based on the widest weight string
  const weightColWidth = useMemo(() => {
    let maxLen = 0;
    for (const s of sets) {
      const w = s.weight ?? 0;
      const len = String(w).length;
      if (len > maxLen) maxLen = len;
    }
    // Each digit ~0.6em at text-xl, plus padding. Use ch units for precision.
    // Minimum w-14 (3.5rem) for small numbers, scale up for wider values
    return maxLen <= 3 ? "w-14" : maxLen <= 4 ? "w-[4.5rem]" : "w-[5.5rem]";
  }, [sets]);

  // Determine PR status for each set: "lifetime" | "yearly" | null
  // Lifetime PR = isHistoricalPR from parsedData. Yearly PR = beats best in last 12 months.
  const prStatus = useMemo(() => {
    return sets.map((s) => {
      if (s._pending || !s.reps || !s.weight) return null;
      if (s.isHistoricalPR) return "lifetime";
      // Check yearly PR
      if (s.reps >= 1 && s.reps <= 10 && topLiftsByTypeAndRepsLast12Months?.[liftType]) {
        const yearlyBest = topLiftsByTypeAndRepsLast12Months[liftType][s.reps - 1]?.[0];
        if (yearlyBest) {
          const { value: bestWeight } = getDisplayWeight(yearlyBest, isMetric);
          const { value: thisWeight } = getDisplayWeight(s, isMetric);
          if (thisWeight > bestWeight) return "yearly";
        }
      }
      return null;
    });
  }, [sets, liftType, isMetric, topLiftsByTypeAndRepsLast12Months]);

  return (
    <div className="relative space-y-1 rounded-xl border bg-card p-4 shadow-sm md:pl-24">
      {/* Desktop: large icon in left gutter */}
      {bigFourEntry && (
        <div className="absolute left-4 top-4 hidden md:block">
          <Image src={bigFourEntry.icon} alt="" width={80} height={80} className="opacity-80" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-2 pb-1">
        {/* Mobile: inline icon (3× = 48px) */}
        {bigFourEntry && (
          <Image src={bigFourEntry.icon} alt="" width={48} height={48} className="md:hidden" />
        )}
        <h2 className="text-base font-semibold uppercase tracking-wide text-foreground">
          {liftType}
        </h2>
      </div>

      {/* Last session suggestion */}
      <LiftSuggestions
        liftType={liftType}
        sessionDate={sessionDate}
        parsedData={parsedData}
        isMetric={isMetric}
      />

      {/* Set rows — clean horizontal line above first row, dividers between */}
      <div className="mt-1 divide-y divide-border/40 border-t border-border/40">
        {sets.map((set, idx) => (
          <SetRow
            key={set._tempId ?? set.rowIndex ?? `pending-${idx}`}
            set={set}
            isMetric={isMetric}
            weightColWidth={weightColWidth}
            prType={prStatus[idx]}
            onUpdate={set._pending ? null : (fields) => onUpdateSet(set.rowIndex, fields)}
            onDelete={set._pending || !set.rowIndex ? null : () => onDeleteSet(set)}
            strengthBadge={idx === bestE1rmIndex ? (
              <LiftStrengthLevel
                liftType={liftType}
                workouts={sets}
                standards={standards}
                e1rmFormula={e1rmFormula}
                sessionDate={sessionDate}
                age={age}
                bodyWeight={bodyWeight}
                sex={sex}
                isMetric={isMetric}
                bestSetReps={set.reps}
                bestSetWeight={set.weight}
                asBadge
              />
            ) : null}
          />
        ))}

        {/* Smart add-set suggestions */}
        <SmartAddButtons
          suggestions={suggestions}
          lastRealSet={lastRealSet}
          isMetric={isMetric}
          onAddSet={onAddSet}
          showHint={showSuggestionHint}
        />
      </div>

    </div>
  );
}

function UnitLabel({ unitType, mismatch }) {
  if (!mismatch) {
    return <span className="text-sm font-medium text-muted-foreground">{unitType}</span>;
  }
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-0.5 text-sm font-medium text-muted-foreground">
            {unitType}
            <Info className="h-3 w-3" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-52 text-center">
          Showing {unitType} — the original unit in your spreadsheet
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// --- Set row (click-to-edit) ---
// Layout: [reps] @ [weight][unit]  [notes flex-1]  [PR]

function SetRow({ set, isMetric, weightColWidth = "w-14", prType, onUpdate, onDelete, strengthBadge }) {
  const [editingReps, setEditingReps] = useState(false);
  const [editingWeight, setEditingWeight] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [draftReps, setDraftReps] = useState(String(set.reps ?? ""));
  const [draftWeight, setDraftWeight] = useState(String(set.weight ?? ""));
  const [draftNotes, setDraftNotes] = useState(set.notes ?? "");
  const prefUnit = isMetric ? "kg" : "lb";
  const unitMismatch = set.unitType && set.unitType !== prefUnit;

  // Optimistic display: holds committed value until parsedData catches up
  const [pendingReps, setPendingReps] = useState(null);
  const [pendingWeight, setPendingWeight] = useState(null);

  // Keep drafts in sync if SWR refreshes parsedData
  useEffect(() => { setDraftReps(String(set.reps ?? "")); }, [set.reps]);
  useEffect(() => { setDraftWeight(String(set.weight ?? "")); }, [set.weight]);
  useEffect(() => { setDraftNotes(set.notes ?? ""); }, [set.notes]);

  // Clear pending once parsedData reflects the committed value
  useEffect(() => {
    if (pendingReps !== null && set.reps === pendingReps) setPendingReps(null);
  }, [set.reps, pendingReps]);
  useEffect(() => {
    if (pendingWeight !== null && set.weight === pendingWeight) setPendingWeight(null);
  }, [set.weight, pendingWeight]);

  const displayReps = pendingReps !== null ? pendingReps : set.reps;
  const displayWeight = pendingWeight !== null ? pendingWeight : set.weight;

  function commitReps() {
    setEditingReps(false);
    const parsed = parseInt(draftReps, 10);
    if (!isNaN(parsed) && parsed !== set.reps) {
      setPendingReps(parsed);
      onUpdate({ reps: parsed, weight: `${set.weight}${set.unitType ?? ""}`, notes: set.notes ?? "", url: set.URL ?? "" });
    }
  }

  function commitWeight() {
    setEditingWeight(false);
    const num = parseFloat(draftWeight);
    if (!isNaN(num) && num !== set.weight) {
      setPendingWeight(num);
      onUpdate({ reps: set.reps, weight: `${num}${set.unitType ?? ""}`, notes: set.notes ?? "", url: set.URL ?? "" });
    }
  }

  function commitNotes() {
    setEditingNotes(false);
    const trimmed = draftNotes.trim();
    if (trimmed !== (set.notes ?? "").trim()) {
      onUpdate({ reps: set.reps, weight: `${set.weight}${set.unitType ?? ""}`, notes: trimmed, url: set.URL ?? "" });
    }
  }

  // Pending rows: identical layout to the editable row, tiny spinner replaces PR slot.
  // Keep the reps@weight markup in sync with the editable version below.
  if (set._pending) {
    return (
      <div className="flex items-center gap-4 px-4 py-3">
        <div className="flex items-center">
          <span className="w-12 text-right text-xl font-semibold tabular-nums">{set.reps}</span>
          <span className="mx-0.5 text-base text-muted-foreground">@</span>
          <span className={`${weightColWidth} text-left text-xl font-semibold tabular-nums`}>{set.weight}</span>
          <UnitLabel unitType={set.unitType} mismatch={unitMismatch} />
        </div>
        <div className="flex flex-1 justify-end">
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/50" />
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-4 px-4 py-3">
      {/* Reps @ Weight unit — tight visual unit.
          Fixed-width containers prevent layout shift when toggling between
          display (button) and edit (input) modes. weightColWidth is computed
          by LiftBlock based on the widest weight value across all sets.
          Reps right-aligned, weight left-aligned so the digit sits flush against @.
          Keep in sync with the _pending branch above. */}
      <div className="flex items-center">
        <div className="w-12">
          {editingReps ? (
            <input
              type="number"
              className="w-full rounded border border-primary px-1 py-0.5 text-right text-xl font-semibold tabular-nums focus:outline-none"
              value={draftReps}
              onChange={(e) => setDraftReps(e.target.value)}
              onBlur={commitReps}
              onKeyDown={(e) => e.key === "Enter" && commitReps()}
              autoFocus
            />
          ) : (
            <button
              className="w-full rounded py-0.5 text-right text-xl font-semibold tabular-nums hover:bg-muted/60"
              onClick={() => setEditingReps(true)}
            >
              {displayReps}
            </button>
          )}
        </div>
        <span className="mx-0.5 text-base text-muted-foreground">@</span>
        <div className={weightColWidth}>
          {editingWeight ? (
            <input
              type="number"
              step="any"
              className="w-full rounded border border-primary px-1 py-0.5 text-xl font-semibold tabular-nums focus:outline-none"
              value={draftWeight}
              onChange={(e) => setDraftWeight(e.target.value)}
              onBlur={commitWeight}
              onKeyDown={(e) => e.key === "Enter" && commitWeight()}
              autoFocus
            />
          ) : (
            <button
              className="w-full rounded py-0.5 text-left text-xl font-semibold tabular-nums hover:bg-muted/60"
              onClick={() => setEditingWeight(true)}
            >
              {displayWeight}
            </button>
          )}
        </div>
        <UnitLabel unitType={set.unitType} mismatch={unitMismatch} />
      </div>

      {/* Notes — flex-1, tap to edit */}
      <div className="min-w-0 flex-1">
        {editingNotes ? (
          <input
            type="text"
            className="w-full border-b border-input bg-transparent py-0.5 text-xs text-muted-foreground focus:border-primary focus:outline-none"
            value={draftNotes}
            onChange={(e) => setDraftNotes(e.target.value)}
            onBlur={commitNotes}
            onKeyDown={(e) => e.key === "Enter" && commitNotes()}
            placeholder="notes..."
            autoFocus
          />
        ) : (
          <button
            className="w-full truncate text-left text-xs italic text-muted-foreground/50 hover:text-muted-foreground"
            onClick={() => setEditingNotes(true)}
          >
            {set.notes || "notes..."}
          </button>
        )}
      </div>

      {/* Right slot: PR badge + trash icon.
          Trash: always visible on mobile (touch has no hover), hover-only on desktop.
          The group class on the row container drives the md:group-hover reveal. */}
      <div className="flex shrink-0 items-center gap-1">
        {strengthBadge}
        {prType === "lifetime" && (
          <Badge variant="outline" className="border-amber-400 text-xs text-amber-600">
            PR
          </Badge>
        )}
        {prType === "yearly" && (
          <Badge variant="outline" className="border-blue-400 text-xs text-blue-500">
            Year PR
          </Badge>
        )}
        {onDelete && (
          <button
            className="rounded p-1 text-muted-foreground/30 transition-colors hover:text-destructive md:opacity-0 md:group-hover:opacity-100"
            onClick={onDelete}
            aria-label="Delete set"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// --- Italic suggestions under lift header ---

function LiftSuggestions({ liftType, sessionDate, parsedData, isMetric }) {
  const lastSets = useMemo(() => {
    if (!parsedData) return null;
    const prior = parsedData.filter(
      (e) => e.liftType === liftType && e.date < sessionDate && !e.isGoal,
    );
    if (!prior.length) return null;
    const lastDate = prior[prior.length - 1].date;
    return prior.filter((e) => e.date === lastDate);
  }, [parsedData, liftType, sessionDate]);

  if (!lastSets) return null;

  const summary = lastSets
    .map((s) => {
      const { value, unit } = getDisplayWeight(s, isMetric);
      return `${s.reps}@${value}${unit}`;
    })
    .join("  ·  ");

  return (
    <p className="pb-1 text-xs italic text-muted-foreground/70">
      Last {getReadableDateString(lastSets[0].date)}: {summary}
    </p>
  );
}

// --- Smart add-set buttons ---
// Shows contextual suggestions based on where the lifter is in their session:
// - Warmup phase: next warmup weight from generateSessionSets() + skip-to-top-set
// - Working phase: repeat last set + increment (+2.5kg/+5lb)
// - No prior data: plain "Add set" fallback

function SmartAddButtons({ suggestions, lastRealSet, isMetric, onAddSet, showHint }) {
  if (!suggestions || suggestions.length === 0) {
    // Fallback: no prior session data — plain add button
    return (
      <button
        className="flex w-full items-center gap-3 px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
        onClick={() => onAddSet(lastRealSet)}
      >
        <Plus className="h-4 w-4" />
        Add set
      </button>
    );
  }

  return (
    <div>
      <div className="flex items-stretch gap-0 divide-x divide-border/40">
        {suggestions.map((s, i) => (
          <button
            key={i}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-3 text-sm transition-colors hover:bg-accent/50 ${
              s.variant === "primary"
                ? "bg-accent/20 font-semibold text-foreground"
                : s.variant === "secondary"
                  ? "font-medium text-foreground"
                  : "text-muted-foreground"
            }`}
            onClick={() => onAddSet({ reps: s.reps, weight: s.weight, unitType: s.unitType })}
          >
            <span className="flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              {s.label}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
              {s.sublabel}
            </span>
            {s.prHint && (
              <span className={`text-[10px] font-bold uppercase ${s.prHint === "lifetime PR" ? "text-amber-500" : "text-blue-500"}`}>
                {s.prHint === "lifetime PR" ? "🏆 Lifetime PR!" : "⭐ Yearly PR!"}
              </span>
            )}
          </button>
        ))}
      </div>
      {showHint && (
        <p className="px-4 py-1.5 text-center text-[11px] italic text-muted-foreground/60">
          Tap to add, then edit the weight to match your plates
        </p>
      )}
    </div>
  );
}

// --- Add lift button ---
// Simplified: just calls onAddLift(liftType), all API logic lives in the parent.

function AddLiftButton({ parsedData, onAddLift, label = "Add Lift" }) {
  const [showInput, setShowInput] = useState(false);
  const [liftType, setLiftType] = useState("");
  const inputRef = useRef(null);

  // Build chip list: Big Four always first, then frequent lifts (excluding Big Four), cap at 8.
  const chips = useMemo(() => {
    const bigFourNames = new Set(BIG_FOUR.map((b) => b.name));
    const freq = {};
    if (parsedData) {
      for (const e of parsedData) {
        if (!e.isGoal && !bigFourNames.has(e.liftType)) {
          freq[e.liftType] = (freq[e.liftType] ?? 0) + 1;
        }
      }
    }
    const frequentExtras = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([lt]) => ({ name: lt, icon: null }));
    return [...BIG_FOUR, ...frequentExtras];
  }, [parsedData]);

  useEffect(() => {
    if (showInput) inputRef.current?.focus();
  }, [showInput]);

  function submit(lt) {
    const raw = (lt ?? liftType).trim();
    if (!raw) return;
    // Title Case: "barbell row" → "Barbell Row"
    const clean = raw.replace(/\S+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
    setShowInput(false);
    setLiftType("");
    onAddLift(clean);
  }

  if (!showInput) {
    return (
      <Button
        variant="outline"
        className="w-full gap-2"
        onClick={() => setShowInput(true)}
      >
        <Plus className="h-4 w-4" />
        {label}
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <input
        ref={inputRef}
        type="text"
        placeholder="Lift type (e.g. Back Squat)"
        className="w-full rounded border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
        value={liftType}
        onChange={(e) => setLiftType(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      {/* Quick-add chips: Big Four (with icons) + frequent lifts */}
      <div className="flex flex-wrap gap-1.5">
        {chips.map(({ name, icon }) => (
          <button
            key={name}
            className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            onClick={() => submit(name)}
          >
            {icon && (
              <Image src={icon} alt="" width={16} height={16} className="shrink-0" />
            )}
            {name}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => submit()} disabled={!liftType.trim()}>
          Add
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setShowInput(false); setLiftType(""); }}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

LogSessionPage.pageTitle = "Log";
LogSessionPage.pageDescription = "Log your lifting session and track your progress.";
