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
  formatISO,
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

  return (
    <div className="col-span-full grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <Card className="flex-1">
        <CardHeader className="">
          <CardDescription>Journey Length</CardDescription>
          <CardTitle className="text-xl font-semibold tabular-nums sm:text-3xl">
            Over 10 years lifting
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 pb-2 text-sm">
          <div className="line-clamp-1 flex gap-2 text-muted-foreground">
            3453 reps and 2323 sets lifted.
          </div>
        </CardFooter>
      </Card>
      <Card className="flex-1">
        <CardHeader>
          <CardDescription>Most Recent PR</CardDescription>
          <CardTitle className="text-xl font-semibold tabular-nums sm:text-3xl">
            Bench Press 1@136kg
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">
            Performed on 1 January 2024
          </div>
        </CardFooter>
      </Card>
      <Card className="flex-1">
        <CardHeader>
          <CardDescription>Average monthly sessions</CardDescription>
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
          <CardDescription>In this last 12 months</CardDescription>
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
          <CardDescription>Current streak</CardDescription>
          <CardTitle className="text-xl font-semibold tabular-nums sm:text-3xl">
            7 weeks
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 pb-2 text-sm">
          <div className="text-muted-foreground">
            You've trained at least once a week for the last 7 weeks.
          </div>
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
