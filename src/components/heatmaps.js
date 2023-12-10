"use client";

import { useState, useEffect, useContext } from "react";
import { ParsedDataContext } from "@/pages/_app";
import { useTheme } from "next-themes";
import CalendarHeatmap from "react-calendar-heatmap";
import { coreLiftTypes, devLog } from "@/lib/SJ-utils";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getReadableDateString } from "@/lib/SJ-utils";
import { useIsClient, useWindowSize } from "usehooks-ts";

// We don't need this because we put our own styles in our globals.css
// import "react-calendar-heatmap/dist/styles.css";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const ActivityHeatmapsCard = () => {
  const { parsedData, isDemoMode } = useContext(ParsedDataContext);
  const { width } = useWindowSize();
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [intervals, setIntervals] = useState(null);
  const [intervalMonths, setIntervalMonths] = useState(18);
  const isClient = useIsClient();
  const theme = null;
  const colorClass = `bg-gh-${theme || "light"}-2 rounded-full`;

  // Main useEffect - wait for parsedData to process component specfic data
  useEffect(() => {
    if (!parsedData) return;

    // Generate heatmap stuff
    const { startDate, endDate } = findStartEndDates(parsedData);
    setStartDate(startDate);
    setEndDate(endDate);

    // devLog(`Width changing to ${width}`);
    let intervalMonths = 18;
    if (width > 768 && width <= 1536) intervalMonths = 24;
    else if (width > 1536) intervalMonths = 32;
    setIntervalMonths(intervalMonths);

    const intervals = generateDateRanges(startDate, endDate, intervalMonths);
    setIntervals(intervals);
  }, [parsedData, width]);

  if (!isClient) return null; // Heatmaps only work on client
  if (!parsedData) return null;
  if (!intervals) return null;

  // FIXME: put an isLoading skeleton in here internally?
  // {isLoading && (
  //   <div className="flex">
  //     <Skeleton className="h-36 w-11/12 flex-1" />
  //   </div>
  // )}

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity History For All Lift Types</CardTitle>
        <CardDescription>
          {intervalMonths} month heatmap{intervals.length > 1 && "s"} for all
          lifting sessions from {getReadableDateString(startDate)} -{" "}
          {getReadableDateString(endDate)}. Historical PRs are highlighted. Core
          lift PRs are brighter.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {intervals.map((interval, index) => {
          return (
            <div className="mb-2 md:mb-6" key={`${index}-heatmap`}>
              <div className="hidden text-center md:block lg:text-lg">
                {getReadableDateString(interval.startDate)} -{" "}
                {getReadableDateString(interval.endDate)}
              </div>
              <Heatmap
                parsedData={parsedData}
                startDate={interval.startDate}
                endDate={interval.endDate}
                isMobile={intervalMonths === 18}
              />
            </div>
          );
        })}
      </CardContent>
      {!isDemoMode && (
        <CardFooter>
          <div className="flex flex-1 flex-row justify-end">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline">
                    <Share2
                      onClick={() => {
                        devLog(`FIXME: implement sharing of heatmap images`);
                      }}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Share heatmaps to clipboard</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardFooter>
      )}
    </Card>
  );
};

export default ActivityHeatmapsCard;

const Heatmap = ({ parsedData, startDate, endDate, isMobile }) => {
  const { theme, setTheme } = useTheme();

  const heatmapData = generateHeatmapData(parsedData, startDate, endDate);

  return (
    <CalendarHeatmap
      startDate={startDate}
      endDate={endDate}
      values={heatmapData}
      showMonthLabels={!isMobile}
      classForValue={(value) => {
        if (!value) {
          return `color-gh-${theme || "light"}-0`; // Grabs colors from css
        }
        return `color-gh-${theme || "light"}-${value.count}`; // Grabs colors from css
      }}
      titleForValue={(value) => {
        if (value?.tooltip) return value.tooltip;
      }}
    />
  );
};

function findStartEndDates(parsedData) {
  if (!parsedData || parsedData.length === 0) {
    return null; // Return null for an empty array or invalid input
  }

  // Initialize start and end dates with the date of the first item in the array
  let startDate = new Date(parsedData[0].date);
  let endDate = new Date(parsedData[0].date);

  // Iterate through the array to find the actual start and end dates
  parsedData.forEach((item) => {
    const currentDate = new Date(item.date);

    if (currentDate < startDate) {
      startDate = currentDate;
    }

    if (currentDate > endDate) {
      endDate = currentDate;
    }
  });

  return {
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
  };
}

// generateDateRanges
//
// 1. If the startDate and end date are within intervalMonths,
// then we return one interval of length intervalMonths with start and end
// date in the middle.
//
// 2. If the start and end date are longer than intervalMonths,
// then return multiple intervals starting at startDate and ending
// AFTER endDate.
//
// startDateStr and endDateStr format is: "yyyy-mm-dd"
//
function generateDateRanges(startDateStr, endDateStr, intervalMonths) {
  // Convert input date strings to Date objects
  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);

  // Calculate the duration of the input date range in milliseconds
  const rangeDuration = endDate - startDate;

  // Calculate the interval duration in milliseconds
  const intervalDuration = intervalMonths * 30 * 24 * 60 * 60 * 1000;

  // Check if the duration is less than the specified interval
  if (rangeDuration < intervalDuration) {
    // If less than the interval, place startDate and endDate in the middle of the interval
    const middleDate = new Date(
      startDate.getTime() + rangeDuration / 2 - intervalDuration / 2,
    );
    const intervalStartDate = new Date(middleDate);
    const intervalEndDate = new Date(intervalStartDate);
    intervalEndDate.setMilliseconds(
      intervalEndDate.getMilliseconds() + intervalDuration,
    );

    return [
      {
        startDate: intervalStartDate.toISOString().split("T")[0],
        endDate: intervalEndDate.toISOString().split("T")[0],
      },
    ];
  } else {
    // If more than the interval, generate multiple ranges with the specified interval
    const dateRanges = [];
    let currentStartDate = new Date(startDate);

    while (currentStartDate < endDate) {
      const currentEndDate = new Date(currentStartDate);
      currentEndDate.setMilliseconds(
        currentEndDate.getMilliseconds() + intervalDuration,
      );

      dateRanges.push({
        startDate: currentStartDate.toISOString().split("T")[0],
        endDate: currentEndDate.toISOString().split("T")[0],
      });

      // Move the start date for the next iteration
      currentStartDate.setTime(currentEndDate.getTime());
    }
    return dateRanges;
  }
}

// Create heatmapData
// If we find activity we set: {date: lift.date, count: 1}
// If we find isHistoricalPR we set: {date: lift.date, count: 2}
// If the historicalPR is a coreLift we set: {date: lift.date, count: 4}
// We also set some tooltips.
// The heatmap can take colors 0..4
export const generateHeatmapData = (parsedData, startDate, endDate) => {
  const startTime = performance.now();

  // Filter data based on the date range (assumes "YYYY-MM-DD" strings)
  const filteredData = parsedData.filter(
    (lift) => lift.date >= startDate && lift.date <= endDate,
  );

  // Use an object to track unique dates
  const uniqueDates = {};

  // Create heatmapData
  const heatmapData = filteredData.reduce((accumulator, lift) => {
    const currentDate = lift.date;
    if (!uniqueDates[currentDate]) {
      uniqueDates[currentDate] = true;

      const isHistoricalPR = filteredData.some(
        (pr) => pr.date === currentDate && pr.isHistoricalPR,
      );

      // Initialize liftTypeCount to 1 (we have a normal lift session data on this date)
      let liftTypeCount = 1;

      if (isHistoricalPR) {
        // Check if it's a core lift
        if (coreLiftTypes.some((coreLift) => coreLift === lift.liftType)) {
          liftTypeCount = 4; // Historical PR for core lift
        } else {
          liftTypeCount = 2; // Historical PR, but not a core lift
        }
      }

      accumulator.push({
        date: currentDate,
        count: liftTypeCount,
        tooltip: isHistoricalPR
          ? getHistoricalPrTooltip(filteredData, currentDate)
          : `Date: ${currentDate}`,
      });
    }

    return accumulator;
  }, []);

  devLog(
    `generateHeatmapData(${startDate} to ${endDate}) execution time: ` +
      `\x1b[1m${Math.round(performance.now() - startTime)}` +
      `ms\x1b[0m`,
  );

  return heatmapData;
};

// Helper function to get tooltip for historical PRs on a specific date
function getHistoricalPrTooltip(data, currentDate) {
  const prsOnDate = data
    .filter((pr) => pr.date === currentDate && pr.isHistoricalPR)
    .map((pr) => `${pr.liftType} PR ${pr.reps}@${pr.weight}${pr.unitType}`)
    .join("\n");

  return `Date: ${getReadableDateString(currentDate)}\n${prsOnDate}`;
}
