"use client";

import { cloneElement, useState, useEffect, useContext, useRef } from "react";
import { useTheme } from "next-themes";
import CalendarHeatmap from "react-calendar-heatmap";
import {
  coreLiftTypes,
  devLog,
  getReadableDateString,
} from "@/lib/processing-utils";
import { Share2, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { Skeleton } from "@/components/ui/skeleton";
// Dynamically import html2canvas only when needed (share feature)
// This is a large library (~200KB) that's only used when user clicks share

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
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [intervals, setIntervals] = useState(null);
  const { status: authStatus } = useSession();
  const { theme } = useTheme();
  const shareRef = useRef(null);
  const [isSharing, setIsSharing] = useState(false);

  // FIXME: I think we have the skills to not need this useEffect anymore
  useEffect(() => {
    if (isLoading) return;
    if (!parsedData || parsedData.length === 0) return;

    // Generate heatmap stuff
    const { startDate, endDate } = findStartEndDates(parsedData);
    setStartDate(startDate);
    setEndDate(endDate);

    const intervals = generateYearRanges(startDate, endDate);

    // devLog(`Heatmaps: setting intervals:`);
    // devLog(intervals);

    setIntervals(intervals); // intervals is the trigger for showing the heatmaps
  }, [isLoading, parsedData]);

  // if (!parsedData || parsedData.length === 0) { return null; }

  const handleShare = async () => {
    const startTime = performance.now();
    setIsSharing(true);

    try {
      if (shareRef.current) {
        // Dynamically import html2canvas only when user clicks share
        const html2canvas = (await import("html2canvas")).default;
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
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <>
      {isSharing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="flex flex-col items-center gap-4 rounded-lg border bg-background p-6 shadow-lg">
            <LoaderCircle className="h-8 w-8 animate-spin" />
            <div className="text-center">
              <h3 className="text-lg font-semibold">Generating Image</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                This may take a few seconds, especially with many years of data.
                Please wait...
              </p>
            </div>
          </div>
        </div>
      )}
      <Card ref={shareRef}>
        <CardHeader>
          <CardTitle>
            {authStatus === "unauthenticated" && "Demo mode: "}Activity History
            For All Lift Types
          </CardTitle>
          {intervals && (
            <CardDescription>
              Your strength journey from{" "}
              {new Date(intervals[0].startDate).getFullYear()} -{" "}
              {new Date(intervals[intervals.length - 1].endDate).getFullYear()}.
              Historical PRs are highlighted.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {!intervals && <Skeleton className="h-64 w-11/12 flex-1" />}
          {intervals && (
            <>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {intervals.map((interval, index) => {
                  return (
                    <div key={`${index}-heatmap`}>
                      <div className="mb-2 text-center text-lg font-semibold">
                        {new Date(interval.startDate).getFullYear()}
                      </div>
                      <Heatmap
                        parsedData={parsedData}
                        startDate={interval.startDate}
                        endDate={interval.endDate}
                      />
                    </div>
                  );
                })}
              </div>
              {/* Footer with app branding - only visible during image capture */}
              {isSharing && (
                <div className="mt-6 flex items-center justify-center border-t pt-4">
                  <p className="text-sm text-muted-foreground">
                    Created with{" "}
                    <span className="font-semibold text-foreground">
                      Strength Journeys
                    </span>
                    {" • "}
                    <span className="text-muted-foreground">
                      strengthjourneys.xyz
                    </span>
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
        {intervals && (
          <CardFooter id="ignoreCopy">
            <div className="flex flex-1 flex-row justify-end">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      onClick={handleShare}
                      disabled={isSharing}
                    >
                      {isSharing ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <Share2 />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isSharing
                      ? "Generating image..."
                      : "Share heatmaps to clipboard"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardFooter>
        )}
      </Card>
    </>
  );
}

function Heatmap({ parsedData, startDate, endDate }) {
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
      showMonthLabels={true}
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

// generateYearRanges
//
// Generates one interval per calendar year from the first year with data
// to the last year with data. Each interval is exactly Jan 1 - Dec 31 of that year.
//
// startDateStr and endDateStr format is: "yyyy-mm-dd"
//
function generateYearRanges(startDateStr, endDateStr) {
  // Convert input date strings to Date objects
  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);

  // Get the year of the start and end dates
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();

  // Generate one range per calendar year
  const yearRanges = [];
  for (let year = startYear; year <= endYear; year++) {
    yearRanges.push({
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
    });
  }

  return yearRanges;
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
