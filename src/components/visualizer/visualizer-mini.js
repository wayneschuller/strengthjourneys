"use client";

import { useMemo, useEffect, useState } from "react";
import { getLiftColor } from "@/lib/get-lift-color";
import { SidePanelSelectLiftsButton } from "../side-panel-lift-chooser";
import { useUserLiftingData } from "@/lib/use-userlift-data";
import { useAthleteBioData } from "@/lib/use-athlete-biodata";
import { useLocalStorage, useWindowSize } from "usehooks-ts";
import { useSession } from "next-auth/react";
import { devLog, getReadableDateString } from "@/lib/processing-utils";
import { e1rmFormulae } from "@/lib/estimate-e1rm";
import { subMonths } from "date-fns";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ReferenceLine, ReferenceArea, ResponsiveContainer } from "recharts";
import { Checkbox } from "@/components/ui/checkbox";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

  // FIXME: This design is terrible. We should be storing the periodTarget options in local storage
  // If we just store the date then the next day onward we won't know the range they wanted
  const [timeRange, setTimeRange] = useLocalStorage(
    "SJ_timeRange",
    "1900-01-01", // The start date threshold for inclusion in the chart
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
        timeRange,
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

  // -----------------------------------------------------------------------------
  // CustomToolTipContent
  // Out tooltip is modelled on the shadcnui chart layout but customised for our needs
  // -----------------------------------------------------------------------------
  const CustomTooltipContent = ({ active, payload, label, liftType }) => {
    // devLog(payload);

    const selectedLiftTypes = [liftType]; // FIXME: we can just remove the .foreach below in mini mode

    if (active && payload && payload.length) {
      // Right now we have put key info into the chartData paylod. But we could simply lookup the date in parsedData/topLifts for info
      const tuple = payload[0].payload;

      // devLog(tuple);
      const dateLabel = getReadableDateString(tuple.date);
      const tooltipsPerLift = [];

      selectedLiftTypes.forEach((liftType) => {
        const reps = tuple[`${liftType}_reps`];
        const weight = tuple[`${liftType}_weight`];
        const oneRepMax = tuple[`${liftType}`];
        const unitType = tuple.unitType;

        if (reps && weight && oneRepMax) {
          let labelContent = "";
          if (reps === 1) {
            labelContent = `Lifted ${reps}@${weight}${unitType}`;
          } else {
            labelContent = `Potential 1@${oneRepMax}${unitType} from lifting ${reps}@${weight}${unitType}`;
          }

          const color = getLiftColor(liftType);
          tooltipsPerLift.push({
            liftType: liftType,
            label: labelContent,
            color: color,
            reps: reps,
          });
        }
      });

      // devLog(liftLabels);

      return (
        <div className="grid min-w-[8rem] max-w-[24rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
          <p className="font-bold">{dateLabel}</p>
          {tooltipsPerLift.map(({ liftType, label, color, reps, index }) => (
            <div key={liftType}>
              <div className="flex flex-row items-center">
                <div
                  className="mr-1 h-2.5 w-2.5 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: color }} // Use css style because tailwind is picky
                />
                <div className="font-semibold">{liftType}</div>
              </div>
              <div className="">{label}</div>
            </div>
          ))}
        </div>
      );
    }

    return null;
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
            {getTimeRangeDescription(timeRange, parsedData)}
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
                    domain={[0, roundedMaxWeightValue]}
                    hide={width < 1280}
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
                    domain={[0, roundedMaxWeightValue]}
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
                    <CustomTooltipContent
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
                {strengthRanges && showStandards && width > 1280 && (
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

// Used in the chart card description
const getTimeRangeDescription = (timeRange, parsedData) => {
  if (!parsedData) return null;

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-based index, January is 0

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  let timeRangeDate = new Date(timeRange);
  if (timeRange === "1900-01-01") {
    // Special case for the "All Time" category
    timeRangeDate = new Date(parsedData[0].date); // Use first user data date for "All Time" option
  }

  let month = timeRangeDate.getMonth();
  let year = timeRangeDate.getFullYear();

  return `${monthNames[month]} ${year !== currentYear ? `${year}` : ""} - ${monthNames[currentMonth]} ${currentYear}`;
};

// These are the full period targets we will use for Visualizer chart time domains
// This allows us to offer time domains on the visualizer that match the user data
// The algorithm assumes each period is longer than the next
const periodTargets = [
  {
    label: "Last 3 months",
    months: 3,
    shortLabel: "3M",
  },
  {
    label: "Last 6 months",
    months: 6,
    shortLabel: "6M",
  },
  {
    label: "Last year",
    months: 12,
    shortLabel: "1Y",
  },
  {
    label: "Last 2 years",
    months: 12 * 2,
    shortLabel: "2Y",
  },
  {
    label: "Last 5 years",
    months: 12 * 5,
    shortLabel: "5Y",
  },
  // All Time option will be pushed manually
];

function TimeRangeSelect({ timeRange, setTimeRange }) {
  const { parsedData } = useUserLiftingData();

  if (!parsedData) return null;

  // This is the first date in "YYYY-MM-DD" format
  // FIXME: Should we find the first date for selected lifts only?
  const firstDateStr = parsedData[0].date;

  const todayStr = new Date().toISOString().split("T")[0];

  let validSelectTimeDomains = [];

  periodTargets.forEach((period) => {
    const dateMonthsAgo = subMonths(new Date(), period.months);
    const thresholdDateStr = dateMonthsAgo.toISOString().split("T")[0];

    if (firstDateStr < thresholdDateStr) {
      validSelectTimeDomains.push({
        label: period.label,
        timeRangeThreshold: thresholdDateStr,
      });
    }
  });

  // Manually push "All Time" option every time
  validSelectTimeDomains.push({
    label: "All time",
    timeRangeThreshold: "1900-01-01",
    shortLabel: "MAX",
  });

  // devLog(validSelectTimeDomains);

  return (
    <Select value={timeRange} onValueChange={setTimeRange}>
      <SelectTrigger
        className="w-[160px] rounded-lg sm:ml-auto"
        aria-label="Select a value"
      >
        <SelectValue placeholder="All time" />
      </SelectTrigger>
      <SelectContent className="rounded-xl">
        {validSelectTimeDomains.map((period) => (
          <SelectItem
            key={`${period.label}-${period.timeRangeThreshold}`}
            value={period.timeRangeThreshold}
            className="rounded-lg"
          >
            {period.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function E1RMFormulaSelect({ e1rmFormula, setE1rmFormula }) {
  return (
    <div className="flex flex-row items-center space-x-2">
      <div className="text-sm font-light">E1RM Algorithm</div>
      <Select value={e1rmFormula} onValueChange={setE1rmFormula}>
        <SelectTrigger
          className="w-[160px] rounded-lg sm:ml-auto"
          aria-label="Select a value"
        >
          <SelectValue placeholder="Brzycki" />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          {e1rmFormulae.map((formula) => (
            <SelectItem key={formula} value={formula} className="rounded-lg">
              {formula}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export const SpecialHtmlLabel = ({ x, y, value }) => {
  if (!value) return null;

  const maxChars = 20;
  // Trim the label if it's longer than the specified max characters
  const trimmedValue =
    value.length > maxChars ? value.slice(0, maxChars) + "..." : value;

  return (
    <foreignObject x={x - 50} y={y + 220} width={100} height={50}>
      <div
        className="rounded-md border p-2 text-center text-xs tracking-tight shadow-lg"
        title={value}
      >
        {trimmedValue}
      </div>
    </foreignObject>
  );
};
