"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { useSession } from "next-auth/react";
import { useReadLocalStorage } from "usehooks-ts";

import {
  getCelebrationEmoji,
  getDisplayWeight,
  getReadableDateString,
  findBestE1RM,
} from "@/lib/processing-utils";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useLiftColors, LiftColorPicker } from "@/hooks/use-lift-colors";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Tier system
// Both minReps AND minYears must be met to reach a tier.
// ─────────────────────────────────────────────────────────────────────────────
// One tier per year 0–15, then 5-year jumps to 30.
// Reps thresholds are ~75% of what a 2,000 reps/year lifter accumulates by
// that year, so dedicated lifters clear reps before years at higher tiers.
const TIERS = [
  { name: "Initiate",     minReps: 0,     minYears: 0,  icon: "🌱", bg: "bg-stone-100 dark:bg-stone-800",         text: "text-stone-500 dark:text-stone-400" },
  { name: "Wanderer",     minReps: 200,   minYears: 1,  icon: "🌿", bg: "bg-green-50 dark:bg-green-950",          text: "text-green-700 dark:text-green-400" },
  { name: "Scout",        minReps: 800,   minYears: 2,  icon: "💡", bg: "bg-teal-50 dark:bg-teal-950",            text: "text-teal-700 dark:text-teal-400" },
  { name: "Squire",       minReps: 1500,  minYears: 3,  icon: "🔧", bg: "bg-sky-100 dark:bg-sky-950",             text: "text-sky-700 dark:text-sky-400" },
  { name: "Warden",       minReps: 2500,  minYears: 4,  icon: "⚡", bg: "bg-blue-100 dark:bg-blue-950",           text: "text-blue-700 dark:text-blue-400" },
  { name: "Padawan",      minReps: 4000,  minYears: 5,  icon: "🎯", bg: "bg-indigo-100 dark:bg-indigo-950",       text: "text-indigo-700 dark:text-indigo-400" },
  { name: "Journeyman",   minReps: 5500,  minYears: 6,  icon: "🛤️", bg: "bg-violet-100 dark:bg-violet-950",       text: "text-violet-700 dark:text-violet-400" },
  { name: "Dedicated",    minReps: 7500,  minYears: 7,  icon: "💪", bg: "bg-purple-100 dark:bg-purple-950",       text: "text-purple-700 dark:text-purple-400" },
  { name: "Veteran",      minReps: 9500,  minYears: 8,  icon: "🎖️", bg: "bg-fuchsia-100 dark:bg-fuchsia-950",     text: "text-fuchsia-700 dark:text-fuchsia-400" },
  { name: "Vanguard",     minReps: 11500, minYears: 9,  icon: "⭐", bg: "bg-pink-100 dark:bg-pink-950",           text: "text-pink-700 dark:text-pink-400" },
  { name: "Paragon",      minReps: 14000, minYears: 10, icon: "🌟", bg: "bg-rose-100 dark:bg-rose-950",           text: "text-rose-700 dark:text-rose-400" },
  { name: "Jedimaster",   minReps: 16500, minYears: 11, icon: "🏆", bg: "bg-amber-100 dark:bg-amber-950",         text: "text-amber-700 dark:text-amber-400" },
  { name: "Crownbearer",  minReps: 19000, minYears: 12, icon: "👑", bg: "bg-amber-200 dark:bg-amber-900",         text: "text-amber-800 dark:text-amber-300" },
  { name: "Champion",     minReps: 21500, minYears: 13, icon: "🥇", bg: "bg-orange-100 dark:bg-orange-950",       text: "text-orange-700 dark:text-orange-400" },
  { name: "Luminary",     minReps: 24000, minYears: 14, icon: "✨", bg: "bg-orange-200 dark:bg-orange-900",       text: "text-orange-800 dark:text-orange-300" },
  { name: "Legend",       minReps: 27000, minYears: 15, icon: "🔱", bg: "bg-red-100 dark:bg-red-950",             text: "text-red-700 dark:text-red-400" },
  { name: "Titan",        minReps: 35000, minYears: 20, icon: "🏔️", bg: "bg-slate-700 dark:bg-slate-800",         text: "text-slate-100" },
  { name: "Immortal",     minReps: 44000, minYears: 25, icon: "🌌", bg: "bg-gray-800 dark:bg-gray-900",           text: "text-amber-300" },
  { name: "Eternal",      minReps: 53000, minYears: 30, icon: "🌠", bg: "bg-zinc-900 dark:bg-zinc-950",           text: "text-yellow-400" },
];

// Rings fill to 100% at the Legend threshold; higher tiers show a full ring.
const RING_MAX_REPS = 27000;
const RING_MAX_SETS = 5400;

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
function ProgressBar({ pct, color, isMounted, delay = 0.3 }) {
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
        animate={isMounted ? { scaleX: Math.min(1, pct) } : { scaleX: 0 }}
        transition={{ duration: 1.0, ease: "easeOut", delay }}
      />
    </div>
  );
}

// Shows reps and time progress bars toward the next tier, or a congratulations message at max tier.
function TierProgressSection({ totalReps, yearsTraining, tier, liftType, liftColor, isMounted }) {
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
        <ProgressBar pct={repsPct} color={liftColor} isMounted={isMounted} delay={0.3} />
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
          <ProgressBar pct={yearsPct} color={liftColor} isMounted={isMounted} delay={0.5} />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated donut ring
// ─────────────────────────────────────────────────────────────────────────────
// SVG donut ring that animates its fill arc from 0 to the target proportion on mount.
function StatRing({ value, fill, label, color, isMounted }) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const targetOffset = circumference * (1 - Math.min(1, fill));

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-24 w-24">
        <svg
          width="96"
          height="96"
          viewBox="0 0 96 96"
          className="-rotate-90"
          aria-hidden="true"
        >
          {/* Track */}
          <circle
            cx="48"
            cy="48"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-muted/25"
          />
          {/* Animated fill */}
          <motion.circle
            cx="48"
            cy="48"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={
              isMounted
                ? { strokeDashoffset: targetOffset }
                : { strokeDashoffset: circumference }
            }
            transition={{ duration: 1.4, ease: "easeOut", delay: 0.2 }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-base font-bold leading-tight">
            {value >= 10000
              ? `${(value / 1000).toFixed(0)}K`
              : value.toLocaleString()}
          </span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

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
export function LiftJourneyCard({ liftType, asCard = true }) {
  const { status: authStatus } = useSession();
  const {
    liftTypes,
    topLiftsByTypeAndReps,
    topTonnageByType,
    topTonnageByTypeLast12Months,
    isLoading,
  } = useUserLiftingData();
  const { isMetric } = useAthleteBio();
  const { getColor } = useLiftColors();
  const liftColor = getColor(liftType);
  const e1rmFormula =
    useReadLocalStorage(LOCAL_STORAGE_KEYS.FORMULA, {
      initializeWithValue: false,
    }) ?? "Brzycki";

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ── Derived data ─────────────────────────────────────────────────────────
  const liftEntry = liftTypes?.find((l) => l.liftType === liftType);
  const totalReps = liftEntry?.totalReps ?? 0;
  const totalSets = liftEntry?.totalSets ?? 0;
  const oldestDate = liftEntry?.oldestDate;

  const topLiftsByReps = topLiftsByTypeAndReps?.[liftType];
  const oneRM = topLiftsByReps?.[0]?.[0];
  const threeRM = topLiftsByReps?.[2]?.[0];
  const fiveRM = topLiftsByReps?.[4]?.[0];

  const { bestLift, bestE1RMWeight } =
    (topLiftsByTypeAndReps
      ? findBestE1RM(liftType, topLiftsByTypeAndReps, e1rmFormula)
      : null) ?? {};

  const heaviestSession = topTonnageByType?.[liftType]?.[0];
  const heaviestLast12 = topTonnageByTypeLast12Months?.[liftType]?.[0];
  const showHeaviestLast12 =
    heaviestLast12 &&
    heaviestSession &&
    (heaviestLast12.date !== heaviestSession.date ||
      heaviestLast12.tonnage !== heaviestSession.tonnage);

  // ── Tier ─────────────────────────────────────────────────────────────────
  const yearsTraining = oldestDate
    ? (new Date() - new Date(oldestDate)) / (365.25 * 24 * 60 * 60 * 1000)
    : 0;
  const tier = computeTier(totalReps, yearsTraining);

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

  const repsFill = totalReps / RING_MAX_REPS;
  const setsFill = totalSets / RING_MAX_SETS;

  const prRecords = [
    { label: "Best Single", lift: oneRM },
    { label: "Best Triple", lift: threeRM },
    { label: "Best Five", lift: fiveRM },
  ];

  const Wrapper = asCard ? Card : "div";

  return (
    <Wrapper className={asCard ? "min-h-[300px]" : undefined}>
      <CardHeader className="px-4 pb-3 sm:px-6">
        {/* Title + tier badge */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2
            className="text-2xl font-semibold leading-none tracking-tight"
            style={{
              textDecoration: "underline",
              textDecorationColor: liftColor,
            }}
          >
            {authStatus !== "authenticated" && (
              <span className="mr-2 font-bold">Demo Mode:</span>
            )}
            My {liftType} Journey
          </h2>

          {!isLoading && totalReps > 0 && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold",
                tier.bg,
                tier.text,
              )}
            >
              {tier.icon} {liftType} {tier.name}
            </span>
          )}
        </div>

        {authStatus !== "authenticated" && (
          <p className="mt-2 text-sm italic text-muted-foreground">
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
            {/* PR Trio */}
            {prRecords.some((r) => r.lift) && (
              <div className="grid grid-cols-3 gap-3">
                {prRecords.map(({ label, lift: prLift }) => {
                  if (!prLift) return null;
                  const w = getDisplayWeight(prLift, isMetric);
                  return (
                    <Link
                      key={label}
                      href="#lift-prs"
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

            {/* E1RM estimate */}
            {bestLift && e1rmDisplay && (
              <p className="text-sm text-muted-foreground">
                Est. 1RM:{" "}
                <span className="font-semibold text-foreground">
                  {e1rmDisplay.value}
                  {e1rmDisplay.unit}
                </span>{" "}
                · based on {bestLift.reps}@{bestLiftDisplay.value}
                {bestLiftDisplay.unit} ({getReadableDateString(bestLift.date)},{" "}
                {e1rmFormula})
              </p>
            )}

            {/* Tier progress */}
            {totalReps > 0 && (
              <TierProgressSection
                totalReps={totalReps}
                yearsTraining={yearsTraining}
                tier={tier}
                liftType={liftType}
                liftColor={liftColor}
                isMounted={isMounted}
              />
            )}

            {/* Commitment rings */}
            {totalReps > 0 && (
              <div className="flex items-center justify-center gap-10 py-2">
                <StatRing
                  value={totalReps}
                  fill={repsFill}
                  label="Total Reps"
                  color={liftColor}
                  isMounted={isMounted}
                />
                <StatRing
                  value={totalSets}
                  fill={setsFill}
                  label="Total Sets"
                  color={liftColor}
                  isMounted={isMounted}
                />
              </div>
            )}

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
                      <div
                        key={i}
                        className="flex items-center gap-3 rounded px-2 py-1 text-sm even:bg-muted/40"
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
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Heaviest session stats */}
            {(heaviestSession || showHeaviestLast12) && (
              <div className="space-y-0.5 text-sm text-muted-foreground">
                {heaviestSession && heaviestSessionDisplay && (
                  <div>
                    Heaviest session:{" "}
                    <span className="font-medium text-foreground">
                      {Math.round(heaviestSessionDisplay.value).toLocaleString()}
                      {heaviestSessionDisplay.unit}
                    </span>{" "}
                    ({getReadableDateString(heaviestSession.date)})
                  </div>
                )}
                {showHeaviestLast12 && heaviestLast12Display && (
                  <div>
                    Heaviest (last 12 months):{" "}
                    <span className="font-medium text-foreground">
                      {Math.round(heaviestLast12Display.value).toLocaleString()}
                      {heaviestLast12Display.unit}
                    </span>{" "}
                    ({getReadableDateString(heaviestLast12.date)})
                  </div>
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
