"use client";

import * as React from "react";
import { devLog } from "@/lib/processing-utils";

import { Label, Pie, PieChart } from "recharts";

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

export function CircularProgressWithLetter({ progress = 90 }) {
  // Determine color based on progress value
  const { grade, color } = getGradeAndColor(progress);

  const chartConfig = {
    consistency: {
      label: "consistency",
      color: "blue",
    },
  };

  const chartData = [
    {
      consistency: progress,
      fill: color,
    },
    {
      consistency: 100 - progress,
      fill: "transparent",
    },
  ];

  return (
    <ChartContainer
      config={chartConfig}
      className="mx-auto aspect-square min-h-[100px]"
    >
      <PieChart>
        <Pie
          data={chartData}
          dataKey="consistency"
          innerRadius={26}
          strokeWidth={5}
        >
          <Label
            content={({ viewBox }) => {
              if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                return (
                  <text
                    x={viewBox.cx}
                    y={viewBox.cy}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-foreground text-2xl font-bold"
                  >
                    {grade}
                  </text>
                );
              }
            }}
          />
        </Pie>
      </PieChart>
    </ChartContainer>
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
// FIXME: 202407 with the shadcn charts the hue color is not working?
export const getGradeAndColor = (progress) => {
  for (let i = 0; i < thresholds.length; i++) {
    if (progress >= thresholds[i].minProgress) {
      const saturation = 90;
      const lightness = 10 + progress / 2; // Increase lightness as progress increases
      const color = `hsl(${thresholds[i].hue}, ${saturation}%, ${lightness}%)`;
      return { grade: thresholds[i].grade, color };
    }
  }
};
