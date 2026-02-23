/** @format */


import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import {
  useAthleteBio,
  STRENGTH_LEVEL_EMOJI,
  getStrengthRatingForE1RM,
} from "@/hooks/use-athlete-biodata";
import { useLocalStorage, useMediaQuery } from "usehooks-ts";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { estimateE1RM } from "@/lib/estimate-e1rm";
import {
  getAverageLiftSessionTonnageFromPrecomputed,
  getLiftVolumeMultiplier,
  getDisplayWeight,
} from "@/lib/processing-utils";
import { motion } from "motion/react";

import { format } from "date-fns";
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

/**
 * Renders a grid of cards for the "big four" barbell lifts (Back Squat, Bench Press,
 * Deadlift, Strict Press). Each card links to its dedicated lift insights page and has
 * two display modes:
 *
 * - **Guest / no-sheet mode**: shows the lift description and SVG diagram.
 * - **Stats mode** (authenticated with a connected sheet): hides the description and
 *   instead shows a mini yellow-to-green strength bar with the user's last-month best
 *   E1RM marker and their strength rating (e.g. "💪 Intermediate"), plus contextual
 *   badges for recent PRs, training frequency, volume, and lift preference.
 *
 * @param {Object} props
 * @param {Array<{liftType: string, slug: string, liftDescription: string}>} props.lifts - Array of
 *   lift config objects. Each must have liftType (display name), slug (URL path), and
 *   liftDescription (short description shown in guest mode).
 * @param {boolean} [props.animated=true] - When true, stats and badges stagger in with a short
 *   delay per card after auth and data load. Set to false to skip the animation (e.g. when
 *   embedded elsewhere).
 */
export function BigFourLiftCards({ lifts, animated = true }) {
  const {
    sheetInfo,
    parsedData,
    topLiftsByTypeAndReps,
    liftTypes,
    sessionTonnageLookup,
    topTonnageByType,
    topTonnageByTypeLast12Months,
  } = useUserLiftingData() || {};
  const [e1rmFormula] = useLocalStorage(LOCAL_STORAGE_KEYS.FORMULA, "Brzycki", {
    initializeWithValue: false,
  });
  const { isMetric, standards } = useAthleteBio();
  const { status: authStatus } = useSession();
  const isMobile = useMediaQuery("(max-width: 1279px)", {
    initializeWithValue: false,
  });
  const [statsVisibleCount, setStatsVisibleCount] = useState(0);
  const todayBadgeLabelsRef = useRef({});
  const favoriteBadgeLabelsRef = useRef({});
  const leastFavoriteBadgeLabelsRef = useRef({});
  const tonnageBadgeLabelsRef = useRef({});

  const getTodayBadgeLabel = (liftType, allLiftTypes) => {
    if (!todayBadgeLabelsRef.current[liftType]) {
      const used = (allLiftTypes || [])
        .filter((lt) => lt !== liftType)
        .map((lt) => todayBadgeLabelsRef.current[lt])
        .filter(Boolean);
      const available = TODAY_BADGE_OPTIONS.filter((o) => !used.includes(o));
      const options = available.length > 0 ? available : TODAY_BADGE_OPTIONS;
      todayBadgeLabelsRef.current[liftType] =
        options[Math.floor(Math.random() * options.length)];
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

  const getTonnageBadgeLabel = (liftType, allLiftTypes) => {
    if (!tonnageBadgeLabelsRef.current[liftType]) {
      const used = (allLiftTypes || [])
        .filter((lt) => lt !== liftType)
        .map((lt) => tonnageBadgeLabelsRef.current[lt])
        .filter(Boolean);
      const available = TONNAGE_BADGE_OPTIONS.filter((o) => !used.includes(o));
      const options = available.length > 0 ? available : TONNAGE_BADGE_OPTIONS;
      tonnageBadgeLabelsRef.current[liftType] =
        options[Math.floor(Math.random() * options.length)];
    }
    return tonnageBadgeLabelsRef.current[liftType];
  };

  const getStatsForLift = (liftType) => {
    if (!topLiftsByTypeAndReps || !topLiftsByTypeAndReps[liftType]) return null;

    const repRanges = topLiftsByTypeAndReps[liftType];
    let bestE1RMWeight = 0;
    let bestLift = null;

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
    }

    const liftTotals = liftTypes?.find((lift) => lift.liftType === liftType);

    return {
      bestLift,
      totalSets: liftTotals?.totalSets ?? 0,
      totalReps: liftTotals?.totalReps ?? 0,
    };
  };

  // Stagger the description→stats fade per card, left to right.
  // Only run when user has a connected sheet (real data), not demo.
  useEffect(() => {
    if (
      authStatus === "authenticated" &&
      sheetInfo?.ssid &&
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
  }, [authStatus, sheetInfo?.ssid, topLiftsByTypeAndReps, animated]);

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
    return format(cutoff, "yyyy-MM-dd"); // Use local date, not UTC
  })();

  const tonnageBadgeCutoffStr = (() => {
    const today = new Date();
    const cutoff = new Date(today);
    cutoff.setDate(today.getDate() - TONNAGE_BADGE_WINDOW_DAYS);
    return format(cutoff, "yyyy-MM-dd"); // Use local date, not UTC
  })();

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 2xl:grid-cols-4">
      {lifts.map((lift, index) => {
        const stats = getStatsForLift(lift.liftType);
        const hasAnyData =
          stats &&
          (stats.totalSets > 0 || stats.totalReps > 0 || stats.bestLift);
        // Only show personal stats when user has connected a sheet (avoid demo data on cards).
        const isStatsMode =
          authStatus === "authenticated" &&
          !!sheetInfo?.ssid &&
          hasAnyData;

        const recentPRTier = topLiftsByTypeAndReps
          ? getRecentPRTier(
              lift.liftType,
              topLiftsByTypeAndReps,
              e1rmFormula,
              recentPRCutoffStr,
            )
          : null;
        const qualifiesTonnageBadge = qualifiesForTonnageBadge(
          lift.liftType,
          topTonnageByType,
          topTonnageByTypeLast12Months,
          tonnageBadgeCutoffStr,
        );
        const allLiftTypes = lifts.map((l) => l.liftType);
        const badges =
          isStatsMode && topLiftsByTypeAndReps
            ? buildBadgesForLiftType(lift.liftType, {
                lastDateByLiftType: sessionTonnageLookup?.lastDateByLiftType,
                favoriteLiftType,
                leastFavoriteLiftType,
                getTodayBadgeLabel,
                getFavoriteBadgeLabel,
                getLeastFavoriteBadgeLabel,
                getTonnageBadgeLabel,
                recentPRTier,
                qualifiesTonnageBadge,
                allLiftTypes,
              })
            : [];

        const showStats = statsVisibleCount > index;

        const miniBarData =
          isStatsMode && parsedData
            ? getMiniBarData(
                lift.liftType,
                parsedData,
                standards,
                isMetric,
                e1rmFormula,
              )
            : null;

        return (
          <Card
            key={lift.slug}
            className="group ring-ring relative shadow-lg ring-0 hover:ring-1"
          >
              <Link href={`/${lift.slug}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-3">
                    <CardTitle className="min-w-0 flex-1 text-xl leading-tight sm:text-2xl lg:min-h-[3.8rem]">
                      {lift.liftType}
                    </CardTitle>
                    {isStatsMode && badges.length > 0 && (
                      <CardAction className="static ml-auto flex flex-col items-end gap-1 text-[11px] leading-tight">
                        <div className="flex flex-col items-end gap-1">
                          {badges.map((badge, i) => (
                            <motion.div
                              key={badge.type}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={
                                showStats
                                  ? { opacity: 1, scale: 1 }
                                  : { opacity: 0, scale: 0.9 }
                              }
                              transition={{
                                type: "spring",
                                stiffness: 220,
                                damping: 22,
                                delay: showStats ? i * 0.06 : 0,
                              }}
                            >
                              <Badge
                                variant={badge.variant}
                                className="pointer-events-none whitespace-nowrap"
                              >
                                {badge.label}
                              </Badge>
                            </motion.div>
                          ))}
                        </div>
                      </CardAction>
                    )}
                  </div>
                </CardHeader>
                {!isStatsMode && (
                  <CardContent className="px-6 pt-0 pb-2">
                    <p className="text-muted-foreground text-sm">
                      {lift.liftDescription}
                    </p>
                  </CardContent>
                )}
                {miniBarData && (
                  <motion.div
                    className="px-6 pb-2"
                    initial={{ opacity: 0 }}
                    animate={showStats ? { opacity: 1 } : { opacity: 0 }}
                    transition={{
                      type: "spring",
                      stiffness: 220,
                      damping: 24,
                      delay: showStats ? 0.1 : 0,
                    }}
                  >
                    {/* Mini gradient strength bar */}
                    <div className="relative py-1">
                      <div className="h-1.5 w-full rounded-full bg-gradient-to-r from-yellow-500 via-green-300 to-green-800" />
                      <div
                        className="absolute top-1/2 h-3.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground shadow"
                        style={{ left: `${miniBarData.thumbPercent}%` }}
                      />
                    </div>
                    <div className="mt-0.5 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        ~{Math.round(miniBarData.e1rmDisplay)}
                        {isMetric ? "kg" : "lb"} best E1RM this month
                      </span>
                      <span>
                        {STRENGTH_LEVEL_EMOJI[miniBarData.strengthRating]}{" "}
                        {miniBarData.strengthRating}
                      </span>
                    </div>
                  </motion.div>
                )}
                <CardFooter className="flex justify-center p-2 pt-0">
                  <motion.div
                    className="flex justify-center"
                    initial={false}
                    animate={{
                      rotate: showStats ? [0, -8, 8, -4, 0] : 0,
                    }}
                    transition={{
                      duration: 0.35,
                      ease: "easeOut",
                    }}
                  >
                    <motion.div
                      className="flex justify-center"
                      initial={
                        isMobile
                          ? { opacity: 0, y: 24 }
                          : false
                      }
                      {...(isMobile
                        ? {
                            whileInView: { opacity: 1, y: 0 },
                            viewport: { once: true, amount: 0.6, margin: "-40px" },
                          }
                        : { animate: { opacity: 1, y: 0 } })}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 24,
                      }}
                    >
                      <img
                        src={bigFourDiagrams[lift.liftType]}
                        alt={`${lift.liftType} diagram`}
                        className="h-36 w-36 object-contain transition-transform group-hover:scale-110"
                      />
                    </motion.div>
                  </motion.div>
                </CardFooter>
              </Link>
            </Card>
        );
      })}
    </div>
  );
}

// ——— Supporting constants and helpers ———

const bigFourDiagrams = {
  "Back Squat": "/back_squat.svg",
  "Bench Press": "/bench_press.svg",
  Deadlift: "/deadlift.svg",
  "Strict Press": "/strict_press.svg",
};

const STATS_STAGGER_MS = 520;

const RECENT_PR_WINDOW_DAYS = 60;

const TONNAGE_BADGE_WINDOW_DAYS = 30; // last month

/** Fortnight = 14 days. We encourage each big four lift at least 1–2x per fortnight. */
const NEGLECTED_TIERS = [
  { days: 10, label: "⏰ It's time" },
  { days: 30, label: "💪 Comeback ready" },
  { days: 60, label: "🌱 Been a while" },
];

const TODAY_BADGE_OPTIONS = [
  "🎯 Actually showed up",
  "🎯 Did the thing",
  "🎯 Adulting",
  "🎯 Today's hero",
  "🎯 Crushing it",
  "🎯 No excuses today",
  "🎯 Checked off",
  "🎯 Zero regrets",
  "🎯 Future you approves",
  "🎯 On it today",
  "🎯 Mission accomplished",
  "🎯 No procrastinating",
  "🎯 Done and dusted",
  "🎯 You did it",
  "🎯 Living the dream",
  "🎯 Today's winner",
  "🎯 Actually adulting",
  "🎯 Tick tick tick",
  "🎯 Showed up",
  "🎯 Done the thing",
];

const FAVORITE_BADGE_OPTIONS = [
  "⭐ Favourite of the four",
  "⭐ Your beloved",
  "⭐ Your precious",
  "⭐ Can't get enough",
  "⭐ Your ride or die",
  "⭐ Your true love",
  "⭐ The one you love",
  "⭐ Your main squeeze",
  "⭐ Top of the pile",
  "⭐ Your heart's desire",
  "⭐ The chosen one",
  "⭐ Your pride and joy",
  "⭐ Can't stay away",
  "⭐ Your favourite",
  "⭐ The one you crave",
  "⭐ Your go-to",
  "⭐ Always gets first",
  "⭐ Your darling",
  "⭐ Your number one",
  "⭐ The one you show up for",
];

const LEAST_FAVORITE_BADGE_OPTIONS = [
  "💩 Least favourite",
  "💩 The one you avoid",
  "💩 The neglected one",
  "💩 The one you dread",
  "💩 The one you skip",
  "💩 The forgotten one",
  "💩 Gets no love",
  "💩 The one you put off",
  "💩 Avoid eye contact",
  "💩 Done begrudgingly",
  "💩 The awkward one",
  "💩 Your nemesis",
  "💩 The dreaded one",
  "💩 Always last",
  "💩 No love here",
  "💩 The reluctant one",
  "💩 Your least favourite",
  "💩 The one you hide from",
  "💩 Bottom of the pile",
  "💩 The one you delay",
];

const TONNAGE_BADGE_OPTIONS = [
  "🏋️ Volume monster",
  "🏋️ Tonnage king",
  "🏋️ Moving serious weight",
  "🏋️ Volume beast",
  "🏋️ Tonnage champion",
  "🏋️ Piling on the plates",
  "🏋️ Volume legend",
  "🏋️ Tonnage hero",
  "🏋️ Shifting the iron",
  "🏋️ Volume warrior",
  "🏋️ Iron mover",
  "🏋️ Plate stacker",
  "🏋️ Volume demon",
  "🏋️ Tonnage titan",
  "🏋️ Weight shifter",
  "🏋️ Volume king",
  "🏋️ Tonnage beast",
  "🏋️ Moving mountains",
  "🏋️ Volume hero",
  "🏋️ Tonnage warrior",
];

function qualifiesForTonnageBadge(
  liftType,
  topTonnageByType,
  topTonnageByTypeLast12Months,
  lastMonthCutoffStr,
) {
  if (!topTonnageByType || !topTonnageByType[liftType]) return false;

  // In the last month: lifetime top 20 tonnage session
  const lifetimeTop = topTonnageByType[liftType];
  for (let i = 0; i < Math.min(20, lifetimeTop.length); i++) {
    const session = lifetimeTop[i];
    if (session?.date && session.date >= lastMonthCutoffStr) return true;
  }

  // In the last month: 12-month top 5 tonnage session
  const last12 = topTonnageByTypeLast12Months?.[liftType];
  for (let i = 0; i < Math.min(5, last12?.length ?? 0); i++) {
    const session = last12[i];
    if (session?.date && session.date >= lastMonthCutoffStr) return true;
  }

  return false;
}

function computeLiftTonnageMeta(sessionTonnageLookup, lifts) {
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
    const value = (average ?? 0) * getLiftVolumeMultiplier(liftType);
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
}

/**
 * Returns the most impressive recent PR tier for a lift type.
 * - "best": best lifetime lift (by e1RM) was done recently
 * - "top5": a lifetime top-5 lift (for its rep scheme) was done recently
 * - "top10": a lifetime top-10 lift was done recently
 * - null: none of the above
 */
function getRecentPRTier(
  liftType,
  topLiftsByTypeAndReps,
  e1rmFormula,
  cutoffStr,
) {
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
}

function buildBadgesForLiftType(
  liftType,
  {
    lastDateByLiftType,
    favoriteLiftType,
    leastFavoriteLiftType,
    getTodayBadgeLabel,
    getFavoriteBadgeLabel,
    getLeastFavoriteBadgeLabel,
    getTonnageBadgeLabel,
    recentPRTier,
    qualifiesTonnageBadge,
    allLiftTypes,
  },
) {
  const badges = [];

  const lastDate = lastDateByLiftType?.[liftType];
  const todayStr = format(new Date(), "yyyy-MM-dd"); // Use local date, not UTC
  if (lastDate === todayStr && getTodayBadgeLabel) {
    badges.push({
      type: "did-today",
      label: getTodayBadgeLabel(liftType, allLiftTypes),
      variant: "secondary",
    });
  }
  // Neglected badge: only when they haven't done it today (reward for showing up)
  if (lastDate && lastDate !== todayStr) {
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

  if (qualifiesTonnageBadge && getTonnageBadgeLabel) {
    badges.push({
      type: "tonnage",
      label: getTonnageBadgeLabel(liftType, allLiftTypes),
      variant: "outline",
    });
  }

  if (
    favoriteLiftType &&
    liftType === favoriteLiftType &&
    getFavoriteBadgeLabel
  ) {
    badges.push({
      type: "favorite",
      label: getFavoriteBadgeLabel(liftType),
      variant: "secondary",
    });
  }

  if (
    leastFavoriteLiftType &&
    liftType === leastFavoriteLiftType &&
    getLeastFavoriteBadgeLabel &&
    lastDate !== todayStr
  ) {
    badges.push({
      type: "least-favorite",
      label: getLeastFavoriteBadgeLabel(liftType),
      variant: "destructive",
    });
  }

  return badges;
}

/**
 * Computes the data needed to render the mini strength bar on each BigFour card.
 * Shows where the user's best E1RM from the last month sits on the standards scale.
 * Returns { strengthRating, thumbPercent } or null if no data in the last month.
 */
function getMiniBarData(liftType, parsedData, standards, isMetric, e1rmFormula) {
  const liftStandards = standards?.[liftType];
  if (!liftStandards || !parsedData?.length) return null;

  // Compute last-month cutoff as a comparable date string
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 1);
  const cutoffStr = format(cutoff, "yyyy-MM-dd");

  // Find the best E1RM for this lift type in the last month
  let best1ME1RM = 0;
  let best1MNativeUnit = isMetric ? "kg" : "lb";
  for (const entry of parsedData) {
    if (entry.liftType !== liftType || !entry.reps || !entry.weight) continue;
    if (!entry.date || entry.date < cutoffStr) continue;
    const e1rm = estimateE1RM(entry.reps, entry.weight, e1rmFormula);
    if (e1rm > best1ME1RM) {
      best1ME1RM = e1rm;
      best1MNativeUnit = entry.unitType || best1MNativeUnit;
    }
  }

  if (best1ME1RM === 0) return null;

  // Convert to display unit — standards are already in display unit
  const e1rmDisplay = getDisplayWeight(
    { weight: best1ME1RM, unitType: best1MNativeUnit },
    isMetric ?? false,
  ).value;

  const strengthRating = getStrengthRatingForE1RM(e1rmDisplay, liftStandards);
  if (!strengthRating) return null;

  const standardValues = Object.values(liftStandards);
  const standardsMin = Math.min(...standardValues);
  const eliteMax = liftStandards.elite;
  const maxLift =
    e1rmDisplay > eliteMax ? Math.ceil(e1rmDisplay * 1.05) : eliteMax;

  const thumbPercent =
    maxLift === standardsMin
      ? 0
      : ((e1rmDisplay - standardsMin) / (maxLift - standardsMin)) * 100;

  return {
    strengthRating,
    thumbPercent: Math.min(100, Math.max(0, thumbPercent)),
    e1rmDisplay,
  };
}
