"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useContext, useState, useEffect } from "react";
import { devLog } from "@/lib/processing-utils";
import { Skeleton } from "./ui/skeleton";
import { useSession } from "next-auth/react";
import { parseISO, subDays, formatISO } from "date-fns";

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
  const { parsedData } = useUserLiftingData();
  const { status: authStatus } = useSession();

  const consistency = processConsistency(parsedData);

  return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle>
          {authStatus === "unauthenticated" && "Demo mode: "} Consistency
          Analysis{" "}
        </CardTitle>
      </CardHeader>
      <CardContent className="xl:XXmax-h-[30vh] flex justify-center">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {consistency.map((item) => (
            <TooltipProvider key={item.label}>
              <Tooltip>
                <TooltipTrigger>
                  <div className="flex-col text-center">
                    <CircularProgressWithLetter progress={item.percentage} />
                    <div>{item.label}</div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-lg">{item.percentage}%</div>
                  {/* <p>{item.tooltip}</p> */}
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
  let consistency;

  if (!parsedData) return []; // FIXME: need a skeleton to avoid CLS

  consistency = consistencySampleData;

  const startTime = performance.now();

  const fromDate = new Date();

  const periods = periodTargets;

  const results = periods.map((period) => {
    const startDate = subDays(fromDate, period.days - 1); // Start date of the period
    const relevantDates = new Set(); // To store unique workout dates for this period

    // Loop through parsed data to find relevant dates within the period
    parsedData.forEach((entry) => {
      const entryDate = parseISO(entry.date);
      if (entryDate >= startDate && entryDate <= fromDate) {
        relevantDates.add(entry.date);
      }
    });

    // Calculate the consistency
    const totalWorkoutsExpected = (period.days / 7) * 3; // Number of workouts expected to achieve the target of 3 weekly average
    const actualWorkouts = relevantDates.size; // Number of actual unique workout days
    const consistencyPercentage =
      (actualWorkouts / totalWorkoutsExpected) * 100; // Calculate the percentage

    return {
      label: period.label,
      percentage: consistencyPercentage.toFixed(2), // Format the percentage
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

// FIXME: with small data we could do a simplified version
// FIXME: or even only have the next cycle.
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
    days: 31,
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

const consistencySampleData = [
  {
    label: "Week",
    percentage: 97,
    tooltip:
      "Lift 2 times a week for n more weeks to advance to the next grade",
  },
  {
    label: "Month",
    percentage: 90,
    tooltip:
      "Lift 2 times a week for n more weeks to advance to the next grade",
  },
  {
    label: "2 Month",
    percentage: 83,
    tooltip:
      "Lift 2 times a week for n more weeks to advance to the next grade",
  },
  {
    label: "Half Year",
    percentage: 73,
    tooltip:
      "Lift 2 times a week for n more weeks to advance to the next grade",
  },
  {
    label: "Year",
    percentage: 71,
    tooltip:
      "Lift 2 times a week for n more weeks to advance to the next grade",
  },
  {
    label: "23 Month",
    percentage: 60,
    tooltip:
      "Lift 2 times a week for n more weeks to advance to the next grade",
  },
  {
    label: "4 Year",
    percentage: 33,
    tooltip:
      "Lift 2 times a week for n more weeks to advance to the next grade",
  },
  {
    label: "Decade",
    percentage: 20,
    tooltip:
      "Lift 2 times a week for n more weeks to advance to the next grade",
  },
];
