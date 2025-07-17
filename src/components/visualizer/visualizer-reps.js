"use client";

// -------------------------------
/**
 * visualizer-reps.js
 *
 * ShadCN-style tab component that visualises Singles, Triples, and Fives
 * for a given lift.  It expects the already-parsed `data` array you use
 * elsewhere in Strength Journeys:
 *
 *   {
 *     session_date: "2025-07-11T09:32:00Z",
 *     liftType: "Back Squat",
 *     reps: 5,
 *     weight: 112.5,
 *     // ...other props (rpe, e1rm, etc.)
 *   }
 *
 * Assumptions
 * ───────────
 * • parsedData is chronologically ordered oldest→newest.
 * • You only need the heaviest set per calendar day for each rep range.
 * • The project already has shadcn/ui (Tabs) and Recharts installed.
 */

import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserLiftingData } from "@/hooks/use-userlift-data";

import {
  ResponsiveContainer,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Line,
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

// ────────────────────────────────────────────────────────────
// util: collapse many sets on the same day → single best set
// ────────────────────────────────────────────────────────────
const getDailyBest = (data, liftType, repsWanted) => {
  const bestByDate = Object.create(null); // bare object map

  data.forEach((s) => {
    if (s.liftType !== liftType || s.reps !== repsWanted) return;

    // → YYYY-MM-DD (guaranteed stable)
    // const dateKey = new Date(s.session_date).toISOString().slice(0, 10);
    const dateKey = s.date;

    // keep the heaviest weight for that day
    if (!bestByDate[dateKey] || s.weight > bestByDate[dateKey].weight) {
      bestByDate[dateKey] = { date: dateKey, weight: s.weight };
    }
  });

  // because incoming data is already chronological, Object.values()
  // preserves order → no extra sort needed
  return Object.values(bestByDate);
};

// Tab configuration – extendable
const repTabs = [
  { label: "Singles", reps: 1, color: "#ef4444" }, // red-500
  { label: "Triples", reps: 3, color: "#3b82f6" }, // blue-500
  { label: "Fives", reps: 5, color: "#10b981" }, // emerald-500
];

export function VisualizerReps({ data, liftType }) {
  const { parsedData, isLoading } = useUserLiftingData();
  const { status: authStatus } = useSession();

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
      result[t.reps] = getDailyBest(parsedData, liftType, t.reps);
    });
    return result;
  }, [parsedData, liftType]);

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
    });
    return entry;
  });

  // State for toggling line visibility
  const [visible, setVisible] = useState({ 1: true, 3: true, 5: true });

  const handleLegendClick = (o) => {
    const reps = Number(o.dataKey.replace("reps", ""));
    setVisible((v) => ({ ...v, [reps]: !v[reps] }));
  };

  // Show skeleton if loading or no data yet
  if (isLoading || !parsedData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Singles, Triples and Fives Progression</CardTitle>
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
          <CardTitle>Singles, Triples and Fives Progression</CardTitle>
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Singles, Triples and Fives Progression</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <LineChart
            width={undefined}
            height={undefined}
            data={chartData}
            margin={{ top: 10, right: 30, left: 20, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.08} />
            <XAxis
              dataKey="date"
              tick={{ fill: "#d1d5db", fontSize: 12 }}
              padding={{ left: 10, right: 10 }}
            />
            <YAxis
              tick={{ fill: "#d1d5db", fontSize: 12 }}
              domain={["auto", "auto"]}
              width={60}
            />
            <Tooltip
              contentStyle={{ background: "#111827", border: "none" }}
              labelStyle={{ color: "#f3f4f6" }}
              formatter={(v, name) => [
                `${v} kg`,
                `${name.replace("reps", "")}-rep`,
              ]}
            />
            <Legend
              onClick={handleLegendClick}
              wrapperStyle={{ cursor: "pointer" }}
              formatter={(value) => {
                const reps = value.replace("reps", "");
                const tab = repTabs.find((t) => String(t.reps) === reps);
                return (
                  <span className="ml-1" style={{ color: tab?.color }}>
                    {tab?.label}
                  </span>
                );
              }}
            />
            {repTabs.map((t) =>
              visible[t.reps] ? (
                <Line
                  key={t.reps}
                  type="monotone"
                  dataKey={`reps${t.reps}`}
                  name={`reps${t.reps}`}
                  stroke={t.color}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls={true}
                />
              ) : null,
            )}
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
