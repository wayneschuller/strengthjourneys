"use client";

import { motion } from "motion/react";
import { useMemo, useRef } from "react";
import {
  todayStr,
  formatDMY,
  diffInCalendarYears,
  diffInCalendarMonths,
  diffInDays,
  subtractDays,
  addDays,
} from "@/lib/date-utils";

import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Trophy,
  Activity,
  Flame,
  Anvil,
} from "lucide-react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import {
  useAthleteBio,
  getStrengthRatingForE1RM,
  getStandardForLiftDate,
  STRENGTH_LEVEL_EMOJI,
} from "@/hooks/use-athlete-biodata";
import { useLocalStorage } from "usehooks-ts";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { Skeleton } from "@/components/ui/skeleton";

const ACCENTS = {
  primary: "text-primary",
  amber: "text-amber-500",
  emerald: "text-emerald-500",
  violet: "text-violet-500",
  orange: "text-orange-500",
};

const STREAK_ENCOURAGMENTS = [
  "Go have a beer.",
  "You've earned couch time.",
  "You're on track.",
  "Winner winner chicken dinner.",
  "Crushing it. Keep going.",
  "Consistency looks good on you.",
  "This is how PR streaks start.",
  "Text a friend and brag a little.",
  "You showed up. That matters most.",
  "Momentum is on your side.",
  "Future you is very grateful.",
  "Your streak graph would be proud.",
  "Log it, then relax. You did work.",
  "Tiny habits, big results.",
  "You vs. last week: you're winning.",
  "Banked another week. Nice.",
  "Coach brain: approved.",
  "Solid work. Sleep like an athlete.",
  "You did the hard part today.",
  "Bookmark this feeling.",
];

/**
 * Compact stat row with icon, label, value, and optional subtext.
 */
function StatCard({
  accent,
  icon: Icon,
  description,
  title,
  footer,
  action,
  animationDelay,
}) {
  const iconColor = ACCENTS[accent] ?? ACCENTS.primary;
  return (
    <motion.div
      className="flex flex-col gap-0.5 py-1.5"
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        type: "spring",
        stiffness: 220,
        damping: 22,
        delay: animationDelay / 1000,
      }}
    >
      <div className="flex items-center gap-2">
        <Icon className={`h-3.5 w-3.5 shrink-0 ${iconColor}`} />
        <span className="text-muted-foreground text-xs">{description}</span>
        {action && <span className="ml-1">{action}</span>}
      </div>
      <div className="text-sm font-semibold leading-snug tabular-nums sm:text-base">
        {title}
      </div>
      {footer && (
        <motion.div
          className="text-muted-foreground text-[11px] leading-tight line-clamp-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            duration: 0.3,
            delay: animationDelay / 1000 + 0.1,
          }}
        >
          {footer}
        </motion.div>
      )}
    </motion.div>
  );
}

/**
 * Shows a row of stat cards with key metrics: journey length, most recent PR single,
 * session momentum (90-day comparison), lifetime tonnage, and weekly consistency streak.
 * Uses useUserLiftingData and useAthleteBioData internally.
 *
 * @param {Object} props
 * @param {boolean} [props.isProgressDone=false] - When true, the actual stat cards are rendered.
 *   When false, a skeleton placeholder is shown (e.g. while row-count animation is running
 *   on the home dashboard).
 */
export function SectionTopCards({ isProgressDone = false }) {
  const {
    parsedData,
    liftTypes,
    topLiftsByTypeAndReps,
    sessionTonnageLookup,
  } = useUserLiftingData();

  const { age, bodyWeight, sex, standards, isMetric } = useAthleteBio();

  // Global-ish unit preference shared with calculator & strength-level pages.
  // Defaults to imperial (lb) when not set.
  const [isMetricPreference] = useLocalStorage(
    LOCAL_STORAGE_KEYS.CALC_IS_METRIC,
    false,
    { initializeWithValue: false },
  );
  const preferredUnit = isMetricPreference ? "kg" : "lb";

  const allSessionDates = useMemo(
    () => sessionTonnageLookup?.allSessionDates ?? [],
    [sessionTonnageLookup],
  );

  // Find the most recent PR single from top 5 most frequent lifts
  const mostRecentPR = useMemo(
    () => findMostRecentSinglePR(topLiftsByTypeAndReps, liftTypes),
    [topLiftsByTypeAndReps, liftTypes],
  );

  // Check if we have the necessary bio data and standards to calculate a strength rating
  const hasBioData =
    age && bodyWeight && standards && Object.keys(standards).length > 0;

  // Calculate strength rating for the most recent PR single when possible.
  // Use age at time of PR for accurate age-adjusted rating (PR may be years old).
  let mostRecentPRStrengthRating = null;
  if (hasBioData && mostRecentPR) {
    const standardForLift = getStandardForLiftDate(
      age,
      mostRecentPR.date,
      bodyWeight,
      sex,
      mostRecentPR.liftType,
      isMetric,
    );
    const unitForStandards = isMetric ? "kg" : "lb";

    if (standardForLift && mostRecentPR.weight) {
      const prUnit = mostRecentPR.unitType || "lb";
      let oneRepMax = mostRecentPR.weight;

      // Align PR units with standards units before rating
      if (prUnit !== unitForStandards) {
        if (prUnit === "kg" && unitForStandards === "lb") {
          oneRepMax = Math.round(oneRepMax * 2.2046);
        } else if (prUnit === "lb" && unitForStandards === "kg") {
          oneRepMax = Math.round(oneRepMax / 2.2046);
        }
      }

      mostRecentPRStrengthRating = getStrengthRatingForE1RM(
        oneRepMax,
        standardForLift,
      );
    }
  }

  // Calculate lifetime tonnage (all-time total weight moved) in preferred units.
  const lifetimeTonnage = useMemo(
    () =>
      calculateLifetimeTonnageFromLookup(sessionTonnageLookup, preferredUnit),
    [sessionTonnageLookup, preferredUnit],
  );

  // Calculate session momentum
  const { recentSessions, previousSessions, percentageChange } = useMemo(
    () =>
      allSessionDates.length
        ? calculateSessionMomentumFromDates(allSessionDates)
        : { recentSessions: 0, previousSessions: 0, percentageChange: 0 },
    [allSessionDates],
  );

  const { currentStreak, bestStreak, sessionsThisWeek } = useMemo(
    () =>
      allSessionDates.length
        ? calculateStreakFromDates(allSessionDates)
        : { currentStreak: 0, bestStreak: 0, sessionsThisWeek: 0 },
    [allSessionDates],
  );
  const sessionsNeededThisWeek = Math.max(0, 3 - (sessionsThisWeek ?? 0));

  const totalStats = useMemo(() => calculateTotalStats(liftTypes), [liftTypes]);

  const streakEncouragementRef = useRef(null);
  if (streakEncouragementRef.current === null) {
    streakEncouragementRef.current =
      STREAK_ENCOURAGMENTS[
        Math.floor(Math.random() * STREAK_ENCOURAGMENTS.length)
      ];
  }
  const encouragementMessage = streakEncouragementRef.current;

  return (
    <div className="col-span-full grid grid-cols-2 gap-5 xl:grid-cols-3 2xl:grid-cols-5">
      {!isProgressDone && <SectionTopCardsSkeleton />}
      {isProgressDone && (
        <>
          <StatCard
            accent="primary"
            icon={Calendar}
            description="Journey Length"
            title={
              parsedData && parsedData.length > 0
                ? formatJourneyLength(parsedData[0].date)
                : "Starting your journey"
            }
            footer={
              <span>
                {totalStats.totalReps.toLocaleString()} reps ·{" "}
                {totalStats.totalSets.toLocaleString()} sets
              </span>
            }
            animationDelay={0}
          />

          <StatCard
            accent="amber"
            icon={Trophy}
            description="Most Recent PR Single"
            title={
              mostRecentPR
                ? `${mostRecentPR.liftType} 1@${mostRecentPR.weight}${mostRecentPR.unitType}`
                : "No PRs yet"
            }
            footer={
              mostRecentPR ? (
                <span>
                  {formatDMY(mostRecentPR.date)}
                  {mostRecentPRStrengthRating
                    ? ` · ${STRENGTH_LEVEL_EMOJI[mostRecentPRStrengthRating] ?? ""} ${mostRecentPRStrengthRating}`
                    : ""}
                </span>
              ) : null
            }
            animationDelay={200}
          />

          <StatCard
            accent="emerald"
            icon={Activity}
            description="Session Momentum"
            title={`${recentSessions} sessions in 90 days`}
            action={
              percentageChange !== 0 ? (
                <span
                  className={`flex items-center text-[11px] font-normal ${
                    percentageChange > 0 ? "text-emerald-600" : "text-red-500"
                  }`}
                >
                  {percentageChange > 0 ? (
                    <TrendingUp className="mr-0.5 h-3 w-3" />
                  ) : (
                    <TrendingDown className="mr-0.5 h-3 w-3" />
                  )}
                  {Math.abs(percentageChange)}%
                </span>
              ) : null
            }
            footer={(() => {
              const avgPerWeek = (recentSessions * 7) / 90;
              const avgFormatted =
                avgPerWeek % 1 === 0
                  ? Math.round(avgPerWeek)
                  : avgPerWeek.toFixed(1);
              return (
                <span>
                  Avg {avgFormatted}/wk · {previousSessions} prev 90 days
                </span>
              );
            })()}
            animationDelay={400}
          />

          <StatCard
            accent="violet"
            icon={Anvil}
            description="Lifetime Tonnage"
            title={
              lifetimeTonnage.primaryTotal > 0
                ? `${formatLifetimeTonnage(
                    lifetimeTonnage.primaryTotal,
                  )} ${lifetimeTonnage.primaryUnit} moved`
                : "No lifting logged yet"
            }
            footer={
              lifetimeTonnage.primaryTotal > 0 ? (
                <span>
                  {lifetimeTonnage.sessionCount.toLocaleString()} sessions · avg{" "}
                  {formatLifetimeTonnage(lifetimeTonnage.averagePerSession)}{" "}
                  {lifetimeTonnage.primaryUnit}/session
                </span>
              ) : null
            }
            animationDelay={600}
          />

          <StatCard
            accent="orange"
            icon={Flame}
            description="Weekly consistency"
            title={`${currentStreak} week${currentStreak === 1 ? "" : "s"} in a row`}
            footer={
              <span>
                {`Best: ${bestStreak}wk`}
                {sessionsNeededThisWeek > 0
                  ? ` · ${sessionsNeededThisWeek} more this week`
                  : sessionsThisWeek >= 3
                    ? ` · ${sessionsThisWeek} this week. ${encouragementMessage}`
                    : ""}
              </span>
            }
            animationDelay={800}
          />
        </>
      )}
    </div>
  );
}

function SectionTopCardsSkeleton() {
  return Array.from({ length: 5 }).map((_, index) => (
    <div
      key={`section-top-card-skeleton-${index}`}
      className="flex flex-col gap-1 py-1.5"
    >
      <div className="flex items-center gap-2">
        <Skeleton className="h-3.5 w-3.5 rounded" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-2.5 w-28" />
    </div>
  ));
}

function formatJourneyLength(startDate) {
  const today = todayStr();

  const years = diffInCalendarYears(today, startDate);
  const months = diffInCalendarMonths(today, startDate) % 12;
  const days = diffInDays(today, startDate) % 30;

  if (years > 0) {
    if (years >= 10) {
      return `Over ${years} years of strength mastery`;
    } else if (years >= 5) {
      return `${years} years of strength excellence`;
    } else if (years >= 1) {
      return `${years} year${years > 1 ? "s" : ""} of strength commitment`;
    }
  }

  if (months > 0) {
    if (months >= 6) {
      return `${months} months of strength progress`;
    } else {
      return `${months} month${months > 1 ? "s" : ""} of lifting`;
    }
  }

  return `${days} day${days !== 1 ? "s" : ""} of lifting`;
}

function calculateTotalStats(liftTypes) {
  if (!liftTypes) return { totalSets: 0, totalReps: 0 };

  return liftTypes.reduce(
    (acc, lift) => ({
      totalSets: acc.totalSets + lift.totalSets,
      totalReps: acc.totalReps + lift.totalReps,
    }),
    { totalSets: 0, totalReps: 0 },
  );
}

/**
 * Calculates lifetime tonnage using precomputed session lookup
 * (sum of weight × reps across all non-goal lifts).
 * Returns totals per unit plus a primary unit/total for display.
 */
function calculateLifetimeTonnageFromLookup(sessionTonnageLookup, preferredUnit = "lb") {
  const allSessionDates = sessionTonnageLookup?.allSessionDates ?? [];
  const sessionTonnageByDate = sessionTonnageLookup?.sessionTonnageByDate ?? {};

  if (allSessionDates.length === 0) {
    return {
      totalByUnit: {},
      primaryUnit: preferredUnit || "lb",
      primaryTotal: 0,
      sessionCount: 0,
      averagePerSession: 0,
      hasTwelveMonthsOfData: false,
      lastYearPrimaryTotal: 0,
    };
  }

  const totalByUnit = {};
  const today = todayStr();
  const twelveMonthsAgoStr = subtractDays(today, 365);
  const lastYearByUnit = {};
  const earliestDateStr = allSessionDates[0] ?? null;
  const latestDateStr = allSessionDates[allSessionDates.length - 1] ?? null;

  for (let i = 0; i < allSessionDates.length; i++) {
    const date = allSessionDates[i];
    const tonnageByUnit = sessionTonnageByDate[date];
    if (!tonnageByUnit) continue;

    const unitKeys = Object.keys(tonnageByUnit);
    for (let j = 0; j < unitKeys.length; j++) {
      const unit = unitKeys[j];
      const tonnage = tonnageByUnit[unit] ?? 0;
      if (!tonnage) continue;
      totalByUnit[unit] = (totalByUnit[unit] ?? 0) + tonnage;
      if (date >= twelveMonthsAgoStr && date <= today) {
        lastYearByUnit[unit] = (lastYearByUnit[unit] ?? 0) + tonnage;
      }
    }
  }

  const unitKeys = Object.keys(totalByUnit);
  const primaryUnit = preferredUnit || unitKeys[0] || "lb";

  // Combine all units into the preferred primary unit for display.
  let primaryTotal = 0;
  const KG_PER_LB = 1 / 2.2046;
  const LB_PER_KG = 2.2046;

  unitKeys.forEach((unit) => {
    const value = totalByUnit[unit] ?? 0;
    if (!value) return;

    if (unit === primaryUnit) {
      primaryTotal += value;
      return;
    }

    // Only two units are expected ("lb" and "kg"), but handle generically.
    if (unit === "kg" && primaryUnit === "lb") {
      primaryTotal += value * LB_PER_KG;
    } else if (unit === "lb" && primaryUnit === "kg") {
      primaryTotal += value * KG_PER_LB;
    } else {
      // Fallback: if we somehow have another unit, just add raw.
      primaryTotal += value;
    }
  });

  // Determine whether we have more than 12 months of data.
  let hasTwelveMonthsOfData = false;
  let lastYearPrimaryTotal = 0;
  if (earliestDateStr && latestDateStr) {
    const earliestDate = new Date(earliestDateStr + "T00:00:00Z");
    const latestDate = new Date(latestDateStr + "T00:00:00Z");
    const diffDays =
      (latestDate.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24);
    hasTwelveMonthsOfData = diffDays >= 365;
  }

  if (hasTwelveMonthsOfData) {
    const lastYearKeys = Object.keys(lastYearByUnit);
    lastYearKeys.forEach((unit) => {
      const value = lastYearByUnit[unit] ?? 0;
      if (!value) return;

      if (unit === primaryUnit) {
        lastYearPrimaryTotal += value;
      } else if (unit === "kg" && primaryUnit === "lb") {
        lastYearPrimaryTotal += value * LB_PER_KG;
      } else if (unit === "lb" && primaryUnit === "kg") {
        lastYearPrimaryTotal += value * KG_PER_LB;
      } else {
        lastYearPrimaryTotal += value;
      }
    });
  }

  const averagePerSession =
    allSessionDates.length > 0 ? Math.round(primaryTotal / allSessionDates.length) : 0;

  return {
    totalByUnit,
    primaryUnit,
    primaryTotal,
    sessionCount: allSessionDates.length,
    averagePerSession,
    hasTwelveMonthsOfData,
    lastYearPrimaryTotal,
  };
}

// Nicely formats large tonnage numbers (e.g. 1.2M, 250k, 42,500)
function formatLifetimeTonnage(value) {
  if (!value || value <= 0) return "0";

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 10_000) {
    return `${Math.round(value / 1_000)}k`;
  }

  return value.toLocaleString();
}

/**
 * Finds the most recent 1-rep PR across the top 5 most frequent lift types
 * @param {Object} topLiftsByTypeAndReps - The data structure containing PRs by lift type and rep ranges
 * @param {Array} liftTypes - Array of lift types sorted by frequency (totalSets)
 * @returns {Object|null} The most recent 1-rep PR or null if none found
 */
function findMostRecentSinglePR(topLiftsByTypeAndReps, liftTypes) {
  if (!topLiftsByTypeAndReps || !liftTypes) return null;

  // Get the most frequent lift types
  const topFiveLiftTypes = liftTypes.slice(0, 5).map((lift) => lift.liftType);

  let mostRecentPR = null;
  let mostRecentDate = "";

  // Only look at PRs from the top lift types
  Object.entries(topLiftsByTypeAndReps).forEach(([liftType, repRanges]) => {
    // Skip if this lift type isn't in the top
    if (!topFiveLiftTypes.includes(liftType)) return;

    const singleReps = repRanges[0]; // Index 0 is 1-rep maxes
    if (singleReps && singleReps.length > 0) {
      const topWeight = singleReps[0].weight;
      const pr = singleReps
        .filter((lift) => lift.weight === topWeight)
        .reduce((best, lift) => (lift.date > best.date ? lift : best), singleReps[0]);
      if (!mostRecentPR || pr.date > mostRecentDate) {
        mostRecentPR = pr;
        mostRecentDate = pr.date;
      }
    }
  });

  return mostRecentPR;
}

/**
 * Calculates PRs achieved in the last 12 months
 * @param {Object} topLiftsByTypeAndReps - The data structure containing PRs by lift type and rep ranges
 * @returns {Object} Object containing count of PRs and array of lift types with PRs
 */
function calculatePRsInLast12Months(topLiftsByTypeAndReps) {
  if (!topLiftsByTypeAndReps) return { count: 0, liftTypes: [] };

  const today = todayStr();
  const twelveMonthsAgo = subtractDays(today, 365);
  const prLiftTypes = new Set();

  Object.entries(topLiftsByTypeAndReps).forEach(([liftType, repRanges]) => {
    // Look at all rep ranges
    Object.values(repRanges).forEach((prs) => {
      if (prs && prs.length > 0) {
        // Check if any PR in this rep range is from last 12 months
        const hasRecentPR = prs.some((pr) => pr.date >= twelveMonthsAgo);
        if (hasRecentPR) {
          prLiftTypes.add(liftType);
        }
      }
    });
  });

  return {
    count: prLiftTypes.size,
    liftTypes: Array.from(prLiftTypes),
  };
}

/**
 * Calculates session momentum by comparing the last 90 days to the previous 90 days.
 * Uses precomputed unique session dates from sessionTonnageLookup.
 * @param {Array<string>} allSessionDates - Sorted unique session dates (YYYY-MM-DD)
 * @returns {Object} Object containing session counts and percentage change
 */
function calculateSessionMomentumFromDates(allSessionDates) {
  if (!allSessionDates || allSessionDates.length === 0) {
    return { recentSessions: 0, previousSessions: 0, percentageChange: 0 };
  }

  const today = todayStr();
  const ninetyDaysAgoStr = subtractDays(today, 90);
  const oneEightyDaysAgoStr = subtractDays(today, 180);

  const recentSessionDates = new Set();
  const previousSessionDates = new Set();

  for (let i = 0; i < allSessionDates.length; i++) {
    const dateStr = allSessionDates[i];
    // YYYY-MM-DD string comparison
    if (dateStr >= ninetyDaysAgoStr && dateStr <= today) {
      recentSessionDates.add(dateStr);
    } else if (dateStr >= oneEightyDaysAgoStr && dateStr < ninetyDaysAgoStr) {
      previousSessionDates.add(dateStr);
    }
  }

  const recentSessions = recentSessionDates.size;
  const previousSessions = previousSessionDates.size;

  let percentageChange = 0;
  if (previousSessions > 0) {
    percentageChange = Math.round(
      ((recentSessions - previousSessions) / previousSessions) * 100,
    );
  } else if (recentSessions > 0) {
    percentageChange = 100; // From 0 to something is a 100% improvement for this context
  }

  return { recentSessions, previousSessions, percentageChange };
}

// YYYY-MM-DD only. Returns Monday of that week as "YYYY-MM-DD" (one Date used).
function getWeekKeyFromDateStr(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  const dow = d.getUTCDay(); // 0=Sun, 1=Mon, ...
  const daysBack = (dow + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysBack);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Calculates current streak and best streak of weeks with 3+ sessions.
 * A "session" = one calendar day with at least one gym visit (we count unique days, not sets/lifts).
 * Uses string comparison for dates (YYYY-MM-DD) and caches week key per unique date.
 *
 * @param {Array<string>} allSessionDates - Sorted unique session dates (YYYY-MM-DD)
 * @returns {Object} Object containing currentStreak, bestStreak (weeks), and sessionsThisWeek (unique days)
 */
function calculateStreakFromDates(allSessionDates) {
  if (!allSessionDates || allSessionDates.length === 0) {
    return { currentStreak: 0, bestStreak: 0, sessionsThisWeek: 0 };
  }

  // --- Phase 1: Build "sessions per week" (unique days per week) ---
  // weekMap: for each week (Monday's date as "YYYY-MM-DD"), we store the Set of *dates* that had
  // at least one gym session that week. So if you trained Mon/Wed/Fri, that week key maps to 3 dates.
  // We do NOT count lift entries — one workout with 20 sets still counts as 1 session (one day).
  const dateToWeekKey = new Map(); // cache: dateStr -> Monday of that week
  const weekMap = new Map(); // weekKey (Monday YYYY-MM-DD) -> Set of date strings (unique session days in that week)

  for (let i = 0; i < allSessionDates.length; i++) {
    const dateStr = allSessionDates[i];
    // Resolve which week (Monday) this session falls into; cache so we only compute once per unique date
    let weekKey = dateToWeekKey.get(dateStr);
    if (weekKey === undefined) {
      weekKey = getWeekKeyFromDateStr(dateStr);
      dateToWeekKey.set(dateStr, weekKey);
    }
    if (!weekMap.has(weekKey)) weekMap.set(weekKey, new Set());
    weekMap.get(weekKey).add(dateStr); // add this session date to that week's set (Set = unique days)
  }

  // Session count per week = number of unique days with a gym session that week (3+ = "streak week")
  const weekSessionCount = new Map();
  weekMap.forEach((dates, weekKey) => {
    weekSessionCount.set(weekKey, dates.size);
  });

  const weekKeys = Array.from(weekSessionCount.keys()).sort(); // ascending; string sort is correct for YYYY-MM-DD
  if (weekKeys.length === 0) {
    return { currentStreak: 0, bestStreak: 0, sessionsThisWeek: 0 };
  }

  const oldestWeek = weekKeys[0];

  // --- Phase 2: Reference weeks (this week, last week) ---
  const today = todayStr();
  const thisWeekKey = getWeekKeyFromDateStr(today);
  const sessionsThisWeek = weekSessionCount.get(thisWeekKey) || 0;

  // --- Phase 3: Current streak (consecutive weeks with 3+ sessions) ---
  // Count the current week immediately once it reaches 3+ sessions.
  // If current week is below 3, it does not break the streak yet.
  let currentStreak = 0;
  const thisWeekIsQualified = sessionsThisWeek >= 3;
  if (thisWeekIsQualified) {
    currentStreak = 1;
  }
  const lastCompleteWeekKey = subtractDays(thisWeekKey, 7); // Monday of the last completed week
  let weekKey = lastCompleteWeekKey;
  while (weekKey >= oldestWeek) {
    const sessionCount = weekSessionCount.get(weekKey) || 0;
    if (sessionCount >= 3) {
      currentStreak++;
    } else {
      break;
    }
    weekKey = subtractDays(weekKey, 7);
  }

  // --- Phase 4: Best streak (longest run of consecutive 3+ session weeks) ---
  // Include this week only when it has already reached 3+ sessions.
  let bestStreak = 0;
  let tempStreak = 0;
  weekKey = oldestWeek;
  const bestStreakEndWeek = thisWeekIsQualified ? thisWeekKey : lastCompleteWeekKey;
  while (weekKey <= bestStreakEndWeek) {
    const sessionCount = weekSessionCount.get(weekKey) || 0;
    if (sessionCount >= 3) {
      tempStreak++;
      bestStreak = Math.max(bestStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
    weekKey = addDays(weekKey, 7);
  }

  return { currentStreak, bestStreak, sessionsThisWeek };
}
