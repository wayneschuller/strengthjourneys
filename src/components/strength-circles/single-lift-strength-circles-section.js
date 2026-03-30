/**
 * Lift-specific Strength Circles section for progress guide pages and calculators.
 * Can either use a provided live E1RM value or fall back to the user's best
 * logged E1RM for the target lift, which keeps the percentile UI reusable
 * across both the historical guide view and the live calculator flow.
 */

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ReferenceLine,
} from "recharts";
import { useReadLocalStorage } from "usehooks-ts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StrengthCirclesChart } from "@/components/strength-circles/strength-circles-chart";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { estimateE1RM } from "@/lib/estimate-e1rm";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { cn } from "@/lib/utils";
import { getLiftPercentiles } from "@/lib/strength-circles/universe-percentiles";

const BIG_FOUR_TO_PERCENTILE_KEY = {
  "Back Squat": "squat",
  "Bench Press": "bench",
  "Deadlift": "deadlift",
  "Strict Press": "strictPress",
};

const TIMELINE_COLORS = {
  "General Population": "var(--chart-1)",
  "Gym-Goers": "var(--chart-2)",
  "Barbell Lifters": "var(--chart-3)",
  "Powerlifting Culture": "var(--chart-4)",
};
const TIMELINE_UNIVERSES = [
  "General Population",
  "Gym-Goers",
  "Barbell Lifters",
  "Powerlifting Culture",
];

export function SingleLiftStrengthCirclesSection({
  liftType,
  e1rmKgOverride = null,
  showTimeline = true,
  compact = false,
}) {
  const { age, sex, bodyWeight, isMetric } = useAthleteBio();
  const { parsedData, hasUserData, isDemoMode } = useUserLiftingData();
  const e1rmFormula =
    useReadLocalStorage(LOCAL_STORAGE_KEYS.FORMULA, {
      initializeWithValue: false,
    }) ?? "Brzycki";
  const [selectedUniverse, setSelectedUniverse] = useState("Gym-Goers");
  const [hoveredUniverse, setHoveredUniverse] = useState(null);

  const percentileKey = BIG_FOUR_TO_PERCENTILE_KEY[liftType];
  const activeUniverse = hoveredUniverse ?? selectedUniverse;
  const showTimelinePanel = showTimeline && hasUserData;

  const bestE1rmKg = useMemo(() => {
    if (e1rmKgOverride > 0) return e1rmKgOverride;
    if (!hasUserData || isDemoMode || !parsedData?.length || !liftType) return 0;

    let best = 0;
    for (const entry of parsedData) {
      if (
        entry.liftType !== liftType ||
        entry.isGoal ||
        !entry.date ||
        entry.reps <= 0 ||
        entry.weight <= 0
      ) {
        continue;
      }

      const weightKg =
        entry.unitType === "kg" ? entry.weight : entry.weight / 2.2046;
      const e1rmKg =
        entry.reps === 1
          ? weightKg
          : estimateE1RM(entry.reps, weightKg, e1rmFormula);

      if (e1rmKg > best) best = e1rmKg;
    }

    return best;
  }, [e1rmFormula, e1rmKgOverride, hasUserData, isDemoMode, liftType, parsedData]);

  const currentPercentiles = useMemo(() => {
    if (
      !percentileKey ||
      !bestE1rmKg ||
      !age ||
      !sex ||
      bodyWeight == null
    ) {
      return null;
    }

    const bodyWeightKg = isMetric ? bodyWeight : bodyWeight / 2.2046;
    return getLiftPercentiles(
      age,
      bodyWeightKg,
      sex === "female" ? "female" : "male",
      percentileKey,
      bestE1rmKg,
    );
  }, [age, bestE1rmKg, bodyWeight, isMetric, percentileKey, sex]);

  const percentileTimeline = useMemo(() => {
    if (
      !hasUserData ||
      isDemoMode ||
      !parsedData?.length ||
      !liftType ||
      !percentileKey ||
      !age ||
      !sex ||
      bodyWeight == null
    ) {
      return null;
    }

    const WINDOW_DAYS = 90;
    const bodyWeightKg = isMetric ? bodyWeight : bodyWeight / 2.2046;
    const gender = sex === "female" ? "female" : "male";

    const liftEntries = parsedData
      .filter(
        (entry) =>
          entry.liftType === liftType &&
          !entry.isGoal &&
          entry.reps > 0 &&
          entry.weight > 0 &&
          entry.date,
      )
      .map((entry) => ({
        date: entry.date,
        weightKg: entry.unitType === "kg" ? entry.weight : entry.weight / 2.2046,
        reps: entry.reps,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    if (liftEntries.length < 2) return null;

    const firstDate = new Date(liftEntries[0].date);
    const lastDate = new Date(liftEntries[liftEntries.length - 1].date);
    const spanDays = (lastDate - firstDate) / 86400000;

    let intervalDays;
    if (spanDays <= 180) intervalDays = 7;
    else if (spanDays <= 730) intervalDays = 14;
    else intervalDays = 30;

    const samples = [];
    const cursor = new Date(firstDate);
    cursor.setDate(cursor.getDate() + WINDOW_DAYS);
    while (cursor <= lastDate) {
      samples.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + intervalDays);
    }
    if (
      samples.length === 0 ||
      (lastDate - samples[samples.length - 1]) / 86400000 > 7
    ) {
      samples.push(new Date(lastDate));
    }

    if (samples.length < 2) return null;

    const points = [];
    for (const sampleDate of samples) {
      const sampleMs = sampleDate.getTime();
      const cutoffMs = sampleMs - WINDOW_DAYS * 86400000;
      let bestSampleE1rmKg = 0;

      for (const entry of liftEntries) {
        const entryMs = new Date(entry.date).getTime();
        if (entryMs > sampleMs) break;
        if (entryMs < cutoffMs) continue;

        const sampledE1rmKg =
          entry.reps === 1
            ? entry.weightKg
            : estimateE1RM(entry.reps, entry.weightKg, e1rmFormula);
        if (sampledE1rmKg > bestSampleE1rmKg) bestSampleE1rmKg = sampledE1rmKg;
      }

      if (bestSampleE1rmKg <= 0) continue;

      const pointPercentiles = getLiftPercentiles(
        age,
        bodyWeightKg,
        gender,
        percentileKey,
        bestSampleE1rmKg,
      );

      if (!pointPercentiles?.["General Population"]) continue;

      points.push({
        date: sampleDate.toISOString().slice(0, 10),
        ...pointPercentiles,
      });
    }

    return points.length >= 2 ? points : null;
  }, [
    age,
    bodyWeight,
    e1rmFormula,
    hasUserData,
    isDemoMode,
    isMetric,
    liftType,
    parsedData,
    percentileKey,
    sex,
  ]);

  if (!currentPercentiles) return null;

  return (
    <Card>
      <CardHeader className={cn("pb-3", compact ? "px-4 pt-4" : "")}>
        <CardTitle className="text-base">{liftType} Strength Circles</CardTitle>
        <p className={cn("text-sm text-muted-foreground", compact ? "text-xs leading-relaxed" : "")}>
          See how your current {liftType.toLowerCase()} stacks up across four comparison groups.
        </p>
      </CardHeader>
      <CardContent
        className={cn(
          "grid grid-cols-1 gap-6",
          compact ? "px-4 pb-4 pt-0" : "",
          showTimelinePanel
            ? "lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]"
            : "",
        )}
      >
        <div className={cn("mx-auto w-full", compact ? "max-w-[280px]" : "max-w-md")}>
          <StrengthCirclesChart
            percentiles={currentPercentiles}
            activeUniverse={activeUniverse}
            onUniverseChange={setSelectedUniverse}
            onUniverseHoverChange={setHoveredUniverse}
          />
        </div>
        <div className="flex flex-col justify-start gap-4">
          {hasUserData && percentileTimeline ? (
            <div className="grid gap-4">
              {TIMELINE_UNIVERSES.map((universe) => (
                <SingleLiftPercentileTimelineChart
                  key={universe}
                  data={percentileTimeline}
                  currentPercentile={currentPercentiles[universe]}
                  activeUniverse={universe}
                  liftLabel={liftType}
                />
              ))}
            </div>
          ) : hasUserData ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Log more {liftType.toLowerCase()} sessions to unlock the long-term percentile chart.
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function SingleLiftPercentileTimelineChart({
  data,
  currentPercentile,
  activeUniverse = "General Population",
  liftLabel,
}) {
  const dataKey = activeUniverse;
  const chartColor = TIMELINE_COLORS[activeUniverse] || "var(--chart-1)";
  const gradientId = `single-lift-pct-grad-${liftLabel
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")}-${activeUniverse
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")}`;

  const firstDate = new Date(data[0].date);
  const lastDate = new Date(data[data.length - 1].date);
  const spanDays = (lastDate - firstDate) / 86400000;

  const formatTick = (dateStr) => {
    const date = new Date(dateStr);
    if (spanDays <= 365) {
      return date.toLocaleDateString("en-US", { month: "short" });
    }
    if (spanDays <= 365 * 4) {
      return date.toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      });
    }
    return `’${date.toLocaleDateString("en-US", { year: "2-digit" })}`;
  };

  const maxTicks = spanDays <= 365 ? 6 : spanDays <= 365 * 4 ? 7 : 8;
  const tickInterval = Math.max(1, Math.floor(data.length / maxTicks));
  const ticks = data
    .filter((_, index) => index % tickInterval === 0 || index === data.length - 1)
    .map((point) => point.date);

  const minPct = Math.min(...data.map((point) => point[dataKey] ?? 0));
  const yMin = Math.max(0, Math.floor(minPct / 10) * 10 - 5);
  const universeLabel = activeUniverse.toLowerCase();

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {liftLabel} percentile vs. {universeLabel} over time
        </p>
        {currentPercentile != null ? (
          <span className="text-xs font-medium text-foreground">
            {currentPercentile}th now
          </span>
        ) : null}
      </div>
      <div className="h-24 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={chartColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tickFormatter={formatTick}
              ticks={ticks}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[yMin, 100]}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => `${value}`}
            />
            <RechartsTooltip
              position={{ y: -10 }}
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: "1px solid hsl(var(--border))",
                backgroundColor: "hsl(var(--popover))",
                color: "hsl(var(--popover-foreground))",
              }}
              labelFormatter={(dateStr) =>
                new Date(dateStr).toLocaleDateString("en-US", {
                  month: "short",
                  year: "numeric",
                })
              }
              formatter={(value) => [`${value}%`, universeLabel]}
            />
            {currentPercentile != null && (
              <ReferenceLine
                y={currentPercentile}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="3 3"
                strokeOpacity={0.5}
              />
            )}
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={chartColor}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0, fill: chartColor }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
