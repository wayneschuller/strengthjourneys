/**
 * ResultsCard
 *
 * Displays the StrengthCirclesChart + per-lift breakdown table + Kilgore category.
 * Shown on the right column (desktop) / below inputs (mobile).
 */

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StrengthCirclesChart } from "./strength-circles-chart";
import {
  getStrengthRatingForE1RM,
  STRENGTH_LEVEL_EMOJI,
} from "@/hooks/use-athlete-biodata";
import { getRatingBadgeVariant } from "@/lib/strength-level-ui";
import { UNIVERSES } from "@/lib/strength-circles/universe-percentiles";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { BarChart3 } from "lucide-react";

// ─── Ordinal suffix ───────────────────────────────────────────────────────────

function ordinal(n) {
  if (n === null || n === undefined) return "—";
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ─── Per-lift breakdown table ─────────────────────────────────────────────────

const LIFT_DISPLAY = {
  squat:    { label: "Back Squat",  emoji: "🏋️" },
  bench:    { label: "Bench Press", emoji: "💪" },
  deadlift: { label: "Deadlift",    emoji: "⛓️" },
};

function BreakdownTable({ lifts, activeUniverse, isMetric }) {
  const unit = isMetric ? "kg" : "lb";

  const rows = Object.entries(LIFT_DISPLAY)
    .map(([key, display]) => {
      const lift = lifts?.[key];
      if (!lift) return null;

      // Display weight: convert from kg if needed
      const displayWeight = isMetric
        ? Math.round(lift.e1rmKg)
        : Math.round(lift.e1rmKg * 2.2046);

      const rating = lift.standard
        ? getStrengthRatingForE1RM(lift.e1rmKg, lift.standard)
        : null;

      return {
        key,
        ...display,
        displayWeight,
        percentile: lift.percentiles?.[activeUniverse] ?? null,
        rating,
        standard: lift.standard,
      };
    })
    .filter(Boolean);

  if (rows.length === 0) return null;

  return (
    <div className="mt-4">
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Per-lift ({activeUniverse})
      </p>
      <div className="flex flex-col gap-1.5">
        {rows.map(({ key, label, emoji, displayWeight, percentile, rating }) => (
          <div
            key={key}
            className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-1.5 text-sm"
          >
            <div className="flex items-center gap-2">
              <span>{emoji}</span>
              <span className="font-medium">{label}</span>
              <span className="text-muted-foreground">
                {displayWeight}
                {unit}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {rating && (
                <Badge
                  variant={getRatingBadgeVariant(rating)}
                  className="hidden text-xs sm:inline-flex"
                >
                  {STRENGTH_LEVEL_EMOJI[rating]} {rating}
                </Badge>
              )}
              <span className="tabular-nums font-semibold">
                {ordinal(percentile)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Total badge ──────────────────────────────────────────────────────────────

function TotalBadge({ total, activeUniverse, isMetric }) {
  if (!total) return null;

  const displayTotal = isMetric
    ? Math.round(total.kg)
    : Math.round(total.kg * 2.2046);
  const unit = isMetric ? "kg" : "lb";
  const percentile = total.percentiles?.[activeUniverse];

  return (
    <div className="mt-3 flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">SBD Total</span>
        <span className="font-medium">
          {displayTotal}
          {unit}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-xs">
          {activeUniverse === "Powerlifting Culture"
            ? "vs powerlifters"
            : `vs ${activeUniverse.toLowerCase()}`}
        </span>
        <span className="tabular-nums text-base font-bold">
          {ordinal(percentile)}
        </span>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8 text-center text-muted-foreground">
      <BarChart3 className="h-10 w-10 opacity-25" />
      <div>
        <p className="text-sm font-medium">Enter at least one lift</p>
        <p className="text-xs">Your strength circles will appear here.</p>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * @param {{ results: import("@/lib/strength-circles/universe-percentiles").StrengthResults | null }} props
 */
export function ResultsCard({ results }) {
  const { isMetric } = useAthleteBio();
  const [activeUniverse, setActiveUniverse] = useState("Barbell Lifters");

  const hasAnyLift =
    results?.enteredCount > 0;

  // Aggregate percentiles for the active universe across all entered lifts
  // (used by the chart to show ring fills)
  const activePercentiles = {};
  if (hasAnyLift) {
    for (const universe of UNIVERSES) {
      const perLiftValues = ["squat", "bench", "deadlift"]
        .map((key) => results.lifts?.[key]?.percentiles?.[universe])
        .filter((v) => v !== null && v !== undefined);

      if (perLiftValues.length > 0) {
        // Average across entered lifts for the ring fill
        activePercentiles[universe] = Math.round(
          perLiftValues.reduce((a, b) => a + b, 0) / perLiftValues.length,
        );
      }
    }
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4" />
          Your Strength Circles
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        {hasAnyLift ? (
          <>
            <StrengthCirclesChart
              percentiles={activePercentiles}
              activeUniverse={activeUniverse}
              onUniverseChange={setActiveUniverse}
            />
            <TotalBadge
              total={results.total}
              activeUniverse={activeUniverse}
              isMetric={isMetric}
            />
            <BreakdownTable
              lifts={results.lifts}
              activeUniverse={activeUniverse}
              isMetric={isMetric}
            />
          </>
        ) : (
          <EmptyState />
        )}
      </CardContent>
    </Card>
  );
}
