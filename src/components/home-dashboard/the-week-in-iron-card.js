
import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { Button } from "@/components/ui/button";
import { DemoModeBadge } from "@/components/demo-mode-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BIG_FOUR_LIFT_TYPES,
  getDisplayWeight,
} from "@/lib/processing-utils";
import {
  formatDateToYmdLocal,
  addDaysFromStr,
  subtractDaysFromStr,
} from "@/lib/date-utils";

// ─── Day labels (Mon–Sun) ──────────────────────────────────────────────────

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const BIG_FOUR_STARTERS = [
  { liftType: "Back Squat", icon: "/back_squat.svg" },
  { liftType: "Bench Press", icon: "/bench_press.svg" },
  { liftType: "Deadlift", icon: "/deadlift.svg" },
  { liftType: "Strict Press", icon: "/strict_press.svg" },
];

// ─── Week boundary helpers ─────────────────────────────────────────────────

function getWeekBoundaries(weekOffset = 0) {
  const today = new Date();
  const todayStr = formatDateToYmdLocal(today);
  const dow = today.getDay(); // 0=Sun … 6=Sat
  const daysBackToMonday = (dow + 6) % 7;
  const mondayStr = subtractDaysFromStr(todayStr, daysBackToMonday + weekOffset * 7);
  const sundayStr = addDaysFromStr(mondayStr, 6);
  const isCurrentWeek = weekOffset === 0;

  // The effective end for the current week is today; for past weeks, it's Sunday
  const effectiveEnd = isCurrentWeek ? todayStr : sundayStr;

  // Previous week boundaries for comparison
  const prevMondayStr = subtractDaysFromStr(mondayStr, 7);
  const prevSundayStr = subtractDaysFromStr(mondayStr, 1);
  // For same-day comparison in current week: how many days into the week are we?
  const dayIndex = isCurrentWeek ? daysBackToMonday : 6; // 0=Mon … 6=Sun
  const prevSameDayStr = addDaysFromStr(prevMondayStr, dayIndex);

  return {
    mondayStr,
    sundayStr,
    effectiveEnd,
    prevMondayStr,
    prevSundayStr,
    prevSameDayStr,
    dayIndex,
    isCurrentWeek,
    todayStr,
  };
}

function getWeekCardTitle(boundaries) {
  if (boundaries.isCurrentWeek) return "The Week in Iron";
  const d = new Date(boundaries.mondayStr + "T00:00:00");
  const currentYear = new Date().getFullYear();
  if (d.getFullYear() === currentYear) {
    return `${format(d, "MMM d")} Week`;
  }
  return `${format(d, "MMM d, yyyy")} Week`;
}

function getWeekSubtitle(boundaries) {
  const mon = new Date(boundaries.mondayStr + "T00:00:00");
  const sun = new Date(boundaries.sundayStr + "T00:00:00");
  const sameMonth = mon.getMonth() === sun.getMonth();
  if (sameMonth) {
    return `${format(mon, "MMM d")} – ${format(sun, "d")}`;
  }
  return `${format(mon, "MMM d")} – ${format(sun, "MMM d")}`;
}

function getMaxWeekOffsetFromData(parsedData) {
  if (!Array.isArray(parsedData) || parsedData.length === 0) return 0;
  let earliest = null;
  for (const entry of parsedData) {
    if (!entry || entry.isGoal) continue;
    if (!earliest || entry.date < earliest) earliest = entry.date;
  }
  if (!earliest) return 0;
  const todayStr = formatDateToYmdLocal(new Date());
  const todayDate = new Date(todayStr + "T00:00:00");
  const earliestDate = new Date(earliest + "T00:00:00");
  const diffDays = Math.floor(
    (todayDate - earliestDate) / (1000 * 60 * 60 * 24),
  );
  return Math.max(0, Math.floor(diffDays / 7));
}

// ─── Weekly stats computation ──────────────────────────────────────────────

function computeWeeklyStats(parsedData, boundaries) {
  const nativeUnit = parsedData.find((e) => !e.isGoal)?.unitType ?? "lb";

  let currentTonnage = 0;
  let prevTonnage = 0;
  let prevTonnageSameDay = 0;
  const currentDates = new Set();
  const prevDates = new Set();
  const prevDatesSameDay = new Set();
  let currentSets = 0;
  let prevSets = 0;
  let currentPRs = 0;
  // Per-day tracking for the dot grid
  const dayDates = Array.from({ length: 7 }, () => new Set());
  // Per-lift-type tracking
  const liftTypes = new Set();
  const liftTypeSets = {};

  for (const entry of parsedData) {
    if (entry.isGoal) continue;
    if ((entry.reps ?? 0) < 1) continue;

    const { date, liftType } = entry;
    const tonnage =
      entry.unitType === nativeUnit
        ? (entry.weight ?? 0) * (entry.reps ?? 0)
        : 0;

    const inCurrent =
      date >= boundaries.mondayStr && date <= boundaries.effectiveEnd;
    const inPrev =
      date >= boundaries.prevMondayStr && date <= boundaries.prevSundayStr;

    if (inCurrent) {
      currentTonnage += tonnage;
      currentDates.add(date);
      currentSets++;
      liftTypes.add(liftType);
      liftTypeSets[liftType] = (liftTypeSets[liftType] ?? 0) + 1;
      if (entry.isHistoricalPR) currentPRs++;

      // Map date to day-of-week index (0=Mon)
      const d = new Date(date + "T00:00:00");
      const dow = d.getDay(); // 0=Sun
      const dayIdx = (dow + 6) % 7; // 0=Mon
      dayDates[dayIdx].add(date);
    } else if (inPrev) {
      prevTonnage += tonnage;
      prevDates.add(date);
      prevSets++;
      if (date <= boundaries.prevSameDayStr) {
        prevTonnageSameDay += tonnage;
        prevDatesSameDay.add(date);
      }
    }
  }

  return {
    tonnage: { current: currentTonnage, prev: prevTonnage, prevSameDay: prevTonnageSameDay },
    sessions: { current: currentDates.size, prev: prevDates.size, prevSameDay: prevDatesSameDay.size },
    sets: { current: currentSets, prev: prevSets },
    prs: currentPRs,
    dayActivity: dayDates.map((s) => s.size > 0),
    liftTypes: [...liftTypes].sort(),
    liftTypeSets,
    nativeUnit,
  };
}

// ─── Formatting helpers ────────────────────────────────────────────────────

function formatTonnage(value, unit) {
  if (value >= 10000) return `${(value / 1000).toFixed(1)}k ${unit}`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k ${unit}`;
  return `${Math.round(value)} ${unit}`;
}

function getTonnageDelta(current, prev) {
  if (prev === 0) return null;
  const pct = ((current - prev) / prev) * 100;
  return pct;
}

// ─── Main component ────────────────────────────────────────────────────────

export function TheWeekInIronCard({
  dashboardStage = "established",
  dataMaturityStage = "mature",
  sessionCount = 0,
}) {
  const { isDemoMode, parsedData } = useUserLiftingData();
  const { isMetric } = useAthleteBio();

  const [weekOffset, setWeekOffset] = useState(0);
  const maxWeekOffset = useMemo(
    () => getMaxWeekOffsetFromData(parsedData),
    [parsedData],
  );
  const safeWeekOffset = Math.min(weekOffset, maxWeekOffset);

  const boundaries = useMemo(
    () => getWeekBoundaries(safeWeekOffset),
    [safeWeekOffset],
  );
  const title = useMemo(() => getWeekCardTitle(boundaries), [boundaries]);
  const subtitle = useMemo(() => getWeekSubtitle(boundaries), [boundaries]);

  const stats = useMemo(() => {
    if (!Array.isArray(parsedData) || parsedData.length === 0) return null;
    return computeWeeklyStats(parsedData, boundaries);
  }, [parsedData, boundaries]);

  const unit = stats?.nativeUnit ?? (isMetric ? "kg" : "lb");

  const tonnageDelta = stats
    ? getTonnageDelta(
        stats.tonnage.current,
        boundaries.isCurrentWeek
          ? stats.tonnage.prevSameDay
          : stats.tonnage.prev,
      )
    : null;

  const viewPreviousWeek = () => {
    setWeekOffset((prev) => Math.min(maxWeekOffset, prev + 1));
  };

  const viewNextWeek = () => {
    setWeekOffset((prev) => Math.max(0, prev - 1));
  };

  const hasLoggedSessions = useMemo(
    () => Array.isArray(parsedData) && parsedData.some((e) => !e?.isGoal),
    [parsedData],
  );

  // Early-stage: show a simpler card for users without mature data
  if (dataMaturityStage !== "mature") {
    return (
      <EarlyWeekCard
        isDemoMode={isDemoMode}
        dataMaturityStage={dataMaturityStage}
        dashboardStage={dashboardStage}
      />
    );
  }

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={1000}>
      <Card className="flex h-full flex-1 flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <CardTitle className="flex flex-wrap items-center gap-2">
                {isDemoMode && <DemoModeBadge size="sm" />}
                {title}
              </CardTitle>
              <CardDescription>{subtitle}</CardDescription>
            </div>
            <div className="flex shrink-0 items-center gap-0.5 rounded-lg border bg-muted/30 p-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={viewPreviousWeek}
                    disabled={safeWeekOffset >= maxWeekOffset}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Previous week</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={viewNextWeek}
                    disabled={safeWeekOffset === 0}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Next week</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col space-y-4">
          {!stats && <Skeleton className="h-[20vh]" />}

          {stats && (
            <>
              {/* Day-of-week dot grid */}
              <WeekDayGrid
                dayActivity={stats.dayActivity}
                boundaries={boundaries}
              />

              <Separator />

              {/* Key stats */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <StatBlock
                  label="Sessions"
                  value={stats.sessions.current}
                  prev={
                    boundaries.isCurrentWeek
                      ? stats.sessions.prevSameDay
                      : stats.sessions.prev
                  }
                />
                <StatBlock
                  label="Sets"
                  value={stats.sets.current}
                />
                <StatBlock
                  label="PRs"
                  value={stats.prs}
                  highlight={stats.prs > 0}
                />
              </div>

              <Separator />

              {/* Tonnage summary */}
              <div className="space-y-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    Volume
                  </span>
                  {tonnageDelta !== null && (
                    <TonnageDeltaBadge delta={tonnageDelta} />
                  )}
                </div>
                <p className="text-2xl font-bold tracking-tight">
                  {formatTonnage(stats.tonnage.current, unit)}
                </p>
                {boundaries.isCurrentWeek &&
                  stats.tonnage.prevSameDay > 0 && (
                    <p className="text-xs text-muted-foreground">
                      vs {formatTonnage(stats.tonnage.prevSameDay, unit)} same
                      point last week
                    </p>
                  )}
                {!boundaries.isCurrentWeek && stats.tonnage.prev > 0 && (
                  <p className="text-xs text-muted-foreground">
                    vs {formatTonnage(stats.tonnage.prev, unit)} previous week
                  </p>
                )}
              </div>

              {/* Lift types trained */}
              {stats.liftTypes.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-1.5">
                    <span className="text-sm font-medium text-muted-foreground">
                      Lifts trained
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {stats.liftTypes.map((liftType) => (
                        <span
                          key={liftType}
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs ${
                            BIG_FOUR_LIFT_TYPES.includes(liftType)
                              ? "border-primary/30 bg-primary/5 font-medium text-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          {liftType}
                          <span className="text-muted-foreground">
                            ×{stats.liftTypeSets[liftType]}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <Separator />
              <StartLiftPrompt />
            </>
          )}

          {!hasLoggedSessions && (
            <p className="rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
              Your training week will appear here once you log your first session.
            </p>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

// ─── Supporting components ─────────────────────────────────────────────────

function WeekDayGrid({ dayActivity, boundaries }) {
  return (
    <div className="grid grid-cols-7 gap-1.5 text-center">
      {DAY_LABELS.map((label, i) => {
        const active = dayActivity[i];
        const dateStr = addDaysFromStr(boundaries.mondayStr, i);
        const isFuture =
          boundaries.isCurrentWeek && dateStr > boundaries.todayStr;
        const isToday =
          boundaries.isCurrentWeek && dateStr === boundaries.todayStr;

        return (
          <div key={label} className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </span>
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : isFuture
                    ? "border border-dashed border-muted-foreground/30 text-muted-foreground/40"
                    : isToday
                      ? "border-2 border-primary/50 text-muted-foreground"
                      : "bg-muted/50 text-muted-foreground/60"
              }`}
            >
              {new Date(dateStr + "T00:00:00").getDate()}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatBlock({ label, value, prev, highlight = false }) {
  return (
    <div className="space-y-0.5">
      <p
        className={`text-2xl font-bold tabular-nums ${
          highlight ? "text-primary" : ""
        }`}
      >
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
      {prev !== undefined && prev > 0 && (
        <p className="text-[10px] text-muted-foreground/70">
          vs {prev} last wk
        </p>
      )}
    </div>
  );
}

function TonnageDeltaBadge({ delta }) {
  const isUp = delta > 0;
  const isDown = delta < 0;
  const abs = Math.abs(delta);
  if (abs < 0.5) return null;

  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ${
        isUp
          ? "bg-green-500/10 text-green-600 dark:text-green-400"
          : isDown
            ? "bg-red-500/10 text-red-600 dark:text-red-400"
            : "bg-muted text-muted-foreground"
      }`}
    >
      {isUp ? "▲" : "▼"} {abs.toFixed(1)}%
    </span>
  );
}

function EarlyWeekCard({ isDemoMode, dataMaturityStage, dashboardStage }) {
  const title =
    dashboardStage === "starter_sample" || dashboardStage === "first_real_week"
      ? "The First Week"
      : "The Week in Iron";

  const subtitle =
    dataMaturityStage === "no_sessions"
      ? "Your weekly summary will appear once you log a session."
      : "Building your first week of data.";

  return (
    <Card className="flex h-full flex-1 flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2">
          {isDemoMode && <DemoModeBadge size="sm" />}
          {title}
        </CardTitle>
        <CardDescription>{subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col items-center justify-center">
        <p className="rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          Log your training sessions and this card will track your weekly rhythm — sessions, volume, and lifts trained.
        </p>
        <div className="mt-5 w-full">
          <StartLiftPrompt />
        </div>
      </CardContent>
    </Card>
  );
}

function StartLiftPrompt() {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">
          Start a new session
        </p>
        <p className="text-xs text-muted-foreground">
          Jump into the log with your first Big Four set already started.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {BIG_FOUR_STARTERS.map(({ liftType, icon }) => (
          <Link
            key={liftType}
            href={{ pathname: "/log", query: { startLift: liftType } }}
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 transition-colors hover:border-primary hover:bg-muted/40"
          >
            <Image
              src={icon}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 shrink-0"
            />
            <span className="text-sm font-medium leading-tight">{liftType}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
