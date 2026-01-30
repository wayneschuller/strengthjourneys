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
  format,
  parseISO,
  differenceInCalendarYears,
  differenceInCalendarMonths,
  differenceInCalendarDays,
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

  const { currentStreak, bestStreak, sessionsThisWeek } = useMemo(
    () => calculateStreak(parsedData),
    [parsedData],
  );
  const sessionsNeededThisWeek = Math.max(0, 3 - (sessionsThisWeek ?? 0));

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
        <CardHeader className="p-4">
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
          <CardDescription>Weekly consistency</CardDescription>
          <CardTitle className="min-h-[3rem] text-xl font-semibold tabular-nums leading-tight sm:text-3xl">
            {currentStreak} week{currentStreak === 1 ? "" : "s"} in a row
          </CardTitle>
        </CardHeader>
        <CardFooter className="min-h-[2.5rem] flex-col items-start gap-1.5 px-4 pb-4 text-sm">
          <div className="text-muted-foreground">
            {currentStreak > 0
              ? `3+ sessions every week through last Sunday. Your best run: ${bestStreak} week${bestStreak === 1 ? "" : "s"}.`
              : `Aim for 3+ sessions per week. Your best so far: ${bestStreak} week${bestStreak === 1 ? "" : "s"} in a row.`}
          </div>
          {sessionsNeededThisWeek > 0 && (
            <div className="text-muted-foreground">
              {sessionsNeededThisWeek === 1
                ? "One more session by Sunday and you keep the streak going."
                : `${sessionsNeededThisWeek} more sessions by Sunday and you're still on track.`}
            </div>
          )}
          {sessionsNeededThisWeek === 0 && (sessionsThisWeek ?? 0) >= 3 && (
            <div className="text-muted-foreground">
              This week: 3+ sessions. You're on track.
            </div>
          )}
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

  const todayStr = new Date().toISOString().slice(0, 10);
  const twelveMonthsAgo = subtractDaysFromStr(todayStr, 365);
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

  const todayStr = new Date().toISOString().slice(0, 10);
  const ninetyDaysAgoStr = subtractDaysFromStr(todayStr, 90);
  const oneEightyDaysAgoStr = subtractDaysFromStr(todayStr, 180);

  let recentSessions = 0;
  let previousSessions = 0;

  for (const entry of parsedData) {
    if (entry.isGoal) continue;

    const dateStr = entry.date;
    if (!dateStr || typeof dateStr !== "string") {
      console.warn("Invalid entry.date in parsedData:", entry);
      continue;
    }

    // YYYY-MM-DD string comparison
    if (dateStr >= ninetyDaysAgoStr && dateStr <= todayStr) {
      recentSessions++;
    } else if (dateStr >= oneEightyDaysAgoStr && dateStr < ninetyDaysAgoStr) {
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

// Days in month (1-12); Feb uses 28, caller can pass 29 for leap year.
function daysInMonth(y, month1Based) {
  if (month1Based === 2) {
    const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    return isLeap ? 29 : 28;
  }
  if ([4, 6, 9, 11].includes(month1Based)) return 30;
  return 31;
}

// YYYY-MM-DD minus n days, returns "YYYY-MM-DD". Pure string/math, no Date.
function subtractDaysFromStr(dateStr, n) {
  let y = parseInt(dateStr.slice(0, 4), 10);
  let m = parseInt(dateStr.slice(5, 7), 10);
  let d = parseInt(dateStr.slice(8, 10), 10);
  for (let i = 0; i < n; i++) {
    d--;
    if (d < 1) {
      m--;
      if (m < 1) {
        m = 12;
        y--;
      }
      d = daysInMonth(y, m);
    }
  }
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// YYYY-MM-DD plus n days, returns "YYYY-MM-DD". Pure string/math, no Date.
function addDaysFromStr(dateStr, n) {
  let y = parseInt(dateStr.slice(0, 4), 10);
  let m = parseInt(dateStr.slice(5, 7), 10);
  let d = parseInt(dateStr.slice(8, 10), 10);
  for (let i = 0; i < n; i++) {
    const maxD = daysInMonth(y, m);
    d++;
    if (d > maxD) {
      d = 1;
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }
  }
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Calculates current streak and best streak of weeks with 3+ sessions.
 * Uses string comparison for dates (YYYY-MM-DD) and caches week key per unique date to avoid repeated date-fns work.
 * @param {Array} parsedData - Array of workout entries sorted chronologically
 * @returns {Object} Object containing current streak and best streak in weeks
 */
function calculateStreak(parsedData) {
  if (!parsedData || parsedData.length === 0) {
    return { currentStreak: 0, bestStreak: 0, sessionsThisWeek: 0 };
  }

  const startTime = performance.now();

  // Cache week key per unique date so we only compute once per day, not per entry (20k entries → ~few thousand days)
  const dateToWeekKey = new Map();
  const weekMap = new Map(); // weekKey -> Set of date strings (unique days)

  for (let i = 0; i < parsedData.length; i++) {
    const entry = parsedData[i];
    if (entry.isGoal) continue;
    const dateStr = entry.date;
    if (!dateStr || typeof dateStr !== "string") {
      console.warn("Invalid entry.date in parsedData:", entry);
      continue;
    }
    let weekKey = dateToWeekKey.get(dateStr);
    if (weekKey === undefined) {
      weekKey = getWeekKeyFromDateStr(dateStr);
      dateToWeekKey.set(dateStr, weekKey);
    }
    if (!weekMap.has(weekKey)) weekMap.set(weekKey, new Set());
    weekMap.get(weekKey).add(dateStr);
  }

  const weekSessionCount = new Map();
  weekMap.forEach((dates, weekKey) => {
    weekSessionCount.set(weekKey, dates.size);
  });

  const weekKeys = Array.from(weekSessionCount.keys()).sort(); // string sort is correct for YYYY-MM-DD
  if (weekKeys.length === 0) {
    return { currentStreak: 0, bestStreak: 0, sessionsThisWeek: 0 };
  }

  const oldestWeek = weekKeys[0];

  // This week's key and last week's key (one Date for today, then string helpers)
  const todayStr = new Date().toISOString().slice(0, 10);
  const thisWeekKey = getWeekKeyFromDateStr(todayStr);
  const lastWeekKey = subtractDaysFromStr(thisWeekKey, 7);
  const sessionsThisWeek = weekSessionCount.get(thisWeekKey) || 0;

  // Iterate week-by-week so gaps (weeks with no data) correctly break the streak.
  // Current streak: from last week backwards
  let currentStreak = 0;
  let currentStreakFinalized = false;
  let tempStreak = 0;
  let bestStreak = 0;

  let weekKey = lastWeekKey;
  while (weekKey >= oldestWeek) {
    const sessionCount = weekSessionCount.get(weekKey) || 0;
    if (sessionCount >= 3) {
      tempStreak++;
      if (!currentStreakFinalized) currentStreak = tempStreak;
      bestStreak = Math.max(bestStreak, tempStreak);
    } else {
      if (!currentStreakFinalized) currentStreakFinalized = true;
      tempStreak = 0;
    }
    weekKey = subtractDaysFromStr(weekKey, 7);
  }

  // Best streak: all weeks from oldest through last week (chronological)
  tempStreak = 0;
  weekKey = oldestWeek;
  while (weekKey <= lastWeekKey) {
    const sessionCount = weekSessionCount.get(weekKey) || 0;
    if (sessionCount >= 3) {
      tempStreak++;
      bestStreak = Math.max(bestStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
    weekKey = addDaysFromStr(weekKey, 7);
  }

  devLog(
    "calculateStreak execution time: " +
      `${Math.round(performance.now() - startTime)}ms`,
  );

  return { currentStreak, bestStreak, sessionsThisWeek };
}
