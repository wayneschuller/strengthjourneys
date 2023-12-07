"use client";

import { useState, useEffect, useContext } from "react";
import { ParsedDataContext } from "@/pages/_app";
import { useTheme } from "next-themes";
import CalendarHeatmap from "react-calendar-heatmap";
import { devLog } from "@/lib/SJ-utils";
import { useWindowSize } from "usehooks-ts";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getReadableDateString } from "@/lib/SJ-utils";

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

  if (!parsedData) return;

  // Sensible defaults so the heatmap height is fairly reasonable
  let intervalMonths = 18;
  if (width > 768) intervalMonths = 24;
  if (width > 1536) intervalMonths = 32;

  const { startDate, endDate } = findDateRange(parsedData);
  const intervals = generateDateRanges(startDate, endDate, intervalMonths);

  // FIXME: put an isLoading skeleton in here internally?
  // {isLoading && (
  //   <div className="flex">
  //     <Skeleton className="h-36 w-11/12 flex-1" />
  //   </div>
  // )}

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity History</CardTitle>
        <CardDescription>
          {intervalMonths} month heatmap{intervals.length > 1 && "s"} for all
          lifting sessions from {getReadableDateString(startDate)} -{" "}
          {getReadableDateString(endDate)}.
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
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  // useEffect only runs on the client, so now we can safely show the UI
  // As advised by: https://github.com/pacocoursey/next-themes#avoid-hydration-mismatch
  // FIXME:  https://usehooks-ts.com/react-hook/use-is-client ?
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  // FIXME: if we are checking for mounted we could do clever stuff to get window width and adjust the heatmap data size accordingly?
  // We could set months based on window size here

  // FIXME: instead of limiting to 2 years on desktop, just show multiple heatmaps in rows for all the data?!
  // sm: show lots of rows of 6 months heatmaps
  // md: show lots of rows of 1 year heatmaps
  // xl: shows lots of rows of 2 year heatmaps
  // This would look epic - an overview of your data

  if (!parsedData) return;

  // Generate random data
  // const heatmap = generateRandomHeatmapData();

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
        if (!value) return null;

        return `${value?.date}: ${value?.count}`;
      }}
    />
  );
};

// Create heatmapData {date: lift.date, count: 1} whever we have parsedData activity
export const generateHeatmapData = (parsedData, startDate, endDate) => {
  const startTime = performance.now();

  // Convert startDate and endDate to Date objects once
  const startDateObj = new Date(startDate);
  const endDateObj = new Date(endDate);

  // Filter data based on the date range
  const filteredData = parsedData.filter((lift) => {
    const liftDate = new Date(lift.date);
    return liftDate >= startDateObj && liftDate <= endDateObj;
  });

  // Use an object to track unique dates
  const uniqueDates = {};

  // Create heatmapData {date: lift.date, count: 1} whenever we have parsedData activity
  const heatmapData = filteredData
    .filter((lift) => {
      if (!uniqueDates[lift.date]) {
        uniqueDates[lift.date] = true;
        return true;
      }
      return false;
    })
    .map((lift) => ({ date: lift.date, count: 1 }));

  // Log execution time using console.log
  devLog(
    "generateHeatmapData() execution time: " +
      Math.round(performance.now() - startTime) +
      "ms",
  );

  return heatmapData;
};

function findDateRange(parsedData) {
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

    return [{ start: intervalStartDate, end: intervalEndDate }];
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
        startDate: new Date(currentStartDate),
        endDate: new Date(currentEndDate),
      });

      // Move the start date for the next iteration
      currentStartDate.setTime(currentEndDate.getTime());
    }
    return dateRanges;
  }
}
