"use client";

// -------------------------------
/**
 * visualizer-reps.js
 *
 * ShadCN-style card component with a chart that visualises Singles, Triples, and Fives
 * for a given lift.  It expects the already-parsed `data` array you use
 * elsewhere in Strength Journeys:
 *
 *   {
 *     date: "2025-07-11",
 *     liftType: "Back Squat",
 *     reps: 5,
 *     weight: 112.5,
 *     unitType: "lb",
 *   }
 *
 * Assumptions
 * ───────────
 * • parsedData is chronologically ordered oldest→newest.
 * • You only need the heaviest set per calendar day for each rep range.
 */

import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { devLog } from "@/lib/processing-utils";
import { useLocalStorage, useWindowSize } from "usehooks-ts";

import {
  TimeRangeSelect,
  calculateThresholdDate,
  getTimeRangeDescription,
} from "./time-range-select";

import {
  ResponsiveContainer,
  LineChart,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Line,
  Area,
  Legend,
} from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { useSession } from "next-auth/react";
import { getLiftColor } from "@/lib/get-lift-color";
import { ChartContainer } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { VisualizerRepsTooltip } from "./visualizer-utils";

const repTabs = [
  { label: "Singles", reps: 1, color: "#ef4444" }, // red-500
  { label: "Triples", reps: 3, color: "#3b82f6" }, // blue-500
  { label: "Fives", reps: 5, color: "#10b981" }, // emerald-500
];

export function VisualizerReps({ data, liftType }) {
  const { parsedData, isLoading } = useUserLiftingData();
  const { status: authStatus } = useSession();

  const [timeRange, setTimeRange] = useLocalStorage(
    "SJ_timeRange",
    "MAX", // MAX, 3M, 6M, 1Y, 2Y, 5Y etc.
    {
      initializeWithValue: false,
    },
  );

  // Add state for toggling line visibility
  const [visible, setVisible] = useState({ 1: true, 3: true, 5: true });
  const handleLegendClick = (reps) => {
    setVisible((prev) => ({ ...prev, [reps]: !prev[reps] }));
  };

  // Compute daily bests for each rep range
  const chartDataByReps = useMemo(() => {
    if (!parsedData) {
      // Return empty arrays for each rep if data is not loaded
      const empty = {};
      repTabs.forEach((t) => {
        empty[t.reps] = [];
      });
      return empty;
    }
    const result = {};
    repTabs.forEach((t) => {
      result[t.reps] = getDailyBest(
        parsedData,
        liftType,
        t.reps,
        timeRange,
        setTimeRange,
      );
    });
    return result;
  }, [parsedData, liftType, timeRange]);

  // Merge all dates for X axis
  const allDates = Array.from(
    new Set(
      repTabs.flatMap((t) => chartDataByReps[t.reps].map((d) => d.date)).sort(),
    ),
  );

  // Build chart data: one object per date, with weight for each rep range
  const chartData = allDates.map((date) => {
    const entry = { date };
    repTabs.forEach((t) => {
      const found = chartDataByReps[t.reps].find((d) => d.date === date);
      entry[`reps${t.reps}`] = found ? found.weight : null;
      entry[`reps${t.reps}_tuple`] = found || null; // Store the full tuple
    });
    // Add rechartsDate field for consistency with visualizer-processing.js
    entry.rechartsDate = Date.UTC(
      new Date(date).getFullYear(),
      new Date(date).getMonth(),
      new Date(date).getDate(),
    );
    return entry;
  });

  devLog(chartData);

  // Show skeleton if loading or no data yet
  if (isLoading || !parsedData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Singles, Triples and Fives</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] w-full items-center justify-center">
            <Skeleton className="h-full w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // If no data at all
  if (!allDates.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Singles, Triples and Fives</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No data for {liftType}.</p>
        </CardContent>
      </Card>
    );
  }

  // Chart config for ChartContainer (for theming/colors)
  const chartConfig = repTabs.reduce((acc, t) => {
    acc[t.label] = { label: t.label, color: t.color };
    return acc;
  }, {});

  // Custom legend renderer
  function CustomLegend() {
    return (
      <div className="flex items-center justify-center gap-4 pt-3">
        {repTabs.map((t) => (
          <button
            key={t.reps}
            type="button"
            onClick={() => handleLegendClick(t.reps)}
            className={`flex items-center gap-1.5 transition-opacity focus:outline-none ${visible[t.reps] ? "opacity-100" : "opacity-50"}`}
            style={{ cursor: "pointer" }}
            aria-pressed={visible[t.reps] ? "true" : "false"}
            tabIndex={0}
          >
            <span
              className="h-2.5 w-2.5 rounded-[2px]"
              style={{ backgroundColor: t.color, display: "inline-block" }}
            />
            <span style={{ color: t.color }}>{t.label}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <CardTitle>
          {authStatus === "unauthenticated" && "Demo Mode: "}
          {liftType} Singles, Triples and Fives
        </CardTitle>
        <TimeRangeSelect timeRange={timeRange} setTimeRange={setTimeRange} />
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart data={chartData} margin={{ left: 5, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.08} />
            <XAxis
              dataKey="rechartsDate"
              type="number"
              scale="time"
              domain={[
                (dataMin) =>
                  new Date(dataMin).setDate(new Date(dataMin).getDate() - 2),
                (dataMax) =>
                  new Date(dataMax).setDate(new Date(dataMax).getDate() + 2),
              ]}
              tickFormatter={formatXAxisDateString}
            />
            <YAxis
              tick={{ fill: "#d1d5db", fontSize: 12 }}
              domain={["auto", "auto"]}
              width={60}
              tickFormatter={(value, index) => {
                const d = chartData[index] || {};
                const unitType =
                  d.reps1_tuple?.unitType ||
                  d.reps3_tuple?.unitType ||
                  d.reps5_tuple?.unitType ||
                  "";
                return `${value}${unitType}`;
              }}
            />
            <Tooltip content={<VisualizerRepsTooltip />} />
            <Legend content={<CustomLegend />} />
            {repTabs.map((t) =>
              visible[t.reps] ? (
                <Area
                  key={t.reps}
                  type="monotone"
                  dataKey={`reps${t.reps}`}
                  name={`reps${t.reps}`}
                  stroke={t.color}
                  strokeWidth={2}
                  dot={false}
                  fill={`url(#fill`}
                  fillOpacity={0.4}
                  connectNulls={true}
                />
              ) : null,
            )}
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// FIXME: This code could be shared with VisualizerMini
const formatXAxisDateString = (tickItem) => {
  const date = new Date(tickItem);
  return date.toLocaleString("en-US", { month: "short", day: "numeric" });
};

// ────────────────────────────────────────────────────────────
// util: collapse many sets on the same day → single best set
// ────────────────────────────────────────────────────────────
const getDailyBest = (data, liftType, repsWanted, timeRange, setTimeRange) => {
  const bestByDate = Object.create(null); // bare object map

  const rangeFirstDate = calculateThresholdDate(timeRange, setTimeRange);

  data.forEach((s) => {
    if (s.liftType !== liftType || s.reps !== repsWanted) return;

    if (s.date < rangeFirstDate) return; // Skip if date out of range of chart
    if (s.isGoal) return; // FIXME: implement goal dashed lines at some point
    // → YYYY-MM-DD (guaranteed stable)
    const dateKey = s.date;

    // keep the heaviest weight for that day
    if (!bestByDate[dateKey] || s.weight > bestByDate[dateKey].weight) {
      // Store the full tuple for future flexibility
      bestByDate[dateKey] = { ...s, date: dateKey };
    }
  });

  // because incoming data is already chronological, Object.values()
  // preserves order → no extra sort needed
  return Object.values(bestByDate);
};
