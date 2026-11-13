/**
 * Bodyweight over time, and strength against it.
 *
 * Two charts, one measure each, never two scales on one axis:
 *   1. Bodyweight: each weigh-in is a dot, joined by straight lines. A
 *      straight line is exactly how the app reads the days between weigh-ins
 *      (bodyweightAt in src/lib/bodyweight.js), so the chart shows the very
 *      number a past rating used.
 *   2. Strength for bodyweight: each big-four lift's best e1RM in a month,
 *      divided by what the lifter weighed that day. Losing weight while
 *      holding a squat shows as this line climbing, which is the story a
 *      lifter on a cut wants to see.
 *
 * Shown only once a lifter has two weigh-ins, since one dot is not a trend.
 * Lift colours come from useLiftColors, so each lift wears the colour it has
 * everywhere else.
 */
import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Scale } from "lucide-react";

import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { useLiftColors } from "@/hooks/use-lift-colors";
import { bodyweightAt } from "@/lib/bodyweight";
import { estimateEntryE1RM } from "@/lib/estimate-e1rm";
import { BIG_FOUR_LIFT_TYPES } from "@/lib/processing-utils";
import { convertWeight, unitTypeFor } from "@/lib/weight-units";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import {
  CHART_AXIS_PROPS,
  CHART_GRID_PROPS,
  chartActiveDotProps,
  chartCursorProps,
} from "@/components/visualizer/chart-visuals";

const BODYWEIGHT_COLOR = "var(--chart-1)";
// The ratio chart starts this long before the first weigh-in at most, so a
// decade of lifting is never divided by one weigh-in from last month.
const RATIO_LEAD_DAYS = 30;

export function BodyweightTrendCard() {
  const { bodyweightSeries, parsedData, dataSource } = useUserLiftingData();
  const { isMetric } = useAthleteBio();
  const { getColor } = useLiftColors();
  const unit = unitTypeFor(isMetric);

  const weightPoints = useMemo(
    () =>
      (bodyweightSeries ?? []).map((weighIn) => ({
        time: toTime(weighIn.date),
        date: weighIn.date,
        bodyweight: round(convertWeight(weighIn.kg, "kg", unit), 1),
        notes: weighIn.notes,
      })),
    [bodyweightSeries, unit],
  );

  const { ratioPoints, ratioLifts } = useMemo(
    () => buildRatioPoints(parsedData, bodyweightSeries),
    [parsedData, bodyweightSeries],
  );

  if (dataSource !== "sheet" || weightPoints.length < 2) return null;

  const first = weightPoints[0];
  const last = weightPoints[weightPoints.length - 1];
  const change = round(last.bodyweight - first.bodyweight, 1);
  const ratioConfig = Object.fromEntries(
    ratioLifts.map((liftType) => [
      liftType,
      { label: liftType, color: getColor(liftType) },
    ]),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="h-5 w-5" aria-hidden />
          Bodyweight
        </CardTitle>
        <CardDescription>
          {weightPoints.length} weigh-ins since {formatDate(first.date)}:{" "}
          {last.bodyweight} {unit} now,{" "}
          {change === 0
            ? "the same as the first"
            : `${change > 0 ? "+" : ""}${change} ${unit} since the first`}
          . Between weigh-ins the line is what your ratings use.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8 pr-2 pl-0">
        <ChartContainer
          config={{
            bodyweight: { label: "Bodyweight", color: BODYWEIGHT_COLOR },
          }}
          className="!aspect-auto h-[240px] [&_.recharts-wrapper]:outline-none"
        >
          <LineChart data={weightPoints} margin={{ left: 5, right: 20 }}>
            <CartesianGrid {...CHART_GRID_PROPS} />
            <XAxis
              {...CHART_AXIS_PROPS}
              dataKey="time"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={formatTick}
            />
            <YAxis
              {...CHART_AXIS_PROPS}
              width={48}
              domain={["auto", "auto"]}
              tickFormatter={(value) => `${round(value, 0)}${unit}`}
            />
            <Tooltip
              cursor={chartCursorProps(BODYWEIGHT_COLOR)}
              content={({ active, payload }) => {
                const point = active ? payload?.[0]?.payload : null;
                if (!point) return null;
                return (
                  <TooltipBox title={formatDate(point.date)}>
                    <p className="font-semibold tabular-nums">
                      {point.bodyweight} {unit}
                    </p>
                    {point.notes && (
                      <p className="text-muted-foreground max-w-[14rem] text-xs">
                        {point.notes}
                      </p>
                    )}
                  </TooltipBox>
                );
              }}
            />
            <Line
              type="linear"
              dataKey="bodyweight"
              stroke={BODYWEIGHT_COLOR}
              strokeWidth={2}
              dot={{ r: 4, fill: "var(--background)", strokeWidth: 2 }}
              activeDot={chartActiveDotProps(BODYWEIGHT_COLOR)}
              animationDuration={700}
            />
          </LineChart>
        </ChartContainer>

        {ratioPoints.length > 1 && ratioLifts.length > 0 && (
          <div className="space-y-2">
            <p className="text-muted-foreground pl-5 text-sm">
              Strength for your bodyweight: each month&apos;s best e1RM as a
              multiple of what you weighed that day.
            </p>
            <ChartContainer
              config={ratioConfig}
              className="!aspect-auto h-[260px] [&_.recharts-wrapper]:outline-none"
            >
              <LineChart data={ratioPoints} margin={{ left: 5, right: 20 }}>
                <CartesianGrid {...CHART_GRID_PROPS} />
                <XAxis
                  {...CHART_AXIS_PROPS}
                  dataKey="time"
                  type="number"
                  scale="time"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={formatTick}
                />
                <YAxis
                  {...CHART_AXIS_PROPS}
                  width={48}
                  domain={["auto", "auto"]}
                  tickFormatter={(value) => `${round(value, 1)}x`}
                />
                <Tooltip
                  cursor={chartCursorProps("var(--muted-foreground)")}
                  content={({ active, payload }) => {
                    const point = active ? payload?.[0]?.payload : null;
                    if (!point) return null;
                    return (
                      <TooltipBox title={formatMonth(point.month)}>
                        {payload.map((item) =>
                          item.value == null ? null : (
                            <p
                              key={item.dataKey}
                              className="flex items-center gap-2 text-sm"
                            >
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ background: item.color }}
                              />
                              <span>{item.dataKey}</span>
                              <span className="ml-auto font-semibold tabular-nums">
                                {item.value.toFixed(2)}x
                              </span>
                            </p>
                          ),
                        )}
                      </TooltipBox>
                    );
                  }}
                />
                <ChartLegend content={<ChartLegendContent />} />
                {ratioLifts.map((liftType) => (
                  <Line
                    key={liftType}
                    type="monotone"
                    dataKey={liftType}
                    stroke={getColor(liftType)}
                    strokeWidth={2}
                    dot={false}
                    activeDot={chartActiveDotProps(getColor(liftType))}
                    connectNulls
                    animationDuration={700}
                  />
                ))}
              </LineChart>
            </ChartContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * One point per month with any big-four lift: that month's best e1RM for
 * each, over the interpolated bodyweight on the day it was lifted.
 */
function buildRatioPoints(parsedData, series) {
  if (!series?.length || !Array.isArray(parsedData)) {
    return { ratioPoints: [], ratioLifts: [] };
  }
  const start = shiftDate(series[0].date, -RATIO_LEAD_DAYS);
  const lifts = new Set(BIG_FOUR_LIFT_TYPES);
  const byMonth = new Map();
  const seenLifts = new Set();
  for (const entry of parsedData) {
    if (entry.date < start || !lifts.has(entry.liftType)) continue;
    if (!(entry.reps >= 1) || !(entry.weight > 0)) continue;
    const bodyweightKg = bodyweightAt(series, entry.date, "kg");
    if (!(bodyweightKg > 0)) continue;
    const ratio = estimateEntryE1RM(entry, undefined, "kg") / bodyweightKg;
    const month = entry.date.slice(0, 7);
    const point = byMonth.get(month) ?? { month, time: toTime(`${month}-15`) };
    if (!(point[entry.liftType] >= ratio)) point[entry.liftType] = ratio;
    byMonth.set(month, point);
    seenLifts.add(entry.liftType);
  }
  const ratioPoints = [...byMonth.values()]
    .sort((a, b) => a.time - b.time)
    .map((point) => {
      const rounded = { ...point };
      for (const liftType of seenLifts) {
        if (rounded[liftType] != null) {
          rounded[liftType] = round(rounded[liftType], 2);
        }
      }
      return rounded;
    });
  return {
    ratioPoints,
    ratioLifts: BIG_FOUR_LIFT_TYPES.filter((liftType) =>
      seenLifts.has(liftType),
    ),
  };
}

function TooltipBox({ title, children }) {
  return (
    <div className="bg-background border-border/50 grid min-w-[8rem] gap-1 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-medium">{title}</p>
      {children}
    </div>
  );
}

function toTime(date) {
  return Date.parse(`${date}T00:00:00Z`);
}

function shiftDate(date, days) {
  const time = toTime(date) + days * 86400000;
  return new Date(time).toISOString().slice(0, 10);
}

function formatTick(time) {
  return new Date(time).toLocaleDateString(undefined, {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}

function formatDate(date) {
  return new Date(toTime(date)).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatMonth(month) {
  return new Date(toTime(`${month}-01`)).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function round(value, places) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
