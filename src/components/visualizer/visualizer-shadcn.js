"use client";

import { useState } from "react";
import { TrendingUp } from "lucide-react";
import { CartesianGrid, LabelList, Line, LineChart, XAxis } from "recharts";
import { getLiftColor } from "@/lib/get-lift-color";
import { useUserLiftingData } from "@/lib/use-userlift-data";
import { estimateE1RM } from "@/lib/estimate-e1rm";
import { devLog } from "@/lib/processing-utils";

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

export function VisualizerShadcn({
  highlightDate,
  setHighlightDate,
  onDataHover,
}) {
  const { parsedData, selectedLiftTypes, topLiftsByTypeAndReps, isLoading } =
    useUserLiftingData();
  const [timeRange, setTimeRange] = useState("Quarter"); // Options: "All", "Year", "Quarter"

  const e1rmFormula = "Brzycki"; // FIXME: uselocalstorage state

  if (isLoading) return;
  if (!parsedData) return;

  const lineData = processVisualizerData(
    parsedData,
    e1rmFormula,
    selectedLiftTypes,
    timeRange,
  );

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
          <CardTitle>Estimated One Rep Maxes</CardTitle>
          <CardDescription>
            {getTimeRangeDescription(timeRange, parsedData)}
          </CardDescription>
        </div>
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
      </CardHeader>

      <CardContent>
        <ChartContainer config={chartConfig}>
          <LineChart
            accessibilityLayer
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="x"
              type="number"
              domain={("auto", "auto")}
              tickFormatter={formatXAxisDateString}
              scale="time"
            />
            <ChartTooltip
              cursor={false}
              // labelKey=""
              content={
                <ChartTooltipContent
                  indicator="line"
                  // labelFormatter={(value, payload) => { const tuple = payload[0].payload; return `${formatXAxisDateString(tuple.date)}`; }}
                  formatter={(value, name, entry) => {
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
                    // setHighlightDate(tuple.date);
                    return label;
                  }}
                />
              }
            />
            {lineData.map((line, index) => (
              <Line
                key={`${line.label}-${index}`}
                type="monotone"
                data={line.data}
                dataKey="y"
                stroke={line.color}
                name={line.label}
                strokeWidth={2}
                dot={false}
                onMouseOver={(event, payload) => onDataHover(event)}
              >
                <LabelList
                  position="top"
                  offset={12}
                  className="fill-foreground"
                  fontSize={12}
                />
              </Line>
            ))}
            {lineData.length > 1 && (
              <ChartLegend content={<ChartLegendContent />} />
            )}
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// This function uniquely processes the parsed data for the Visualizer
export function processVisualizerData(
  parsedData,
  e1rmFormula,
  selectedLiftTypes,
  timeRange,
) {
  if (parsedData === null) {
    console.log(`Error: visualizerProcessParsedData passed null.`);
    return;
  }

  const startTime = performance.now();

  const startDateStr = timeRangetoDateSTR(timeRange);

  const datasets = {}; // We build chart.js datasets with the lift type as the object key

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

    const timeStamp = new Date(entry.date).getTime(); // Convert to Unix timestamp for x-axis

    const fullEntry = {
      ...entry, // Spread the original entry to include all properties
      x: timeStamp,
      y: oneRepMax,
    };

    // Record this new best e1rm on this date
    datasets[liftTypeKey].data.set(entry.date, fullEntry);
  });

  // Convert object into an array of objects with the date included
  const sortedDatasets = Object.values(datasets).map((dataset) => ({
    ...dataset,
    data: Array.from(dataset.data.values()),
  }));

  // Sort the array by date using simple string comparison
  // entries.sort((a, b) => (a.date > b.date ? 1 : -1));

  devLog(
    "processVisualizerDataSHAD execution time: " +
      `\x1b[1m${Math.round(performance.now() - startTime)}` +
      `ms\x1b[0m`,
  );

  return sortedDatasets;
}

// Return a start date ("YYYY-MM-DD" format) based on timeRange ("All", "Year", "Quarter") relative to today's date
function timeRangetoDateSTR(timeRange) {
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
