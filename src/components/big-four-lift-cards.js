/** @format */

"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useLocalStorage } from "usehooks-ts";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { estimateE1RM } from "@/lib/estimate-e1rm";
import { getAverageLiftSessionTonnage } from "@/lib/processing-utils";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const bigFourDiagrams = {
  "Back Squat": "/back_squat.svg",
  "Bench Press": "/bench_press.svg",
  Deadlift: "/deadlift.svg",
  "Strict Press": "/strict_press.svg",
};

const STATS_STAGGER_MS = 360;

const RECENT_PR_WINDOW_DAYS = 60;

const computeLiftTonnageMeta = (parsedData, lifts) => {
  if (!parsedData || !parsedData.length || !lifts || !lifts.length) {
    return {
      liftTonnageMap: null,
      averageTonnage: 0,
      favoriteLiftType: null,
      leastFavoriteLiftType: null,
    };
  }

  const endDate = parsedData[parsedData.length - 1]?.date;
  if (!endDate) {
    return {
      liftTonnageMap: null,
      averageTonnage: 0,
      favoriteLiftType: null,
      leastFavoriteLiftType: null,
    };
  }

  const liftTonnageMap = {};

  // Compute per-lift average session tonnage over the rolling year window
  lifts.forEach((lift) => {
    const liftType = lift.liftType;
    if (!liftType || liftTonnageMap[liftType]) return; // skip duplicates

    const { average } = getAverageLiftSessionTonnage(
      parsedData,
      endDate,
      liftType,
    );

    liftTonnageMap[liftType] = { average };
  });

  const tonnageValues = Object.values(liftTonnageMap).map(
    (entry) => entry.average ?? 0,
  );

  if (!tonnageValues.length) {
    return {
      liftTonnageMap,
      averageTonnage: 0,
      favoriteLiftType: null,
      leastFavoriteLiftType: null,
    };
  }

  const averageTonnage =
    tonnageValues.reduce((sum, value) => sum + value, 0) / tonnageValues.length;

  let favoriteLiftType = null;
  let leastFavoriteLiftType = null;
  let maxTonnage = -Infinity;
  let minTonnage = Infinity;

  Object.entries(liftTonnageMap).forEach(([liftType, { average }]) => {
    const value = average ?? 0;
    if (value > maxTonnage) {
      maxTonnage = value;
      favoriteLiftType = liftType;
    }
    if (value < minTonnage) {
      minTonnage = value;
      leastFavoriteLiftType = liftType;
    }
  });

  return {
    liftTonnageMap,
    averageTonnage,
    favoriteLiftType,
    leastFavoriteLiftType,
  };
};

const hasRecentPRForLiftType = (liftType, topLiftsByTypeAndReps) => {
  if (!topLiftsByTypeAndReps || !topLiftsByTypeAndReps[liftType]) return false;

  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(today.getDate() - RECENT_PR_WINDOW_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10); // YYYY-MM-DD

  const repRanges = topLiftsByTypeAndReps[liftType];
  for (let repsIndex = 0; repsIndex < repRanges.length; repsIndex++) {
    const repArray = repRanges[repsIndex];
    if (!repArray || !repArray.length) continue;

    for (let i = 0; i < repArray.length; i++) {
      const pr = repArray[i];
      if (pr?.date && pr.date >= cutoffStr) {
        return true;
      }
    }
  }

  return false;
};

const buildBadgesForLiftType = (
  liftType,
  {
    topLiftsByTypeAndReps,
    liftTonnageMap,
    averageTonnage,
    favoriteLiftType,
    leastFavoriteLiftType,
  },
) => {
  const badges = [];

  if (hasRecentPRForLiftType(liftType, topLiftsByTypeAndReps)) {
    badges.push({
      type: "recent-pr",
      label: "🔥 Recent PR",
      shortLabel: "🔥 PR",
      variant: "secondary",
    });
  }

  const tonnageInfo = liftTonnageMap?.[liftType];
  if (
    tonnageInfo &&
    tonnageInfo.average > 0 &&
    tonnageInfo.average > averageTonnage
  ) {
    badges.push({
      type: "workhorse",
      label: "🛠 Workhorse",
      shortLabel: "🛠",
      variant: "outline",
    });
  }

  if (favoriteLiftType && liftType === favoriteLiftType) {
    badges.push({
      type: "favorite",
      label: "⭐ Favourite of the four",
      shortLabel: "⭐ Fav",
      variant: "secondary",
    });
  }

  if (leastFavoriteLiftType && liftType === leastFavoriteLiftType) {
    badges.push({
      type: "least-favorite",
      label: "💩 Least favourite",
      shortLabel: "💩 Least",
      variant: "destructive",
    });
  }

  return badges;
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

export function BigFourLiftCards({ lifts, animated = true }) {
  const { topLiftsByTypeAndReps, liftTypes, parsedData } =
    useUserLiftingData() || {};
  const [e1rmFormula] = useLocalStorage(LOCAL_STORAGE_KEYS.FORMULA, "Brzycki", {
    initializeWithValue: false,
  });
  const { status: authStatus } = useSession();
  const [statsVisibleCount, setStatsVisibleCount] = useState(0);

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

  // Stagger the description→stats fade per card, left to right.
  // Tied to the `animated` flag from the home page so the sequence
  // starts after the dashboard intro.
  useEffect(() => {
    if (
      authStatus === "authenticated" &&
      topLiftsByTypeAndReps &&
      animated
    ) {
      const timeouts = [0, 1, 2, 3].map((i) =>
        setTimeout(
          () => setStatsVisibleCount((c) => Math.max(c, i + 1)),
          i * STATS_STAGGER_MS,
        ),
      );
      return () => timeouts.forEach(clearTimeout);
    }
    setStatsVisibleCount(0);
  }, [authStatus, topLiftsByTypeAndReps, animated]);

  const {
    liftTonnageMap,
    averageTonnage,
    favoriteLiftType,
    leastFavoriteLiftType,
  } = computeLiftTonnageMeta(parsedData, lifts);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-4">
      {lifts.map((lift, index) => {
        const stats = getStatsForLift(lift.liftType);
        const hasAnyData =
          stats &&
          (stats.totalSets > 0 || stats.totalReps > 0 || stats.bestLift);
        const isStatsMode = authStatus === "authenticated" && hasAnyData;

        const badges =
          isStatsMode && topLiftsByTypeAndReps
            ? buildBadgesForLiftType(lift.liftType, {
                topLiftsByTypeAndReps,
                liftTonnageMap,
                averageTonnage,
                favoriteLiftType,
                leastFavoriteLiftType,
              })
            : [];

        const showStats = statsVisibleCount > index;

        return (
          <Card
            key={lift.slug}
            className="group relative ring-ring shadow-lg ring-0 hover:ring-1"
          >
            <Link href={`/${lift.slug}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start gap-3">
                  <CardTitle className="min-w-0 flex-1 text-xl leading-tight sm:text-2xl min-h-[3.2rem] sm:min-h-[3.8rem]">
                    {lift.liftType}
                  </CardTitle>
                  {isStatsMode && badges.length > 0 && (
                    <CardAction
                      className={`static ml-auto flex flex-col items-end gap-1 text-[11px] leading-tight transition-opacity duration-300 ${
                        showStats ? "opacity-100" : "opacity-0"
                      }`}
                    >
                      {badges.map((badge) => (
                        <Badge
                          key={badge.type}
                          variant={badge.variant}
                          className="pointer-events-none whitespace-nowrap"
                        >
                          <span className="hidden sm:inline">
                            {badge.label}
                          </span>
                          <span className="sm:hidden">{badge.shortLabel}</span>
                        </Badge>
                      ))}
                    </CardAction>
                  )}
                </div>
              </CardHeader>
              <CardContent className="relative px-6 pt-0 pb-2">
                <div className="relative h-16">
                  {/* Base description. Fades out per card when that card's stats fade in. */}
                  <div
                    className={`text-sm text-muted-foreground transition-opacity duration-300 ${
                      isStatsMode && showStats ? "opacity-0" : "opacity-100"
                    }`}
                  >
                    {lift.liftDescription}
                  </div>

                  {/* Stats overlay that fades in on top for authenticated users with data */}
                  {isStatsMode && stats && (
                    <div
                      className={`text-muted-foreground pointer-events-none absolute inset-0 flex flex-col justify-center text-sm transition-opacity duration-300 ${
                        showStats ? "opacity-100" : "opacity-0"
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
                          Best set: {stats.bestLift.reps}@
                          {stats.bestLift.weight}
                          {stats.bestLift.unitType || stats.unitType}
                          {stats.bestLift.date && (
                            <> on {formatLiftDate(stats.bestLift.date)}</>
                          )}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter className="flex justify-center p-2 pt-0">
                <img
                  src={bigFourDiagrams[lift.liftType]}
                  alt={`${lift.liftType} diagram`}
                  className="h-36 w-36 object-contain transition-transform group-hover:scale-110"
                />
              </CardFooter>
            </Link>
          </Card>
        );
      })}
    </div>
  );
}
