"use client";

import { useState, useRef, useMemo } from "react";
import { subMonths } from "date-fns";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CartesianGrid,
  Area,
  AreaChart,
  LabelList,
  Line,
  LineChart,
  XAxis,
  YAxis,
  ReferenceLine,
  Tooltip,
} from "recharts";
import { getLiftColor, brightenHexColor } from "@/lib/get-lift-color";
import { SidePanelSelectLiftsButton } from "../side-panel-lift-chooser";
import { useUserLiftingData } from "@/lib/use-userlift-data";
import { estimateE1RM } from "@/lib/estimate-e1rm";
import { devLog } from "@/lib/processing-utils";
import { useLocalStorage } from "usehooks-ts";
import { getReadableDateString } from "@/lib/processing-utils";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

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
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

import { ChartLegend, ChartLegendContent } from "@/components/ui/chart";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// FIXME: I have a function to do this which removes current year
const formatXAxisDateString = (tickItem) => {
  const date = new Date(tickItem);
  return date.toLocaleString("en-US", { month: "short", day: "numeric" });
};

export function VisualizerShadcn({ setHighlightDate }) {
  const { parsedData, selectedLiftTypes, topLiftsByTypeAndReps, isLoading } =
    useUserLiftingData();
  const [timeRange, setTimeRange] = useLocalStorage(
    "SJ_timeRange",
    "1900-01-01", // The start date threshold for inclusion in the chart
  );
  const [showLabelValues, setShowLabelValues] = useLocalStorage(
    "SJ_showLabelValues",
    false,
  );
  const [showAllData, setShowAllData] = useLocalStorage(
    "SJ_showAllData",
    false,
  ); // Show weekly bests or all data

  // Use useRef for variables that don't require re-render
  const activeDateRef = useRef(null);
  const tooltipXRef = useRef(0);

  // const [activeDate, setActiveDate] = useState(null); // Used for dynamic vertical reference dashed line
  // const [tooltipX, setToolTipX] = useState(0); // Used for dynamic vertical reference dashed line

  const referenceLine = useMemo(() => {
    if (activeDateRef.current) {
      return (
        <ReferenceLine
          x={activeDateRef.current}
          strokeDasharray="5 6"
          strokeWidth={3}
        />
      );
    }
    return null;
  }, [activeDateRef.current]);

  const e1rmFormula = "Brzycki"; // FIXME: uselocalstorage state

  if (isLoading) return;
  if (!parsedData) return;

  const processedData = processVisualizerData(
    parsedData,
    e1rmFormula,
    selectedLiftTypes,
    timeRange,
    showAllData,
  );

  devLog(processedData);

  const chartData = processedData;

  // setChartData(processedData);
  // devLog(selectedLiftTypes);

  // const firstLiftData = processedData[0].data;
  // const maxWeightValue = Math.max( ...firstLiftData.map((item) => item.oneRepMax),);

  const maxWeightValues = processedData.map((entry) =>
    Math.max(...entry.data.map((item) => item.oneRepMax)),
  );

  const maxWeightValue = Math.max(...maxWeightValues);

  // Round maxWeightValue up to the next multiple of 50
  // const roundedMaxWeightValue = Math.ceil(maxWeightValue / 50) * 50;
  const roundedMaxWeightValue = maxWeightValue * 1.3;
  // const roundedMaxWeightValue = Math.ceil((maxWeightValue * 1.3) / 50) * 50; // rounding to nearest 50
  // devLog(maxValue);

  // FIXME: this chartConfig is hacky - shad expects it for colors but I want to dynamically find colors
  const chartConfigMEH = {
    "Back Squat": {
      label: "Back Squat",
      color: "hsl(var(--chart-1))",
    },
    Deadlift: {
      label: "Deadlift",
      color: "hsl(var(--chart-2))",
    },
    "Bench Press": {
      label: "Bench Press",
    },
  };

  // FIXME: this chartConfig is hacky - shad expects it for colors but I want to dynamically find colors
  const chartConfig = {
    desktop: {
      label: "Desktop",
      color: "#2563eb",
    },
    mobile: {
      label: "Mobile",
      color: "#60a5fa",
    },
  };

  const handleMouseMove = (event) => {
    if (event && event.activePayload) {
      const activeIndex = event.activeTooltipIndex;
      // devLog(event);
      // setActiveDate(event.activeLabel);
      // setToolTipX(event.chartX);
      activeDateRef.current = event.activeLabel;
      tooltipXRef.current = event.chartX;

      setHighlightDate(event.activePayload[0].payload.date);
    }
  };

  const CustomTooltipContent = ({ active, payload, label }) => {
    // devLog(payload);
    if (active && payload && payload.length) {
      if (payload.length > 1) {
        devLog(`multipayload!`);
        devLog(payload);
      }

      // FIXME: we could map the payloads, or simply lookup the date in parseddata and do our own analysis or old code toplifts

      const tuple = payload[0].payload;
      // const oneRepMax = estimateE1RM(tuple.reps, tuple.weight, e1rmFormula);
      const oneRepMax = tuple.oneRepMax;
      const dateLabel = getReadableDateString(tuple.date);

      let labelContent = "";
      if (tuple.reps === 1) {
        labelContent = `Lifted ${tuple.reps}@${tuple.weight}${tuple.unitType}`;
      } else {
        labelContent = `Potential 1@${oneRepMax}@${tuple.unitType} from lifting ${tuple.reps}@${tuple.weight}${tuple.unitType}`;
      }

      const color = getLiftColor(tuple.liftType);
      // devLog(`${tuple.liftType} color: ${color}`);
      // devLog(tuple);

      return (
        <div className="grid min-w-[8rem] max-w-[24rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
          <p className="font-bold">{dateLabel}</p>
          <div className="flex flex-row items-center">
            <div
              className="mr-1 h-2.5 w-2.5 shrink-0 rounded-[2px]"
              style={{ backgroundColor: color }} // Use css style because tailwind is picky
            />
            {labelContent}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <Card>
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1 text-center sm:text-left">
          <CardTitle>{selectedLiftTypes[0]} Estimated One Rep Maxes</CardTitle>
          <CardDescription>
            {getTimeRangeDescription(timeRange, parsedData)}
          </CardDescription>
        </div>
        <div className="grid grid-cols-2 space-x-1">
          <SidePanelSelectLiftsButton />
          <TimeRangeSelect timeRange={timeRange} setTimeRange={setTimeRange} />
        </div>
      </CardHeader>

      <CardContent>
        <ChartContainer config={chartConfig}>
          <AreaChart
            accessibilityLayer
            // data={chartData}
            margin={{
              left: 12,
              right: 12,
            }}
            onMouseMove={handleMouseMove}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="x"
              type="number"
              scale="time"
              domain={[
                (dataMin) =>
                  new Date(dataMin).setDate(new Date(dataMin).getDate() - 2),
                (dataMax) =>
                  new Date(dataMax).setDate(new Date(dataMax).getDate() + 2),
              ]}
              tickFormatter={formatXAxisDateString}
              // interval="equidistantPreserveStart"
            />
            <YAxis
              domain={[0, roundedMaxWeightValue]}
              // hide={true}
              axisLine={false}
              // tickFormatter={(value) => Math.ceil(value / 50) * 50}
              ticks={Array.from(
                { length: Math.ceil(roundedMaxWeightValue / 50) },
                (v, i) => i * 50,
              )}
              allowDataOverflow
            />
            {referenceLine}
            {false && activeDateRef.current && (
              <ReferenceLine
                x={activeDateRef.current}
                // stroke="red" // FIXME: Doesn't seem to apply?
                // stroke="var(--color-foreground)" // FIXME: Doesn't work either
                strokeDasharray="5 6"
                strokeWidth={3}
                // label={activeDate}
              />
            )}
            <Tooltip
              content={<CustomTooltipContent />}
              position={{ x: tooltipXRef.current - 100, y: 10 }}
            />
            <defs>
              {chartData.map((line, index) => {
                const gradientId = `fill${line.label.split(" ").join("_")}`; // SVG id requires no spaces in life type label
                return (
                  <linearGradient
                    id={`fill${gradientId}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                    key={`${line.label}-${index}`} // Add a unique key for React rendering
                  >
                    <stop
                      offset="5%"
                      stopColor={line.color}
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="50%"
                      stopColor={line.color}
                      stopOpacity={0.05}
                    />
                  </linearGradient>
                );
              })}
            </defs>
            {chartData.map((line, index) => {
              const gradientId = `fill${line.label.split(" ").join("_")}`; // SVG id requires no spaces in life type label
              return (
                <Area
                  key={`${line.label}-${index}`}
                  type="monotone"
                  dataKey={`y_${line.label}`}
                  data={line.data}
                  stroke={line.color}
                  name={line.label}
                  strokeWidth={2}
                  fill={`url(#fill${gradientId})`}
                  fillOpacity={0.4}
                  dot={false}
                >
                  {showLabelValues && (
                    <LabelList
                      position="top"
                      offset={12}
                      className="fill-foreground"
                      fontSize={12}
                    />
                  )}
                </Area>
              );
            })}
            {chartData.length > 1 && (
              <ChartLegend content={<ChartLegendContent />} />
            )}
          </AreaChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <div className="flex w-full justify-between">
          <div className="flex items-center space-x-2">
            <Label className="font-light" htmlFor="show-values">
              Show All Values
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
        </div>
      </CardFooter>
    </Card>
  );
}

function processVisualizerData(
  parsedData,
  e1rmFormula,
  selectedLiftTypes,
  timeRange,
  showAllData = false,
) {
  if (parsedData === null) {
    console.log(`Error: visualizerProcessParsedData passed null.`);
    return;
  }

  const startTime = performance.now();

  // const startDateStr = timeRangetoDateStr(timeRange);
  const startDateStr = timeRange;

  const datasets = {}; // We build chart.js datasets with the lift type as the object key
  const recentLifts = {}; // Used for weekly bests data decimation
  const decimationDaysWindow = 7; // Only chart the best e1rm in the N day window

  // Loop through the data and find the best E1RM on each date for this liftType
  parsedData.forEach((entry) => {
    const liftTypeKey = entry.liftType;

    if (entry.date < startDateStr) return; // Skip if date out of range of chart

    // Skip if the lift type is not selected
    if (selectedLiftTypes && !selectedLiftTypes.includes(liftTypeKey)) {
      return;
    }

    if (entry.isGoal) return; // FIXME: implement goal dashed lines at some point

    // Lazy initialization of dataset for the lift type
    if (!datasets[liftTypeKey]) {
      const color = getLiftColor(liftTypeKey);
      const brightColor = brightenHexColor(color, 1.1);
      datasets[liftTypeKey] = {
        label: liftTypeKey,
        data: new Map(), // Using Map for efficient lookups
        color: color,
        brightColor: brightColor,
      };
    }

    const oneRepMax = estimateE1RM(entry.reps, entry.weight, e1rmFormula);
    const currentDate = new Date(entry.date);

    // Check if the current date already has a better E1RM
    if (datasets[liftTypeKey].data.has(entry.date)) {
      const currentData = datasets[liftTypeKey].data.get(entry.date);
      if (currentData.oneRepMax >= oneRepMax) {
        return; // Skip update if the existing E1RM is greater or equal
      }
    }

    // Data decimation - skip lower lifts if there was something bigger the last N day window
    if (!showAllData && recentLifts[liftTypeKey]) {
      const recentDate = new Date(recentLifts[liftTypeKey].date);
      const dayDiff = (currentDate - recentDate) / (1000 * 60 * 60 * 24);

      // Check if we already have a much better lift in the data decimation window
      if (
        dayDiff <= decimationDaysWindow &&
        oneRepMax <= recentLifts[liftTypeKey].oneRepMax * 0.95
      ) {
        return; // Skip this entry
      }
    }

    const timeStamp = new Date(entry.date).getTime(); // Convert to Unix timestamp for x-axis

    const fullEntry = {
      ...entry, // Spread the original entry to include all properties
      x: timeStamp,
      oneRepMax: oneRepMax,
      [`y_${liftTypeKey}`]: oneRepMax,
    };

    // Record this new best e1rm on this date
    datasets[liftTypeKey].data.set(entry.date, fullEntry);
    recentLifts[liftTypeKey] = fullEntry; // Store the full entry for future comparisons
  });

  // Convert object into an array of objects with the date included
  const sortedDatasets = Object.values(datasets).map((dataset) => ({
    ...dataset,
    data: Array.from(dataset.data.values()),
  }));

  devLog(
    "processVisualizerDataSHAD execution time: " +
      `\x1b[1m${Math.round(performance.now() - startTime)}` +
      `ms\x1b[0m`,
  );

  return sortedDatasets;
}

// Return a start date ("YYYY-MM-DD" format) based on timeRange ("All", "Year", "Quarter") relative to today's date
function timeRangetoDateStr(timeRange) {
  let startDateStr = "1900-01-01";
  const today = new Date();

  // Get the date 3 months ago
  const threeMonthsAgo = new Date(today);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const formattedThreeMonthsAgo = `${threeMonthsAgo.getFullYear()}-${(threeMonthsAgo.getMonth() + 1).toString().padStart(2, "0")}-${threeMonthsAgo.getDate().toString().padStart(2, "0")}`;

  // Get the date 1 year ago
  const oneYearAgo = new Date(today);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const formattedOneYearAgo = `${oneYearAgo.getFullYear()}-${(oneYearAgo.getMonth() + 1).toString().padStart(2, "0")}-${oneYearAgo.getDate().toString().padStart(2, "0")}`;

  switch (timeRange) {
    case "Year":
      startDateStr = formattedOneYearAgo;
      break;
    case "Quarter":
      startDateStr = formattedThreeMonthsAgo;
      break;
    default:
    // Nothing to do
  }

  return startDateStr;
}

// Used in the chart card description
const getTimeRangeDescription = (timeRange, parsedData) => {
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
  },
  {
    label: "Last 6 months",
    months: 6,
  },
  {
    label: "Last year",
    months: 12,
  },
  {
    label: "Last 2 years",
    months: 12 * 2,
  },
  {
    label: "Last 5 years",
    months: 12 * 5,
  },
  // All Time option will be pushed manually
];

function TimeRangeSelect({ timeRange, setTimeRange }) {
  const { parsedData } = useUserLiftingData();

  const firstDateStr = parsedData[0].date; // This is the first date in "YYYY-MM-DD" format

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

  // Manually push "All Time" option
  validSelectTimeDomains.push({
    label: "All time",
    timeRangeThreshold: "1900-01-01",
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
