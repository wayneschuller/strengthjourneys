"use client";

import { cloneElement, useState, useEffect, useContext, useRef } from "react";
import { useTheme } from "next-themes";
import CalendarHeatmap from "react-calendar-heatmap";
import {
  coreLiftTypes,
  devLog,
  getReadableDateString,
} from "@/lib/processing-utils";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsClient, useWindowSize } from "usehooks-ts";
import { useSession } from "next-auth/react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { Skeleton } from "@/components/ui/skeleton";
import html2canvas from "html2canvas";

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

export function ActivityHeatmapsCard() {
  const { parsedData, isLoading } = useUserLiftingData();
  const { width } = useWindowSize({ initializeWithValue: false });
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [intervals, setIntervals] = useState(null);
  const [intervalMonths, setIntervalMonths] = useState(18);
  const { status: authStatus } = useSession();
  const isClient = useIsClient();
  const { theme } = useTheme();
  const shareRef = useRef(null);

  // FIXME: I think we have the skills to not need this useEffect anymore
  useEffect(() => {
    if (isLoading) return;
    if (!parsedData || parsedData.length === 0) return;

    // Generate heatmap stuff
    const { startDate, endDate } = findStartEndDates(parsedData);
    setStartDate(startDate);
    setEndDate(endDate);

    // devLog(`Heatmaps: Width changing to ${width}`);
    let intervalMonths = 12;
    if (width > 768 && width <= 1536) intervalMonths = 24;
    else if (width > 1536) intervalMonths = 32;
    setIntervalMonths(intervalMonths);

    const intervals = generateDateRanges(startDate, endDate, intervalMonths);

    // devLog(`Heatmaps: setting intervals:`);
    // devLog(intervals);

    setIntervals(intervals); // intervals is the trigger for showing the heatmaps
  }, [isLoading, parsedData, width]);

  // if (!parsedData || parsedData.length === 0) { return null; }

  const handleShare = async () => {
    const startTime = performance.now();

    if (shareRef.current) {
      const canvas = await html2canvas(shareRef.current, {
        ignoreElements: (element) => element.id === "ignoreCopy",
      });

      canvas.toBlob((blob) => {
        navigator.clipboard
          .write([new ClipboardItem({ "image/png": blob })])
          .then(() => {
            console.log("Heatmap copied to clipboard");
            // FIXME: toast update here
          })
          .catch((err) => console.error("Error in copying heatmap: ", err));
      }, "image/png");
    }

    devLog(
      `generate html2canvas execution time: ` +
        `\x1b[1m${Math.round(performance.now() - startTime)}ms\x1b[0m`,
    );

    if (typeof window !== "undefined") {
      window.gtag("event", "heatmap_share_clipboard");
    }
  };

  return (
    <Card ref={shareRef}>
      <CardHeader>
        <CardTitle>
          {authStatus === "unauthenticated" && "Demo mode: "}Activity History
          For All Lift Types
        </CardTitle>
        {intervals && (
          <CardDescription>
            {intervalMonths} month heatmap{intervals.length > 1 && "s"} for all
            lifting sessions from {getReadableDateString(startDate)} -{" "}
            {getReadableDateString(endDate)}. Historical PRs are highlighted.
            Major barbell lift type PRs are{" "}
            {theme === "dark" ? "brighter" : "darker"}.
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {!intervals && <Skeleton className="h-64 w-11/12 flex-1" />}
        {intervals &&
          intervals.map((interval, index) => {
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
      {intervals && (
        <CardFooter id="ignoreCopy">
          <div className="flex flex-1 flex-row justify-end">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline">
                    <Share2 onClick={handleShare} />
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
}

function Heatmap({ parsedData, startDate, endDate, isMobile }) {
  const { theme } = useTheme();
  const { status: authStatus } = useSession();
  const [heatmapData, setHeatmapData] = useState(null);

  useEffect(() => {
    if (!parsedData) return;
    const heatmapData = generateHeatmapData(
      parsedData,
      startDate,
      endDate,
      authStatus === "unauthenticated", // This is a clue we have sample data and we will fake the heatmap to impress shallow people
    );
    setHeatmapData(heatmapData);
  }, [parsedData, startDate, endDate, authStatus]);

  if (!heatmapData || !startDate || !endDate) {
    return <Skeleton className="h-24 flex-1" />;
  }

  return (
    <CalendarHeatmap
      startDate={startDate}
      endDate={endDate}
      values={heatmapData}
      showMonthLabels={!isMobile}
      classForValue={(value) => {
        if (!value) {
          return `color-heatmap-0`; // Uses CSS variables from theme
        }
        return `color-heatmap-${value.count}`; // Uses CSS variables from theme
      }}
      titleForValue={(value) => {
        if (value?.tooltip) return value.tooltip;
      }}
      // Roundedness
      transformDayElement={(element, value, index) =>
        cloneElement(element, { rx: 3, ry: 3 })
      }
    />
  );
}

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
function generateHeatmapData(parsedData, startDate, endDate, isDemoMode) {
  const startTime = performance.now();

  // Generate a full interval of random data for demo mode because it looks good
  if (isDemoMode) {
    const demoHeatmapData = [];
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    const oneDay = 24 * 60 * 60 * 1000; // milliseconds in a day

    // Function to get a random count based on specified probabilities
    const getRandomCount = () => {
      const rand = Math.random();
      if (rand < 0.6) return 0; // 60% chance of being 0
      if (rand < 0.8) return 1; // 30% chance of being 1
      if (rand < 0.95) return 2; // 15% chance of being 2
      return 4; // 5% chance of being 4 (note: 3 is never chosen)
    };

    for (let currentTime = start; currentTime <= end; currentTime += oneDay) {
      const count = getRandomCount();
      demoHeatmapData.push({
        date: new Date(currentTime).toISOString().split("T")[0],
        count: count,
        tooltip: "Random data for demo mode",
      });
    }

    devLog(
      `generateHeatmapData(random) execution time: ` +
        `\x1b[1m${Math.round(performance.now() - startTime)}ms\x1b[0m`,
    );
    return demoHeatmapData;
  }

  // Normal heatmap data generation logic

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
}

// Helper function to get tooltip for historical PRs on a specific date
function getHistoricalPrTooltip(data, currentDate) {
  const prsOnDate = data
    .filter((pr) => pr.date === currentDate && pr.isHistoricalPR)
    .map(
      (pr) =>
        `${pr.liftType} Historical PR ${pr.reps}@${pr.weight}${pr.unitType}`,
    )
    .join("\n");

  return `Date: ${getReadableDateString(currentDate)}\n${prsOnDate}`;
}
