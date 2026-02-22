"use client";

import { useMemo, useState, useEffect } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
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
import { AthleteBioInlineSettings } from "@/components/athlete-bio-quick-settings";

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

function isStrengthLevelRegressed(current, last) {
  return last !== null && (current === null || current < last - 0.3);
}

function AnimatedInteger({ value, className = "" }) {
  const motionVal = useMotionValue(0);
  const springVal = useSpring(motionVal, { stiffness: 180, damping: 22 });
  const displayVal = useTransform(springVal, (v) => Math.round(v));

  useEffect(() => {
    motionVal.set(value ?? 0);
  }, [value, motionVal]);

  return <motion.span className={className}>{displayVal}</motion.span>;
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
  const initBigFourByLift = () =>
    Object.fromEntries(
      BIG_FOUR_LIFT_TYPES.map((liftType) => [
        liftType,
        { current: 0, last: 0, lastSameDay: 0 },
      ]),
    );

  let currentTonnage = 0;
  let lastTonnage = 0;
  let lastTonnageSameDay = 0;
  const currentDates = new Set();
  const lastDates = new Set();
  const lastDatesSameDay = new Set();
  let currentBigFour = 0;
  let lastBigFour = 0;
  let lastBigFourSameDay = 0;
  const bigFourByLift = initBigFourByLift();

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
      if (BIG_FOUR_LIFT_TYPES.includes(liftType)) {
        currentBigFour += tonnage;
        bigFourByLift[liftType].current += tonnage;
      }
    } else if (inLast) {
      lastTonnage += tonnage;
      lastDates.add(date);
      if (BIG_FOUR_LIFT_TYPES.includes(liftType)) {
        lastBigFour += tonnage;
        bigFourByLift[liftType].last += tonnage;
      }
      if (date <= boundaries.prevMonthSameDayStr) {
        lastTonnageSameDay += tonnage;
        lastDatesSameDay.add(date);
        if (BIG_FOUR_LIFT_TYPES.includes(liftType)) {
          lastBigFourSameDay += tonnage;
          bigFourByLift[liftType].lastSameDay += tonnage;
        }
      }
    }
  }

  return {
    tonnage: { current: currentTonnage, last: lastTonnage, lastSameDay: lastTonnageSameDay },
    sessions: { current: currentDates.size, last: lastDates.size, lastSameDay: lastDatesSameDay.size },
    bigFourTonnage: { current: currentBigFour, last: lastBigFour, lastSameDay: lastBigFourSameDay },
    bigFourByLift,
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
    if (isStrengthLevelRegressed(current, last)) {
      return { passed: false, skipped: false };
    }
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

// ─── Verdict ───────────────────────────────────────────────────────────────

function getVerdict(stats, strengthLevelPassed) {
  const { sessions, bigFourTonnage, tonnage, bigFourByLift } = stats;

  if (
    sessions.last === 0 &&
    bigFourTonnage.last === 0 &&
    tonnage.last === 0
  ) {
    return { label: "Writing History", emoji: "📖", won: false };
  }

  const primaryMet =
    sessions.current >= sessions.last &&
    BIG_FOUR_LIFT_TYPES.every((liftType) => {
      const lift = bigFourByLift?.[liftType];
      return (lift?.current ?? 0) >= (lift?.last ?? 0);
    });
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

function formatLiftTypeLabel(liftType) {
  return liftType
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// ─── Win needs summary ─────────────────────────────────────────────────────

function getWinNeedsText(stats, strengthLevelPassed, unit) {
  const { sessions, bigFourByLift } = stats;
  const parts = [];
  if (sessions.current < sessions.last) {
    const diff = sessions.last - sessions.current;
    parts.push(`${diff} more session${diff !== 1 ? "s" : ""}`);
  }
  const tonnageLiftDeficits = BIG_FOUR_LIFT_TYPES.map((liftType) => {
    const current = bigFourByLift?.[liftType]?.current ?? 0;
    const last = bigFourByLift?.[liftType]?.last ?? 0;
    if (current >= last) return null;
    return `${formatLiftTypeLabel(liftType)} +${formatTonnage(last - current, unit)}`;
  }).filter(Boolean);
  if (tonnageLiftDeficits.length > 0) {
    parts.push(`tonnage (${tonnageLiftDeficits.join(", ")})`);
  }
  if (!strengthLevelPassed.skipped && !strengthLevelPassed.passed) {
    parts.push("maintain strength level across Big Four");
  }
  return parts.length > 0 ? `Needs: ${parts.join(" · ")}` : null;
}

function getMonthlyChecksSummary(stats, strengthLevelStats) {
  if (!stats) return null;

  let checksMet = 0;
  let checksTotal = 1; // sessions

  if (stats.sessions.current >= stats.sessions.last) checksMet += 1;

  for (const liftType of BIG_FOUR_LIFT_TYPES) {
    checksTotal += 1; // tonnage
    const lift = stats.bigFourByLift?.[liftType];
    if ((lift?.current ?? 0) >= (lift?.last ?? 0)) checksMet += 1;
  }

  if (strengthLevelStats) {
    for (const liftType of BIG_FOUR_LIFT_TYPES) {
      checksTotal += 1; // strength
      const { current, last } = strengthLevelStats[liftType] ?? {
        current: null,
        last: null,
      };
      const passed = last === null || !isStrengthLevelRegressed(current, last);
      if (passed) checksMet += 1;
    }
  }

  return { checksMet, checksTotal };
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

// ─── Big Four Criteria Table (Strength + Tonnage per lift) ────────────────

function BigFourCriteriaTable({
  sessions,
  bigFourByLift,
  strengthLevelStats,
  strengthSetupRequired = false,
  boundaries,
  unit,
}) {
  const rows = BIG_FOUR_LIFT_TYPES.map((liftType) => {
    const tonnage = bigFourByLift?.[liftType] ?? {
      current: 0,
      last: 0,
      lastSameDay: 0,
    };
    const strength = strengthLevelStats?.[liftType] ?? { current: null, last: null };
    return { liftType, tonnage, strength };
  }).filter(({ tonnage, strength }) => {
    const hasTonnage = (tonnage.current ?? 0) > 0 || (tonnage.last ?? 0) > 0;
    const hasStrength = strength.current !== null || strength.last !== null;
    return hasTonnage || hasStrength;
  });

  if (rows.length === 0) {
    return (
      <p className="text-xs text-muted-foreground/60">
        No Big Four lift criteria to compare yet this month or last.
      </p>
    );
  }

  const lastStrengthTooltip = `${boundaries.prevMonthName} average through day ${boundaries.dayOfMonth}`;
  const strengthInfoTooltip =
    "Strength level compares each month’s average session-top-set rating for this lift. For every session, your best set (up to 10 reps) is converted to an estimated 1RM and graded against age-, sex-, and bodyweight-adjusted standards. This check passes when this month matches or exceeds last month.";

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-[1fr_100px_1fr] items-center gap-2 px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
        <div className="text-right">{boundaries.prevMonthName}</div>
        <div className="text-center" aria-hidden="true"></div>
        <div className="text-left">{boundaries.currentMonthName}</div>
      </div>

      {!!sessions && (() => {
        const baseline = (sessions.lastSameDay ?? 0) === 0;
        const passed = baseline || (sessions.current ?? 0) >= (sessions.lastSameDay ?? 0);
        const rowBg = baseline
          ? "bg-muted/20"
          : passed
            ? "bg-emerald-50/30 dark:bg-emerald-950/15"
            : "bg-red-50/30 dark:bg-red-950/15";
        const rightColor = baseline
          ? "text-muted-foreground"
          : passed
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-red-600 dark:text-red-400";

        return (
          <motion.div
            className={`grid grid-cols-[1fr_100px_1fr] items-center gap-2 rounded-md px-2 py-1.5 ${rowBg}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
          >
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-right">
                    <AnimatedInteger
                      value={sessions.lastSameDay}
                      className="tabular-nums text-2xl font-semibold tracking-tight text-muted-foreground"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="max-w-56 text-center text-xs">
                    {boundaries.prevMonthName} sessions through day{" "}
                    {boundaries.dayOfMonth} (same point in the month).
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="text-center text-xs font-medium text-muted-foreground">
              Sessions
            </div>
            <div className="text-left">
              <AnimatedInteger
                value={sessions.current}
                className={`tabular-nums text-2xl font-bold tracking-tight ${rightColor}`}
              />
            </div>
          </motion.div>
        );
      })()}

      {rows.map(({ liftType, tonnage, strength }, i) => {
        const currentTonnage = tonnage.current ?? 0;
        const lastTonnage = tonnage.last ?? 0;
        const tonnagePassed = (tonnage.current ?? 0) >= (tonnage.last ?? 0);
        const tonnageBaseline = lastTonnage === 0;
        const tonnageNewWin = tonnageBaseline && currentTonnage > 0;
        const tonnageColor = tonnageBaseline && !tonnageNewWin
          ? "text-muted-foreground"
          : tonnageNewWin || tonnagePassed
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-red-600 dark:text-red-400";

        const currentStrengthFmt = formatStrengthLevel(strength.current);
        const lastStrengthFmt = formatStrengthLevel(strength.last);
        const strengthBaseline = strength.last === null;
        const strengthNewWin = strengthBaseline && strength.current !== null;
        const strengthRegressed = isStrengthLevelRegressed(
          strength.current,
          strength.last,
        );
        const strengthLocked = strengthSetupRequired;
        const strengthPassed = strengthLocked
          ? true
          : strengthBaseline || !strengthRegressed;
        const strengthColor = strengthLocked
          ? "text-muted-foreground"
          : strengthBaseline && !strengthNewWin
          ? "text-muted-foreground"
          : strengthNewWin || strengthPassed
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-red-600 dark:text-red-400";
        const strengthBg =
          strengthLocked || (strengthBaseline && !strengthNewWin)
            ? "bg-muted/20"
            : strengthPassed
          ? "bg-emerald-50/30 dark:bg-emerald-950/15"
          : "bg-red-50/30 dark:bg-red-950/15";
        const tonnageBg =
          tonnageBaseline && !tonnageNewWin
            ? "bg-muted/20"
            : tonnagePassed
          ? "bg-emerald-50/30 dark:bg-emerald-950/15"
          : "bg-red-50/30 dark:bg-red-950/15";

        return (
          <motion.div
            key={liftType}
            className="grid grid-cols-[1fr_100px_1fr] grid-rows-2 items-center gap-x-2 gap-y-1 rounded-md px-2 py-2"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.35,
              delay: 0.08 + i * 0.06,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <div className={`rounded px-1.5 py-1 text-right ${strengthBg}`}>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-xs">
                      {strengthLocked ? (
                        <span className="text-muted-foreground/70">Locked</span>
                      ) : lastStrengthFmt ? (
                        <span className="text-muted-foreground">
                          {lastStrengthFmt.emoji} {lastStrengthFmt.label}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <p className="max-w-52 text-center text-xs">
                      {strengthLocked
                        ? "Add age, sex, and bodyweight in your profile to compare strength levels."
                        : lastStrengthTooltip}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="row-span-2 flex flex-col items-center justify-center gap-1">
              <LiftSvg liftType={liftType} size="sm" animate={false} />
              <span className="text-[10px] text-muted-foreground/80">
                {formatLiftTypeLabel(liftType)}
              </span>
            </div>

            <div className={`rounded px-1.5 py-1 text-left ${strengthBg}`}>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={`text-xs font-medium ${strengthColor}`}>
                      {strengthLocked ? (
                        <span>Setup required</span>
                      ) : currentStrengthFmt ? (
                        <span>
                          {currentStrengthFmt.emoji} {currentStrengthFmt.label}
                        </span>
                      ) : (
                        <span>{strength.last !== null ? "Not trained" : "—"}</span>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p className="max-w-52 text-center text-xs">
                      {strengthLocked
                        ? "Strength-level comparisons require bio details: age, sex, and bodyweight."
                        : strengthRegressed
                        ? `${formatLiftTypeLabel(liftType)} strength level regressed vs last month`
                        : strengthInfoTooltip}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className={`rounded px-1.5 py-1 text-right ${tonnageBg}`}>
              <div className={`text-xs ${tonnageColor}`}>
                <span className="text-muted-foreground">
                  {formatTonnage(tonnage.last ?? 0, unit)} lifted
                </span>
              </div>
            </div>

            <div className={`rounded px-1.5 py-1 text-left ${tonnageBg}`}>
              <div className={`text-xs font-semibold ${tonnageColor}`}>
                {formatTonnage(tonnage.current ?? 0, unit)} lifted
              </div>
            </div>
          </motion.div>
        );
      })}

      <div className="space-y-1 pt-1">
        <AthleteBioInlineSettings
          forceStackedControls
          autoOpenWhenDefault={false}
        />
      </div>
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

  const unit = stats?.nativeUnit ?? (isMetric ? "kg" : "lb");

  const sessionsPaceStatus = stats
    ? getPaceStatus(stats.sessions.current, stats.sessions.last, stats.progressRatio)
    : null;
  const bigFourPaceStatus = stats
    ? getPaceStatus(stats.bigFourTonnage.current, stats.bigFourTonnage.last, stats.progressRatio)
    : null;

  const winNeedsText = stats
    ? getWinNeedsText(stats, strengthLevelPassed, unit)
    : null;
  const strengthSetupRequired = !!bio?.bioDataIsDefault;
  const checksSummary = useMemo(
    () => getMonthlyChecksSummary(stats, strengthLevelStats),
    [stats, strengthLevelStats],
  );

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
            <BigFourCriteriaTable
              sessions={stats.sessions}
              bigFourByLift={stats.bigFourByLift}
              strengthLevelStats={strengthLevelStats}
              strengthSetupRequired={strengthSetupRequired}
              boundaries={boundaries}
              unit={unit}
            />

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
                  {(() => {
                    if (verdict?.won) return "Winning the Month ✅";

                    const onPace = (s) =>
                      s?.status === "ahead" || s?.status === "on-pace";
                    if (onPace(sessionsPaceStatus) && onPace(bigFourPaceStatus)) {
                      return "On Track to Win ⚒️";
                    }
                    return "Not Winning Yet ⚒️";
                  })()}
                </span>
              </p>
              {checksSummary && (
                <p className="text-xs text-muted-foreground">
                  {checksSummary.checksMet}/{checksSummary.checksTotal} checks green
                </p>
              )}
              {verdict?.label === "Still Forging" && winNeedsText && (
                <p className="text-xs text-muted-foreground">{winNeedsText}</p>
              )}
            </motion.div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
