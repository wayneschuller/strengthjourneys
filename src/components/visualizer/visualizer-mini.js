"use client";

import { useMemo, useEffect, useState } from "react";
import { getLiftColor } from "@/lib/get-lift-color";
import { SidePanelSelectLiftsButton } from "../side-panel-lift-chooser";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useAthleteBioData } from "@/hooks/use-athlete-biodata";
import { useLocalStorage, useWindowSize } from "usehooks-ts";
import { useSession } from "next-auth/react";
import { devLog } from "@/lib/processing-utils";
import { e1rmFormulae } from "@/lib/estimate-e1rm";
import { subMonths } from "date-fns";
import {
  E1RMFormulaSelect,
  SpecialHtmlLabel,
  SingleLiftTooltipContent,
} from "./visualizer-utils";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ReferenceLine, ReferenceArea, ResponsiveContainer } from "recharts";
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

// VisualizerMini is used in the big four lift pages to show a single lift
// only visualizer.
export function VisualizerMini({ liftType }) {
  const { parsedData, selectedLiftTypes } = useUserLiftingData();
  const { status: authStatus } = useSession();

  const {
    age,
    setAge,
    isMetric,
    setIsMetric,
    sex,
    setSex,
    bodyWeight,
    setBodyWeight,
    standards,
    toggleIsMetric,
  } = useAthleteBioData();

  // devLog(parsedData);

  const [timeRange, setTimeRange] = useLocalStorage(
    "SJ_timeRange",
    "MAX", // MAX, 3M, 6M, 1Y, 2Y, 5Y etc.
    {
      initializeWithValue: false,
    },
  );

  const [showLabelValues, setShowLabelValues] = useLocalStorage(
    "SJ_showLabelValues",
    false,
    {
      initializeWithValue: false,
    },
  );

  const [showAllData, setShowAllData] = useLocalStorage(
    "SJ_showAllData",
    true,
    {
      initializeWithValue: false,
    },
  ); // Show weekly bests or all data

  const [e1rmFormula, setE1rmFormula] = useLocalStorage("formula", "Brzycki", {
    initializeWithValue: false,
  });

  const [showStandards, setShowStandards] = useLocalStorage(
    "SJ_VisMiniShowStandards",
    true,
    {
      initializeWithValue: false,
    },
  );

  const [showBodyweightMultiples, setShowBodyweightMultiples] = useLocalStorage(
    "SJ_VisMiniShowBodyweightMultiples",
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
      ),
    [parsedData, e1rmFormula, timeRange, showAllData],
  );

  if (authStatus !== "authenticated") return; // Don't show at all for anon mode
  // devLog(chartData);

  const yearLabels = getYearLabels(chartData);

  const strengthRanges = standards?.[liftType] || null;

  const roundedMaxWeightValue = weightMax * (width > 1280 ? 1.3 : 1.5);

  // Shadcn charts needs this for theming but we just do custom colors anyway
  const chartConfig = Object.fromEntries(
    selectedLiftTypes.map((liftType, index) => [
      liftType,
      {
        label: liftType,
      },
    ]),
  );

  const handleMouseMove = (event) => {
    if (event && event.activePayload) {
      const activeIndex = event.activeTooltipIndex;
      // devLog(event);
      // setHighlightDate(event.activeLabel);
    }
  };

  let tickJump = 100; // 100 for pound jumps on y-Axis.
  if (chartData?.[0]?.unitType === "kg") tickJump = 50; // 50 for kg jumps on y-Axis

  // FIXME: We need more dynamic x-axis ticks
  const formatXAxisDateString = (tickItem) => {
    const date = new Date(tickItem);
    return date.toLocaleString("en-US", { month: "short", day: "numeric" });
  };

  // Calculate dynamic bodyweight multiples based on weightMin and roundedMaxWeightValue, only if bodyWeight is valid
  let validBodyweightMultiples = null;

  if (bodyWeight && bodyWeight > 0) {
    // Generate ticks based on the main axis tick jump
    const numTicks = Math.ceil(roundedMaxWeightValue / tickJump);
    validBodyweightMultiples = Array.from(
      { length: numTicks },
      (_, i) => (i * tickJump) / bodyWeight,
    );
  }

  const strokeWidth = 1;
  const strokeDashArray = "5 15";

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
          <ResponsiveContainer width="100%" height={400} className="">
            <ChartContainer config={chartConfig} className="">
              <AreaChart
                accessibilityLayer
                data={chartData}
                margin={{ left: 5, right: 20 }}
                // onMouseMove={handleMouseMove}
              >
                <CartesianGrid vertical={false} />
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
                    (value) => `${value}${chartData[0]?.unitType || ""}` // Default to first item's unitType
                  }
                  ticks={Array.from(
                    { length: Math.ceil(roundedMaxWeightValue / tickJump) },
                    (v, i) => i * tickJump,
                  )}
                  // allowDataOverflow
                />
                {/* Additional Right Y-Axis for strength levels */}
                {showStandards && strengthRanges && (
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    // domain={[1, roundedMaxWeightValue]}
                    domain={[0, Math.max(100, roundedMaxWeightValue)]} // Sync with left Y-axis
                    hide={width < 768}
                    axisLine={false}
                    tickLine={false}
                    ticks={Object.values(strengthRanges)} // Use the strength ranges as ticks
                    tickFormatter={(value) => {
                      const unitType = isMetric ? "kg" : "lb";
                      // Map the value to the corresponding label and include the value + unitType
                      if (value === strengthRanges.physicallyActive)
                        return `Physically Active (${value}${unitType})`;
                      if (value === strengthRanges.beginner)
                        return `Beginner (${value}${unitType})`;
                      if (value === strengthRanges.intermediate)
                        return `Intermediate (${value}${unitType})`;
                      if (value === strengthRanges.advanced)
                        return `Advanced (${value}${unitType})`;
                      if (value === strengthRanges.elite)
                        return `Elite (${value}${unitType})`;
                    }}
                  />
                )}
                {/* Additional Right Y-Axis for bodyweight multiples */}
                {showBodyweightMultiples && bodyWeight && bodyWeight > 0 && (
                  <YAxis
                    yAxisId="bodyweight-multiples"
                    orientation="right"
                    hide={width < 1280}
                    axisLine={false}
                    tickLine={false}
                    domain={[0, Math.max(100, roundedMaxWeightValue)]} // Sync with left Y-axis
                    ticks={validBodyweightMultiples.map(
                      (multiple) => multiple * bodyWeight,
                    )} // Multiples of bodyweight
                    tickFormatter={(value) => {
                      const multiple = value / bodyWeight;
                      return `${multiple.toFixed(1)}xBW`;
                    }}
                  />
                )}
                <Tooltip
                  content={
                    <SingleLiftTooltipContent
                      selectedLiftTypes={selectedLiftTypes}
                      liftType={liftType}
                      e1rmFormula={e1rmFormula}
                    />
                  }
                  formatter={(value, name, props) =>
                    `${value} ${props.payload.unitType}`
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
                    <stop
                      offset="5%"
                      stopColor={getLiftColor(liftType)}
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="50%"
                      stopColor={getLiftColor(liftType)}
                      stopOpacity={0.05}
                    />
                  </linearGradient>
                  );
                </defs>
                <Area
                  key={liftType}
                  type="monotone"
                  dataKey={liftType}
                  stroke={getLiftColor(liftType)}
                  name={liftType}
                  strokeWidth={2}
                  fill={`url(#fill`}
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
                          {`${value}${chartData[index].unitType}`}
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

                {/* Horizontal reference lines on the secondary Y-axis */}
                {strengthRanges && showStandards && width > 768 && (
                  <>
                    <ReferenceLine
                      y={strengthRanges.physicallyActive}
                      strokeWidth={strokeWidth}
                      strokeDasharray={strokeDashArray}
                    />
                    <ReferenceLine
                      y={strengthRanges.beginner}
                      strokeWidth={strokeWidth}
                      strokeDasharray={strokeDashArray}
                    />
                    <ReferenceLine
                      y={strengthRanges.intermediate}
                      strokeWidth={strokeWidth}
                      strokeDasharray={strokeDashArray}
                    />
                    <ReferenceLine
                      y={strengthRanges.advanced}
                      strokeWidth={strokeWidth}
                      strokeDasharray={strokeDashArray}
                    />
                    <ReferenceLine
                      y={strengthRanges.elite}
                      strokeWidth={strokeWidth}
                      strokeDasharray={strokeDashArray}
                    />
                  </>
                )}
              </AreaChart>
            </ChartContainer>
          </ResponsiveContainer>
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
