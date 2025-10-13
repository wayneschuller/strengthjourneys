"use client";

import { useMemo } from "react";
import { getLiftColor, useLiftColors } from "@/lib/color-tools";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useLocalStorage, useWindowSize } from "usehooks-ts";
import { devLog, getReadableDateString } from "@/lib/processing-utils";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ReferenceLine, Line } from "recharts";
import {
  TimeRangeSelect,
  calculateThresholdDate,
  getTimeRangeDescription,
} from "./time-range-select";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";

import {
  CartesianGrid,
  Area,
  AreaChart,
  LabelList,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

import { getYearLabels } from "./visualizer-processing";

export function TonnageChart({ setHighlightDate }) {
  const { parsedData } = useUserLiftingData();
  const [timeRange, setTimeRange] = useLocalStorage("SJ_timeRange", "MAX", {
    initializeWithValue: false,
  });
  const [showLabelValues, setShowLabelValues] = useLocalStorage(
    "SJ_showLabelValues",
    false,
  );

  const rangeFirstDate = calculateThresholdDate(timeRange, setTimeRange);

  const chartData = useMemo(() => {
    if (!parsedData || parsedData.length === 0) return [];
    return processTonnageData(parsedData, rangeFirstDate, timeRange);
  }, [parsedData, rangeFirstDate]);

  if (!parsedData) return null; // <-- gracefully handle null loading state

  // devLog(chartData);

  // devLog(timeRange);

  const unitType = parsedData?.[0]?.unitType ?? "";

  const handleMouseMove = (event) => {
    if (event && event.activePayload) {
      setHighlightDate(event.activePayload[0]?.payload?.date);
    }
  };

  const formatXAxisDate = (tickItem) => {
    const date = new Date(tickItem);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Define a valid chartConfig for shadcnui
  const chartConfig = {
    tonnage: {
      label: "Tonnage",
      // color: "#8884d8",
      color: "hsl(var(--chart-2))", // uses theme's first chart color for both light and dark
    },
  };

  const yearLabels = getYearLabels(chartData);

  return (
    <Card>
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1 text-pretty">
          <CardTitle>Total Tonnage</CardTitle>
          <CardDescription>
            {getTimeRangeDescription(rangeFirstDate, parsedData)}
          </CardDescription>
        </div>
        <div className="grid grid-cols-1 space-x-1">
          <TimeRangeSelect timeRange={timeRange} setTimeRange={setTimeRange} />
        </div>
      </CardHeader>

      <CardContent className="pl-0 pr-2">
        <ChartContainer config={chartConfig}>
          <AreaChart
            data={chartData}
            margin={{ left: 5, right: 20 }}
            onMouseMove={handleMouseMove}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="rechartsDate"
              type="number"
              scale="time"
              domain={[
                (dataMin) => dataMin - 2 * 24 * 60 * 60 * 1000,
                (dataMax) => dataMax + 2 * 24 * 60 * 60 * 1000,
              ]}
              tickFormatter={formatXAxisDate}
            />
            <YAxis
              tickFormatter={(value) => `${value}${unitType}`}
              domain={[0, (dataMax) => dataMax * 1.2]}
            />

            <Tooltip content={<TonnageTooltipContent />} />

            <defs>
              <linearGradient id="fillTonnage" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="hsl(var(--chart-2))"
                  stopOpacity={0.9}
                />
                <stop
                  offset="50%"
                  stopColor="hsl(var(--chart-2))"
                  stopOpacity={0.09}
                />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              // type="basis"
              dataKey="tonnage"
              // dataKey="rollingAverageTonnage"
              stroke="hsl(var(--chart-1))"
              fill="url(#fillTonnage)"
              // fill="#8884d8"
              // fillOpacity={0.2}
              // fillOpacity={0.1}
              dot={["3M", "6M"].includes(timeRange)} // Show point dots in short time ranges
              connectNulls
            >
              {showLabelValues && (
                <LabelList
                  position="top"
                  offset={12}
                  content={({ x, y, value }) => (
                    <text
                      x={x}
                      y={y}
                      dy={-10}
                      fontSize={12}
                      textAnchor="middle"
                      className="fill-foreground"
                    >
                      {`${Math.round(value)}${unitType}`}
                    </text>
                  )}
                />
              )}
            </Area>

            {/* Year labels to show year start */}
            {yearLabels.map(({ date, label }) => (
              <ReferenceLine
                key={`label-${date}`}
                x={date} // Position label at January 1 of each year
                stroke="none" // No visible line
                label={{
                  value: label,
                  position: "insideBottom",
                  fontSize: 14,
                  fill: "#666",
                }}
              />
            ))}
          </AreaChart>
        </ChartContainer>
      </CardContent>

      <CardFooter>
        <div className="flex w-full flex-col items-center justify-between gap-2 md:flex-row">
          <div className="flex items-center space-x-2">
            <Label className="font-light" htmlFor="show-values">
              Show Values
            </Label>
            <Switch
              id="show-values"
              value={showLabelValues}
              checked={showLabelValues}
              onCheckedChange={(show) => setShowLabelValues(show)}
            />
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}

/**
 * Aggregates total tonnage per date from parsedData
 */

function processTonnageData(parsedData, thresholdDateStr) {
  const startTime = performance.now();
  const tonnageMap = new Map();

  parsedData.forEach((tuple) => {
    const dateKey = tuple.date; // already "YYYY-MM-DD"
    if (dateKey >= thresholdDateStr) {
      const tonnage = tuple.weight * tuple.reps;
      tonnageMap.set(dateKey, (tonnageMap.get(dateKey) || 0) + tonnage);
    }
  });

  const chartData = Array.from(tonnageMap.entries())
    .map(([date, tonnage]) => ({
      date, // keep string date for use in setHighlightDate on mouseover
      rechartsDate: new Date(date).getTime(), // numeric timestamp for X-axis
      tonnage,
    }))
    .sort((a, b) => a.date - b.date);

  // Add rolling average
  const windowSize = 7; // 7-day moving average
  for (let i = 0; i < chartData.length; i++) {
    const windowData = chartData.slice(Math.max(0, i - windowSize + 1), i + 1);
    const avg =
      windowData.reduce((sum, d) => sum + d.tonnage, 0) / windowData.length;

    chartData[i].rollingAverageTonnage = isNaN(avg) ? null : Math.round(avg);
  }

  devLog(
    `processTonnageData() execution time: \x1b[1m${Math.round(
      performance.now() - startTime,
    )}ms\x1b[0m`,
  );

  return chartData;
}

const TonnageTooltipContent = ({ payload, label }) => {
  if (!payload || payload.length === 0) return null;

  const tonnage = payload[0].value;
  const dateLabel = new Date(label).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="grid min-w-[8rem] max-w-[24rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-bold">{dateLabel}</p>
      <div className="flex flex-row items-center">
        <div className="mr-1 h-2.5 w-2.5 shrink-0 rounded-[2px] bg-primary" />
        <div className="font-semibold">Total Tonnage</div>
      </div>
      <div>{`${tonnage.toFixed(0)} kg`}</div>
    </div>
  );
};
