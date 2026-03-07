import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { getReadableDateString } from "@/lib/processing-utils";
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
  Loader2,
  X,
} from "lucide-react";

// --- Big Four lifts with SVG icons ---

const BIG_FOUR = [
  { name: "Back Squat", icon: "/back_squat.svg" },
  { name: "Bench Press", icon: "/bench_press.svg" },
  { name: "Deadlift", icon: "/deadlift.svg" },
  { name: "Strict Press", icon: "/strict_press.svg" },
];

export default function LogSessionPage() {
  const { status: authStatus } = useSession();
  const router = useRouter();
  const { parsedData, sheetInfo, mutate, isLoading } = useUserLiftingData();
  const { isMetric } = useAthleteBio();

  // Use local time — new Date().toISOString() is UTC, which causes off-by-one in AU/Asia/Pacific
  const todayIso = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }, []);

  const [sessionDate, setSessionDate] = useState(todayIso);
  const [syncState, setSyncState] = useState("idle"); // idle | saving | saved | error
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // Optimistic pending sets: { [liftType]: [pendingSetObj, ...] }
  // Rows appear instantly in the UI while the sheet API call is in-flight.
  const [pendingSets, setPendingSets] = useState({});
  const savedTimerRef = useRef(null);

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
      setPendingSets({});
      router.replace(
        { pathname: "/log-session", query: date !== todayIso ? { date } : {} },
        undefined,
        { shallow: true },
      );
    },
    [router, todayIso],
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

  // Merge real data with optimistic pending sets for rendering
  const sessionLiftsWithPending = useMemo(() => {
    const merged = { ...sessionLifts };
    for (const [lt, sets] of Object.entries(pendingSets)) {
      merged[lt] = [...(merged[lt] ?? []), ...sets];
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
    return later.length ? later[0] : null;
  }, [sessionDates, sessionDate]);

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

  function clearPending(liftType) {
    setPendingSets((prev) => {
      const next = { ...prev };
      delete next[liftType];
      return next;
    });
  }

  // --- API calls ---

  const updateSet = useCallback(
    async (rowIndex, fields) => {
      if (!sheetInfo?.ssid) return;
      markSaving();
      try {
        const res = await fetch("/api/log-set", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ssid: sheetInfo.ssid, rowIndex, ...fields }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Update failed");
        await mutate();
        markSaved();
      } catch (err) {
        console.error("[log-session] updateSet failed:", err);
        markError();
      }
    },
    [sheetInfo?.ssid, mutate],
  );

  // Add a new set to an existing lift block.
  // Optimistic: row appears immediately, API fires in background.
  const addSet = useCallback(
    async (liftType, prevSet) => {
      if (!sheetInfo?.ssid || !parsedData) return;

      const unitType = prevSet?.unitType ?? (isMetric ? "kg" : "lb");
      const reps = prevSet?.reps ?? 5;
      const weight = prevSet?.weight ?? (isMetric ? 20 : 45);

      // Show optimistic row immediately
      setPendingSets((prev) => ({
        ...prev,
        [liftType]: [
          ...(prev[liftType] ?? []),
          { date: sessionDate, liftType, reps, weight, unitType, rowIndex: null, isGoal: false, isHistoricalPR: false, _pending: true },
        ],
      }));
      markSaving();

      const liftRows = parsedData
        .filter((e) => e.date === sessionDate && e.liftType === liftType && !e.isGoal && e.rowIndex)
        .map((e) => e.rowIndex);
      const insertAfterRowIndex = liftRows.length ? Math.max(...liftRows) : null;

      try {
        const res = await fetch("/api/log-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ssid: sheetInfo.ssid,
            rows: [["", "", String(reps), `${weight}${unitType}`, "", ""]],
            insertAfterRowIndex,
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Add set failed");
        await mutate();
        clearPending(liftType);
        markSaved();
      } catch (err) {
        console.error("[log-session] addSet failed:", err);
        clearPending(liftType);
        markError();
      }
    },
    [sheetInfo?.ssid, parsedData, sessionDate, isMetric, mutate],
  );

  // Add a brand-new lift type to the session.
  // Optimistic: the lift block appears immediately.
  const addLift = useCallback(
    async (liftType) => {
      if (!sheetInfo?.ssid || !parsedData) return;

      const unitType = isMetric ? "kg" : "lb";
      const weight = isMetric ? 20 : 45;
      const reps = 5;

      // Show optimistic lift block immediately
      setPendingSets((prev) => ({
        ...prev,
        [liftType]: [
          ...(prev[liftType] ?? []),
          { date: sessionDate, liftType, reps, weight, unitType, rowIndex: null, isGoal: false, isHistoricalPR: false, _pending: true },
        ],
      }));
      markSaving();

      const sessionRows = parsedData
        .filter((e) => e.date === sessionDate && !e.isGoal && e.rowIndex)
        .map((e) => e.rowIndex);
      const hasExistingSession = sessionRows.length > 0;
      const insertAfterRowIndex = hasExistingSession ? Math.max(...sessionRows) : null;

      const row = [
        hasExistingSession ? "" : sessionDate,
        liftType,
        String(reps),
        `${weight}${unitType}`,
        "",
        "",
      ];

      try {
        const res = await fetch("/api/log-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ssid: sheetInfo.ssid,
            rows: [row],
            insertAfterRowIndex,
            newSession: !hasExistingSession,
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Failed");
        await mutate();
        clearPending(liftType);
        markSaved();
      } catch (err) {
        console.error("[add-lift] failed:", err);
        clearPending(liftType);
        markError();
      }
    },
    [sheetInfo?.ssid, parsedData, sessionDate, isMetric, mutate],
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
      const res = await fetch("/api/delete-session", {
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
      console.error("[log-session] deleteSession failed:", err);
      markError();
    }
  }, [sheetInfo?.ssid, parsedData, sessionDate, sessionDates, todayIso, mutate, navigateToDate]);

  // --- Render ---

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
      <div className="sticky top-0 z-10 flex items-center gap-2 bg-background/95 py-3 backdrop-blur-sm">
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
          <p className="text-xs text-muted-foreground">
            {getReadableDateString(sessionDate, true)}
          </p>
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

      {/* Jump to today */}
      {!isToday && (
        <div className="mb-4 flex justify-center">
          <Button variant="outline" size="sm" onClick={() => navigateToDate(todayIso)}>
            Back to today
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !hasSession && (
        <div className="mt-8 flex flex-col items-center gap-6 text-center">
          <div className="rounded-full bg-muted p-6">
            <Dumbbell className="h-10 w-10 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">
              {isToday ? "Start today's session" : "Start a session for this date"}
            </h2>
            <p className="text-sm text-muted-foreground">
              Add your first lift to get started.
            </p>
          </div>
          <AddLiftButton parsedData={parsedData} onAddLift={addLift} />
        </div>
      )}

      {/* Lift blocks */}
      {hasSession && (
        <div className="space-y-8">
          {Object.entries(sessionLiftsWithPending).map(([liftType, sets]) => (
            <LiftBlock
              key={liftType}
              liftType={liftType}
              sets={sets}
              parsedData={parsedData}
              sessionDate={sessionDate}
              isMetric={isMetric}
              onUpdateSet={updateSet}
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

function LiftBlock({ liftType, sets, parsedData, sessionDate, isMetric, onUpdateSet, onAddSet }) {
  // Only use confirmed (non-pending) sets for plate diagram and last-set reference
  const realSets = sets.filter((s) => !s._pending);
  const unitType = sets[0]?.unitType ?? (isMetric ? "kg" : "lb");
  const barWeight = unitType === "kg" ? 20 : 45;

  const heaviestWeight = realSets.length ? Math.max(...realSets.map((s) => s.weight ?? 0)) : 0;
  const { platesPerSide } = heaviestWeight > barWeight
    ? calculatePlateBreakdown(heaviestWeight, barWeight, unitType === "kg")
    : { platesPerSide: [] };

  const lastRealSet = realSets[realSets.length - 1];
  const hasPending = sets.some((s) => s._pending);
  const bigFourEntry = BIG_FOUR.find((b) => b.name === liftType);

  return (
    <div className="relative space-y-1 md:pl-20">
      {/* Desktop: large icon in left gutter (4× = 64px) */}
      {bigFourEntry && (
        <div className="absolute left-0 top-0 hidden md:block">
          <Image src={bigFourEntry.icon} alt="" width={64} height={64} />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-2 pb-1">
        {/* Mobile: inline icon (3× = 48px) */}
        {bigFourEntry && (
          <Image src={bigFourEntry.icon} alt="" width={48} height={48} className="md:hidden" />
        )}
        <h2 className="text-base font-semibold uppercase tracking-wide text-foreground/80">
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
      <div className="mt-1 divide-y divide-border/50 border-t border-border/60">
        {sets.map((set, idx) => (
          <SetRow
            key={set.rowIndex ?? `pending-${idx}`}
            set={set}
            onUpdate={set._pending ? null : (fields) => onUpdateSet(set.rowIndex, fields)}
          />
        ))}

        {/* Add set — disabled while any pending set is in-flight for this lift */}
        <button
          className="flex w-full items-center gap-3 px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          onClick={() => onAddSet(lastRealSet)}
          disabled={hasPending}
        >
          <Plus className="h-4 w-4" />
          Add set
        </button>
      </div>

      {/* Plate diagram */}
      {platesPerSide.length > 0 && (
        <div className="flex justify-end opacity-60">
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

// --- Set row (click-to-edit) ---

function SetRow({ set, onUpdate }) {
  const [editingReps, setEditingReps] = useState(false);
  const [editingWeight, setEditingWeight] = useState(false);
  const [draftReps, setDraftReps] = useState(String(set.reps ?? ""));
  const [draftWeight, setDraftWeight] = useState(String(set.weight ?? ""));

  // Keep drafts in sync if parsedData refreshes from SWR
  useEffect(() => { setDraftReps(String(set.reps ?? "")); }, [set.reps]);
  useEffect(() => { setDraftWeight(String(set.weight ?? "")); }, [set.weight]);

  function commitReps() {
    setEditingReps(false);
    const parsed = parseInt(draftReps, 10);
    if (!isNaN(parsed) && parsed !== set.reps) {
      onUpdate({ reps: parsed, weight: `${set.weight}${set.unitType ?? ""}`, notes: set.notes ?? "", url: set.URL ?? "" });
    }
  }

  function commitWeight() {
    setEditingWeight(false);
    const num = parseFloat(draftWeight);
    if (!isNaN(num) && num !== set.weight) {
      onUpdate({ reps: set.reps, weight: `${num}${set.unitType ?? ""}`, notes: set.notes ?? "", url: set.URL ?? "" });
    }
  }

  // Pending rows: look identical to real rows, tiny spinner in the badge slot
  if (set._pending) {
    return (
      <div className="flex items-center px-4 py-3">
        <div className="flex flex-1 items-baseline gap-3">
          <div className="flex items-baseline gap-1">
            <span className="px-1 text-xl font-semibold tabular-nums">{set.reps}</span>
            <span className="text-sm text-muted-foreground">reps</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="px-1 text-xl font-semibold tabular-nums">{set.weight}</span>
            <span className="text-sm text-muted-foreground">{set.unitType}</span>
          </div>
        </div>
        <div className="w-8 shrink-0 flex items-center justify-end">
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/50" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center px-4 py-3">
      {/* Reps + Weight cluster */}
      <div className="flex flex-1 items-baseline gap-3">
        {/* Reps — tap to edit */}
        <div className="flex items-baseline gap-1">
          {editingReps ? (
            <input
              type="number"
              className="w-16 rounded border border-primary px-2 py-0.5 text-xl font-semibold tabular-nums focus:outline-none"
              value={draftReps}
              onChange={(e) => setDraftReps(e.target.value)}
              onBlur={commitReps}
              onKeyDown={(e) => e.key === "Enter" && commitReps()}
              autoFocus
            />
          ) : (
            <button
              className="rounded px-1 text-xl font-semibold tabular-nums hover:bg-muted/60"
              onClick={() => setEditingReps(true)}
            >
              {set.reps}
            </button>
          )}
          <span className="text-sm text-muted-foreground">reps</span>
        </div>

        {/* Weight — tap to edit */}
        <div className="flex items-baseline gap-1">
          {editingWeight ? (
            <input
              type="number"
              step="any"
              className="w-20 rounded border border-primary px-2 py-0.5 text-xl font-semibold tabular-nums focus:outline-none"
              value={draftWeight}
              onChange={(e) => setDraftWeight(e.target.value)}
              onBlur={commitWeight}
              onKeyDown={(e) => e.key === "Enter" && commitWeight()}
              autoFocus
            />
          ) : (
            <button
              className="rounded px-1 text-xl font-semibold tabular-nums hover:bg-muted/60"
              onClick={() => setEditingWeight(true)}
            >
              {set.weight}
            </button>
          )}
          <span className="text-sm text-muted-foreground">{set.unitType}</span>
        </div>
      </div>

      {/* PR badge — far right, fixed slot so rows align */}
      <div className="w-8 shrink-0 text-right">
        {set.isHistoricalPR && (
          <Badge
            variant="outline"
            className="border-amber-400 text-xs text-amber-600"
          >
            PR
          </Badge>
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

  const unitType = lastSets[0]?.unitType ?? (isMetric ? "kg" : "lb");
  const summary = lastSets
    .map((s) => `${s.reps}@${s.weight}${unitType}`)
    .join("  ·  ");

  return (
    <p className="pb-1 text-xs italic text-muted-foreground">
      Last {getReadableDateString(lastSets[0].date)}: {summary}
    </p>
  );
}

// --- Add lift button ---
// Simplified: just calls onAddLift(liftType), all API logic lives in the parent.

function AddLiftButton({ parsedData, onAddLift }) {
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
    const clean = (lt ?? liftType).trim();
    if (!clean) return;
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
        Add Lift
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

LogSessionPage.pageTitle = "Log Session";
LogSessionPage.pageDescription = "Log your lifting session and track your progress.";
