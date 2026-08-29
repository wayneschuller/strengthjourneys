/**
 * Headline "key numbers" strip for a single Big Four lift page.
 *
 * Deliberately shows only stats that appear nowhere else on the page. The
 * strength standards card already answers "how strong am I", and the journey
 * card already answers "what are my PRs", so this strip answers the questions
 * the page previously left unanswered: am I trending up right now, how often do
 * I actually train this, how much have I moved lifetime, and how big a share of
 * my training this lift really is.
 *
 * All maths runs client-side off parsedData in a single pass, in the athlete's
 * display units, so nothing here needs a server round trip.
 */

import { useMemo } from "react";
import Link from "next/link";
import {
  Activity,
  CalendarClock,
  Layers,
  PieChart,
  Repeat,
  Scale,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { motion } from "motion/react";

import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { useLiftColors } from "@/hooks/use-lift-colors";
import { estimateE1RM } from "@/lib/estimate-e1rm";
import { getDisplayWeight } from "@/lib/processing-utils";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { useReadLocalStorage } from "usehooks-ts";
import {
  formatDateToYmdLocal,
  getReadableDateString,
  subtractDaysFromStr,
} from "@/lib/date-utils";
import { DemoModeBadge } from "@/components/demo-mode-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const MOMENTUM_WINDOW_DAYS = 90;
const FREQUENCY_WINDOW_DAYS = 84; // 12 whole weeks reads cleanly as "x per week"

/**
 * Renders the key-numbers strip for one lift.
 *
 * @param {Object} props
 * @param {string} props.liftType - Lift to summarise (e.g. "Back Squat").
 */
export function LiftKeyStats({ liftType, className }) {
  const { parsedData, liftTypes, isLoading, isDemoMode } = useUserLiftingData();
  const { isMetric, bodyWeight, bodyWeightIsDefault } = useAthleteBio();
  const { getColor } = useLiftColors();
  const liftColor = getColor(liftType);
  const e1rmFormula =
    useReadLocalStorage(LOCAL_STORAGE_KEYS.FORMULA, {
      initializeWithValue: false,
    }) ?? "Brzycki";

  const stats = useMemo(
    () => summarizeLift({ parsedData, liftTypes, liftType, isMetric, e1rmFormula }),
    [parsedData, liftTypes, liftType, isMetric, e1rmFormula],
  );

  if (isLoading && !stats) {
    return (
      <div className={cn("grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6", className)}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const unit = isMetric ? "kg" : "lb";
  const tiles = buildTiles({ stats, unit, bodyWeight, bodyWeightIsDefault, isMetric, liftType });

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {liftType} key numbers
        </span>
        {isDemoMode && <DemoModeBadge size="sm" />}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {tiles.map((tile, index) => (
          <StatTile key={tile.label} tile={tile} index={index} accent={liftColor} />
        ))}
      </div>
    </div>
  );
}

/**
 * One number tile. The coloured hairline along the top edge is the only place
 * the lift colour appears, which keeps six tiles side by side from becoming a
 * block of colour.
 */
function StatTile({ tile, index, accent }) {
  const Icon = tile.icon;
  const body = (
    <>
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-0.5 opacity-70"
        style={{ backgroundColor: tile.accent ?? accent }}
      />
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{tile.label}</span>
      </div>
      <div
        className={cn(
          "mt-1.5 text-2xl leading-none font-bold tracking-tight tabular-nums",
          tile.valueClassName,
        )}
      >
        {tile.value}
        {tile.suffix && (
          <span className="ml-0.5 text-sm font-semibold text-muted-foreground">
            {tile.suffix}
          </span>
        )}
      </div>
      <div className="mt-1.5 text-xs leading-snug text-muted-foreground">
        {tile.sub}
      </div>
    </>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: index * 0.05 }}
      className="relative overflow-hidden rounded-xl border bg-card p-3 shadow-sm transition-colors hover:bg-accent/40"
    >
      {tile.href ? (
        <Link href={tile.href} className="block focus-visible:outline-none">
          {body}
        </Link>
      ) : (
        body
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Derivation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Single pass over parsedData for one lift type, returning everything the strip
 * needs. Returns null when the lifter has no sets of this lift at all, so the
 * caller can hide the strip rather than render a row of zeroes.
 */
function summarizeLift({ parsedData, liftTypes, liftType, isMetric, e1rmFormula }) {
  if (!Array.isArray(parsedData) || parsedData.length === 0) return null;

  const today = formatDateToYmdLocal(new Date());
  const momentumStart = subtractDaysFromStr(today, MOMENTUM_WINDOW_DAYS);
  const priorStart = subtractDaysFromStr(today, MOMENTUM_WINDOW_DAYS * 2);
  const frequencyStart = subtractDaysFromStr(today, FREQUENCY_WINDOW_DAYS);

  const sessionDates = new Set();
  const recentSessionDates = new Set();
  let totalSets = 0;
  let totalReps = 0;
  let tonnage = 0;
  let bestE1RM = 0;
  let recentBestE1RM = 0;
  let priorBestE1RM = 0;
  let firstDate = null;
  let lastDate = null;

  for (const lift of parsedData) {
    if (lift.liftType !== liftType || lift.isGoal) continue;

    const { value: weight } = getDisplayWeight(lift, isMetric);
    const e1rm = estimateE1RM(lift.reps, weight, e1rmFormula);

    totalSets += 1;
    totalReps += lift.reps;
    tonnage += weight * lift.reps;
    sessionDates.add(lift.date);
    if (e1rm > bestE1RM) bestE1RM = e1rm;
    if (!firstDate || lift.date < firstDate) firstDate = lift.date;
    if (!lastDate || lift.date > lastDate) lastDate = lift.date;

    if (lift.date >= frequencyStart) recentSessionDates.add(lift.date);
    if (lift.date >= momentumStart) {
      if (e1rm > recentBestE1RM) recentBestE1RM = e1rm;
    } else if (lift.date >= priorStart) {
      if (e1rm > priorBestE1RM) priorBestE1RM = e1rm;
    }
  }

  if (totalSets === 0) return null;

  // Share of training is measured in sets rather than reps so a high-rep
  // accessory habit does not drown out heavy low-rep work on this lift.
  const allSets = Array.isArray(liftTypes)
    ? liftTypes.reduce((sum, entry) => sum + (entry.totalSets ?? 0), 0)
    : 0;

  return {
    totalSets,
    totalReps,
    tonnage,
    bestE1RM,
    recentBestE1RM,
    priorBestE1RM,
    firstDate,
    lastDate,
    sessionCount: sessionDates.size,
    recentSessionCount: recentSessionDates.size,
    daysSinceLast: lastDate ? daysBetweenYmd(lastDate, today) : null,
    shareOfSets: allSets > 0 ? totalSets / allSets : null,
  };
}

function buildTiles({ stats, unit, bodyWeight, bodyWeightIsDefault, isMetric, liftType }) {
  const tiles = [];

  // 1. Strength-to-bodyweight — the number lifters actually quote to each other.
  const bodyWeightDisplay =
    bodyWeight != null && !bodyWeightIsDefault
      ? getDisplayWeight({ weight: bodyWeight, unitType: isMetric ? "kg" : "lb" }, isMetric)
      : null;
  if (bodyWeightDisplay?.value > 0 && stats.bestE1RM > 0) {
    tiles.push({
      icon: Scale,
      label: "Bodyweight ratio",
      value: `${(stats.bestE1RM / bodyWeightDisplay.value).toFixed(2)}`,
      suffix: "×",
      sub: `Best est. 1RM vs ${Math.round(bodyWeightDisplay.value)}${unit} bodyweight`,
    });
  } else {
    tiles.push({
      icon: Scale,
      label: "Best est. 1RM",
      value: formatWeight(stats.bestE1RM),
      suffix: unit,
      sub: "Set your bodyweight to see the ratio",
    });
  }

  // 2. Momentum — the page had plenty of history but nothing that said
  //    "and right now you are going up".
  tiles.push(buildMomentumTile(stats, unit));

  // 3. Frequency.
  const perWeek = (stats.recentSessionCount / (FREQUENCY_WINDOW_DAYS / 7)).toFixed(1);
  tiles.push({
    icon: Repeat,
    label: "Frequency",
    value: perWeek,
    suffix: "/wk",
    sub:
      stats.recentSessionCount > 0
        ? `${stats.recentSessionCount} sessions in the last 12 weeks`
        : "No sessions in the last 12 weeks",
  });

  // 4. Last trained.
  tiles.push({
    icon: CalendarClock,
    label: "Last trained",
    value: formatDaysSince(stats.daysSinceLast),
    sub: stats.lastDate ? getReadableDateString(stats.lastDate) : "—",
    href: stats.lastDate ? `/log?date=${stats.lastDate}` : undefined,
  });

  // 5. Lifetime volume.
  tiles.push({
    icon: Layers,
    label: "Lifetime volume",
    value: formatCompactNumber(stats.tonnage),
    suffix: unit,
    sub: `${stats.totalReps.toLocaleString()} reps over ${stats.sessionCount.toLocaleString()} sessions`,
  });

  // 6. Share of training.
  tiles.push({
    icon: PieChart,
    label: "Share of training",
    value:
      stats.shareOfSets != null ? `${Math.round(stats.shareOfSets * 100)}` : "—",
    suffix: stats.shareOfSets != null ? "%" : undefined,
    sub: `${stats.totalSets.toLocaleString()} of your logged sets are ${liftType}`,
  });

  return tiles;
}

/**
 * Compares the best estimated 1RM in the last 90 days against the 90 days
 * before that. Two windows of equal length keeps the comparison honest even for
 * lifters who train sporadically.
 */
function buildMomentumTile(stats, unit) {
  const { recentBestE1RM, priorBestE1RM } = stats;

  if (recentBestE1RM === 0) {
    return {
      icon: Activity,
      label: "90-day momentum",
      value: "—",
      sub: "Nothing logged in the last 90 days",
    };
  }

  if (priorBestE1RM === 0) {
    return {
      icon: Activity,
      label: "90-day momentum",
      value: formatWeight(recentBestE1RM),
      suffix: unit,
      sub: "Best est. 1RM in the last 90 days",
    };
  }

  const delta = recentBestE1RM - priorBestE1RM;
  const pct = (delta / priorBestE1RM) * 100;
  const isUp = delta > 0.05;
  const isDown = delta < -0.05;

  return {
    icon: isDown ? TrendingDown : TrendingUp,
    label: "90-day momentum",
    value: `${isUp ? "+" : ""}${formatWeight(delta)}`,
    suffix: unit,
    valueClassName: isUp
      ? "text-green-600 dark:text-green-400"
      : isDown
        ? "text-amber-600 dark:text-amber-400"
        : undefined,
    accent: isUp ? "#22c55e" : isDown ? "#f59e0b" : undefined,
    sub: `${isUp ? "+" : ""}${pct.toFixed(1)}% on best est. 1RM vs the prior 90 days`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatWeight(value) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded)
    ? rounded.toLocaleString()
    : rounded.toFixed(1);
}

// Lifetime tonnage runs into the millions, which is unreadable in full.
function formatCompactNumber(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 10_000) return `${Math.round(value / 1000).toLocaleString()}k`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return Math.round(value).toLocaleString();
}

function formatDaysSince(days) {
  if (days == null) return "—";
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 60) return `${days}d ago`;
  if (days < 730) return `${Math.round(days / 30.44)}mo ago`;
  return `${(days / 365.25).toFixed(1)}yr ago`;
}

function daysBetweenYmd(startDate, endDate) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.max(
    0,
    Math.round((new Date(endDate) - new Date(startDate)) / msPerDay),
  );
}
