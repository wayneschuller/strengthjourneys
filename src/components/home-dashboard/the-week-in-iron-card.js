
import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, FileUp } from "lucide-react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getConsecutiveWorkoutGroups } from "@/components/analyzer/session-exercise-block";
import { DemoModeBadge } from "@/components/demo-mode-badge";
import { estimateE1RM } from "@/lib/estimate-e1rm";
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

function getWeeklySessionRows(parsedData, boundaries, isMetric) {
  if (!Array.isArray(parsedData) || parsedData.length === 0) return [];

  const sessionsByDate = new Map();

  for (const entry of parsedData) {
    if (!entry || entry.isGoal) continue;
    if ((entry.reps ?? 0) < 1) continue;
    if (entry.date < boundaries.mondayStr || entry.date > boundaries.effectiveEnd) {
      continue;
    }

    const existing = sessionsByDate.get(entry.date);
    if (existing) {
      existing.lifts.add(entry.liftType);
      existing.entries.push(entry);
      continue;
    }

    sessionsByDate.set(entry.date, {
      date: entry.date,
      lifts: new Set([entry.liftType]),
      entries: [entry],
    });
  }

  return [...sessionsByDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((session) => ({
      ...session,
      liftDetails: getSessionLiftDetails(session.entries, isMetric),
    }));
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

function formatLiftSummary(liftTypes) {
  if (!Array.isArray(liftTypes) || liftTypes.length === 0) {
    return "Session logged";
  }

  const orderedLiftTypes = [
    ...liftTypes.filter((liftType) => BIG_FOUR_LIFT_TYPES.includes(liftType)),
    ...liftTypes.filter((liftType) => !BIG_FOUR_LIFT_TYPES.includes(liftType)),
  ];
  const uniqueLiftTypes = [...new Set(orderedLiftTypes)];

  if (uniqueLiftTypes.length <= 3) return uniqueLiftTypes.join(", ");
  return `${uniqueLiftTypes.slice(0, 3).join(", ")} +${uniqueLiftTypes.length - 3}`;
}

function formatTopSetGroup(sets, group, isMetric) {
  const firstSet = sets[group[0]];
  const { value, unit } = getDisplayWeight(firstSet, isMetric);
  const baseSummary = `${firstSet.reps}@${value}${unit}`;
  return group.length > 1 ? `${group.length}x${baseSummary}` : baseSummary;
}

function getLiftTopSetSummaries(sets, isMetric) {
  if (!Array.isArray(sets) || sets.length === 0) return [];

  const e1rms = sets.map((set) => estimateE1RM(set.reps ?? 0, set.weight ?? 0, "Brzycki"));
  const bestE1rm = Math.max(...e1rms);
  const groups = getConsecutiveWorkoutGroups(sets);

  return groups
    .filter((group) => group.some((index) => e1rms[index] >= bestE1rm - 1e-6))
    .map((group) => formatTopSetGroup(sets, group, isMetric));
}

function getSessionLiftDetails(entries, isMetric) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return [];
  }

  const entriesByLiftType = entries.reduce((acc, entry) => {
    acc[entry.liftType] = acc[entry.liftType] || [];
    acc[entry.liftType].push(entry);
    return acc;
  }, {});

  const orderedLiftTypes = [
    ...BIG_FOUR_LIFT_TYPES.filter((liftType) => entriesByLiftType[liftType]?.length),
    ...Object.keys(entriesByLiftType).filter(
      (liftType) => !BIG_FOUR_LIFT_TYPES.includes(liftType),
    ),
  ];

  const liftSummaries = orderedLiftTypes
    .map((liftType) => {
      const sets = entriesByLiftType[liftType];
      const topSets = getLiftTopSetSummaries(sets, isMetric);
      if (topSets.length === 0) return null;
      return {
        liftType,
        topSets,
        hasHistoricalPR: sets.some((set) => set.isHistoricalPR),
      };
    })
    .filter(Boolean);

  return liftSummaries;
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
  const weeklySessionRows = useMemo(
    () => getWeeklySessionRows(parsedData, boundaries, isMetric),
    [parsedData, boundaries, isMetric],
  );

  const unit = stats?.nativeUnit ?? (isMetric ? "kg" : "lb");

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
  const shouldShowEarlyWeekCard =
    dataMaturityStage === "no_sessions" ||
    dashboardStage === "starter_sample" ||
    dashboardStage === "first_real_week";

  // Unlock the detailed weekly recap as soon as the user exits the first real
  // week. The monthly and long-game cards can stay staged longer, but the week
  // card should reflect current sessions immediately once week two begins.
  if (shouldShowEarlyWeekCard) {
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
              <WeekSection
                stepLabel="A"
                title="What happened this week"
                description={getWeekRecapCopy(stats, boundaries, unit, weeklySessionRows)}
              >
                <WeekSessionList rows={weeklySessionRows} />
              </WeekSection>

              <Separator />

              <WeekSection
                stepLabel="B"
                title="Looking ahead"
                description={getNextStepCopy(stats, boundaries, weeklySessionRows)}
              >
                <StartLiftPrompt showIntro={false} />
              </WeekSection>
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

function WeekSection({ stepLabel, title, description, children }) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          {stepLabel}. {title}
        </p>
        {description ? (
          <p className="text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function WeekSessionList({ rows }) {
  return (
    <div className="space-y-2">
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
          No sessions logged in this week.
        </div>
      ) : (
        rows.map((row) => (
          <Link
            key={row.date}
            href={{ pathname: "/log", query: { date: row.date } }}
            className="grid grid-cols-[72px_minmax(0,1fr)] items-start gap-4 rounded-xl border bg-muted/20 px-4 py-3 transition-colors hover:border-primary hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <div className="space-y-0.5">
              <p className="text-sm font-semibold leading-none text-foreground">
                {format(new Date(row.date + "T00:00:00"), "EEE")}
              </p>
              <p className="text-xs leading-none text-muted-foreground">
                {format(new Date(row.date + "T00:00:00"), "MMM d")}
              </p>
            </div>
            <div className="min-w-0 space-y-1.5">
              {row.liftDetails.length > 0 ? (
                row.liftDetails.map((lift) => (
                  <div
                    key={lift.liftType}
                    className="grid grid-cols-[minmax(0,120px)_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1"
                  >
                    <span className="min-w-0 text-sm font-medium text-foreground">
                      {lift.liftType}
                    </span>
                    <span className="min-w-0 text-sm text-muted-foreground">
                      {lift.topSets.length > 1 ? "Top sets" : "Top set"} {lift.topSets.join(" · ")}
                    </span>
                    {lift.hasHistoricalPR ? (
                      <Badge
                        variant="outline"
                        className="justify-self-start border-amber-400 px-2 py-0 text-[10px] text-amber-600"
                      >
                        PR
                      </Badge>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-sm text-foreground">Session logged</p>
              )}
            </div>
          </Link>
        ))
      )}
    </div>
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
        {!isDemoMode && dashboardStage === "starter_sample" && (
          <Link
            href="/import"
            className="mt-4 flex w-full items-center gap-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3 transition-colors hover:border-primary hover:bg-primary/10"
          >
            <FileUp className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">
                Already have training data?
              </p>
              <p className="text-xs text-muted-foreground">
                Import a data file to merge your history into your Google Sheet.
              </p>
            </div>
          </Link>
        )}
        <div className="mt-5 w-full">
          <StartLiftPrompt />
        </div>
      </CardContent>
    </Card>
  );
}

function getWeekRecapCopy(stats, boundaries, unit, weeklySessionRows) {
  if (weeklySessionRows.length === 0) {
    return boundaries.isCurrentWeek
      ? "Nothing logged yet this week. The first session sets the tone."
      : "No sessions were logged in this week.";
  }

  const sessionsLabel =
    weeklySessionRows.length === 1
      ? "1 training day logged"
      : `${weeklySessionRows.length} training days logged`;
  const volumeLabel = formatTonnage(stats.tonnage.current, unit);

  return `${sessionsLabel} so far, with ${volumeLabel} of total volume across the week.`;
}

function getNextStepCopy(stats, boundaries, weeklySessionRows) {
  if (stats.sessions.current === 0) {
    return boundaries.isCurrentWeek
      ? "Start the week by logging the first lift you want to train."
      : "Use this as a reset point and pick the first lift for your next week.";
  }

  const hasLiftedToday = weeklySessionRows.some(
    (session) => session.date === boundaries.todayStr,
  );

  if (boundaries.isCurrentWeek && hasLiftedToday) {
    if (stats.prs > 0) {
      return "Nice work getting today’s session in. That’s a strong note for the week. Take the win, recover well, and start thinking about what you’ll want to train next.";
    }

    return "Nice work getting today’s session in. That’s another day in the bank this week. Recover well, and when you’re ready, start thinking about when you want to lift next and what you want to train.";
  }

  if (boundaries.isCurrentWeek && stats.dayActivity.some((active) => !active)) {
    return "You’ve already put work into this week. If today is a rest day, let it be one. When you’re ready, think about when you want to lift next and what you want to train.";
  }

  if (stats.prs > 0) {
    return "Strong week so far. Take a moment to recover, reflect on how it felt, and decide what you want to train next.";
  }

  return "This week is underway. Take stock of how you’re feeling, and when the time is right, choose the next lift you want to log.";
}

function StartLiftPrompt({ showIntro = true }) {
  return (
    <div className="space-y-3">
      {showIntro && (
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">
            Pick a lift to work on
          </p>
          <p className="text-xs text-muted-foreground">
            Open today&apos;s log and go straight to the lift you want to train.
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {BIG_FOUR_STARTERS.map(({ liftType, icon }) => (
          <Link
            key={liftType}
            href={`/log?startLift=${encodeURIComponent(liftType)}#${encodeURIComponent(`lift-${liftType.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`)}`}
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 transition-colors hover:border-primary hover:bg-muted/40"
          >
            <Image
              src={icon}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 shrink-0"
            />
            <span className="text-sm font-medium leading-tight">{`Log ${liftType} activity`}</span>
          </Link>
        ))}
      </div>
      <Button
        asChild
        className="w-full justify-center gap-2 rounded-full bg-zinc-700 text-zinc-50 shadow-sm transition-colors hover:bg-zinc-600 focus-visible:ring-zinc-700 dark:bg-zinc-300 dark:text-zinc-950 dark:hover:bg-zinc-200"
      >
        <Link href="/log">
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          <span className="sm:hidden">Log</span>
          <span className="hidden sm:inline">Log any lift</span>
        </Link>
      </Button>
    </div>
  );
}
