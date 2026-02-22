"use client";

import { useMemo, useState, useEffect } from "react";
import { motion } from "motion/react";
import { useSession } from "next-auth/react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
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
  findLiftPositionInTopLifts,
} from "@/lib/processing-utils";
import {
  getStrengthRatingForE1RM,
  getStandardForLiftDate,
} from "@/hooks/use-athlete-biodata";
import { estimateE1RM } from "@/lib/estimate-e1rm";

// ─── Motivational phrases ──────────────────────────────────────────────────

const MOTIVATIONAL_PHRASES = [
  "Win the month, win the year",
  "Win the month, win the game",
  "One month at a time",
  "Own the month",
  "Better than last month",
  "Outwork last month",
  "Beat last month",
  "Make last month jealous",
  "One month stronger",
  "This month or never",
];


// ─── Month boundary helpers ────────────────────────────────────────────────

function getMonthBoundaries() {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();
  const pad = (n) => String(n).padStart(2, "0");
  const todayStr = `${y}-${pad(m + 1)}-${pad(d)}`;
  const currentMonthStart = `${y}-${pad(m + 1)}-01`;

  const prevDate = new Date(y, m - 1, 1);
  const py = prevDate.getFullYear();
  const pm = prevDate.getMonth();
  const daysInPrevMonth = new Date(y, m, 0).getDate();

  return {
    todayStr,
    currentMonthStart,
    prevMonthStart: `${py}-${pad(pm + 1)}-01`,
    prevMonthEnd: `${py}-${pad(pm + 1)}-${pad(daysInPrevMonth)}`,
    dayOfMonth: d,
    daysInPrevMonth,
    currentMonthName: today.toLocaleString("default", { month: "long" }),
    prevMonthName: prevDate.toLocaleString("default", { month: "long" }),
  };
}

// ─── Monthly stats calculation ─────────────────────────────────────────────

function computeMonthlyBattleStats(parsedData, boundaries) {
  const nativeUnit = parsedData.find((e) => !e.isGoal)?.unitType ?? "lb";

  let currentTonnage = 0;
  let lastTonnage = 0;
  const currentDates = new Set();
  const lastDates = new Set();
  let currentBigFour = 0;
  let lastBigFour = 0;

  for (const entry of parsedData) {
    if (entry.isGoal) continue;
    if ((entry.reps ?? 0) < 1) continue;
    if (entry.unitType !== nativeUnit) continue;

    const tonnage = (entry.weight ?? 0) * (entry.reps ?? 0);
    const { date, liftType } = entry;
    const inCurrent =
      date >= boundaries.currentMonthStart && date <= boundaries.todayStr;
    const inLast =
      date >= boundaries.prevMonthStart && date <= boundaries.prevMonthEnd;

    if (inCurrent) {
      currentTonnage += tonnage;
      currentDates.add(date);
      if (BIG_FOUR_LIFT_TYPES.includes(liftType)) currentBigFour += tonnage;
    } else if (inLast) {
      lastTonnage += tonnage;
      lastDates.add(date);
      if (BIG_FOUR_LIFT_TYPES.includes(liftType)) lastBigFour += tonnage;
    }
  }

  return {
    tonnage: { current: currentTonnage, last: lastTonnage },
    sessions: { current: currentDates.size, last: lastDates.size },
    bigFourTonnage: { current: currentBigFour, last: lastBigFour },
    progressRatio: boundaries.dayOfMonth / boundaries.daysInPrevMonth,
    nativeUnit,
  };
}

// ─── Notable PR count (top-20 yearly or lifetime) ─────────────────────────

function computeNotablePRCounts(
  parsedData,
  topLiftsByTypeAndReps,
  topLiftsByTypeAndRepsLast12Months,
  boundaries,
) {
  let current = 0;
  let last = 0;

  for (const entry of parsedData) {
    if (entry.isGoal) continue;
    if ((entry.reps ?? 0) < 1 || (entry.reps ?? 0) > 20) continue;

    const { date } = entry;
    const inCurrent =
      date >= boundaries.currentMonthStart && date <= boundaries.todayStr;
    const inLast =
      date >= boundaries.prevMonthStart && date <= boundaries.prevMonthEnd;

    if (!inCurrent && !inLast) continue;

    const { rank: lifetimeRank } = findLiftPositionInTopLifts(
      entry,
      topLiftsByTypeAndReps,
    );
    const { rank: yearlyRank } = findLiftPositionInTopLifts(
      entry,
      topLiftsByTypeAndRepsLast12Months,
    );

    const isNotable =
      (lifetimeRank !== -1 && lifetimeRank < 20) ||
      (yearlyRank !== -1 && yearlyRank < 20);
    if (!isNotable) continue;

    if (inCurrent) current++;
    else last++;
  }

  return { current, last };
}

// ─── Pace status ───────────────────────────────────────────────────────────

function getPaceStatus(current, last, progressRatio) {
  if (last === 0) return { status: "no-data", fillPct: 0, needed: 0 };
  const fillPct = Math.min(100, (current / last) * 100);
  const paceTarget = last * progressRatio;
  const pacePct = paceTarget > 0 ? current / paceTarget : 1;
  const status =
    pacePct >= 1.0 ? "ahead" : pacePct >= 0.85 ? "on-pace" : "behind";
  return { status, fillPct, needed: Math.max(0, Math.round(last - current)) };
}

// PRs don't accumulate linearly so we compare totals without a pace target
function getPRPaceStatus(current, last) {
  if (last === 0) return { status: "no-data", fillPct: 0 };
  const fillPct = Math.min(100, (current / last) * 100);
  const status = current >= last ? "ahead" : "behind";
  return { status, fillPct };
}

// ─── Month phase copy ──────────────────────────────────────────────────────

function getMonthPhase(dayOfMonth) {
  if (dayOfMonth <= 7) return "early";
  if (dayOfMonth <= 15) return "mid";
  if (dayOfMonth <= 22) return "late";
  return "final";
}

const PHASE_COPY = {
  early: "Just getting started",
  mid: "One week in — pace is taking shape",
  late: "Second half — time to make a move",
  final: "Final stretch — close it out strong",
};

// ─── Standards check ───────────────────────────────────────────────────────

function getStandardsMet(parsedData, currentMonthStart, todayStr, bio) {
  if (bio.bioDataIsDefault) return { met: true, skipped: true };

  const PASSING = ["Intermediate", "Advanced", "Elite"];
  const bestE1RMByLift = {};

  for (const entry of parsedData) {
    if (entry.isGoal) continue;
    if (entry.date < currentMonthStart || entry.date > todayStr) continue;
    if (!BIG_FOUR_LIFT_TYPES.includes(entry.liftType)) continue;

    const e1rm = estimateE1RM(entry.reps, entry.weight);
    if (
      !bestE1RMByLift[entry.liftType] ||
      e1rm > bestE1RMByLift[entry.liftType].e1rm
    ) {
      bestE1RMByLift[entry.liftType] = {
        e1rm,
        date: entry.date,
        liftType: entry.liftType,
      };
    }
  }

  const results = Object.values(bestE1RMByLift).map(
    ({ e1rm, date, liftType }) => {
      const standard = getStandardForLiftDate(
        bio.age,
        date,
        bio.bodyWeight,
        bio.sex,
        liftType,
        bio.isMetric,
      );
      const rating = getStrengthRatingForE1RM(e1rm, standard);
      return { liftType, rating, passing: PASSING.includes(rating) };
    },
  );

  if (results.length === 0) return { met: true, skipped: true };
  return { met: results.every((r) => r.passing), results, skipped: false };
}

// ─── Verdict ───────────────────────────────────────────────────────────────

function getVerdict(stats, hasNotablePRs, standardsMet) {
  const { sessions, bigFourTonnage, tonnage } = stats;

  if (
    sessions.last === 0 &&
    bigFourTonnage.last === 0 &&
    tonnage.last === 0
  ) {
    return { label: "Writing History", emoji: "📖", won: false };
  }

  const primaryMet =
    sessions.current >= sessions.last &&
    bigFourTonnage.current >= bigFourTonnage.last;
  const secondaryMet = tonnage.current >= tonnage.last || hasNotablePRs;
  const standardsOK = standardsMet.skipped || standardsMet.met;

  if (primaryMet && secondaryMet && standardsOK) {
    return { label: "Month Won", emoji: "✅", won: true };
  }
  return { label: "Still Forging", emoji: "⚒️", won: false };
}

// ─── Formatting helpers ────────────────────────────────────────────────────

function formatTonnage(value, unit) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k ${unit}`;
  }
  return `${Math.round(value)} ${unit}`;
}

// ─── Win needs summary ─────────────────────────────────────────────────────

function getWinNeedsText(stats, unit) {
  const { sessions, bigFourTonnage } = stats;
  const parts = [];
  if (sessions.current < sessions.last) {
    const diff = sessions.last - sessions.current;
    parts.push(`${diff} more session${diff !== 1 ? "s" : ""}`);
  }
  if (bigFourTonnage.current < bigFourTonnage.last) {
    parts.push(
      `${formatTonnage(bigFourTonnage.last - bigFourTonnage.current, unit)} Big Four tonnage`,
    );
  }
  return parts.length > 0 ? `Needs: ${parts.join(" · ")}` : null;
}

// ─── Status colors ─────────────────────────────────────────────────────────

const STATUS_COLORS = {
  ahead: "bg-emerald-500",
  "on-pace": "bg-amber-400",
  behind: "bg-red-500",
  "no-data": "bg-muted",
};

const STATUS_TRACK_COLORS = {
  ahead: "bg-emerald-100 dark:bg-emerald-950",
  "on-pace": "bg-amber-100 dark:bg-amber-950",
  behind: "bg-red-100 dark:bg-red-950",
  "no-data": "bg-muted/40",
};

function PaceStatusLine({ status, needed, hideNeeded }) {
  if (status === "no-data") {
    return (
      <p className="text-xs text-muted-foreground">
        No data for last month yet — keep logging!
      </p>
    );
  }
  if (status === "ahead") {
    return (
      <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
        ▲ Ahead of pace
      </p>
    );
  }
  if (status === "on-pace") {
    return (
      <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
        → On pace
      </p>
    );
  }
  // behind
  return (
    <p className="text-xs font-medium text-red-600 dark:text-red-400">
      {hideNeeded
        ? "▼ Behind last month"
        : `▼ Behind pace · Need ${needed.toLocaleString()} more to win`}
    </p>
  );
}

// ─── MetricRow ─────────────────────────────────────────────────────────────

function MetricRow({
  label,
  currentLabel,
  lastLabel,
  paceStatus,
  index,
  progressRatio,
  showPaceMarker = true,
  hideNeeded = false,
  paceTooltip,
}) {
  const { status, fillPct } = paceStatus;
  const rowDelay = index * 0.08;
  const paceMarkerPct = Math.min(100, progressRatio * 100);

  return (
    <motion.div
      className="space-y-1"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: rowDelay, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{currentLabel}</span>
          {" vs "}
          {lastLabel}
        </span>
      </div>
      <div
        className={`relative h-2.5 w-full rounded-full ${STATUS_TRACK_COLORS[status]}`}
      >
        <div className="absolute inset-0 overflow-hidden rounded-full">
          <motion.div
            className={`h-full rounded-full ${STATUS_COLORS[status]}`}
            initial={{ width: "0%" }}
            animate={{ width: `${fillPct}%` }}
            transition={{ duration: 0.7, delay: rowDelay + 0.1, ease: "easeOut" }}
          />
        </div>
        {showPaceMarker && status !== "no-data" && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="absolute top-0 h-full w-2 -translate-x-1/2 cursor-default"
                  style={{ left: `${paceMarkerPct}%` }}
                >
                  <div className="mx-auto h-full w-0.5 bg-foreground/40" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="max-w-44 text-center text-xs">{paceTooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <PaceStatusLine
        status={status}
        needed={paceStatus.needed}
        hideNeeded={hideNeeded}
      />
    </motion.div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

/**
 * Card that challenges the user to beat their previous calendar month across
 * tonnage, sessions, Big Four tonnage, and notable top-20 PRs.
 * Reads data from UserLiftingDataProvider; takes no props.
 */
export function ThisMonthInIronCard() {
  const {
    parsedData,
    topLiftsByTypeAndReps,
    topLiftsByTypeAndRepsLast12Months,
  } = useUserLiftingData();
  const bio = useAthleteBio();
  const { isMetric } = bio;
  const { status: authStatus } = useSession();

  const boundaries = useMemo(() => getMonthBoundaries(), []);

  const [motivationalPhrase, setMotivationalPhrase] = useState(
    MOTIVATIONAL_PHRASES[0],
  );
  useEffect(() => {
    setMotivationalPhrase(
      MOTIVATIONAL_PHRASES[
        Math.floor(Math.random() * MOTIVATIONAL_PHRASES.length)
      ],
    );
  }, []);

  const stats = useMemo(() => {
    if (!parsedData) return null;
    return computeMonthlyBattleStats(parsedData, boundaries);
  }, [parsedData, boundaries]);

  const notablePRCounts = useMemo(() => {
    if (
      !parsedData ||
      !topLiftsByTypeAndReps ||
      !topLiftsByTypeAndRepsLast12Months
    )
      return null;
    return computeNotablePRCounts(
      parsedData,
      topLiftsByTypeAndReps,
      topLiftsByTypeAndRepsLast12Months,
      boundaries,
    );
  }, [
    parsedData,
    topLiftsByTypeAndReps,
    topLiftsByTypeAndRepsLast12Months,
    boundaries,
  ]);

  const standardsMet = useMemo(() => {
    if (!parsedData || !bio) return { met: true, skipped: true };
    return getStandardsMet(
      parsedData,
      boundaries.currentMonthStart,
      boundaries.todayStr,
      bio,
    );
  }, [parsedData, bio, boundaries]);

  const verdict = useMemo(() => {
    if (!stats) return null;
    return getVerdict(
      stats,
      (notablePRCounts?.current ?? 0) > 0,
      standardsMet,
    );
  }, [stats, notablePRCounts, standardsMet]);

  const phase = getMonthPhase(boundaries.dayOfMonth);
  const unit = stats?.nativeUnit ?? (isMetric ? "kg" : "lb");
  const paceTooltip = `Where ${boundaries.prevMonthName} stood on day ${boundaries.dayOfMonth} — your target pace`;

  const metricRows = stats
    ? [
        {
          label: "Total Tonnage",
          currentLabel: formatTonnage(stats.tonnage.current, unit),
          lastLabel: formatTonnage(stats.tonnage.last, unit),
          paceStatus: getPaceStatus(
            stats.tonnage.current,
            stats.tonnage.last,
            stats.progressRatio,
          ),
          showPaceMarker: true,
          hideNeeded: false,
          paceTooltip,
        },
        {
          label: "Sessions",
          currentLabel: String(stats.sessions.current),
          lastLabel: String(stats.sessions.last),
          paceStatus: getPaceStatus(
            stats.sessions.current,
            stats.sessions.last,
            stats.progressRatio,
          ),
          showPaceMarker: true,
          hideNeeded: false,
          paceTooltip,
        },
        {
          label: "Big Four Tonnage",
          currentLabel: formatTonnage(stats.bigFourTonnage.current, unit),
          lastLabel: formatTonnage(stats.bigFourTonnage.last, unit),
          paceStatus: getPaceStatus(
            stats.bigFourTonnage.current,
            stats.bigFourTonnage.last,
            stats.progressRatio,
          ),
          showPaceMarker: true,
          hideNeeded: false,
          paceTooltip,
        },
        ...(notablePRCounts
          ? [
              {
                label: "Top-20 PRs",
                currentLabel: String(notablePRCounts.current),
                lastLabel: String(notablePRCounts.last),
                paceStatus: getPRPaceStatus(
                  notablePRCounts.current,
                  notablePRCounts.last,
                ),
                showPaceMarker: false,
                hideNeeded: true,
              },
            ]
          : []),
      ]
    : [];

  return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle>
          {authStatus === "unauthenticated" && "Demo Mode: "}
          This Month in Iron
        </CardTitle>
        <CardDescription>
          {motivationalPhrase} · {boundaries.currentMonthName} vs{" "}
          {boundaries.prevMonthName}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!stats && <Skeleton className="h-[30vh]" />}

        {stats && (
          <>
            <div className="space-y-4">
              {metricRows.map((row, i) => (
                <MetricRow
                  key={row.label}
                  label={row.label}
                  currentLabel={row.currentLabel}
                  lastLabel={row.lastLabel}
                  paceStatus={row.paceStatus}
                  index={i}
                  progressRatio={stats.progressRatio}
                  showPaceMarker={row.showPaceMarker}
                  hideNeeded={row.hideNeeded}
                  paceTooltip={row.paceTooltip}
                />
              ))}
            </div>

            <Separator />
            <motion.div
              className="space-y-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.35 }}
            >
              <p className="text-sm">
                <span className="text-muted-foreground">Verdict: </span>
                <span
                  className={
                    verdict?.won
                      ? "font-semibold text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground"
                  }
                >
                  {verdict?.label} {verdict?.emoji}
                </span>
              </p>
              {verdict?.label === "Still Forging" &&
                getWinNeedsText(stats, unit) && (
                  <p className="text-xs text-muted-foreground">
                    {getWinNeedsText(stats, unit)}
                  </p>
                )}
              <p className="text-xs text-muted-foreground">
                {PHASE_COPY[phase]} · Day {boundaries.dayOfMonth} of{" "}
                {boundaries.daysInPrevMonth}
              </p>
            </motion.div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
