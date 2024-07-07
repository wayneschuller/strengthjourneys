"use client";

import { useState } from "react";
import { TrendingUp } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis } from "recharts";
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

const chartConfig = {
  liftType: {
    label: "Back Squat",
    color: "hsl(var(--chart-1))",
  },
};

export function VisualizerShadcn() {
  const { parsedData, selectedLiftTypes, topLiftsByTypeAndReps, isLoading } =
    useUserLiftingData();
  const [timeRange, setTimeRange] = useState("Quarter"); // Options: "All", "Year", "Quarter"

  const e1rmFormula = "Brzycki"; // FIXME: uselocalstorage state

  const processedData = processVisualizerData(
    parsedData,
    e1rmFormula,
    "Back Squat",
    timeRange,
  );

  // devLog(processedData);

  return (
    <Card>
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1 text-center sm:text-left">
          <CardTitle>Back Squat Estimated One Rep Max</CardTitle>
          <CardDescription>January - July 2024</CardDescription>
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
            data={processedData}
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
              content={
                <ChartTooltipContent
                  indicator="line"
                  labelFormatter={(value, entry) => {
                    // devLog(entry);
                    return `${formatXAxisDateString(entry[0].payload.date)}`;
                  }}
                  formatter={(value, name, entry) => {
                    devLog(entry);
                    const tuple = entry.payload;
                    devLog(tuple);
                    const oneRepMax = estimateE1RM(
                      tuple.reps,
                      tuple.weight,
                      e1rmFormula,
                    );
                    const label = `Potential 1@${oneRepMax}@${tuple.unitType} from lifting ${tuple.reps}@${tuple.weight}${tuple.unitType} (${e1rmFormula} formula)`;
                    return label;
                  }}
                />
              }
            />
            <Line
              dataKey="y"
              type="monotone"
              stroke="var(--color-liftType)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <div className="flex w-full items-start gap-2 text-sm">
          <div className="grid gap-2">
            <div className="flex items-center gap-2 font-medium leading-none">
              Trending up by 5.2% this month <TrendingUp className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-2 leading-none text-muted-foreground">
              Showing total visitors for the last 6 months
            </div>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}

// This function uniquely processes the parsed data for the Visualizer
export function processVisualizerData(
  parsedData,
  e1rmFormula,
  liftType,
  timeRange,
) {
  if (parsedData === null) {
    console.log(`Error: visualizerProcessParsedData passed null.`);
    return;
  }

  const startTime = performance.now();

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

  const liftE1RMsByDate = {}; // Use entry.date as the key, holding the best e1rm for that date

  // Loop through the data and find the best E1RM on each date for this liftType
  parsedData.forEach((entry) => {
    if (entry.date < startDateStr) return;
    if (entry.liftType !== liftType) return;
    if (entry.isGoal) return;

    const oneRepMax = estimateE1RM(entry.reps, entry.weight, e1rmFormula);

    // Check if the current date already has a better E1RM
    if (liftE1RMsByDate[entry.date]) {
      if (liftE1RMsByDate[entry.date].y >= oneRepMax) {
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
    liftE1RMsByDate[entry.date] = fullEntry;
  });

  // Convert object into an array of objects with the date included
  const entries = Object.entries(liftE1RMsByDate).map(([date, entry]) => ({
    date,
    ...entry,
  }));

  // Sort the array by date using simple string comparison
  entries.sort((a, b) => (a.date > b.date ? 1 : -1));

  devLog(
    "processVisualizerDataSHAD execution time: " +
      `\x1b[1m${Math.round(performance.now() - startTime)}` +
      `ms\x1b[0m`,
  );

  return entries;
}
