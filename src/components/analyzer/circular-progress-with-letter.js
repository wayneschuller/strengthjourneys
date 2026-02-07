"use client";

import * as React from "react";
import { Label, Pie, PieChart } from "recharts";

import {
  ChartConfig,
  ChartContainer,
} from "@/components/ui/chart";
import { getGradeAndColor } from "@/lib/consistency-grades";

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
