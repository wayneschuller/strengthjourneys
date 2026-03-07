import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { getReadableDateString, findLiftPositionInTopLifts } from "@/lib/processing-utils";
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
} from "lucide-react";

export default function LogSessionPage() {
  const { status: authStatus } = useSession();
  const router = useRouter();
  const {
    parsedData,
    topLiftsByTypeAndReps,
    isLoading,
    sheetInfo,
  } = useUserLiftingData();
  const { isMetric } = useAthleteBio();

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [sessionDate, setSessionDate] = useState(todayIso);

  // Sync date from URL param after hydration
  useEffect(() => {
    if (router.query.date && typeof router.query.date === "string") {
      setSessionDate(router.query.date);
    }
  }, [router.query.date]);

  // Update URL when date changes
  function navigateToDate(date) {
    setSessionDate(date);
    router.replace(
      { pathname: "/log-session", query: date !== todayIso ? { date } : {} },
      undefined,
      { shallow: true },
    );
  }

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

  // Current session's entries grouped by lift type
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
  // Can go "next" toward present, plus can always go to today if not already there
  const canGoNext = currentDateIndex >= 0 && currentDateIndex < sessionDates.length - 1;
  const isToday = sessionDate === todayIso;

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
      {/* Header */}
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

      {/* Jump to today if browsing past */}
      {!isToday && (
        <div className="mb-4 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateToDate(todayIso)}
          >
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
          <Button size="lg" className="gap-2">
            <Plus className="h-4 w-4" />
            Add Lift
          </Button>
        </div>
      )}

      {/* Lift blocks */}
      {hasSession && (
        <div className="space-y-6">
          {Object.entries(sessionLifts).map(([liftType, sets]) => (
            <LiftBlock
              key={liftType}
              liftType={liftType}
              sets={sets}
              parsedData={parsedData}
              sessionDate={sessionDate}
              topLiftsByTypeAndReps={topLiftsByTypeAndReps}
              isMetric={isMetric}
            />
          ))}

          {/* Add lift */}
          <Button variant="outline" className="w-full gap-2">
            <Plus className="h-4 w-4" />
            Add Lift
          </Button>

          {/* Delete session — destructive, at the bottom */}
          <div className="flex justify-center pt-4">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Delete this session
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Lift block ---

function LiftBlock({ liftType, sets, parsedData, sessionDate, topLiftsByTypeAndReps, isMetric }) {
  const unitType = sets[0]?.unitType ?? (isMetric ? "kg" : "lb");
  const barWeight = unitType === "kg" ? 20 : 45;

  // Heaviest working weight in this block for plate diagram
  const heaviestWeight = Math.max(...sets.map((s) => s.weight ?? 0));
  const { platesPerSide } = heaviestWeight > barWeight
    ? calculatePlateBreakdown(heaviestWeight, barWeight, unitType === "kg")
    : { platesPerSide: [] };

  return (
    <div className="space-y-1">
      {/* Lift type header */}
      <div className="flex items-center justify-between pb-1">
        <h2 className="text-base font-semibold uppercase tracking-wide text-foreground/80">
          {liftType}
        </h2>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground">
          ···
        </Button>
      </div>

      {/* Suggestions row */}
      <LiftSuggestions
        liftType={liftType}
        sessionDate={sessionDate}
        parsedData={parsedData}
        isMetric={isMetric}
      />

      {/* Set rows */}
      <div className="divide-y divide-border/50 rounded-lg border">
        {sets.map((set, idx) => (
          <SetRow key={set.rowIndex ?? idx} set={set} index={idx} />
        ))}

        {/* Add set button inline */}
        <button className="flex w-full items-center gap-3 px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground">
          <Plus className="h-4 w-4" />
          Add set
        </button>
      </div>

      {/* Plate diagram — shows for heaviest weight */}
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

// --- Set row ---

function SetRow({ set, index }) {
  const hasPR = set.isHistoricalPR;

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {/* Set number */}
      <span className="w-4 text-right text-sm text-muted-foreground">
        {index + 1}
      </span>

      {/* Reps */}
      <div className="flex flex-1 items-baseline gap-1">
        <span className="text-xl font-semibold tabular-nums">{set.reps}</span>
        <span className="text-sm text-muted-foreground">reps</span>
      </div>

      {/* Weight */}
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-semibold tabular-nums">{set.weight}</span>
        <span className="text-sm text-muted-foreground">{set.unitType}</span>
      </div>

      {/* PR badge */}
      {hasPR && (
        <Badge variant="outline" className="shrink-0 text-xs text-amber-600 border-amber-400">
          PR
        </Badge>
      )}
    </div>
  );
}

// --- Italic suggestions below lift header ---

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

  const lastDate = lastSets[0].date;
  const unitType = lastSets[0]?.unitType ?? (isMetric ? "kg" : "lb");
  const summary = lastSets
    .map((s) => `${s.reps}×${s.weight}${unitType}`)
    .join("  ·  ");

  return (
    <div className="space-y-0.5 pb-1">
      <p className="text-xs italic text-muted-foreground">
        Last {getReadableDateString(lastDate)}: {summary}
      </p>
    </div>
  );
}

// Page metadata
LogSessionPage.pageTitle = "Log Session";
LogSessionPage.pageDescription = "Log your lifting session and track your progress.";
