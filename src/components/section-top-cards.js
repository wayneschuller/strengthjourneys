"use client";

import {
  Card,
  CardContent,
  CardFooter,
  CardDescription,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card";
import { useMemo } from "react";
import { devLog } from "@/lib/processing-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "next-auth/react";
import {
  parseISO,
  subDays,
  differenceInCalendarDays,
  differenceInCalendarYears,
  differenceInCalendarMonths,
  formatISO,
  format,
  startOfWeek,
  subWeeks,
} from "date-fns";

import { TrendingUp, CalendarDays, TrendingDown } from "lucide-react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CircularProgressWithLetter } from "./analyzer/circular-progress-with-letter";

// Show a section row of key metrics on smaller cards
export function SectionTopCards() {
  const {
    parsedData,
    liftTypes,
    topLiftsByTypeAndReps,
    topLiftsByTypeAndRepsLast12Months,
  } = useUserLiftingData();
  const { status: authStatus } = useSession();

  // Find the most recent PR single from top 5 most frequent lifts
  const mostRecentPR = findMostRecentSinglePR(topLiftsByTypeAndReps, liftTypes);

  // Calculate PRs in last 12 months
  const prsLast12Months = useMemo(
    () => calculatePRsInLast12Months(topLiftsByTypeAndReps),
    [topLiftsByTypeAndReps],
  );

  // Calculate session momentum
  const { recentSessions, previousSessions, percentageChange } = useMemo(
    () => calculateSessionMomentum(parsedData),
    [parsedData],
  );

  const { currentStreak, bestStreak } = useMemo(
    () => calculateStreak(parsedData),
    [parsedData],
  );

  return (
    <div className="col-span-full grid grid-cols-2 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <Card className="animate-fade flex h-full flex-col justify-between opacity-0">
        <CardHeader className="p-4">
          <CardDescription>Journey Length</CardDescription>
          <CardTitle className="min-h-[3rem] text-xl font-semibold tabular-nums leading-tight sm:text-3xl">
            {parsedData && parsedData.length > 0
              ? formatJourneyLength(parsedData[0].date)
              : "Starting your journey"}
          </CardTitle>
        </CardHeader>
        <CardFooter className="min-h-[2.5rem] flex-col items-start gap-1.5 px-4 pb-4 text-sm">
          <div className="line-clamp-1 flex gap-2 text-muted-foreground">
            {calculateTotalStats(liftTypes).totalReps.toLocaleString()} reps and{" "}
            {calculateTotalStats(liftTypes).totalSets.toLocaleString()} sets
            lifted
          </div>
          <div className="text-muted-foreground">&nbsp;</div>
        </CardFooter>
      </Card>
      <Card className="animate-fade flex h-full flex-col justify-between opacity-0 [animation-delay:250ms]">
        <CardHeader className="p-4">
          <CardDescription>Most Recent PR Single</CardDescription>
          <CardTitle className="min-h-[3rem] text-xl font-semibold tabular-nums leading-tight sm:text-3xl">
            {mostRecentPR
              ? `${mostRecentPR.liftType} 1@${mostRecentPR.weight}${mostRecentPR.unitType}`
              : "No PRs yet"}
          </CardTitle>
        </CardHeader>
        <CardFooter className="min-h-[2.5rem] flex-col items-start gap-1.5 px-4 pb-4 text-sm">
          <div className="text-muted-foreground">
            {mostRecentPR
              ? `Performed on ${format(new Date(mostRecentPR.date), "d MMMM yyyy")}`
              : ""}
          </div>
          <div className="text-muted-foreground">&nbsp;</div>
        </CardFooter>
      </Card>
      <Card className="animate-fade relative flex h-full flex-col justify-between opacity-0 [animation-delay:500ms]">
        {percentageChange !== 0 && (
          <CardAction className="">
            <span
              className={`flex items-center text-sm font-normal ${
                percentageChange > 0 ? "text-green-500" : "text-red-500"
              }`}
            >
              {percentageChange > 0 ? (
                <TrendingUp className="mr-1 h-4 w-4" />
              ) : (
                <TrendingDown className="mr-1 h-4 w-4" />
              )}
              {Math.abs(percentageChange)}%
            </span>
          </CardAction>
        )}
        <CardHeader className="p-4">
          <CardDescription>Session Momentum</CardDescription>
          <CardTitle className="min-h-[3rem] text-xl font-semibold tabular-nums leading-tight sm:text-3xl">
            {recentSessions} sessions
          </CardTitle>
        </CardHeader>
        <CardFooter className="min-h-[2.5rem] flex-col items-start gap-1.5 px-4 pb-4 text-sm">
          <div className="text-muted-foreground">in the last 90 days</div>
          <div className="text-muted-foreground">
            ({previousSessions} sessions in previous 90 days)
          </div>
        </CardFooter>
      </Card>
      <Card className="animate-fade flex h-full flex-col justify-between opacity-0 [animation-delay:750ms]">
        <CardHeader className="p-4">
          <CardDescription>In This Last 12 Months</CardDescription>
          <CardTitle className="min-h-[3rem] text-xl font-semibold tabular-nums leading-tight sm:text-3xl">
            {prsLast12Months.count} Personal Records
          </CardTitle>
        </CardHeader>
        <CardFooter className="min-h-[2.5rem] flex-col items-start gap-1.5 px-4 pb-4 text-sm">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="line-clamp-2 cursor-pointer text-muted-foreground">
                  {prsLast12Months.count > 0
                    ? `In the last 12 months you have PRs in ${prsLast12Months.liftTypes.join(", ")}`
                    : "No PRs in the last 12 months"}
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-[300px]">
                {prsLast12Months.count > 0
                  ? `Full list of PRs in the last 12 months:\n${prsLast12Months.liftTypes.join("\n")}`
                  : "No PRs in the last 12 months"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardFooter>
      </Card>
      <Card className="animate-fade flex h-full flex-col justify-between opacity-0 [animation-delay:1000ms]">
        <CardHeader className="p-4">
          <CardDescription>Current Streak</CardDescription>
          <CardTitle className="min-h-[3rem] text-xl font-semibold tabular-nums leading-tight sm:text-3xl">
            {currentStreak} week{currentStreak === 1 ? "" : "s"}
          </CardTitle>
        </CardHeader>
        <CardFooter className="min-h-[2.5rem] flex-col items-start gap-1.5 px-4 pb-4 text-sm">
          <div className="text-muted-foreground">
            At least three sessions a week for the last {currentStreak} week
            {currentStreak === 1 ? "" : "s"} (best streak: {bestStreak} week
            {bestStreak === 1 ? "" : "s"})
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

function formatJourneyLength(startDate) {
  const today = new Date();
  const start = parseISO(startDate);

  const years = differenceInCalendarYears(today, start);
  const months = differenceInCalendarMonths(today, start) % 12;
  const days = differenceInCalendarDays(today, start) % 30;

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
      const pr = singleReps[0]; // First item is highest weight
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

  const twelveMonthsAgo = subDays(new Date(), 365).toISOString().slice(0, 10);
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
 * @param {Array} parsedData - Array of workout entries sorted chronologically
 * @returns {Object} Object containing session counts and percentage change
 */
function calculateSessionMomentum(parsedData) {
  if (!parsedData || parsedData.length === 0) {
    return { recentSessions: 0, previousSessions: 0, percentageChange: 0 };
  }

  const today = new Date();
  const ninetyDaysAgo = subDays(today, 90);
  const oneEightyDaysAgo = subDays(today, 180);

  let recentSessions = 0;
  let previousSessions = 0;

  for (const entry of parsedData) {
    if (entry.isGoal) continue;

    if (!entry.date || typeof entry.date !== "string") {
      console.warn("Invalid entry.date in parsedData:", entry);
      continue;
    }

    const entryDate = parseISO(entry.date);

    if (entryDate >= ninetyDaysAgo && entryDate <= today) {
      recentSessions++;
    } else if (entryDate >= oneEightyDaysAgo && entryDate < ninetyDaysAgo) {
      previousSessions++;
    }
  }

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

/**
 * Calculates current streak and best streak of weeks with 3+ sessions
 * @param {Array} parsedData - Array of workout entries sorted chronologically
 * @returns {Object} Object containing current streak and best streak in weeks
 */
function calculateStreak(parsedData) {
  if (!parsedData || parsedData.length === 0) {
    return { currentStreak: 0, bestStreak: 0 };
  }

  const startTime = performance.now();

  // Group sessions by week (Monday as start of week)
  const weekMap = new Map();
  for (let i = 0; i < parsedData.length; i++) {
    const entry = parsedData[i];
    if (entry.isGoal) continue;

    if (!entry.date || typeof entry.date !== "string") {
      console.warn("Invalid entry.date in parsedData:", entry);
      continue;
    }
    const entryDate = parseISO(entry.date);
    const weekStart = format(
      startOfWeek(entryDate, { weekStartsOn: 1 }),
      "yyyy-MM-dd",
    );
    weekMap.set(weekStart, (weekMap.get(weekStart) || 0) + 1);
  }

  // Find the range of weeks
  const weekKeys = Array.from(weekMap.keys()).sort(); // ascending
  const mostRecentWeek =
    weekKeys.length > 0 ? weekKeys[weekKeys.length - 1] : null;
  const oldestWeek = weekKeys.length > 0 ? weekKeys[0] : null;
  if (!mostRecentWeek || !oldestWeek)
    return { currentStreak: 0, bestStreak: 0 };

  // Step week-by-week from most recent to oldest
  let currentStreak = 0;
  let bestStreak = 0;
  let tempStreak = 0;
  let weekCursor = parseISO(mostRecentWeek);
  const oldestWeekDate = parseISO(oldestWeek);

  while (weekCursor >= oldestWeekDate) {
    const weekKey = format(weekCursor, "yyyy-MM-dd");
    const sessionCount = weekMap.get(weekKey) || 0;
    if (sessionCount >= 3) {
      tempStreak++;
      if (currentStreak === 0) currentStreak = tempStreak; // Only set currentStreak for the most recent run
      bestStreak = Math.max(bestStreak, tempStreak);
    } else {
      if (currentStreak !== 0) break; // Only break current streak on first interruption
      tempStreak = 0;
    }
    weekCursor = subWeeks(weekCursor, 1);
  }
  devLog(
    "calculateStreak execution time: " +
      `${Math.round(performance.now() - startTime)}ms`,
  );

  return { currentStreak, bestStreak };
}
