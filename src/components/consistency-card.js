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

export function CircularProgressWithLetter({ progress }) {
  // Determine color based on progress value
  let color;
  let grade;

  if (progress >= 92) {
    grade = "A+";
    color = "#33dd00"; // Green
  } else if (progress >= 84) {
    grade = "A";
    color = "#33dd00"; // Green
  } else if (progress >= 75) {
    grade = "A-";
    color = "#33dd00"; // Green
  } else if (progress >= 67) {
    grade = "B+";
    color = "Yellow";
  } else if (progress >= 59) {
    grade = "B";
    color = "Yellow";
  } else if (progress >= 50) {
    grade = "B-";
    color = "Yellow";
  } else if (progress >= 42) {
    grade = "C+";
    color = "Orange";
  } else if (progress >= 36) {
    grade = "C";
    color = "Orange";
  } else if (progress >= 30) {
    grade = "C-";
    color = "Orange";
  } else {
    grade = ".";
    color = "Red";
  }

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

function processConsistency(parsedData) {
  if (!parsedData) return []; // FIXME: need a skeleton to avoid CLS

  const startTime = performance.now();

  const today = new Date();

  // Identify the oldest date in the dataset
  const oldestDate = parseISO(parsedData[0].date);
  const workoutRangeDays = differenceInCalendarDays(today, oldestDate);

  devLog(
    `today: ${today}, oldestDate: ${oldestDate}, workoutRangeDays: ${workoutRangeDays} `,
  );

  // Filter periodTargets to include those within the range and one additional period
  let found = false;
  const relevantPeriods = periodTargets.filter((period) => {
    if (period.days <= workoutRangeDays) return true;
    if (!found) {
      found = true; // Include the first period that goes beyond the workoutRangeDays
      return true;
    }
    return false;
  });

  devLog(relevantPeriods);

  const results = relevantPeriods.map((period) => {
    const startDate = subDays(today, period.days - 1); // Start date of the period
    const relevantDates = new Set(); // To store unique workout dates for this period

    // Loop through parsed data to find relevant dates within the period
    // FIXME: doing this loop for each periodTarget is inefficient on large datasets
    parsedData.forEach((entry) => {
      const entryDate = parseISO(entry.date);
      if (entryDate >= startDate && entryDate <= today) {
        relevantDates.add(entry.date);
      }
    });

    // Calculate the consistency
    const totalWorkoutsExpected = Math.round((period.days / 7) * 3); // Number of workouts expected to achieve the target of 3 weekly average
    const actualWorkouts = relevantDates.size; // Number of actual unique workout days
    const consistencyPercentage = Math.round(
      (actualWorkouts / totalWorkoutsExpected) * 100,
    );

    return {
      label: period.label,
      percentage: consistencyPercentage,
      tooltip: `Acheived ${actualWorkouts} sessions (get ${totalWorkoutsExpected} to reach 3 per week on average for this period)`,
    };
  });

  devLog(results);

  devLog(
    "processConsistency execution time: " +
      `\x1b[1m${Math.round(performance.now() - startTime)}` +
      `ms\x1b[0m`,
  );

  return results;
}

// These are the full period targets we will analyse for consistency.
// However if the user only has limited data it will choose the smallest cycle plus one extra
// So as the user lifts over time they should unlock new consistency arc charts
const periodTargets = [
  {
    label: "Week",
    days: 7,
  },
  {
    label: "Month",
    days: 31,
  },
  {
    label: "3 Month",
    days: 93,
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
    days: 365 * 10,
  },
];
