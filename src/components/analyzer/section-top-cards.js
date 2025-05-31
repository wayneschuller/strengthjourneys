"use client";

import {
  Card,
  CardContent,
  CardFooter,
  CardDescription,
  CardHeader,
  CardTitle,
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
} from "date-fns";

import { TrendingUp, CalendarDays } from "lucide-react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CircularProgressWithLetter } from "./circular-progress-with-letter";

// Show a section row of key metrics on smaller cards
export function SectionTopCards() {
  const {
    parsedData,
    liftTypes,
    topLiftsByTypeAndReps,
    topLiftsByTypeAndRepsLast12Months,
  } = useUserLiftingData();
  const { status: authStatus } = useSession();

  // Memoize the processing of data
  const results = useMemo(() => processData(parsedData), [parsedData]);

  // Find the most recent PR single from top 5 most frequent lifts
  const mostRecentPR = findMostRecentSinglePR(topLiftsByTypeAndReps, liftTypes);

  devLog(topLiftsByTypeAndReps);

  return (
    <div className="col-span-full grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <Card className="flex-1">
        <CardHeader className="">
          <CardDescription>Journey Length</CardDescription>
          <CardTitle className="text-xl font-semibold tabular-nums sm:text-3xl">
            {parsedData && parsedData.length > 0
              ? formatJourneyLength(parsedData[0].date)
              : "Starting your journey"}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 pb-2 text-sm">
          <div className="line-clamp-1 flex gap-2 text-muted-foreground">
            {calculateTotalStats(liftTypes).totalReps.toLocaleString()} reps and{" "}
            {calculateTotalStats(liftTypes).totalSets.toLocaleString()} sets
            lifted
          </div>
        </CardFooter>
      </Card>
      <Card className="flex-1">
        <CardHeader>
          <CardDescription>Most Recent PR Single</CardDescription>
          <CardTitle className="text-xl font-semibold tabular-nums sm:text-3xl">
            {mostRecentPR
              ? `${mostRecentPR.liftType} 1@${mostRecentPR.weight}${mostRecentPR.unitType}`
              : "No PRs yet"}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">
            {mostRecentPR
              ? `Performed on ${format(new Date(mostRecentPR.date), "d MMMM yyyy")}`
              : ""}
          </div>
        </CardFooter>
      </Card>
      <Card className="flex-1">
        <CardHeader>
          <CardDescription>Average Monthly Sessions</CardDescription>
          <CardTitle className="text-xl font-semibold tabular-nums sm:text-3xl">
            3 sessions per month
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">
            Last year was 2.3 sessions per month{" "}
          </div>
        </CardFooter>
      </Card>
      <Card className="flex-1">
        <CardHeader>
          <CardDescription>In This Last 12 Months</CardDescription>
          <CardTitle className="text-xl font-semibold tabular-nums sm:text-3xl">
            5 Personal Records
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 pb-2 text-sm">
          <div className="text-muted-foreground">
            In the last 12 months you have PRs in Squat, Bench and Snatch
          </div>
        </CardFooter>
      </Card>
      <Card className="flex-1">
        <CardHeader>
          <CardDescription>Current Streak</CardDescription>
          <CardTitle className="text-xl font-semibold tabular-nums sm:text-3xl">
            7 weeks
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 pb-2 text-sm">
          <div className="text-muted-foreground">
            You've trained at least three times a week for the last 7 weeks
          </div>
          <div className="text-muted-foreground">Best streak: 23 weeks</div>
        </CardFooter>
      </Card>
    </div>
  );
}

function subtractDays(dateStr, days) {
  const date = parseISO(dateStr);
  return subDays(date, days).toISOString().slice(0, 10);
}

export function processData(parsedData) {
  if (!parsedData) return null;

  const startTime = performance.now();
  const today = new Date().toISOString().slice(0, 10); // Format today's date as "YYYY-MM-DD"

  const workoutRangeDays = differenceInCalendarDays(
    parseISO(today),
    parseISO(parsedData[0].date),
  );

  // Determine the relevant periods
  const relevantPeriods = [];
  for (let i = 0; i < periodTargets.length; i++) {
    relevantPeriods.push(periodTargets[i]);
    if (periodTargets[i].days > workoutRangeDays) {
      break; // Include the first period beyond the workout range days
    }
  }

  // Compute start dates for each period, for easier comparison
  const periodStartDates = relevantPeriods.map((period) => ({
    label: period.label,
    startDate: subtractDays(today, period.days - 1),
  }));

  // devLog(periodStartDates);

  const periodDates = relevantPeriods.reduce((acc, period) => {
    acc[period.label] = new Set();
    return acc;
  }, {});

  // Loop backwards through the parsed data
  for (let i = parsedData.length - 1; i >= 0; i--) {
    const entryDate = parsedData[i].date; // Directly use the date string

    if (parsedData[i].isGoal) continue; // Don't count entries that are just dreams

    // Loop backwards through the period start dates
    for (let j = periodStartDates.length - 1; j >= 0; j--) {
      if (entryDate < periodStartDates[j].startDate) {
        break; // Since we're moving backwards, if the date is before the start date, skip this and further earlier periods
      }
      periodDates[periodStartDates[j].label].add(entryDate); // Record an entry for this unique session date in this period
    }
  }

  // devLog(periodDates);

  const results = relevantPeriods.map((period) => {
    const actualWorkouts = periodDates[period.label].size;
    const totalWorkoutsExpected = Math.round((period.days / 7) * 3); // Expecation is 3 per week on average
    const rawPercentage = (actualWorkouts / totalWorkoutsExpected) * 100;
    const consistencyPercentage = Math.min(Math.round(rawPercentage), 100); // Cap the percentage at 100

    let tooltip = "";

    return {
      label: period.label,
      percentage: consistencyPercentage,
      tooltip: tooltip,
    };
  });

  devLog(
    "processConsistency execution time: " +
      `${Math.round(performance.now() - startTime)}ms`,
  );

  return results;
}

// These are the full period targets we will analyse for consistency.
// However if the user only has limited data it will choose the smallest cycle plus one extra
// So as the user lifts over time they should unlock new consistency arc charts
// The algorithm assumes each period is longer than the next
const periodTargets = [
  {
    label: "Week",
    days: 7,
  },
  {
    label: "Month",
    days: 30, // Approximate is good enough
  },
  {
    label: "3 Month",
    days: 90,
  },
  {
    label: "Half Year",
    days: 180,
  },
  {
    label: "Year",
    days: 345, // Lower to allow some rest days
  },
  {
    label: "24 Month",
    days: 350 * 2, // Lower to allow some rest days
  },
  {
    label: "5 Year",
    days: 350 * 5,
  },
  {
    label: "Decade",
    days: 350 * 10,
  },
];

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
