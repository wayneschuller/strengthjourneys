/** @format */

"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useLocalStorage } from "usehooks-ts";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { estimateE1RM } from "@/lib/estimate-e1rm";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const bigFourDiagrams = {
  "Back Squat": "/back_squat.svg",
  "Bench Press": "/bench_press.svg",
  Deadlift: "/deadlift.svg",
  "Strict Press": "/strict_press.svg",
};

const formatLiftDate = (dateStr) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export function BigFourLiftCards({ lifts }) {
  const { topLiftsByTypeAndReps, liftTypes } = useUserLiftingData() || {};
  const [e1rmFormula] = useLocalStorage(LOCAL_STORAGE_KEYS.FORMULA, "Brzycki", {
    initializeWithValue: false,
  });
  const { status: authStatus } = useSession();
  const [statsVisible, setStatsVisible] = useState(false);

  const getStatsForLift = (liftType) => {
    if (!topLiftsByTypeAndReps || !topLiftsByTypeAndReps[liftType]) return null;

    const repRanges = topLiftsByTypeAndReps[liftType];
    let bestE1RMWeight = 0;
    let bestLift = null;
    let unitType = "lb";

    // Mirror the barbell-strength-potential "best lift" logic:
    // scan rep ranges 1–10 and pick the set with highest estimated 1RM
    for (let repsIndex = 0; repsIndex < 10; repsIndex++) {
      const topAtReps = repRanges[repsIndex]?.[0];
      if (!topAtReps) continue;

      const reps = repsIndex + 1;
      const currentE1RM = estimateE1RM(reps, topAtReps.weight, e1rmFormula);

      if (currentE1RM > bestE1RMWeight) {
        bestE1RMWeight = currentE1RM;
        bestLift = topAtReps;
      }

      if (topAtReps.unitType) {
        unitType = topAtReps.unitType;
      }
    }

    const liftTotals = liftTypes?.find((lift) => lift.liftType === liftType);

    return {
      bestLift,
      unitType,
      totalSets: liftTotals?.totalSets ?? 0,
      totalReps: liftTotals?.totalReps ?? 0,
    };
  };

  // Let stats gently fade in after the hero/home slider transition.
  // Hard-coded delay to line up with the 800ms hero animation.
  useEffect(() => {
    if (authStatus === "authenticated" && topLiftsByTypeAndReps) {
      const timeoutId = setTimeout(() => {
        setStatsVisible(true);
      }, 1400);
      return () => clearTimeout(timeoutId);
    }
    setStatsVisible(false);
  }, [authStatus, topLiftsByTypeAndReps]);

  return (
    <div className="grid grid-cols-2 gap-6 md:grid-cols-2 lg:grid-cols-4">
      {lifts.map((lift) => {
        const stats = getStatsForLift(lift.liftType);
        const hasAnyData =
          stats && (stats.totalSets > 0 || stats.totalReps > 0 || stats.bestLift);
        const isStatsMode = authStatus === "authenticated" && hasAnyData;

        return (
          <Card
            key={lift.slug}
            className="group shadow-lg ring-0 ring-ring hover:ring-1"
          >
            <Link href={`/${lift.slug}`}>
              <CardHeader className="min-h-28">
                <CardTitle>{lift.liftType}</CardTitle>
                <div className="relative min-h-8">
                  {/* Base description (for guests / non-stats mode). Hidden visually when stats overlay is active. */}
                  <CardDescription
                    className={
                      isStatsMode
                        ? "h-8 opacity-0 transition-opacity duration-300"
                        : "h-8"
                    }
                  >
                    {lift.liftDescription}
                  </CardDescription>

                  {/* Stats overlay that fades in on top for authenticated users with data */}
                  {isStatsMode && stats && (
                    <div
                      className={`pointer-events-none absolute inset-0 flex flex-col justify-center text-sm text-muted-foreground transition-opacity duration-500 ${
                        statsVisible ? "opacity-100" : "opacity-0"
                      }`}
                    >
                      {(stats.totalSets > 0 || stats.totalReps > 0) && (
                        <span>
                          {stats.totalSets.toLocaleString()} sets ·{" "}
                          {stats.totalReps.toLocaleString()} reps logged
                        </span>
                      )}
                      {stats.bestLift && (
                        <span className="block">
                          Best set: {stats.bestLift.reps}@{stats.bestLift.weight}
                          {stats.bestLift.unitType || stats.unitType}
                          {stats.bestLift.date && (
                            <> on {formatLiftDate(stats.bestLift.date)}</>
                          )}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex justify-center p-2">
                <img
                  src={bigFourDiagrams[lift.liftType]}
                  alt={`${lift.liftType} diagram`}
                  className="h-36 w-36 object-contain transition-transform group-hover:scale-110"
                />
              </CardContent>
            </Link>
          </Card>
        );
      })}
    </div>
  );
}

