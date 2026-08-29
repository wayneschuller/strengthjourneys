
/**
 * Summarizes one lift's long-term journey and links dated milestones back to
 * the session log so exploration can jump from aggregate insight to raw context.
 *
 * This card is the athlete's strength story for a single lift, so it leads with
 * narrative — how long they have been at it, how much they have moved — before
 * it gets to tables and charts. It addresses the reader as an athlete on
 * purpose: the numbers below belong to someone with a training history, not to
 * a dashboard.
 *
 * Rendered both at one third width (the Big Four guide pages) and full width
 * (Lift Explorer), so the internal grids use container queries rather than
 * viewport breakpoints.
 */
import { useEffect, useMemo } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { useReadLocalStorage } from "usehooks-ts";
import { CalendarClock, Layers, Scale, TrendingDown, TrendingUp } from "lucide-react";

import {
  getCelebrationEmoji,
  getDisplayWeight,
  findBestE1RM,
} from "@/lib/processing-utils";
import { getReadableDateString, parseYmdLocal } from "@/lib/date-utils";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { isBodyweightLoadLift } from "@/lib/estimate-e1rm";
import { summarizeLiftJourney, MOMENTUM_WINDOW_DAYS } from "@/lib/lift-journey-stats";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useLiftColors, LiftColorPicker } from "@/hooks/use-lift-colors";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { Skeleton } from "@/components/ui/skeleton";
import {
  buildLiftChronology,
  MiniLiftChronologyChart,
} from "@/components/mini-lift-chronology-chart";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DemoModeBadge } from "@/components/demo-mode-badge";

function getLogHref(date) {
  return date ? `/log?date=${date}` : "/log";
}

// ─────────────────────────────────────────────────────────────────────────────
// Tier system
// Both minReps AND minYears must be met to reach a tier.
// ─────────────────────────────────────────────────────────────────────────────
// One tier per year 0–15, then 5-year jumps to 30.
// Reps thresholds track ~100% of a 2,000 reps/year pace, so a consistent
// lifter reaches the year-N tier's reps requirement at roughly year N.
const TIERS = [
  { name: "Baby",         minReps: 0,     minYears: 0,  icon: "🌱", bg: "bg-stone-100 dark:bg-stone-800",         text: "text-stone-500 dark:text-stone-400" },
  { name: "Initiate",     minReps: 300,   minYears: 1,  icon: "🌿", bg: "bg-green-50 dark:bg-green-950",          text: "text-green-700 dark:text-green-400" },
  { name: "Scout",        minReps: 1500,  minYears: 2,  icon: "💡", bg: "bg-teal-50 dark:bg-teal-950",            text: "text-teal-700 dark:text-teal-400" },
  { name: "Squire",       minReps: 3000,  minYears: 3,  icon: "🔧", bg: "bg-sky-100 dark:bg-sky-950",             text: "text-sky-700 dark:text-sky-400" },
  { name: "Warden",       minReps: 5000,  minYears: 4,  icon: "⚡", bg: "bg-blue-100 dark:bg-blue-950",           text: "text-blue-700 dark:text-blue-400" },
  { name: "Padawan",      minReps: 7000,  minYears: 5,  icon: "🎯", bg: "bg-indigo-100 dark:bg-indigo-950",       text: "text-indigo-700 dark:text-indigo-400" },
  { name: "Journeyman",   minReps: 9500,  minYears: 6,  icon: "🛤️", bg: "bg-violet-100 dark:bg-violet-950",       text: "text-violet-700 dark:text-violet-400" },
  { name: "Dedicated",    minReps: 12000, minYears: 7,  icon: "💪", bg: "bg-purple-100 dark:bg-purple-950",       text: "text-purple-700 dark:text-purple-400" },
  { name: "Veteran",      minReps: 14500, minYears: 8,  icon: "🎖️", bg: "bg-fuchsia-100 dark:bg-fuchsia-950",     text: "text-fuchsia-700 dark:text-fuchsia-400" },
  { name: "Predator",     minReps: 17000, minYears: 9,  icon: "⭐", bg: "bg-pink-100 dark:bg-pink-950",           text: "text-pink-700 dark:text-pink-400" },
  { name: "Paragon",      minReps: 19500, minYears: 10, icon: "🌟", bg: "bg-rose-100 dark:bg-rose-950",           text: "text-rose-700 dark:text-rose-400" },
  { name: "Jedimaster",   minReps: 22000, minYears: 11, icon: "🏆", bg: "bg-amber-100 dark:bg-amber-950",         text: "text-amber-700 dark:text-amber-400" },
  { name: "Terminator",   minReps: 24000, minYears: 12, icon: "👑", bg: "bg-amber-200 dark:bg-amber-900",         text: "text-amber-800 dark:text-amber-300" },
  { name: "Champion",     minReps: 26000, minYears: 13, icon: "🥇", bg: "bg-orange-100 dark:bg-orange-950",       text: "text-orange-700 dark:text-orange-400" },
  { name: "Luminary",     minReps: 28000, minYears: 14, icon: "✨", bg: "bg-orange-200 dark:bg-orange-900",       text: "text-orange-800 dark:text-orange-300" },
  { name: "Legend",       minReps: 30000, minYears: 15, icon: "🔱", bg: "bg-red-100 dark:bg-red-950",             text: "text-red-700 dark:text-red-400" },
  { name: "Titan",        minReps: 40000, minYears: 20, icon: "🏔️", bg: "bg-slate-700 dark:bg-slate-800",         text: "text-slate-100" },
  { name: "Immortal",     minReps: 50000, minYears: 25, icon: "🌌", bg: "bg-gray-800 dark:bg-gray-900",           text: "text-amber-300" },
  { name: "Eternal",      minReps: 60000, minYears: 30, icon: "🌠", bg: "bg-zinc-900 dark:bg-zinc-950",           text: "text-yellow-400" },
];


function computeTier(totalReps, yearsTraining) {
  let tier = TIERS[0];
  for (const t of TIERS) {
    if (totalReps >= t.minReps && yearsTraining >= t.minYears) {
      tier = t;
    }
  }
  return tier;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tier progress section
// ─────────────────────────────────────────────────────────────────────────────

function formatYears(years) {
  const y = Math.floor(years);
  const months = Math.round((years - y) * 12);
  if (months === 0 || y >= 10) return `${y} yr`;
  if (y === 0) return `${months} mo`;
  return `${y} yr ${months} mo`;
}

// Animated horizontal progress bar that fills from 0 to pct on mount using motion.
function ProgressBar({ pct, color, delay = 0.3 }) {
  const isDone = pct >= 1;
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
      <motion.div
        className="h-full rounded-full"
        style={{
          transformOrigin: "left",
          backgroundColor: isDone ? "#22c55e" : color,
          width: "100%",
        }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: Math.min(1, pct) }}
        transition={{ duration: 1.0, ease: "easeOut", delay }}
      />
    </div>
  );
}

// Shows reps and time progress bars toward the next tier, or a congratulations message at max tier.
function TierProgressSection({
  totalReps,
  yearsTraining,
  tier,
  liftType,
  liftColor,
}) {
  const currentIndex = TIERS.findIndex((t) => t.name === tier.name);
  const nextTier = TIERS[currentIndex + 1] ?? null;

  if (!nextTier) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        👑 You&apos;ve reached the highest tier for {liftType}!
      </p>
    );
  }

  const repsPct = nextTier.minReps > 0 ? totalReps / nextTier.minReps : 1;
  const yearsPct = nextTier.minYears > 0 ? yearsTraining / nextTier.minYears : 1;
  const repsNeeded = Math.max(0, nextTier.minReps - totalReps);
  const yearsNeeded = Math.max(0, nextTier.minYears - yearsTraining);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Next tier:</span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
            nextTier.bg,
            nextTier.text,
          )}
        >
          {nextTier.icon} {liftType} {nextTier.name}
        </span>
      </div>

      {/* Reps axis */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Reps &mdash; {totalReps.toLocaleString()} / {nextTier.minReps.toLocaleString()}
          </span>
          {repsPct >= 1 ? (
            <span className="font-medium text-green-600">✓ Done</span>
          ) : (
            <span className="text-muted-foreground">
              {repsNeeded.toLocaleString()} to go
            </span>
          )}
        </div>
        <ProgressBar pct={repsPct} color={liftColor} delay={0.3} />
      </div>

      {/* Years axis */}
      {nextTier.minYears > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Time &mdash; {formatYears(yearsTraining)} / {formatYears(nextTier.minYears)}
            </span>
            {yearsPct >= 1 ? (
              <span className="font-medium text-green-600">✓ Done</span>
            ) : (
              <span className="text-muted-foreground">
                {formatYears(yearsNeeded)} to go
              </span>
            )}
          </div>
          <ProgressBar pct={yearsPct} color={liftColor} delay={0.5} />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated donut ring
// ─────────────────────────────────────────────────────────────────────────────
// SVG donut ring that animates its fill arc from 0 to the target proportion on mount.

// ─────────────────────────────────────────────────────────────────────────────
// Main card
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Card summarizing a user's full history with a single lift: PR trio, E1RM estimate, experience
 * tier badge and progress, animated commitment rings, recent highlights, and heaviest session stats.
 *
 * @param {Object} props
 * @param {string} props.liftType - Display name of the lift (e.g. "Back Squat") to show the journey for.
 */
export function LiftJourneyCard({
  liftType,
  asCard = true,
  chartDensity = "default",
}) {
  const {
    parsedData,
    liftTypes,
    topLiftsByTypeAndReps,
    topTonnageByType,
    topTonnageByTypeLast12Months,
    isLoading,
    isDemoMode,
  } = useUserLiftingData();
  const { isMetric, bodyWeight, bodyWeightIsDefault } = useAthleteBio();
  const { getColor } = useLiftColors();
  const liftColor = getColor(liftType);
  const e1rmFormula =
    useReadLocalStorage(LOCAL_STORAGE_KEYS.FORMULA, {
      initializeWithValue: false,
    }) ?? "Brzycki";
  const usesBodyweightEstimate =
    isBodyweightLoadLift(liftType) && !bodyWeightIsDefault;

  // ── Derived data ─────────────────────────────────────────────────────────
  const liftEntry = liftTypes?.find((l) => l.liftType === liftType);
  const totalReps = liftEntry?.totalReps ?? 0;
  const oldestDate = liftEntry?.oldestDate;

  const topLiftsByReps = topLiftsByTypeAndReps?.[liftType];
  const oneRM = topLiftsByReps?.[0]?.[0];
  const threeRM = topLiftsByReps?.[2]?.[0];
  const fiveRM = topLiftsByReps?.[4]?.[0];

  const { bestLift, bestE1RMWeight } =
    (topLiftsByTypeAndReps
      ? findBestE1RM(liftType, topLiftsByTypeAndReps, e1rmFormula, {
          bodyWeight: bodyWeightIsDefault ? null : bodyWeight,
          bodyWeightUnitType: isMetric ? "kg" : "lb",
        })
      : null) ?? {};

  const heaviestSession = topTonnageByType?.[liftType]?.[0];
  const heaviestLast12 = topTonnageByTypeLast12Months?.[liftType]?.[0];
  const showHeaviestLast12 =
    heaviestLast12 &&
    heaviestSession &&
    (heaviestLast12.date !== heaviestSession.date ||
      heaviestLast12.tonnage !== heaviestSession.tonnage);

  // ── Athlete story numbers ────────────────────────────────────────────────
  // One pass over parsedData for the lifetime and momentum figures the PR
  // tables and tier bars cannot express.
  const journey = useMemo(
    () =>
      summarizeLiftJourney({ parsedData, liftType, isMetric, e1rmFormula }),
    [parsedData, liftType, isMetric, e1rmFormula],
  );

  // ── Tier ─────────────────────────────────────────────────────────────────
  const yearsTraining = oldestDate
    ? (new Date() - new Date(oldestDate)) / (365.25 * 24 * 60 * 60 * 1000)
    : 0;
  const tier = computeTier(totalReps, yearsTraining);

  // ── Reps chronology ──────────────────────────────────────────────────────
  const chronology = buildLiftChronology(
    parsedData,
    liftType,
    chartDensity === "dense"
      ? {
          targetBars: 24,
          minBars: 18,
          maxBars: 52,
          preferHigherResolution: true,
        }
      : 10,
    isMetric,
  );

  // ── Recent highlights (last 4 weeks) ─────────────────────────────────────
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const oneMonthAgoStr = oneMonthAgo.toISOString().slice(0, 10);
  const recentHighlights = topLiftsByReps
    ?.flatMap((repRange, repIndex) =>
      repRange.map((entry, entryIndex) => ({ ...entry, repIndex, entryIndex })),
    )
    .filter((e) => e.date >= oneMonthAgoStr)
    .sort((a, b) => a.entryIndex - b.entryIndex)
    .slice(0, 8);

  // ── Display helpers ───────────────────────────────────────────────────────
  const e1rmDisplay =
    bestLift && bestE1RMWeight != null
      ? getDisplayWeight(
          { weight: bestE1RMWeight, unitType: bestLift.unitType },
          isMetric,
        )
      : null;
  const bestLiftDisplay = bestLift ? getDisplayWeight(bestLift, isMetric) : null;
  const heaviestSessionDisplay = heaviestSession
    ? getDisplayWeight(
        { weight: heaviestSession.tonnage, unitType: heaviestSession.unitType },
        isMetric,
      )
    : null;
  const heaviestLast12Display = heaviestLast12
    ? getDisplayWeight(
        { weight: heaviestLast12.tonnage, unitType: heaviestLast12.unitType },
        isMetric,
      )
    : null;


  const prRecords = [
    { label: "Best Single", lift: oneRM },
    { label: "Best Triple", lift: threeRM },
    { label: "Best Five", lift: fiveRM },
  ];

  const Wrapper = asCard ? Card : "div";
  const feedbackContextId = `lift_journey_card_${liftType
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")}`;

  // Withheld until the data has landed: mid-load the counters all read zero,
  // and "log your first set" is the wrong thing to say to an athlete with
  // twelve years of history.
  const storyLine =
    isLoading || !liftTypes
      ? null
      : buildStoryLine({
          liftType,
          firstDate: journey?.firstDate ?? oldestDate,
          yearsTraining,
          sessionCount: journey?.sessionCount ?? 0,
          totalReps,
        });

  return (
    <Wrapper className={asCard ? "min-h-[300px] overflow-hidden" : undefined}>
      {/* Hero band. The lift colour wash gives each of the four lifts its own
          identity at a glance without recolouring the whole card. */}
      <CardHeader className="relative overflow-hidden border-b px-4 pt-5 pb-4 sm:px-6">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07]"
          style={{
            background: `linear-gradient(135deg, ${liftColor} 0%, transparent 62%)`,
          }}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-1"
          style={{ backgroundColor: liftColor }}
        />

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                Athlete journey
              </span>
              {isDemoMode && <DemoModeBadge size="sm" />}
            </div>
            <h2 className="mt-1 text-2xl leading-none font-semibold tracking-tight">
              My {liftType} Journey
            </h2>
          </div>

          {!isLoading && totalReps > 0 && (
            <motion.span
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.15 }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold shadow-sm",
                tier.bg,
                tier.text,
              )}
            >
              {tier.icon} {liftType} {tier.name}
            </motion.span>
          )}
        </div>

        {storyLine ? (
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            {storyLine}
          </p>
        ) : (
          <Skeleton className="mt-2 h-4 w-64 max-w-full" />
        )}

        {/* The estimated 1RM is the headline of the whole story, so it is the
            largest thing on the card rather than a line of body copy. */}
        {bestLift && e1rmDisplay && (
          <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-1">
            <div>
              <div
                className="text-4xl leading-none font-bold tracking-tight tabular-nums sm:text-5xl"
                style={{ color: liftColor }}
              >
                <CountUp value={e1rmDisplay.value} />
                <span className="text-xl font-semibold sm:text-2xl">
                  {e1rmDisplay.unit}
                </span>
              </div>
              <div className="mt-1.5 text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                {usesBodyweightEstimate
                  ? "Estimated added-load 1RM"
                  : "Estimated 1RM"}
              </div>
            </div>
            <p className="pb-1 text-xs text-muted-foreground">
              based on{" "}
              <Link
                href={getLogHref(bestLift.date)}
                className="font-medium text-foreground underline decoration-dotted underline-offset-2 transition-colors hover:text-primary"
              >
                {bestLift.reps}@{bestLiftDisplay.value}
                {bestLiftDisplay.unit} ({getReadableDateString(bestLift.date)},{" "}
                {e1rmFormula})
              </Link>
            </p>
          </div>
        )}

        {isDemoMode && (
          <p className="mt-3 text-sm text-muted-foreground italic">
            This is sample data. Sign in with Google and connect your sheet to
            see your own numbers.
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-6 px-2 sm:px-6">
        {isLoading || !liftTypes || !topLiftsByTypeAndReps ? (
          <Skeleton className="h-[260px] w-full" />
        ) : (
          <>
            {/* Athlete vitals: the four numbers that describe the shape of this
                lift right now, rather than its all-time bests. */}
            <JourneyVitals
              journey={journey}
              liftType={liftType}
              liftColor={liftColor}
              bestE1RM={e1rmDisplay?.value ?? null}
              unit={e1rmDisplay?.unit ?? (isMetric ? "kg" : "lb")}
              bodyWeight={bodyWeight}
              bodyWeightIsDefault={bodyWeightIsDefault}
              isMetric={isMetric}
            />

            {/* PR Trio */}
            {prRecords.some((r) => r.lift) && (
              <div className="grid grid-cols-3 gap-3">
                {prRecords.map(({ label, lift: prLift }) => {
                  if (!prLift) return null;
                  const w = getDisplayWeight(prLift, isMetric);
                  return (
                    <Link
                      key={label}
                      href={getLogHref(prLift.date)}
                      className="rounded-lg border bg-card p-3 text-center block transition-colors hover:bg-muted/50"
                      style={{ borderTopWidth: 3, borderTopColor: liftColor }}
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        {label}
                      </div>
                      <div className="mt-1 text-2xl font-bold">
                        {w.value}
                        <span className="text-sm font-normal">{w.unit}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {getReadableDateString(prLift.date)}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Tier progress */}
            {totalReps > 0 && (
              <TierProgressSection
                totalReps={totalReps}
                yearsTraining={yearsTraining}
                tier={tier}
                liftType={liftType}
                liftColor={liftColor}
              />
            )}


            {/* Reps over time */}
            <MiniLiftChronologyChart
              liftType={liftType}
              color={liftColor}
              chronology={chronology}
              density={chartDensity}
            />

            {/* Recent highlights */}
            {recentHighlights && recentHighlights.length > 0 && (
              <div>
                <div className="mb-2 text-sm font-semibold">
                  Recent Highlights{" "}
                  <span className="font-normal text-muted-foreground">
                    (last 4 weeks)
                  </span>
                </div>
                <div className="space-y-0.5">
                  {recentHighlights.map((entry, i) => {
                    const w = getDisplayWeight(entry, isMetric);
                    return (
                      <Link
                        key={i}
                        href={getLogHref(entry.date)}
                        className="flex items-center gap-3 rounded px-2 py-1 text-sm transition-colors even:bg-muted/40 hover:bg-muted/70"
                      >
                        <span className="w-24 shrink-0 font-mono font-medium">
                          {entry.reps}@{w.value}
                          {w.unit}
                        </span>
                        <span className="w-16 shrink-0 text-muted-foreground">
                          {getReadableDateString(entry.date)}
                        </span>
                        <span className="flex-1 text-muted-foreground">
                          {getCelebrationEmoji(entry.entryIndex)}{" "}
                          <span className="font-medium text-foreground">
                            #{entry.entryIndex + 1} best {entry.reps}RM
                          </span>{" "}
                          ever
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Heaviest session stats */}
            {(heaviestSession || showHeaviestLast12) && (
              <div className="space-y-0.5 text-sm text-muted-foreground">
                {heaviestSession && heaviestSessionDisplay && (
                  <Link
                    href={getLogHref(heaviestSession.date)}
                    className="block rounded px-2 py-1 transition-colors hover:bg-muted/50"
                  >
                    Heaviest session:{" "}
                    <span className="font-medium text-foreground">
                      {Math.round(heaviestSessionDisplay.value).toLocaleString()}
                      {heaviestSessionDisplay.unit}
                    </span>{" "}
                    ({getReadableDateString(heaviestSession.date)})
                  </Link>
                )}
                {showHeaviestLast12 && heaviestLast12Display && (
                  <Link
                    href={getLogHref(heaviestLast12.date)}
                    className="block rounded px-2 py-1 transition-colors hover:bg-muted/50"
                  >
                    Heaviest (last 12 months):{" "}
                    <span className="font-medium text-foreground">
                      {Math.round(heaviestLast12Display.value).toLocaleString()}
                      {heaviestLast12Display.unit}
                    </span>{" "}
                    ({getReadableDateString(heaviestLast12.date)})
                  </Link>
                )}
              </div>
            )}

            {/* Color picker */}
            <div>
              <LiftColorPicker liftType={liftType} />
            </div>

          </>
        )}
      </CardContent>
    </Wrapper>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Athlete vitals
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Four numbers describing the current shape of the athlete's relationship with
 * this lift — as opposed to the PR trio above, which is all-time bests.
 *
 * Laid out with container queries because this card renders at roughly a third
 * of the page on the Big Four guides and at full width in Lift Explorer; a
 * viewport breakpoint would get one of those two wrong.
 *
 * @param {Object} props
 * @param {Object|null} props.journey - Output of summarizeLiftJourney().
 * @param {number|null} props.bestE1RM - Best estimated 1RM in display units.
 * @param {string} props.unit - Display unit label ("kg" / "lb").
 */
function JourneyVitals({
  journey,
  liftType,
  liftColor,
  bestE1RM,
  unit,
  bodyWeight,
  bodyWeightIsDefault,
  isMetric,
}) {
  if (!journey) return null;

  const vitals = [];

  // Strength-to-bodyweight is the number lifters actually quote to each other,
  // but it is nonsense for lifts whose E1RM is added load on top of bodyweight.
  if (!isBodyweightLoadLift(liftType)) {
    const bw =
      bodyWeight != null && !bodyWeightIsDefault
        ? getDisplayWeight(
            { weight: bodyWeight, unitType: isMetric ? "kg" : "lb" },
            isMetric,
          )
        : null;

    vitals.push(
      bw?.value > 0 && bestE1RM > 0
        ? {
            icon: Scale,
            label: "Bodyweight ratio",
            value: (bestE1RM / bw.value).toFixed(2),
            suffix: "×",
            sub: `of ${Math.round(bw.value)}${unit} bodyweight`,
          }
        : {
            icon: Scale,
            label: "Bodyweight ratio",
            value: "—",
            sub: "Add your bodyweight to unlock this",
            muted: true,
          },
    );
  }

  vitals.push(buildMomentumVital(journey, unit));

  vitals.push({
    icon: CalendarClock,
    label: "Last trained",
    value: formatDaysSince(journey.daysSinceLast),
    sub: journey.lastDate ? getReadableDateString(journey.lastDate) : "—",
    href: journey.lastDate ? getLogHref(journey.lastDate) : null,
  });

  vitals.push({
    icon: Layers,
    label: "Lifetime volume",
    value: formatCompactNumber(journey.tonnage),
    suffix: unit,
    sub: `moved across ${journey.totalSets.toLocaleString()} sets`,
  });

  return (
    <div className="@container">
      <div className="grid grid-cols-2 gap-2 @2xl:grid-cols-4">
        {vitals.map((vital, index) => (
          <VitalTile
            key={vital.label}
            vital={vital}
            index={index}
            accent={liftColor}
          />
        ))}
      </div>
    </div>
  );
}

function VitalTile({ vital, index, accent }) {
  const Icon = vital.icon;
  const body = (
    <>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{vital.label}</span>
      </div>
      <div
        className={cn(
          "mt-1 text-xl leading-none font-bold tracking-tight tabular-nums",
          vital.muted && "text-muted-foreground",
          vital.valueClassName,
        )}
      >
        {vital.value}
        {vital.suffix && (
          <span className="ml-0.5 text-sm font-semibold text-muted-foreground">
            {vital.suffix}
          </span>
        )}
      </div>
      <div className="mt-1 text-[11px] leading-snug text-muted-foreground">
        {vital.sub}
      </div>
    </>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: index * 0.06 }}
      className="relative overflow-hidden rounded-lg bg-muted/40 p-2.5"
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-0.5 opacity-70"
        style={{ backgroundColor: vital.accent ?? accent }}
      />
      {vital.href ? (
        <Link href={vital.href} className="block">
          {body}
        </Link>
      ) : (
        body
      )}
    </motion.div>
  );
}

/**
 * Best estimated 1RM in the last 90 days against the 90 days before that.
 * A gentle decline is deliberately amber rather than red — deloads, rehab and
 * off-season blocks are not failures.
 */
function buildMomentumVital(journey, unit) {
  const { recentBestE1RM, priorBestE1RM } = journey;
  const label = `${MOMENTUM_WINDOW_DAYS}-day momentum`;

  if (recentBestE1RM === 0) {
    return {
      icon: TrendingUp,
      label,
      value: "—",
      sub: `Nothing logged in ${MOMENTUM_WINDOW_DAYS} days`,
      muted: true,
    };
  }

  if (priorBestE1RM === 0) {
    return {
      icon: TrendingUp,
      label,
      value: formatWeight(recentBestE1RM),
      suffix: unit,
      sub: "Best est. 1RM in this window",
    };
  }

  const delta = recentBestE1RM - priorBestE1RM;
  const pct = (delta / priorBestE1RM) * 100;
  const isUp = delta > 0.05;
  const isDown = delta < -0.05;

  return {
    icon: isDown ? TrendingDown : TrendingUp,
    label,
    value: `${isUp ? "+" : ""}${formatWeight(delta)}`,
    suffix: unit,
    valueClassName: isUp
      ? "text-green-600 dark:text-green-400"
      : isDown
        ? "text-amber-600 dark:text-amber-400"
        : undefined,
    accent: isUp ? "#22c55e" : isDown ? "#f59e0b" : undefined,
    sub: isUp || isDown
      ? `${isUp ? "+" : ""}${pct.toFixed(1)}% vs the prior ${MOMENTUM_WINDOW_DAYS} days`
      : `Holding steady vs the prior ${MOMENTUM_WINDOW_DAYS} days`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Story line
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One sentence of narrative under the card title. This is the line that is
 * meant to make the numbers underneath feel like a history rather than a
 * readout, so it names the athlete's start date and the scale of the work.
 */
function buildStoryLine({ liftType, firstDate, yearsTraining, sessionCount, totalReps }) {
  if (!firstDate || totalReps === 0) {
    return `Log your first ${liftType} set and this athlete journey starts here.`;
  }

  const parts = [`Athlete of the ${liftType} since ${formatMonthYear(firstDate)}`];
  const detail = [];
  if (yearsTraining > 0) detail.push(formatYears(yearsTraining));
  if (sessionCount > 0) detail.push(`${sessionCount.toLocaleString()} sessions`);
  if (totalReps > 0) detail.push(`${totalReps.toLocaleString()} reps`);

  return `${parts[0]} — ${detail.join(", ")}.`;
}

function formatMonthYear(dateStr) {
  const date = parseYmdLocal(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting + animation helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Counts a number up from zero on mount, without re-rendering the card on every
 * frame — this card sits above a Recharts chronology chart and a page of other
 * charts, so a 60fps setState here would be felt.
 */
function CountUp({ value, decimals = 1 }) {
  const prefersReducedMotion = useReducedMotion();
  const motionValue = useMotionValue(prefersReducedMotion ? value : 0);
  const text = useTransform(motionValue, (latest) => formatWeight(latest, decimals));

  useEffect(() => {
    if (prefersReducedMotion) {
      motionValue.set(value);
      return;
    }
    const controls = animate(motionValue, value, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
    });
    return () => controls.stop();
  }, [value, motionValue, prefersReducedMotion]);

  return <motion.span>{text}</motion.span>;
}

function formatWeight(value, decimals = 1) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded)
    ? rounded.toLocaleString()
    : rounded.toFixed(decimals);
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
