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
import { cn } from "@/lib/utils";
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

// --- Sync indicator states ---
// idle | saving | saved | error

export default function LogSessionPage() {
  const { status: authStatus } = useSession();
  const router = useRouter();
  const { parsedData, sheetInfo, mutate, isLoading } = useUserLiftingData();
  const { isMetric } = useAthleteBio();

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [sessionDate, setSessionDate] = useState(todayIso);
  const [syncState, setSyncState] = useState("idle"); // idle | saving | saved | error
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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

  // Current session entries grouped by lift type
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

  const hasSession = Object.keys(sessionLifts).length > 0;
  const currentDateIndex = sessionDates.indexOf(sessionDate);
  const canGoPrev = currentDateIndex > 0;
  const canGoNext = currentDateIndex >= 0 && currentDateIndex < sessionDates.length - 1;
  const isToday = sessionDate === todayIso;

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

  const addSet = useCallback(
    async (liftType, prevSet) => {
      if (!sheetInfo?.ssid) return;
      markSaving();
      try {
        const res = await fetch("/api/log-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ssid: sheetInfo.ssid,
            date: sessionDate,
            lifts: [
              {
                liftType,
                sets: [
                  {
                    reps: prevSet?.reps ?? 5,
                    weight: prevSet?.weight
                      ? `${prevSet.weight}${prevSet.unitType ?? ""}`
                      : "",
                    notes: "",
                    url: "",
                  },
                ],
              },
            ],
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Add set failed");
        await mutate();
        markSaved();
      } catch (err) {
        console.error("[log-session] addSet failed:", err);
        markError();
      }
    },
    [sheetInfo?.ssid, sessionDate, mutate],
  );

  const deleteSession = useCallback(async () => {
    if (!sheetInfo?.ssid || !parsedData) return;

    // Compute the row range: everything from the first row of this session
    // to the row just before the next adjacent session starts.
    const sessionRows = parsedData
      .filter((e) => e.date === sessionDate && !e.isGoal && e.rowIndex)
      .map((e) => e.rowIndex);

    if (!sessionRows.length) return;

    const minRow = Math.min(...sessionRows);
    const maxRow = Math.max(...sessionRows);

    // Find rows from other dates adjacent to this session
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
      // Navigate to the previous/next available date
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
          disabled={!canGoPrev}
          onClick={() => navigateToDate(sessionDates[currentDateIndex - 1])}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex-1 text-center">
          <h1 className="text-lg font-semibold leading-tight">
            {isToday ? "Today" : getReadableDateString(sessionDate, true)}
          </h1>
          {!isToday && (
            <p className="text-xs text-muted-foreground">{sessionDate}</p>
          )}
        </div>

        <SyncIndicator state={syncState} />

        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          disabled={!canGoNext}
          onClick={() => navigateToDate(sessionDates[currentDateIndex + 1])}
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
              {isToday ? "Start today's session" : "No session on this date"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isToday
                ? "Add your first lift to get started."
                : "Nothing was logged on this day."}
            </p>
          </div>
          <AddLiftButton
            parsedData={parsedData}
            sessionDate={sessionDate}
            sheetInfo={sheetInfo}
            onSaving={markSaving}
            onSaved={() => { markSaved(); mutate(); }}
            onError={markError}
          />
        </div>
      )}

      {/* Lift blocks */}
      {hasSession && (
        <div className="space-y-8">
          {Object.entries(sessionLifts).map(([liftType, sets]) => (
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

          <AddLiftButton
            parsedData={parsedData}
            sessionDate={sessionDate}
            sheetInfo={sheetInfo}
            onSaving={markSaving}
            onSaved={() => { markSaved(); mutate(); }}
            onError={markError}
          />

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
  const unitType = sets[0]?.unitType ?? (isMetric ? "kg" : "lb");
  const barWeight = unitType === "kg" ? 20 : 45;

  const heaviestWeight = Math.max(...sets.map((s) => s.weight ?? 0));
  const { platesPerSide } = heaviestWeight > barWeight
    ? calculatePlateBreakdown(heaviestWeight, barWeight, unitType === "kg")
    : { platesPerSide: [] };

  const lastSet = sets[sets.length - 1];

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="flex items-baseline justify-between pb-1">
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

      {/* Set rows */}
      <div className="divide-y divide-border/50 rounded-lg border">
        {sets.map((set, idx) => (
          <SetRow
            key={set.rowIndex ?? idx}
            set={set}
            index={idx}
            onUpdate={(fields) => onUpdateSet(set.rowIndex, fields)}
          />
        ))}

        {/* Add set */}
        <button
          className="flex w-full items-center gap-3 px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          onClick={() => onAddSet(lastSet)}
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

function SetRow({ set, index, onUpdate }) {
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
      const weightWithUnit = `${num}${set.unitType ?? ""}`;
      onUpdate({ reps: set.reps, weight: weightWithUnit, notes: set.notes ?? "", url: set.URL ?? "" });
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {/* Set number */}
      <span className="w-4 shrink-0 text-right text-sm text-muted-foreground">
        {index + 1}
      </span>

      {/* Reps — tap to edit */}
      <div className="flex flex-1 items-baseline gap-1">
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

      {/* PR badge */}
      {set.isHistoricalPR && (
        <Badge
          variant="outline"
          className="shrink-0 border-amber-400 text-xs text-amber-600"
        >
          PR
        </Badge>
      )}
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
    .map((s) => `${s.reps}×${s.weight}${unitType}`)
    .join("  ·  ");

  return (
    <p className="pb-1 text-xs italic text-muted-foreground">
      Last {getReadableDateString(lastSets[0].date)}: {summary}
    </p>
  );
}

// --- Add lift button ---

function AddLiftButton({ parsedData, sessionDate, sheetInfo, onSaving, onSaved, onError }) {
  const [showInput, setShowInput] = useState(false);
  const [liftType, setLiftType] = useState("");
  const inputRef = useRef(null);
  const { isMetric } = useAthleteBio();

  // Recent lift types for quick-add suggestions (top 6 by frequency)
  const suggestions = useMemo(() => {
    if (!parsedData) return [];
    const freq = {};
    for (const e of parsedData) {
      if (!e.isGoal) freq[e.liftType] = (freq[e.liftType] ?? 0) + 1;
    }
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([lt]) => lt);
  }, [parsedData]);

  useEffect(() => {
    if (showInput) inputRef.current?.focus();
  }, [showInput]);

  async function submit(lt) {
    const clean = (lt ?? liftType).trim();
    if (!clean || !sheetInfo?.ssid) return;
    setShowInput(false);
    setLiftType("");
    onSaving();
    try {
      const defaultWeight = isMetric ? "20kg" : "45lb";
      const res = await fetch("/api/log-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ssid: sheetInfo.ssid,
          date: sessionDate,
          lifts: [{ liftType: clean, sets: [{ reps: 5, weight: defaultWeight, notes: "", url: "" }] }],
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      onSaved();
    } catch (err) {
      console.error("[add-lift] failed:", err);
      onError();
    }
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
      {/* Quick-add suggestions */}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((lt) => (
            <button
              key={lt}
              className="rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
              onClick={() => submit(lt)}
            >
              {lt}
            </button>
          ))}
        </div>
      )}
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
