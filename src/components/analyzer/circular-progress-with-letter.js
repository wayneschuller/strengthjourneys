"use client";

import * as React from "react";
import { Label, Pie, PieChart } from "recharts";

import {
  ChartConfig,
  ChartContainer,
} from "@/components/ui/chart";
import { getGradeAndColor } from "@/lib/consistency-grades";

const SIZES = {
  sm: { minH: 100, innerRadius: 26, strokeWidth: 5, textClass: "text-2xl" },
  lg: { minH: 150, innerRadius: 42, strokeWidth: 8, textClass: "text-4xl" },
};

/**
 * Renders a circular pie-chart progress ring with a letter grade in the center.
 * Grade and ring color are derived from the progress percentage via getGradeAndColor.
 *
 * @param {Object} props
 * @param {number} [props.progress=90] - Percentage filled (0–100) used to draw the ring and derive the grade.
 * @param {"sm"|"lg"} [props.size="sm"] - Size preset controlling ring radius and font size.
 * @param {number} [props.gradeOverride] - When provided, overrides progress for grade/color calculation only
 *   while the ring still animates from the actual progress value.
 */
export function CircularProgressWithLetter({ progress = 90, size = "sm", gradeOverride }) {
  const displayProgress = gradeOverride ?? progress;
  const { grade, color } = getGradeAndColor(displayProgress);
  const { minH, innerRadius, strokeWidth, textClass } = SIZES[size] ?? SIZES.sm;

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
      className="mx-auto aspect-square"
      style={{ minHeight: minH }}
    >
      <PieChart>
        <Pie
          data={chartData}
          dataKey="consistency"
          innerRadius={innerRadius}
          strokeWidth={strokeWidth}
          isAnimationActive={true}
          animationDuration={800}
          animationBegin={0}
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
                    className={`fill-foreground font-bold ${textClass}`}
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
