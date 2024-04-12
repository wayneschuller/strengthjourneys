"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useContext, useState, useEffect } from "react";
import { devLog } from "@/lib/processing-utils";
import { Skeleton } from "./ui/skeleton";
import { useSession } from "next-auth/react";

import { Chart, ArcElement, Tooltip } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { getLiftColor } from "@/lib/get-lift-color";
import { useUserLiftingData } from "@/lib/use-userlift-data";
import { useTheme } from "next-themes";

Chart.register(ArcElement);

export function ConsistencyCard() {
  const { liftTypes } = useUserLiftingData();
  const { status: authStatus } = useSession();

  const consistency = processConsistency();

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
            <div className="flex-col text-center">
              <CircularProgressWithLetter progress={item.percentage} />
              <div>{item.label}</div>
            </div>
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

function processConsistency() {
  let consistency;

  consistency = [
    {
      label: "Week",
      percentage: 98,
      tooltip:
        "Lift 3 times a week for n more weeks to advance to the next grade",
    },
    {
      label: "Month",
      percentage: 91,
      tooltip:
        "Lift 3 times a week for n more weeks to advance to the next grade",
    },
    {
      label: "3 Month",
      percentage: 84,
      tooltip:
        "Lift 3 times a week for n more weeks to advance to the next grade",
    },
    {
      label: "Half Year",
      percentage: 74,
      tooltip:
        "Lift 3 times a week for n more weeks to advance to the next grade",
    },
    {
      label: "Year",
      percentage: 72,
      tooltip:
        "Lift 3 times a week for n more weeks to advance to the next grade",
    },
    {
      label: "24 Month",
      percentage: 61,
      tooltip:
        "Lift 3 times a week for n more weeks to advance to the next grade",
    },
    {
      label: "5 Year",
      percentage: 34,
      tooltip:
        "Lift 3 times a week for n more weeks to advance to the next grade",
    },
    {
      label: "Decade",
      percentage: 21,
      tooltip:
        "Lift 3 times a week for n more weeks to advance to the next grade",
    },
  ];

  return consistency;
}
