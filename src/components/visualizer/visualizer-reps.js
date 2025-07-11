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
  { label: "Singles", reps: 1 },
  { label: "Triples", reps: 3 },
  { label: "Fives", reps: 5 },
];

export function VisualizerReps({ data, liftType }) {
  const { parsedData } = useUserLiftingData();
  const { status: authStatus } = useSession();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Singles, Triples and Fives Progression </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="1" className="mt-10 w-full">
          {/* ─ Tab headers ─ */}
          <TabsList className="bg-muted/40">
            {repTabs.map((t) => (
              <TabsTrigger key={t.reps} value={String(t.reps)}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ─ Tab content: one chart per rep-range ─ */}
          {repTabs.map((t) => (
            <TabsContent
              key={t.reps}
              value={String(t.reps)}
              className="pt-6 focus:outline-none"
            >
              <RepLineChart
                data={parsedData}
                liftType={liftType}
                reps={t.reps}
                color="#ef4444" // tailwind red-500 – matches your theme
              />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────
// child: memoised chart for a given rep-range
// ────────────────────────────────────────────────────────────
function RepLineChart({ data, liftType, reps, color }) {
  if (!data) return null;

  // memo to avoid recompute on tab switch
  const chartData = useMemo(
    () => getDailyBest(data, liftType, reps),
    [data, liftType, reps],
  );

  if (!chartData.length) {
    return (
      <p className="text-muted-foreground">
        No {reps}-rep sets logged for {liftType}.
      </p>
    );
  }

  return (
    <LineChart
      key={`chart-${reps}`} // stable key kills React duplicate warnings
      width={900}
      height={300}
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
        formatter={(v) => [`${v} kg`, "Weight"]}
      />
      <Line
        type="monotone"
        dataKey="weight"
        stroke={color}
        strokeWidth={2}
        dot={false}
        isAnimationActive={false}
      />
    </LineChart>
  );
}
