"use client";

import { useState, useRef } from "react";
import { TrendingUp } from "lucide-react";
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
} from "recharts";
import { getLiftColor } from "@/lib/get-lift-color";
import { SidePanelSelectLiftsButton } from "../side-panel-lift-chooser";
import { useUserLiftingData } from "@/lib/use-userlift-data";
import { estimateE1RM } from "@/lib/estimate-e1rm";
import { devLog } from "@/lib/processing-utils";
import { useLocalStorage } from "usehooks-ts";

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
  const [timeRange, setTimeRange] = useLocalStorage("SJ_timeRange", "Quarter"); // Options: "All", "Year", "Quarter"
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

  // FIXME: Not using this yet - just starting
  const CustomLabel = (props) => {
    const { x, y, value, payload } = props;
    return (
      <text x={x} y={y} dy={-4} fill="#666" fontSize={14} textAnchor="middle">
        {`${value} ${payload.unitType}`}
      </text>
    );
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
            {activeDateRef.current && (
              <ReferenceLine
                x={activeDateRef.current}
                stroke="red"
                strokeDasharray="5 5"
                // label={activeDate}
              />
            )}

            {true && (
              <ChartTooltip
                cursor={false}
                // labelKey=""
                content={
                  <ChartTooltipContent
                    indicator="line"
                    // labelFormatter={(value, payload) => { const tuple = payload[0].payload; return `${formatXAxisDateString(tuple.date)}`; }}
                    formatter={(value, name, entry) => {
                      // devLog(value);
                      const tuple = entry.payload;

                      const oneRepMax = estimateE1RM(
                        tuple.reps,
                        tuple.weight,
                        e1rmFormula,
                      );

                      // FIXME: add color line and shadlike design
                      let label = "";
                      if (tuple.reps === 1) {
                        label = `Lifted ${tuple.reps}@${tuple.weight}${tuple.unitType}`;
                      } else {
                        label = `Potential 1@${oneRepMax}@${tuple.unitType} from lifting ${tuple.reps}@${tuple.weight}${tuple.unitType}`;
                      }
                      return label;
                    }}
                  />
                }
                position={{ x: tooltipXRef.current - 100, y: 10 }}
              />
            )}
            <defs>
              {chartData.map((line, index) => (
                <linearGradient
                  id={`fillSquat`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                  key={index} // Add a unique key for React rendering
                >
                  <stop
                    offset="5%"
                    // stopColor="var(--color-desktop)"
                    stopColor={line.color}
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="50%"
                    // stopColor="var(--color-desktop)"
                    stopColor={line.color}
                    stopOpacity={0.05}
                  />
                </linearGradient>
              ))}
            </defs>
            {chartData.map((line, index) => (
              <Area
                key={`${line.label}-${index}`}
                type="monotone"
                dataKey={`y_${line.label}`}
                // dataKey="y"
                data={line.data}
                stroke={line.color}
                name={line.label}
                strokeWidth={2}
                // type="natural"
                // fill={`url(#fill${line.label})`}
                fill="url(#fillSquat)"
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
            ))}
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

function TimeRangeSelect({ timeRange, setTimeRange }) {
  return (
    <Select value={timeRange} onValueChange={setTimeRange}>
      <SelectTrigger
        className="w-[160px] rounded-lg sm:ml-auto"
        aria-label="Select a value"
      >
        <SelectValue placeholder="Last 3 months" />
      </SelectTrigger>
      <SelectContent className="rounded-xl">
        <SelectItem value="All" className="rounded-lg">
          All time
        </SelectItem>
        <SelectItem value="Year" className="rounded-lg">
          Last year
        </SelectItem>
        <SelectItem value="Quarter" className="rounded-lg">
          Last 3 months
        </SelectItem>
      </SelectContent>
    </Select>
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

  const startDateStr = timeRangetoDateStr(timeRange);

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
      // const brightColor = brightenHexColor(color, 1.1);
      datasets[liftTypeKey] = {
        label: liftTypeKey,
        data: new Map(), // Using Map for efficient lookups
        color: getLiftColor(liftTypeKey),
      };
    }

    const oneRepMax = estimateE1RM(entry.reps, entry.weight, e1rmFormula);
    const currentDate = new Date(entry.date);

    // Check if the current date already has a better E1RM
    if (datasets[liftTypeKey].data.has(entry.date)) {
      const currentData = datasets[liftTypeKey].data.get(entry.date);
      if (currentData.y >= oneRepMax) {
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

const getTimeRangeDescription = (timeRange, parsedData) => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-based index, January is 0

  const lastYear = currentYear - 1;

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

  switch (timeRange) {
    case "All":
      if (parsedData.length === 0) return ""; // Ensure there's data to work with
      const firstDate = new Date(parsedData[0].date);
      const firstMonth = firstDate.getMonth();
      const firstYear = firstDate.getFullYear();
      return `${monthNames[firstMonth]} ${firstYear} - ${monthNames[currentMonth]} ${currentYear}`;

    case "Year":
      // From the current month last year to the same month this year
      return `${monthNames[currentMonth]} ${lastYear} - ${monthNames[currentMonth]} ${currentYear}`;

    case "Quarter":
      const startMonthIndex = (currentMonth - 3 + 12) % 12; // Adjusting for negative month indices
      const startMonthYear =
        startMonthIndex > currentMonth ? currentYear - 1 : currentYear; // Adjust year if month index wrapped around
      return `${monthNames[startMonthIndex]} ${startMonthYear} - ${monthNames[currentMonth]} ${currentYear}`;

    default:
      return "Time Range Not Specified";
  }
};
