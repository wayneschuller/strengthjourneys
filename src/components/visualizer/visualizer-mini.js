"use client";

import { useMemo, useEffect, useState } from "react";
import { useLiftColors } from "@/hooks/use-lift-colors";
import { format } from "date-fns";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { useLocalStorage, useWindowSize } from "usehooks-ts";
import { useSession } from "next-auth/react";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { devLog } from "@/lib/processing-utils";
import { e1rmFormulae, estimateE1RM } from "@/lib/estimate-e1rm";
import { subMonths } from "date-fns";

import {
  E1RMFormulaSelect,
  SpecialHtmlLabel,
  SingleLiftTooltipContent,
} from "./visualizer-utils";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
} from "recharts";
import { Checkbox } from "@/components/ui/checkbox";

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

import { getYearLabels, processVisualizerData } from "./visualizer-processing";

/**
 * E1RM over time chart for a single lift. Shows estimated 1RM progression with optional formula
 * and time range controls. Used on lift pages (e.g. /bench-press).
 *
 * @param {Object} props
 * @param {string} [props.liftType] - Display name of the lift to chart (e.g. "Bench Press").
 */
export function VisualizerMini({ liftType }) {
  const { parsedData, topLiftsByTypeAndReps } = useUserLiftingData();
  const { status: authStatus } = useSession();
  const { getColor } = useLiftColors();
  const liftColor = getColor(liftType);

  const { isMetric, bodyWeight, standards } = useAthleteBio();

  // devLog(parsedData);

  const [timeRange, setTimeRange] = useLocalStorage(
    LOCAL_STORAGE_KEYS.TIME_RANGE,
    "MAX", // MAX, 3M, 6M, 1Y, 2Y, 5Y etc.
    {
      initializeWithValue: false,
    },
  );

  const [showLabelValues, setShowLabelValues] = useLocalStorage(
    LOCAL_STORAGE_KEYS.SHOW_LABEL_VALUES,
    false,
    {
      initializeWithValue: false,
    },
  );

  const [showAllData, setShowAllData] = useLocalStorage(
    LOCAL_STORAGE_KEYS.SHOW_ALL_DATA,
    true,
    {
      initializeWithValue: false,
    },
  ); // Show weekly bests or all data

  const [e1rmFormula, setE1rmFormula] = useLocalStorage(LOCAL_STORAGE_KEYS.FORMULA, "Brzycki", {
    initializeWithValue: false,
  });

  const [showStandards, setShowStandards] = useLocalStorage(
    LOCAL_STORAGE_KEYS.VIS_MINI_SHOW_STANDARDS,
    true,
    {
      initializeWithValue: false,
    },
  );

  const [showBodyweightMultiples, setShowBodyweightMultiples] = useLocalStorage(
    LOCAL_STORAGE_KEYS.VIS_MINI_SHOW_BODYWEIGHT_MULTIPLES,
    true,
    {
      initializeWithValue: false,
    },
  );

  // Used to hide the y-axis and other UI elements on smaller screens
  const { width } = useWindowSize({ initializeWithValue: false });

  const rangeFirstDate = calculateThresholdDate(timeRange, setTimeRange);

  const {
    dataset: chartData,
    weightMax,
    weightMin,
  } = useMemo(
    () =>
      processVisualizerData(
        parsedData,
        e1rmFormula,
        [liftType],
        rangeFirstDate,
        showAllData,
        isMetric,
      ),
    [parsedData, e1rmFormula, liftType, rangeFirstDate, showAllData, isMetric],
  );

  // if (authStatus !== "authenticated") return; // Don't show at all for anon mode
  // devLog(chartData);

  const yearLabels = getYearLabels(chartData);

  // Significant lifts: best per rep range (1–5 RM) that appear on the chart, one per date
  const significantLiftsForChart = useMemo(() => {
    if (
      !topLiftsByTypeAndReps?.[liftType] ||
      !chartData?.length ||
      !e1rmFormula
    )
      return [];
    const repArrays = topLiftsByTypeAndReps[liftType];
    const candidates = [];
    for (let repIndex = 0; repIndex < Math.min(5, repArrays?.length ?? 0); repIndex++) {
      const entry = repArrays[repIndex]?.[0];
      if (!entry) continue;
      const e1rm = estimateE1RM(entry.reps, entry.weight, e1rmFormula);
      const dateStr =
        typeof entry.date === "number"
          ? format(new Date(entry.date), "yyyy-MM-dd")
          : String(entry.date).slice(0, 10);
      candidates.push({
        dateStr,
        reps: entry.reps,
        weight: entry.weight,
        e1rm,
        unitType: entry.unitType || "",
      });
    }
    const dateToPoint = new Map(
      chartData.map((d) => {
        const k =
          typeof d.date === "number"
            ? format(new Date(d.date), "yyyy-MM-dd")
            : String(d.date).slice(0, 10);
        return [k, d];
      }),
    );
    const byDate = new Map();
    candidates.forEach((c) => {
      const point = dateToPoint.get(c.dateStr);
      if (!point) return;
      const existing = byDate.get(c.dateStr);
      if (!existing || c.e1rm > existing.e1rm)
        byDate.set(c.dateStr, { ...c, point });
    });
    return Array.from(byDate.values());
  }, [
    topLiftsByTypeAndReps,
    liftType,
    chartData,
    e1rmFormula,
  ]);

  const strengthRanges = standards?.[liftType] || null;

  const roundedMaxWeightValue = weightMax * (width > 1280 ? 1.3 : 1.5);

  // Shadcn charts needs this for theming but we just do custom colors anyway
  const chartConfig = { [liftType]: { label: liftType } };

  const handleMouseMove = (event) => {
    if (event && event.activePayload) {
      const activeIndex = event.activeTooltipIndex;
      // devLog(event);
      // setHighlightDate(event.activeLabel);
    }
  };

  let tickJump = isMetric ? 50 : 100; // 50 for kg, 100 for lb

  // FIXME: We need more dynamic x-axis ticks
  const formatXAxisDateString = (tickItem) => {
    const date = new Date(tickItem);
    return date.toLocaleString("en-US", { month: "short", day: "numeric" });
  };

  // Semantic color progression: cool (easy) → warm (elite). Works across all themes.
  const strengthStandardColors = {
    physicallyActive: "#3b82f6", // blue-500
    beginner: "#22c55e",        // green-500
    intermediate: "#f59e0b",    // amber-500
    advanced: "#f97316",        // orange-500
    elite: "#ef4444",           // red-500
  };
  const strengthStandardLabels = {
    physicallyActive: "Physically Active",
    beginner: "Beginner",
    intermediate: "Intermediate",
    advanced: "Advanced",
    elite: "Elite",
  };

  // Show all standards the user has reached + exactly one next target.
  // No point showing Elite to a beginner — keep the chart focused and motivating.
  const orderedStandardKeys = ["physicallyActive", "beginner", "intermediate", "advanced", "elite"];
  const orderedStandards = strengthRanges
    ? orderedStandardKeys.map((key) => ({ key, val: strengthRanges[key] })).filter((s) => s.val != null)
    : [];
  const nextStandardIndex = orderedStandards.findIndex((s) => weightMax < s.val);
  const visibleStandardCount = nextStandardIndex === -1 ? orderedStandards.length : nextStandardIndex + 1;
  const visibleStandards = orderedStandards.slice(0, visibleStandardCount);
  // Bands: one per zone the user has passed through (not including the next target's zone)
  const visibleBandCount = nextStandardIndex === -1 ? orderedStandards.length : nextStandardIndex;

  return (
    <Card className="">
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1 text-pretty">
          <CardTitle>
            {authStatus === "unauthenticated" && "Demo Mode: "}
            {liftType} Estimated One Rep Maxes
          </CardTitle>
          <CardDescription>
            {getTimeRangeDescription(rangeFirstDate, parsedData)}
          </CardDescription>
        </div>
        {width > 1280 && (
          <div className="mr-4 flex flex-col gap-2">
            <div className="flex items-center gap-1">
              <Checkbox
                id="show-standards"
                value={showStandards}
                checked={showStandards}
                onCheckedChange={(show) => setShowStandards(show)}
              />
              <Label htmlFor="show-standards">Show Strength Standards</Label>
            </div>
            <div className="flex items-center gap-1">
              <Checkbox
                id="show-bodyweight-multiples"
                checked={showBodyweightMultiples}
                onCheckedChange={(checked) =>
                  setShowBodyweightMultiples(checked)
                }
              />
              <Label htmlFor="show-bodyweight-multiples">
                Show Bodyweight Multiples
              </Label>
            </div>
          </div>
        )}
        <TimeRangeSelect timeRange={timeRange} setTimeRange={setTimeRange} />
      </CardHeader>

      <CardContent className="pl-0 pr-2">
        {chartData && (
            <ChartContainer config={chartConfig} className="h-[400px] !aspect-auto">
              <AreaChart
                accessibilityLayer
                data={chartData}
                margin={{ left: 5, right: 20 }}
                // onMouseMove={handleMouseMove}
              >
                <CartesianGrid vertical={false} />
                {/* Strength standard background bands — rendered first so they sit behind
                    the chart data. Only zones the user has passed through are shown;
                    the next unreached standard gets a line but no band beyond it. */}
                {strengthRanges && showStandards && width > 768 &&
                  Array.from({ length: visibleBandCount }, (_, i) => ({
                    y1: visibleStandards[i].val,
                    y2: visibleStandards[i + 1]?.val ?? Math.max(100, roundedMaxWeightValue),
                    color: strengthStandardColors[visibleStandards[i].key],
                  })).map(({ y1, y2, color }) => (
                    <ReferenceArea
                      key={`band-${y1}`}
                      y1={y1}
                      y2={y2}
                      fill={color}
                      fillOpacity={0.08}
                      stroke="none"
                    />
                  ))
                }
                <XAxis
                  dataKey="rechartsDate"
                  type="number"
                  scale="time"
                  domain={[
                    (dataMin) =>
                      new Date(dataMin).setDate(
                        new Date(dataMin).getDate() - 2,
                      ),
                    (dataMax) =>
                      new Date(dataMax).setDate(
                        new Date(dataMax).getDate() + 2,
                      ),
                  ]}
                  tickFormatter={formatXAxisDateString}
                  // interval="equidistantPreserveStart"
                />
                {/* FIXME: fix the domain height to always incorporate the height of elite standard */}
                <YAxis
                  domain={[0, Math.max(100, roundedMaxWeightValue)]}
                  hide={width < 1280}
                  axisLine={false}
                  tickFormatter={
                    (value) => `${value}${chartData[0]?.displayUnit || ""}` // Default to first item's displayUnit
                  }
                  ticks={Array.from(
                    { length: Math.ceil(roundedMaxWeightValue / tickJump) },
                    (v, i) => i * tickJump,
                  )}
                  // allowDataOverflow
                />
                <Tooltip
                  content={(props) => (
                    <SingleLiftTooltipContent
                      {...props}
                      liftType={liftType}
                      parsedData={parsedData}
                      liftColor={liftColor}
                      isMetric={isMetric}
                    />
                  )}
                  formatter={(value, name, props) =>
                    `${value} ${props.payload.displayUnit || ""}`
                  }
                  position={{ y: 10 }}
                  cursor={{
                    stroke: "#8884d8",
                    strokeWidth: 2,
                    strokeDasharray: "5 5",
                  }} // Recharts tooltip cursor is the vertical reference line that follows the mouse
                />
                <defs>
                  <linearGradient
                    id={`fill`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                    key={liftType}
                  >
                    <stop offset="5%" stopColor={liftColor} stopOpacity={0.8} />
                    <stop
                      offset="50%"
                      stopColor={liftColor}
                      stopOpacity={0.05}
                    />
                  </linearGradient>
                </defs>
                <Area
                  key={liftType}
                  type="monotone"
                  dataKey={liftType}
                  stroke={liftColor}
                  name={liftType}
                  strokeWidth={2}
                  fill={`url(#fill)`}
                  fillOpacity={0.4}
                  dot={false}
                  connectNulls
                >
                  {showLabelValues && (
                    <LabelList
                      position="top"
                      offset={12}
                      content={({ x, y, value, index }) => (
                        <text
                          x={x}
                          y={y}
                          dy={-10}
                          fontSize={12}
                          textAnchor="middle"
                          className="fill-foreground"
                        >
                          {`${value}${chartData[index].displayUnit || ""}`}
                        </text>
                      )}
                    />
                  )}
                </Area>
                {/* Significant lift highlights: vertical line from bottom up to the data point */}
                {significantLiftsForChart.map((lift, idx) => (
                  <ReferenceLine
                    key={`pr-${lift.dateStr}-${idx}`}
                    segment={[
                      { x: lift.point.rechartsDate, y: 0 },
                      { x: lift.point.rechartsDate, y: lift.point[liftType] },
                    ]}
                    stroke={liftColor}
                    strokeOpacity={0.5}
                    strokeWidth={2}
                    strokeDasharray="4 8"
                  />
                ))}
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

                {/* Strength standards: color-coded lines for all reached levels + one next target. */}
                {strengthRanges && showStandards && width > 768 &&
                  visibleStandards.map(({ key, val }) => {
                    const unitType = isMetric ? "kg" : "lb";
                    const color = strengthStandardColors[key];
                    return (
                      <ReferenceLine
                        key={key}
                        y={val}
                        stroke={color}
                        strokeWidth={1.5}
                        strokeDasharray="6 4"
                        label={{
                          content: ({ viewBox }) => (
                            <text
                              x={viewBox.x + viewBox.width - 4}
                              y={viewBox.y - 4}
                              textAnchor="end"
                              fontSize={11}
                              fontWeight="500"
                              style={{ fill: color }}
                            >
                              {`${strengthStandardLabels[key]} (${val}${unitType})`}
                            </text>
                          ),
                        }}
                      />
                    );
                  })
                }
                {/* Bodyweight multiples: use liftColor so lines feel tied to the chart area. */}
                {showBodyweightMultiples && bodyWeight > 0 && width >= 1280 &&
                  [0.5, 1.0, 1.5, 2.0, 2.5, 3.0].map((multiple) => {
                    const weightValue = Math.round(multiple * bodyWeight);
                    if (weightValue > roundedMaxWeightValue || weightValue <= 0) return null;
                    return (
                      <ReferenceLine
                        key={`bw-${multiple}`}
                        y={weightValue}
                        stroke={liftColor}
                        strokeWidth={1.5}
                        strokeDasharray="3 6"
                        strokeOpacity={0.7}
                        label={{
                          content: ({ viewBox }) => (
                            <text
                              x={viewBox.x + viewBox.width - 4}
                              y={viewBox.y - 4}
                              textAnchor="end"
                              fontSize={11}
                              fontWeight="500"
                              style={{ fill: liftColor }}
                            >
                              {`${multiple}xBW`}
                            </text>
                          ),
                        }}
                      />
                    );
                  })
                }
              </AreaChart>
            </ChartContainer>
        )}
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
          <div className="flex items-center space-x-1">
            <Label className="font-light" htmlFor="show-values">
              Weekly Bests
            </Label>
            <Switch
              id="all-data"
              value={showAllData}
              checked={showAllData}
              onCheckedChange={(show) => setShowAllData(show)}
            />
            <Label className="font-light" htmlFor="show-values">
              All Data
            </Label>
          </div>
          <div>
            <E1RMFormulaSelect
              e1rmFormula={e1rmFormula}
              setE1rmFormula={setE1rmFormula}
            />
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
