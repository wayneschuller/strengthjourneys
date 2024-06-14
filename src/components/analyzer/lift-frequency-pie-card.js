"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useContext, useState, useEffect } from "react";
import { devLog } from "@/lib/processing-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "next-auth/react";

import { Chart, ArcElement } from "chart.js";
import { Pie, Doughnut } from "react-chartjs-2";
import { getLiftColor } from "@/lib/get-lift-color";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { useUserLiftingData } from "@/lib/use-userlift-data";

Chart.register(ArcElement, ChartDataLabels);

export function LiftTypeFrequencyPieCard() {
  const { liftTypes } = useUserLiftingData();
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
      tooltip: {
        enabled: true,
        callbacks: {
          label: function (context) {
            let label = context.label || "";
            if (label) {
              label += ": ";
            }
            if (context.formattedValue !== undefined) {
              devLog(context);
              label += context.formattedValue + " sets";
            }
            return label;
          },
        },
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
        formatter: function (value, context) {
          // devLog(value);
          return `${value.label}`; // Append 'sets' to the value
        },
      },
    },
  };

  return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle>
          {authStatus === "unauthenticated" && "Demo mode: "} Your Top{" "}
          {pieData?.length > 0 ? pieData.length : ""} Lifts
        </CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center xl:max-h-[30vh]">
        {pieChartData && <Pie data={pieChartData} options={pieChartOptions} />}
      </CardContent>
    </Card>
  );
}
