"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useContext, useState, useEffect } from "react";
import { devLog } from "@/lib/processing-utils";
import { ParsedDataContext } from "@/pages/_app";
import { Skeleton } from "./ui/skeleton";
import { useSession } from "next-auth/react";

import { Chart, ArcElement } from "chart.js";
import { Pie, Doughnut } from "react-chartjs-2";
import { getLiftColor } from "@/lib/get-lift-color";
import ChartDataLabels from "chartjs-plugin-datalabels";

Chart.register(ArcElement, ChartDataLabels);

export function LiftTypeFrequencyPieCard() {
  const { liftTypes } = useContext(ParsedDataContext);
  const { status: authStatus } = useSession();

  const pieData = liftTypes
    ?.map((item) => ({
      label: item.liftType,
      value: item.totalSets,
    }))
    .slice(0, 5); // Up to 5 lifts

  const backgroundColors = pieData?.map((item) => getLiftColor(item.label));

  const pieChartData = {
    labels: pieData?.map((item) => item.label),
    datasets: [
      {
        // label: "Total Sets:",
        data: pieData,
        backgroundColor: backgroundColors,
        borderWidth: 3,
        hoverOffset: 5,
        hoverBorderColor: "#222222",
      },
    ],
  };

  let pieChartOptions = {
    type: "pie",
    responsive: true,
    font: {
      family: "Catamaran",
      size: 20,
      weight: "bold",
    },
    plugins: {
      legend: {
        display: false,
      },
      datalabels: {
        backgroundColor: function (context) {
          return context.dataset.backgroundColor; // Follow lift background color
        },
        borderColor: "white",
        borderRadius: 25,
        borderWidth: 2,
        color: "white",
        font: {
          weight: "bold",
          size: "11",
        },
        padding: 10,
      },
    },
  };

  return (
    <Card className="flex-1 justify-center">
      <CardHeader>
        <CardTitle>
          {authStatus === "unauthenticated" && "Demo mode: "} Your Top{" "}
          {pieData?.length > 0 ? pieData.length : ""} Lifts
        </CardTitle>
      </CardHeader>
      <CardContent className="">
        {/* I find the Skeleton here never appears long enough to provide value */}
        {/* {(!pieChartData || !liftTypes) && <Skeleton className="" />} */}
        {pieChartData && <Pie data={pieChartData} options={pieChartOptions} />}
        {/* <CircularProgressWithLetter progress={97} letter="F" /> */}
      </CardContent>
    </Card>
  );
}

function CircularProgressWithLetter({ progress, letter }) {
  // Determine color based on progress value
  let color;
  if (progress < 40) {
    color = "#ff2222"; // Red
  } else if (progress >= 40 && progress <= 60) {
    color = "#ffa500"; // Orange
  } else {
    color = "#00bb00"; // Green
  }

  const data = {
    datasets: [
      {
        data: [progress, 100 - progress], // progress is your dynamic value
        backgroundColor: [color, "#ebedef"],
        borderWidth: 0,
        cutout: "70%",
      },
    ],
  };

  const options = {
    maintainAspectRatio: false,
    plugins: {
      tooltip: {
        enabled: false,
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
          fontSize: "3em",
        }}
      >
        {letter}
      </div>
    </div>
  );
}
