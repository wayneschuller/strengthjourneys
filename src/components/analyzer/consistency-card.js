"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useMemo } from "react";
import { devLog } from "@/lib/processing-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "next-auth/react";
import {
  format,
  parseISO,
  subDays,
  differenceInCalendarDays,
  formatISO,
} from "date-fns";

import { useUserLiftingData } from "@/hooks/use-userlift-data";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CircularProgressWithLetter } from "./circular-progress-with-letter";
import { CONSISTENCY_GRADE_THRESHOLDS } from "@/lib/consistency-grades";

export function ConsistencyCard() {
  const { parsedData } = useUserLiftingData();
  const { status: authStatus } = useSession();

  // const consistency = processConsistency(parsedData);
  // Memoize the consistency calculation
  const consistency = useMemo(
    () => processConsistency(parsedData),
    [parsedData],
  );

  // devLog(consistency);

  return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle>
          {authStatus === "unauthenticated" && "Demo mode: "} Consistency
          Analysis{" "}
        </CardTitle>
        <CardDescription>
          Benchmark is three sessions per week, with some rest weeks per year.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center">
        {!consistency ? (
          <Skeleton className="h-[40vh]" />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {consistency.map((item) => (
              <TooltipProvider key={item.label}>
                <Tooltip>
                  <TooltipTrigger>
                    <div className="flex flex-col items-center text-center">
                      <div className="">
                        <CircularProgressWithLetter
                          progress={item.percentage}
                        />
                      </div>
                      <div className="text-nowrap">{item.label}</div>
                      <p className="mt-1 text-xs text-muted-foreground sm:hidden">
                        {item.tooltip}
                      </p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="w-40">
                      <div className="text-center text-2xl sm:text-2xl lg:text-lg">
                        {item.percentage}%
                      </div>
                      <div>{item.tooltip}</div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function subtractDays(dateStr, days) {
  const date = parseISO(dateStr);
  return format(subDays(date, days), "yyyy-MM-dd");
}

export function processConsistency(parsedData) {
  if (!parsedData || parsedData.length === 0) return null;

  const startTime = performance.now();
  const today = format(new Date(), "yyyy-MM-dd"); // Local date, not UTC

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
    switch (true) {
      case actualWorkouts > totalWorkoutsExpected:
        tooltip = `Achieved ${
          actualWorkouts - totalWorkoutsExpected
        } more than the minimum # of sessions required for 3 per week average`;
        break;
      case actualWorkouts === totalWorkoutsExpected:
        tooltip = `Achieved exactly the required # of sessions for 3 per week average. You can stop lifting now.`;
        break;
      case actualWorkouts < totalWorkoutsExpected:
        tooltip = `Achieved ${actualWorkouts} sessions (get ${calculateGradeJump(
          actualWorkouts,
          totalWorkoutsExpected,
        )} more in this period to improve your grade)`;
        break;
    }

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

// Calculate how many more workouts needed to reach the next grade.
function calculateGradeJump(actualWorkouts, totalWorkoutsExpected) {
  if (totalWorkoutsExpected <= 0) return 0;

  const currentProgress = (actualWorkouts / totalWorkoutsExpected) * 100;

  // Find the next threshold strictly above current progress (next higher grade)
  const nextThreshold = CONSISTENCY_GRADE_THRESHOLDS.find(
    (t) => t.minProgress > currentProgress,
  );

  if (!nextThreshold) return 0; // Already at A+

  const minWorkoutsForNextGrade = Math.ceil(
    (nextThreshold.minProgress * totalWorkoutsExpected) / 100,
  );
  const workoutsNeeded = minWorkoutsForNextGrade - actualWorkouts;

  return Math.max(0, workoutsNeeded);
}
