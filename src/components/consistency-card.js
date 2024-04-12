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

  if (progress >= 100) {
    grade = "A+";
    color = "#33dd00"; // Green
  } else if (progress >= 90) {
    grade = "A";
    color = "#33dd00"; // Green
  } else if (progress >= 80) {
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
        tooltip = `Achieved ${actualWorkouts} sessions (get ${totalWorkoutsExpected} total to reach 3 per week on average for this period)`;
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
