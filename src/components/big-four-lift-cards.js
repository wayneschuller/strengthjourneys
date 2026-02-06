/** @format */

"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useLocalStorage } from "usehooks-ts";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { estimateE1RM } from "@/lib/estimate-e1rm";
import { getAverageLiftSessionTonnageFromPrecomputed } from "@/lib/processing-utils";

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

/** Fortnight = 14 days. We encourage each big four lift at least 1–2x per fortnight. */
const NEGLECTED_TIERS = [
  { days: 10, label: "⏰ It's time" },
  { days: 30, label: "💪 Comeback ready" },
  { days: 60, label: "🌱 Been a while" },
];

const computeLiftTonnageMeta = (sessionTonnageLookup, lifts) => {
  if (!sessionTonnageLookup || !lifts || !lifts.length) {
    return {
      liftTonnageMap: null,
      averageTonnage: 0,
      favoriteLiftType: null,
      leastFavoriteLiftType: null,
    };
  }

  const { sessionTonnageByDateAndLift, allSessionDates } = sessionTonnageLookup;
  const endDate = allSessionDates[allSessionDates.length - 1];
  if (!endDate) {
    return {
      liftTonnageMap: null,
      averageTonnage: 0,
      favoriteLiftType: null,
      leastFavoriteLiftType: null,
    };
  }

  const liftTonnageMap = {};

  // Compute per-lift average session tonnage over the rolling year window (from precomputed lookup)
  lifts.forEach((lift) => {
    const liftType = lift.liftType;
    if (!liftType || liftTonnageMap[liftType]) return; // skip duplicates

    const { average } = getAverageLiftSessionTonnageFromPrecomputed(
      sessionTonnageByDateAndLift,
      allSessionDates,
      endDate,
      liftType,
      undefined, // include all unit types
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

/**
 * Returns the most impressive recent PR tier for a lift type.
 * - "best": best lifetime lift (by e1RM) was done recently
 * - "top5": a lifetime top-5 lift (for its rep scheme) was done recently
 * - "top10": a lifetime top-10 lift was done recently
 * - null: none of the above
 */
const getRecentPRTier = (
  liftType,
  topLiftsByTypeAndReps,
  e1rmFormula,
  cutoffStr,
) => {
  if (!topLiftsByTypeAndReps || !topLiftsByTypeAndReps[liftType]) return null;

  const repRanges = topLiftsByTypeAndReps[liftType];

  // Find best lifetime lift (by e1RM across all rep schemes)
  let bestLift = null;
  let bestE1RM = 0;
  for (let repsIndex = 0; repsIndex < 10; repsIndex++) {
    const topAtReps = repRanges[repsIndex]?.[0];
    if (!topAtReps) continue;
    const reps = repsIndex + 1;
    const e1rm = estimateE1RM(reps, topAtReps.weight, e1rmFormula);
    if (e1rm > bestE1RM) {
      bestE1RM = e1rm;
      bestLift = topAtReps;
    }
  }
  if (bestLift?.date && bestLift.date >= cutoffStr) {
    return "best";
  }

  // Check top 5 (indices 0–4 for each rep scheme)
  for (let repsIndex = 0; repsIndex < 10; repsIndex++) {
    const repArray = repRanges[repsIndex];
    if (!repArray) continue;
    for (let i = 0; i < Math.min(5, repArray.length); i++) {
      const lift = repArray[i];
      if (lift?.date && lift.date >= cutoffStr) return "top5";
    }
  }

  // Check top 10 (indices 0–9 for each rep scheme)
  for (let repsIndex = 0; repsIndex < 10; repsIndex++) {
    const repArray = repRanges[repsIndex];
    if (!repArray) continue;
    for (let i = 0; i < Math.min(10, repArray.length); i++) {
      const lift = repArray[i];
      if (lift?.date && lift.date >= cutoffStr) return "top10";
    }
  }

  return null;
};

const TODAY_BADGE_OPTIONS = [
  "🎯 Actually showed up",
  "🎯 Did the thing",
  "🎯 Adulting",
  "🎯 Today's hero",
  "🎯 Crushing it",
];

const FAVORITE_BADGE_OPTIONS = [
  "⭐ Favourite of the four",
  "⭐ Your beloved",
  "⭐ The one you actually love",
  "⭐ Your precious",
  "⭐ Can't get enough",
  "⭐ The one you show up for",
  "⭐ Your ride or die",
  "⭐ The one that gets the reps",
  "⭐ Your true love",
  "⭐ The one that gets the love",
];

const LEAST_FAVORITE_BADGE_OPTIONS = [
  "💩 Least favourite",
  "💩 The one you avoid",
  "💩 The neglected one",
  "💩 The one you dread",
  "💩 The one you skip",
  "💩 The one you forget about",
  "💩 The one that gets no love",
  "💩 The one you put off",
  "💩 The one you avoid eye contact with",
  "💩 The one you do begrudgingly",
];

const buildBadgesForLiftType = (
  liftType,
  {
    lastDateByLiftType,
    liftTonnageMap,
    averageTonnage,
    favoriteLiftType,
    leastFavoriteLiftType,
    getTodayBadgeLabel,
    getFavoriteBadgeLabel,
    getLeastFavoriteBadgeLabel,
    recentPRTier,
  },
) => {
  const badges = [];

  const lastDate = lastDateByLiftType?.[liftType];
  const todayStr = new Date().toISOString().slice(0, 10);
  if (lastDate === todayStr && getTodayBadgeLabel) {
    badges.push({
      type: "did-today",
      label: getTodayBadgeLabel(liftType),
      variant: "secondary",
    });
  }
  if (lastDate) {
    const today = new Date();
    const last = new Date(lastDate);
    const daysSince = Math.floor((today - last) / (1000 * 60 * 60 * 24));
    const tier = [...NEGLECTED_TIERS]
      .sort((a, b) => b.days - a.days)
      .find((t) => daysSince >= t.days);
    if (tier) {
      badges.push({
        type: "neglected",
        label: tier.label,
        variant: "outline",
      });
    }
  }

  if (recentPRTier === "best") {
    badges.push({
      type: "recent-pr",
      label: "🔥 Best ever recently",
      variant: "secondary",
    });
  } else if (recentPRTier === "top5") {
    badges.push({
      type: "recent-pr-top5",
      label: "🔥 Top 5 recently",
      variant: "secondary",
    });
  } else if (recentPRTier === "top10") {
    badges.push({
      type: "recent-pr-top10",
      label: "🔥 Top 10 recently",
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
      variant: "outline",
    });
  }

  if (favoriteLiftType && liftType === favoriteLiftType && getFavoriteBadgeLabel) {
    badges.push({
      type: "favorite",
      label: getFavoriteBadgeLabel(liftType),
      variant: "secondary",
    });
  }

  if (
    leastFavoriteLiftType &&
    liftType === leastFavoriteLiftType &&
    getLeastFavoriteBadgeLabel
  ) {
    badges.push({
      type: "least-favorite",
      label: getLeastFavoriteBadgeLabel(liftType),
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
  const { topLiftsByTypeAndReps, liftTypes, sessionTonnageLookup } =
    useUserLiftingData() || {};
  const [e1rmFormula] = useLocalStorage(LOCAL_STORAGE_KEYS.FORMULA, "Brzycki", {
    initializeWithValue: false,
  });
  const { status: authStatus } = useSession();
  const [statsVisibleCount, setStatsVisibleCount] = useState(0);
  const todayBadgeLabelsRef = useRef({});
  const favoriteBadgeLabelsRef = useRef({});
  const leastFavoriteBadgeLabelsRef = useRef({});

  const getTodayBadgeLabel = (liftType) => {
    if (!todayBadgeLabelsRef.current[liftType]) {
      todayBadgeLabelsRef.current[liftType] =
        TODAY_BADGE_OPTIONS[
          Math.floor(Math.random() * TODAY_BADGE_OPTIONS.length)
        ];
    }
    return todayBadgeLabelsRef.current[liftType];
  };

  const getFavoriteBadgeLabel = (liftType) => {
    if (!favoriteBadgeLabelsRef.current[liftType]) {
      favoriteBadgeLabelsRef.current[liftType] =
        FAVORITE_BADGE_OPTIONS[
          Math.floor(Math.random() * FAVORITE_BADGE_OPTIONS.length)
        ];
    }
    return favoriteBadgeLabelsRef.current[liftType];
  };

  const getLeastFavoriteBadgeLabel = (liftType) => {
    if (!leastFavoriteBadgeLabelsRef.current[liftType]) {
      leastFavoriteBadgeLabelsRef.current[liftType] =
        LEAST_FAVORITE_BADGE_OPTIONS[
          Math.floor(Math.random() * LEAST_FAVORITE_BADGE_OPTIONS.length)
        ];
    }
    return leastFavoriteBadgeLabelsRef.current[liftType];
  };

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
    if (authStatus === "authenticated" && topLiftsByTypeAndReps && animated) {
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
  } = computeLiftTonnageMeta(sessionTonnageLookup, lifts);

  const recentPRCutoffStr = (() => {
    const today = new Date();
    const cutoff = new Date(today);
    cutoff.setDate(today.getDate() - RECENT_PR_WINDOW_DAYS);
    return cutoff.toISOString().slice(0, 10);
  })();

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-4">
      {lifts.map((lift, index) => {
        const stats = getStatsForLift(lift.liftType);
        const hasAnyData =
          stats &&
          (stats.totalSets > 0 || stats.totalReps > 0 || stats.bestLift);
        const isStatsMode = authStatus === "authenticated" && hasAnyData;

        const recentPRTier = topLiftsByTypeAndReps
          ? getRecentPRTier(
              lift.liftType,
              topLiftsByTypeAndReps,
              e1rmFormula,
              recentPRCutoffStr,
            )
          : null;
        const badges =
          isStatsMode && topLiftsByTypeAndReps
            ? buildBadgesForLiftType(lift.liftType, {
                lastDateByLiftType: sessionTonnageLookup?.lastDateByLiftType,
                liftTonnageMap,
                averageTonnage,
                favoriteLiftType,
                leastFavoriteLiftType,
                getTodayBadgeLabel,
                getFavoriteBadgeLabel,
                getLeastFavoriteBadgeLabel,
                recentPRTier,
              })
            : [];

        const showStats = statsVisibleCount > index;

        return (
          <Card
            key={lift.slug}
            className="group ring-ring relative shadow-lg ring-0 hover:ring-1"
          >
            <Link href={`/${lift.slug}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start gap-3">
                  <CardTitle className="min-h-[3.2rem] min-w-0 flex-1 text-xl leading-tight sm:min-h-[3.8rem] sm:text-2xl">
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
                          {badge.label}
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
                    className={`text-muted-foreground text-sm transition-opacity duration-300 ${
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
