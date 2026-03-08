import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { useReadLocalStorage } from "usehooks-ts";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { LiftStrengthLevel } from "@/components/analyzer/session-exercise-block";
import { estimateE1RM } from "@/lib/estimate-e1rm";
import { getReadableDateString, getDisplayWeight } from "@/lib/processing-utils";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { calculatePlateBreakdown } from "@/lib/warmups.js";
import { PlateDiagram } from "@/components/warmups/plate-diagram";
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

export default function LogSessionPage() {
  const { status: authStatus } = useSession();
  const router = useRouter();
  const { parsedData, sheetInfo, mutate, isLoading } = useUserLiftingData();
  const { isMetric, toggleIsMetric } = useAthleteBio();
  const { toast } = useToast();

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
  const sessionLifts = useMemo(() => {
    if (!parsedData) return {};
    const entries = parsedData.filter(
      (e) => e.date === sessionDate && !e.isGoal,
    );
    const grouped = {};
    for (const entry of entries) {
      if (!grouped[entry.liftType]) grouped[entry.liftType] = [];
      grouped[entry.liftType].push(entry);
    }
    return grouped;
  }, [parsedData, sessionDate]);

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
    setSyncState("saving");
  }

  function markSaved() {
    setSyncState("saved");
    savedTimerRef.current = setTimeout(() => setSyncState("idle"), 2000);
  }

  function markError() {
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
      try {
        const res = await fetch("/api/sheet/log-set", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ssid: sheetInfo.ssid, rowIndex, ...fields }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Update failed");
        markSaved();
        // Fire SWR revalidation in background — no await to avoid flicker
        mutate();
      } catch (err) {
        console.error("[sheet/log-set] updateSet failed:", err);
        markError();
      }
    },
    [sheetInfo?.ssid, mutate],
  );

  // deleteSet: removes a single set row from the sheet.
  // Handles anchor-row promotion so date/liftType inheritance stays intact.
  const deleteSet = useCallback(
    async (set) => {
      if (!sheetInfo?.ssid || !parsedData || !set.rowIndex) return;

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

      markSaving();
      try {
        const res = await fetch("/api/sheet/log-set", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ssid: sheetInfo.ssid, rowIndex: set.rowIndex, promoteTo }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Delete failed");
        await mutate();
        markSaved();
      } catch (err) {
        console.error("[sheet/log-set] deleteSet failed:", err);
        markError();
      }
    },
    [sheetInfo?.ssid, parsedData, mutate],
  );

  // Add a new set to an existing lift block.
  // Optimistic: row appears immediately with spinner, promoted to confirmed on success.
  const addSet = useCallback(
    async (liftType, prevSet) => {
      if (!sheetInfo?.ssid || !parsedData) return;

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
      setPendingSetsSync((prev) => ({
        ...prev,
        [liftType]: [
          ...(prev[liftType] ?? []),
          { date: sessionDate, liftType, reps, weight, unitType, rowIndex: null, isGoal: false, isHistoricalPR: false, _pending: true, _tempId: tempId },
        ],
      }));
      markSaving();

      try {
        const res = await fetch("/api/sheet/log-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ssid: sheetInfo.ssid,
            rows: [["", "", String(reps), `${weight}${unitType}`, "", ""]],
            insertAfterRowIndex,
          }),
        });
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
    },
    [sheetInfo?.ssid, parsedData, sessionDate, isMetric, setPendingSetsSync, promoteFirstPending],
  );

  // Add a brand-new lift type to the session.
  // Border is only drawn for the very first row of a brand-new session date.
  const addLift = useCallback(
    async (liftType) => {
      if (!sheetInfo?.ssid || !parsedData) return;

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
      setPendingSetsSync((prev) => ({
        ...prev,
        [liftType]: [
          ...(prev[liftType] ?? []),
          { date: sessionDate, liftType, reps, weight, unitType, rowIndex: null, isGoal: false, isHistoricalPR: false, _pending: true, _tempId: tempId },
        ],
      }));
      markSaving();

      const row = [
        hasExistingSession ? "" : sessionDate,
        liftType,
        String(reps),
        `${weight}${unitType}`,
        "",
        "",
      ];

      try {
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
    },
    [sheetInfo?.ssid, parsedData, sessionDate, isMetric, setPendingSetsSync, promoteFirstPending],
  );

  const deleteSession = useCallback(async () => {
    if (!sheetInfo?.ssid || !parsedData) return;

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

    markSaving();
    try {
      const res = await fetch("/api/sheet/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ssid: sheetInfo.ssid,
          startRowIndex: minRow,
          endRowIndex: endRow,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Delete failed");
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
  }, [sheetInfo?.ssid, parsedData, sessionDate, sessionDates, todayIso, mutate, navigateToDate]);

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
    <div className="mx-auto max-w-2xl px-3 pb-24 sm:px-4">
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
              saving={syncState === "saving"}
              onUpdateSet={updateSet}
              onDeleteSet={deleteSet}
              onAddSet={(prevSet) => addSet(liftType, prevSet)}
            />
          ))}

          <AddLiftButton parsedData={parsedData} onAddLift={addLift} disabled={syncState === "saving"} />

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

function LiftBlock({ liftType, sets, parsedData, sessionDate, isMetric, saving, onUpdateSet, onDeleteSet, onAddSet }) {
  const { status: authStatus } = useSession();
  const { age, bodyWeight, sex, standards } = useAthleteBio();
  const e1rmFormula =
    useReadLocalStorage(LOCAL_STORAGE_KEYS.FORMULA, {
      initializeWithValue: false,
    }) ?? "Brzycki";
  const hasBioData =
    age && bodyWeight && standards && Object.keys(standards).length > 0;

  // Only use confirmed (non-pending) sets for plate diagram and last-set reference
  const realSets = sets.filter((s) => !s._pending);
  const unitType = sets[0]?.unitType ?? (isMetric ? "kg" : "lb");
  const barWeight = unitType === "kg" ? 20 : 45;

  const heaviestWeight = realSets.length ? Math.max(...realSets.map((s) => s.weight ?? 0)) : 0;
  const { platesPerSide } = heaviestWeight > barWeight
    ? calculatePlateBreakdown(heaviestWeight, barWeight, unitType === "kg")
    : { platesPerSide: [] };

  const lastRealSet = realSets[realSets.length - 1];
  const bigFourEntry = BIG_FOUR.find((b) => b.name === liftType);

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

  return (
    <div className="relative space-y-1 rounded-xl border bg-card p-4 shadow-sm md:pl-24">
      {/* Desktop: large icon in left gutter */}
      {bigFourEntry && (
        <div className="absolute left-4 top-1/2 hidden -translate-y-1/2 md:block">
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
            saving={saving}
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

        {/* Add set */}
        <button
          className="flex w-full items-center gap-3 px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
          onClick={() => onAddSet(lastRealSet)}
          disabled={saving}
        >
          <Plus className="h-4 w-4" />
          Add set
        </button>
      </div>

      {/* Plate diagram */}
      {platesPerSide.length > 0 && (
        <div className="flex justify-end opacity-75">
          <PlateDiagram
            platesPerSide={platesPerSide}
            barWeight={barWeight}
            isMetric={unitType === "kg"}
            hideLabels={true}
            useScrollTrigger={false}
          />
        </div>
      )}
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

function SetRow({ set, isMetric, saving, onUpdate, onDelete, strengthBadge }) {
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
          <span className="w-14 text-left text-xl font-semibold tabular-nums">{set.weight}</span>
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
          Fixed-width containers (w-12 reps, w-20 weight) prevent layout shift when
          toggling between display (button) and edit (input) modes.
          Reps right-aligned, weight left-aligned so the digit sits flush against @.
          Buttons use px-0 to avoid pushing numbers away from @.
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
        <div className="w-14">
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
        {set.isHistoricalPR && (
          <Badge variant="outline" className="border-amber-400 text-xs text-amber-600">
            PR
          </Badge>
        )}
        {onDelete && (
          <button
            className="rounded p-1 text-muted-foreground/30 transition-colors hover:text-destructive disabled:pointer-events-none disabled:opacity-20 md:opacity-0 md:group-hover:opacity-100"
            onClick={onDelete}
            disabled={saving}
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

// --- Add lift button ---
// Simplified: just calls onAddLift(liftType), all API logic lives in the parent.

function AddLiftButton({ parsedData, onAddLift, label = "Add Lift", disabled }) {
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
        disabled={disabled}
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
