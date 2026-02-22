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
} from "@/lib/processing-utils";
import {
  getStrengthRatingForE1RM,
  getStandardForLiftDate,
} from "@/hooks/use-athlete-biodata";
import { estimateE1RM } from "@/lib/estimate-e1rm";
import { LiftSvg } from "@/components/year-recap/lift-svg";

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

// ─── Strength level constants ──────────────────────────────────────────────

const LEVEL_SCORES = {
  "Physically Active": 0,
  Beginner: 1,
  Intermediate: 2,
  Advanced: 3,
  Elite: 4,
};

const LEVEL_LABELS = [
  "Physically Active",
  "Beginner",
  "Intermediate",
  "Advanced",
  "Elite",
];

const LEVEL_EMOJIS = ["🏃", "🌱", "💪", "🔥", "👑"];

function formatStrengthLevel(score) {
  if (score === null || score === undefined) return null;
  const floor = Math.min(4, Math.floor(score));
  const fraction = score - floor;
  const label = LEVEL_LABELS[floor];
  const emoji = LEVEL_EMOJIS[floor];
  const plus = fraction >= 0.25 ? "+" : "";
  return { label: label + plus, emoji, score };
}

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

  const sameDayInPrev = Math.min(d, daysInPrevMonth);

  return {
    todayStr,
    currentMonthStart,
    prevMonthStart: `${py}-${pad(pm + 1)}-01`,
    prevMonthEnd: `${py}-${pad(pm + 1)}-${pad(daysInPrevMonth)}`,
    prevMonthSameDayStr: `${py}-${pad(pm + 1)}-${pad(sameDayInPrev)}`,
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
  let lastTonnageSameDay = 0;
  const currentDates = new Set();
  const lastDates = new Set();
  const lastDatesSameDay = new Set();
  let currentBigFour = 0;
  let lastBigFour = 0;
  let lastBigFourSameDay = 0;

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
      if (date <= boundaries.prevMonthSameDayStr) {
        lastTonnageSameDay += tonnage;
        lastDatesSameDay.add(date);
        if (BIG_FOUR_LIFT_TYPES.includes(liftType)) lastBigFourSameDay += tonnage;
      }
    }
  }

  return {
    tonnage: { current: currentTonnage, last: lastTonnage, lastSameDay: lastTonnageSameDay },
    sessions: { current: currentDates.size, last: lastDates.size, lastSameDay: lastDatesSameDay.size },
    bigFourTonnage: { current: currentBigFour, last: lastBigFour, lastSameDay: lastBigFourSameDay },
    progressRatio: boundaries.dayOfMonth / boundaries.daysInPrevMonth,
    nativeUnit,
  };
}

// ─── Strength level stats (per Big Four lift, avg top-set level) ───────────

function computeStrengthLevelStats(parsedData, boundaries, bio) {
  if (bio.bioDataIsDefault) return null;

  // For each (liftType, date), track the entry with the highest e1rm
  const currentTopByLiftDate = {};
  const lastTopByLiftDate = {};

  for (const entry of parsedData) {
    if (entry.isGoal) continue;
    const reps = entry.reps ?? 0;
    if (reps < 1 || reps > 10) continue; // cap at 10 for reliable e1rm
    if (!BIG_FOUR_LIFT_TYPES.includes(entry.liftType)) continue;

    const { date, liftType } = entry;
    const inCurrent =
      date >= boundaries.currentMonthStart && date <= boundaries.todayStr;
    const inLast =
      date >= boundaries.prevMonthStart && date <= boundaries.prevMonthSameDayStr;

    if (!inCurrent && !inLast) continue;

    const e1rm = estimateE1RM(reps, entry.weight ?? 0);
    const bucket = inCurrent ? currentTopByLiftDate : lastTopByLiftDate;

    if (!bucket[liftType]) bucket[liftType] = {};
    if (!bucket[liftType][date] || e1rm > bucket[liftType][date].e1rm) {
      bucket[liftType][date] = { e1rm, date, liftType };
    }
  }

  const computeAvgLevel = (topByDate, liftType) => {
    const sessions = Object.values(topByDate[liftType] ?? {});
    if (sessions.length === 0) return null;

    const scores = sessions.map(({ e1rm, date }) => {
      const standard = getStandardForLiftDate(
        bio.age,
        date,
        bio.bodyWeight,
        bio.sex,
        liftType,
        bio.isMetric,
      );
      const rating = getStrengthRatingForE1RM(e1rm, standard);
      return LEVEL_SCORES[rating] ?? 0;
    });

    return scores.reduce((a, b) => a + b, 0) / scores.length;
  };

  const result = {};
  for (const liftType of BIG_FOUR_LIFT_TYPES) {
    result[liftType] = {
      current: computeAvgLevel(currentTopByLiftDate, liftType),
      last: computeAvgLevel(lastTopByLiftDate, liftType),
    };
  }
  return result;
}

function getStrengthLevelPassed(strengthLevelStats) {
  if (!strengthLevelStats) return { passed: true, skipped: true };
  for (const liftType of BIG_FOUR_LIFT_TYPES) {
    const { current, last } = strengthLevelStats[liftType];
    if (last === null) continue; // not trained last month — no regression possible
    if (current === null) return { passed: false, skipped: false }; // absent this month = regression
    if (current < last - 0.3) return { passed: false, skipped: false }; // significant drop
  }
  return { passed: true, skipped: false };
}

// ─── Pace status ───────────────────────────────────────────────────────────

function getPaceStatus(current, last, progressRatio) {
  if (last === 0) return { status: "no-data", fillPct: 0, needed: 0, projected: 0 };
  const fillPct = Math.min(100, (current / last) * 100);
  const paceTarget = last * progressRatio;
  const pacePct = paceTarget > 0 ? current / paceTarget : 1;
  const status =
    pacePct >= 1.0 ? "ahead" : pacePct >= 0.85 ? "on-pace" : "behind";
  const projected = progressRatio > 0 ? current / progressRatio : current;
  return { status, fillPct, needed: Math.max(0, Math.round(last - current)), projected };
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

// ─── Verdict ───────────────────────────────────────────────────────────────

function getVerdict(stats, strengthLevelPassed) {
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
  const strengthOK =
    strengthLevelPassed.skipped || strengthLevelPassed.passed;

  if (primaryMet && strengthOK) {
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

function getWinNeedsText(stats, strengthLevelPassed, unit) {
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
  if (!strengthLevelPassed.skipped && !strengthLevelPassed.passed) {
    parts.push("maintain strength level across Big Four");
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

function PaceStatusLine({ status, needed, hideNeeded, projectedLabel }) {
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
        ▲ On pace for {projectedLabel}
      </p>
    );
  }
  if (status === "on-pace") {
    return (
      <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
        → On pace for {projectedLabel}
      </p>
    );
  }
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
  projectedLabel,
  vsTooltip,
  labelTooltip,
}) {
  const { status, fillPct } = paceStatus;
  const rowDelay = index * 0.08;
  const paceMarkerPct = Math.min(100, progressRatio * 100);

  const labelEl = labelTooltip ? (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-sm font-medium">{label}</span>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="max-w-52 text-center text-xs">{labelTooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : (
    <span className="text-sm font-medium">{label}</span>
  );

  const vsEl = vsTooltip ? (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{currentLabel}</span>
            {" vs "}
            {lastLabel}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="max-w-44 text-center text-xs">{vsTooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : (
    <span className="text-xs text-muted-foreground">
      <span className="font-semibold text-foreground">{currentLabel}</span>
      {" vs "}
      {lastLabel}
    </span>
  );

  return (
    <motion.div
      className="space-y-1"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: rowDelay, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex items-baseline justify-between gap-2">
        {labelEl}
        {vsEl}
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
        projectedLabel={projectedLabel}
      />
    </motion.div>
  );
}

// ─── StrengthLevelTable ────────────────────────────────────────────────────

function StrengthLevelTable({ strengthLevelStats, boundaries }) {
  if (!strengthLevelStats) {
    return (
      <p className="text-xs text-muted-foreground/60">
        Set your profile (age, bodyweight, sex) to track strength level consistency.
      </p>
    );
  }

  // Only show rows where at least one month has data
  const rows = BIG_FOUR_LIFT_TYPES.map((liftType) => ({
    liftType,
    ...strengthLevelStats[liftType],
  })).filter((r) => r.current !== null || r.last !== null);

  if (rows.length === 0) {
    return (
      <p className="text-xs text-muted-foreground/60">
        No Big Four lifts recorded yet this month or last.
      </p>
    );
  }

  const lastTooltip = `${boundaries.prevMonthName} average through day ${boundaries.dayOfMonth}`;
  const currentTooltip = `Average strength level across all sessions this month — best set per session, capped at 10 reps for accuracy`;

  return (
    <div className="space-y-0.5">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              Strength Level
            </p>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="max-w-56 text-center text-xs">
              For each Big Four lift, the best set per session is classified
              against age- and bodyweight-adjusted standards. This column
              averages those daily ratings — a drop signals reduced training
              intensity, not just lower volume.
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {rows.map((row, i) => {
        const { liftType, current, last } = row;
        const currentFmt = formatStrengthLevel(current);
        const lastFmt = formatStrengthLevel(last);

        const regressed =
          last !== null &&
          (current === null || current < last - 0.3);
        const noData = current === null && last === null;

        const rowBg = noData
          ? ""
          : regressed
            ? "bg-red-50/50 dark:bg-red-950/30"
            : "bg-emerald-50/40 dark:bg-emerald-950/20";

        const currentColor = noData
          ? "text-muted-foreground/40"
          : regressed
            ? "text-red-600 dark:text-red-400"
            : "text-emerald-600 dark:text-emerald-400";

        const currentTooltipText = regressed
          ? `${liftType} averaged a lower strength level than last month — training intensity for this lift has dipped`
          : currentTooltip;

        return (
          <motion.div
            key={liftType}
            className={`grid grid-cols-[1fr_52px_1fr] items-center gap-2 rounded-md px-2 py-1 ${rowBg}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.35,
              delay: 0.1 + i * 0.07,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {/* Last month level */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-right">
                    {lastFmt ? (
                      <span className="text-xs text-muted-foreground">
                        {lastFmt.emoji} {lastFmt.label}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/30">—</span>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p className="max-w-44 text-center text-xs">{lastTooltip}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Lift SVG */}
            <div className="flex justify-center">
              <LiftSvg liftType={liftType} size="sm" animate={false} />
            </div>

            {/* This month level */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-left">
                    {currentFmt ? (
                      <span className={`text-xs font-medium ${currentColor}`}>
                        {currentFmt.emoji} {currentFmt.label}
                      </span>
                    ) : (
                      <span className={`text-xs font-medium ${currentColor}`}>
                        {last !== null ? "Not trained" : "—"}
                      </span>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="max-w-52 text-center text-xs">{currentTooltipText}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

/**
 * Card that challenges the user to beat their previous calendar month across
 * sessions, Big Four tonnage, and Big Four strength level consistency.
 * Reads data from UserLiftingDataProvider; takes no props.
 */
export function ThisMonthInIronCard() {
  const { parsedData } = useUserLiftingData();
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

  const strengthLevelStats = useMemo(() => {
    if (!parsedData || !bio) return null;
    return computeStrengthLevelStats(parsedData, boundaries, bio);
  }, [parsedData, bio, boundaries]);

  const strengthLevelPassed = useMemo(
    () => getStrengthLevelPassed(strengthLevelStats),
    [strengthLevelStats],
  );

  const verdict = useMemo(() => {
    if (!stats) return null;
    return getVerdict(stats, strengthLevelPassed);
  }, [stats, strengthLevelPassed]);

  const phase = getMonthPhase(boundaries.dayOfMonth);
  const unit = stats?.nativeUnit ?? (isMetric ? "kg" : "lb");
  const paceTooltip = `Where ${boundaries.prevMonthName} stood on day ${boundaries.dayOfMonth} — your target pace`;
  const vsTooltip = `${boundaries.prevMonthName}'s total through day ${boundaries.dayOfMonth} — same point in the month`;

  const sessionsPaceStatus = stats
    ? getPaceStatus(stats.sessions.current, stats.sessions.last, stats.progressRatio)
    : null;
  const bigFourPaceStatus = stats
    ? getPaceStatus(stats.bigFourTonnage.current, stats.bigFourTonnage.last, stats.progressRatio)
    : null;

  const metricRows = stats
    ? [
        {
          label: "Sessions",
          currentLabel: String(stats.sessions.current),
          lastLabel: String(stats.sessions.lastSameDay),
          paceStatus: sessionsPaceStatus,
          projectedLabel: `~${Math.round(sessionsPaceStatus.projected)} sessions`,
          showPaceMarker: true,
          hideNeeded: false,
          paceTooltip,
          vsTooltip,
        },
        {
          label: "Big Four Tonnage",
          labelTooltip:
            "Squat, bench, deadlift, and overhead press — the backbone of sustainable strength. Matching last month's Big Four exposure is the primary win condition.",
          currentLabel: formatTonnage(stats.bigFourTonnage.current, unit),
          lastLabel: formatTonnage(stats.bigFourTonnage.lastSameDay, unit),
          paceStatus: bigFourPaceStatus,
          projectedLabel: `~${formatTonnage(bigFourPaceStatus.projected, unit)}`,
          showPaceMarker: true,
          hideNeeded: false,
          paceTooltip,
          vsTooltip,
        },
      ]
    : [];

  const winNeedsText = stats
    ? getWinNeedsText(stats, strengthLevelPassed, unit)
    : null;

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
                  projectedLabel={row.projectedLabel}
                  vsTooltip={row.vsTooltip}
                  labelTooltip={row.labelTooltip}
                />
              ))}
            </div>

            <StrengthLevelTable
              strengthLevelStats={strengthLevelStats}
              boundaries={boundaries}
            />

            <Separator />
            <motion.div
              className="space-y-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.35 }}
            >
              <p className="text-xs text-muted-foreground/60">
                Won by matching last month{"'"}s sessions and Big Four tonnage
                with stable strength levels.
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">Verdict: </span>
                <span
                  className={
                    verdict?.won
                      ? "font-semibold text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground"
                  }
                >
                  {(() => {
                    if (verdict?.label === "Still Forging") {
                      const onPace = (s) =>
                        s?.status === "ahead" || s?.status === "on-pace";
                      if (onPace(sessionsPaceStatus) && onPace(bigFourPaceStatus)) {
                        return "Still Forging — On Pace ⚒️";
                      }
                    }
                    return `${verdict?.label} ${verdict?.emoji}`;
                  })()}
                </span>
              </p>
              {verdict?.label === "Still Forging" && winNeedsText && (
                <p className="text-xs text-muted-foreground">{winNeedsText}</p>
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
