"use client";

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

  const processedData = processVisualizerData(
    parsedData,
    "Brzycki",
    "Back Squat",
    "2024-03-01",
  );

  devLog(processedData);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Back Squat Estimated One Rep Max</CardTitle>
        <CardDescription>January - July 2024</CardDescription>
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
              content={<ChartTooltipContent labelKey="liftType" />}
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
  startDateStr,
) {
  if (parsedData === null) {
    console.log(`Error: visualizerProcessParsedData passed null.`);
    return;
  }

  const startTime = performance.now();

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
