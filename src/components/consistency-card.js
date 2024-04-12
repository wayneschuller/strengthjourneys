"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useContext, useState, useEffect } from "react";
import { devLog } from "@/lib/processing-utils";
import { Skeleton } from "./ui/skeleton";
import { useSession } from "next-auth/react";
import {
  parseISO,
  subDays,
  differenceInCalendarDays,
  formatISO,
} from "date-fns";

import { Chart, ArcElement } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { getLiftColor } from "@/lib/get-lift-color";
import { useUserLiftingData } from "@/lib/use-userlift-data";
import { useTheme } from "next-themes";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

Chart.register(ArcElement);

export function ConsistencyCard() {
  const { parsedData, isLoading } = useUserLiftingData();
  const { status: authStatus } = useSession();

  if (isLoading) return null;

  const consistency = processConsistency(parsedData);

  return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle>
          {authStatus === "unauthenticated" && "Demo mode: "} Consistency
          Analysis{" "}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {consistency.map((item) => (
            <TooltipProvider key={item.label}>
              <Tooltip>
                <TooltipTrigger>
                  <div className="flex-col text-center">
                    <div className="">
                      <CircularProgressWithLetter progress={item.percentage} />
                    </div>
                    <div>{item.label}</div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="w-40">
                    <div className="text-center text-2xl">
                      {item.percentage}%
                    </div>
                    <div>{item.tooltip}</div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Define base hues as constants
const HUE_GREEN = 120;
const HUE_YELLOW = 60;
const HUE_ORANGE = 30;
const HUE_RED = 0;

// Define thresholds for grades and colors using constants
const thresholds = [
  { minProgress: 100, grade: "A+", hue: HUE_GREEN },
  { minProgress: 90, grade: "A", hue: HUE_GREEN },
  { minProgress: 80, grade: "A-", hue: HUE_GREEN },
  { minProgress: 70, grade: "B+", hue: HUE_YELLOW },
  { minProgress: 59, grade: "B", hue: HUE_YELLOW },
  { minProgress: 50, grade: "B-", hue: HUE_YELLOW },
  { minProgress: 42, grade: "C+", hue: HUE_ORANGE },
  { minProgress: 36, grade: "C", hue: HUE_ORANGE },
  { minProgress: 30, grade: "C-", hue: HUE_ORANGE },
  { minProgress: 0, grade: ".", hue: HUE_RED }, // Red for low progress
];

// Function to determine grade and HSL color based on progress
const getGradeAndColor = (progress) => {
  for (let i = 0; i < thresholds.length; i++) {
    if (progress >= thresholds[i].minProgress) {
      const saturation = 90;
      const lightness = 10 + progress / 2; // Increase lightness as progress increases
      const color = `hsl(${thresholds[i].hue}, ${saturation}%, ${lightness}%)`;
      return { grade: thresholds[i].grade, color };
    }
  }
};

function CircularProgressWithLetter({ progress }) {
  // Determine color based on progress value
  const { grade, color } = getGradeAndColor(progress);

  // devLog(color);

  const data = {
    datasets: [
      {
        data: [progress, 100 - progress], // progress is your dynamic value
        backgroundColor: [color, "transparent"],
        borderWidth: 0,
        cutout: "70%",
      },
    ],
  };

  const options = {
    maintainAspectRatio: false,
    responsive: true,
    plugins: {
      datalabels: {
        display: false,
      },
    },
  };

  return (
    <div style={{ position: "relative" }}>
      <Doughnut data={data} options={options} />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          fontSize: "2em",
        }}
      >
        {grade}
      </div>
    </div>
  );
}

function subtractDays(dateStr, days) {
  const date = parseISO(dateStr);
  return subDays(date, days).toISOString().slice(0, 10);
}

function processConsistency(parsedData) {
  if (!parsedData || !parsedData.length) {
    devLog("No data provided");
    return [];
  }

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

    const totalWorkoutsGradeJump = calculateGradeJump(
      actualWorkouts,
      totalWorkoutsExpected,
    );

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
    days: 92,
  },
  {
    label: "Half Year",
    days: 183,
  },
  {
    label: "Year",
    days: 365,
  },
  {
    label: "24 Month",
    days: 365 * 2,
  },
  {
    label: "5 Year",
    days: 365 * 5,
  },
  {
    label: "Decade",
    days: 365 * 10 + 2,
  },
];

// Function to calculate how many more workouts needed to reach the next grade
// FIXME: this is NQR
function calculateGradeJump(actualWorkouts, totalWorkoutsExpected) {
  let currentProgress = (actualWorkouts / totalWorkoutsExpected) * 100;

  // Find the first threshold that is greater than the current progress
  const nextThreshold = thresholds.find(
    (threshold) => threshold.minProgress > currentProgress,
  );

  // If there's no higher threshold, return 0 as no more workouts can improve the grade
  if (!nextThreshold) {
    return 0;
  }

  // Calculate the exact number of workouts needed to reach the next threshold
  const requiredProgressToNextGrade = nextThreshold.minProgress;
  const workoutsNeeded =
    Math.ceil((requiredProgressToNextGrade * totalWorkoutsExpected) / 100) -
    actualWorkouts;

  return workoutsNeeded;
}
