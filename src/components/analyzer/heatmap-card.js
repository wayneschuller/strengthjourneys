"use client";

import { format } from "date-fns";
import { cloneElement, useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "next-themes";
import CalendarHeatmap from "react-calendar-heatmap";
import {
  coreLiftTypes,
  devLog,
  logTiming,
  getReadableDateString,
} from "@/lib/processing-utils";
import { LoaderCircle } from "lucide-react";
import { gaTrackShareCopy } from "@/lib/analytics";
import { ShareCopyButton } from "@/components/share-copy-button";
import { useSession } from "next-auth/react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { Skeleton } from "@/components/ui/skeleton";
import { LiftTypeIndicator } from "@/components/lift-type-indicator";
import { SessionRow } from "@/components/visualizer/visualizer-utils";

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

const MAX_LIFTS_SHOWN = 6;

export function ActivityHeatmapsCard() {
  const { parsedData, isLoading } = useUserLiftingData();
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [intervals, setIntervals] = useState(null);
  const { status: authStatus } = useSession();
  const { theme } = useTheme();
  const shareRef = useRef(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareReady, setShareReady] = useState(false);

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
    // Wait one frame so the browser paints the loading overlay before html2canvas blocks the thread
    await new Promise((r) => requestAnimationFrame(r));

    try {
      if (shareRef.current) {
        // Dynamically import html2canvas only when user clicks share
        const html2canvas = (await import("html2canvas-pro")).default;
        const canvas = await html2canvas(shareRef.current, {
          ignoreElements: (element) => element.id === "ignoreCopy",
        });

        const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        console.log("Heatmap copied to clipboard");
        gaTrackShareCopy("heatmap", { page: "/analyzer" });
      }

      logTiming("html2canvas", performance.now() - startTime);
      setShareReady(true);
    } catch (err) {
      console.error("Error in copying heatmap: ", err);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <>
      {(isSharing || shareReady) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="flex flex-col items-center gap-4 rounded-lg border bg-background p-6 shadow-lg">
            {isSharing ? (
              <>
                <LoaderCircle className="h-8 w-8 animate-spin" aria-label="Loading" role="status" />
                <div className="text-center">
                  <h3 className="text-lg font-semibold">Generating Image</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {getSharingMessage(intervals?.length || 1)}
                  </p>
                </div>
              </>
            ) : (
              <div className="text-center">
                <h3 className="text-lg font-semibold">
                  Heatmap Copied to Clipboard
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Paste it anywhere — social media, Discord, messages, or a
                  Google Doc.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Use <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-semibold">Ctrl+V</kbd> on
                  Windows/Linux
                  or <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-semibold">Cmd+V</kbd> on
                  Mac.
                </p>
                <button
                  className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  onClick={() => setShareReady(false)}
                >
                  Got it
                </button>
              </div>
            )}
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
                        isSharing={isSharing}
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
              <ShareCopyButton
                label="Copy heatmap"
                tooltip="Share heatmaps to clipboard"
                onClick={handleShare}
                isLoading={isSharing}
                disabled={isSharing}
              />
            </div>
          </CardFooter>
        )}
      </Card>
    </>
  );
}

function Heatmap({ parsedData, startDate, endDate, isSharing }) {
  const { status: authStatus } = useSession();
  const [heatmapData, setHeatmapData] = useState(null);
  const [hoveredValue, setHoveredValue] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({
    x: 0,
    y: 0,
    showBelow: false,
  });

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

  const handleMouseOver = useCallback((e, value) => {
    if (!value || !value.sessionData) return;
    const cellRect = e.target.getBoundingClientRect();
    const x = cellRect.left + cellRect.width / 2;
    const y = cellRect.top;
    const showBelow = y < 200;
    setTooltipPos({
      x: Math.max(140, Math.min(x, window.innerWidth - 140)),
      y: showBelow ? cellRect.bottom + 8 : y - 8,
      showBelow,
    });
    setHoveredValue(value);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredValue(null);
  }, []);

  if (!heatmapData || !startDate || !endDate) {
    return <Skeleton className="h-24 flex-1" />;
  }

  return (
    <div className="relative">
      <CalendarHeatmap
        startDate={startDate}
        endDate={endDate}
        values={heatmapData}
        showMonthLabels={true}
        classForValue={(value) => {
          if (!value) return `color-heatmap-0`;
          return `color-heatmap-${value.count}`;
        }}
        titleForValue={() => null}
        onMouseOver={handleMouseOver}
        onMouseLeave={handleMouseLeave}
        transformDayElement={(element, value, index) =>
          cloneElement(element, { rx: 3, ry: 3 })
        }
      />
      {hoveredValue && !isSharing && (
        <div
          className="pointer-events-none fixed z-50"
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y,
            transform: tooltipPos.showBelow
              ? "translate(-50%, 0)"
              : "translate(-50%, -100%)",
          }}
        >
          <HeatmapTooltipContent value={hoveredValue} />
        </div>
      )}
    </div>
  );
}

function HeatmapTooltipContent({ value }) {
  const { sessionData, date } = value;
  if (!sessionData) return null;

  const { totalSets, uniqueLifts, prs, liftsByType } = sessionData;
  const dateLabel = getReadableDateString(date, true);
  const liftTypes = Object.keys(liftsByType);
  const visibleLifts = liftTypes.slice(0, MAX_LIFTS_SHOWN);
  const hiddenCount = liftTypes.length - MAX_LIFTS_SHOWN;

  // Keep only the heaviest PR per lift type
  const bestPrs = Object.values(
    prs.reduce((acc, pr) => {
      if (!acc[pr.liftType] || pr.weight > acc[pr.liftType].weight) {
        acc[pr.liftType] = pr;
      }
      return acc;
    }, {}),
  );

  return (
    <div className="grid min-w-[10rem] max-w-[20rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-bold">{dateLabel}</p>
      <p className="text-muted-foreground">
        {totalSets} {totalSets === 1 ? "set" : "sets"} across {uniqueLifts}{" "}
        {uniqueLifts === 1 ? "lift" : "lifts"}
      </p>

      {bestPrs.length > 0 && (
        <div className="flex flex-col gap-1">
          {bestPrs.map((pr, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="shrink-0 rounded bg-amber-500/20 px-1 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                PR
              </span>
              <LiftTypeIndicator liftType={pr.liftType} />
              <span className="text-muted-foreground">
                {pr.reps}@{pr.weight}
                {pr.unitType}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1">
        {visibleLifts.map((liftType) => (
          <div key={liftType}>
            <LiftTypeIndicator liftType={liftType} />
            <SessionRow lifts={liftsByType[liftType]} showDate={false} />
          </div>
        ))}
        {hiddenCount > 0 && (
          <p className="text-muted-foreground">
            +{hiddenCount} more {hiddenCount === 1 ? "lift" : "lifts"}
          </p>
        )}
      </div>
    </div>
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
    startDate: format(startDate, "yyyy-MM-dd"),
    endDate: format(endDate, "yyyy-MM-dd"),
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

function getSharingMessage(years) {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  if (years <= 1)
    return pick([
      "Generating your heatmap, get ready to brag.",
      "Rendering your heatmap. Newbie gains are the best gains.",
      "Packaging your gains for maximum flex.",
      "Every PR journey starts with a single plate.",
    ]);

  if (years <= 3)
    return pick([
      `Rendering ${years} years of heatmap. This won't take long.`,
      `${years} years of heatmap. You're past the 'just trying it out' phase.`,
      `${years} years in, and still adding plates. Nice.`,
      "Dedicated. Your heatmap is about to prove it.",
      "Generating your heatmap. We see you love a good spreadsheet.",
    ]);

  if (years <= 5)
    return pick([
      `Rendering ${years} years of heatmap. This might take a moment.`,
      `${years} years of heatmap is no joke. Hang tight.`,
      "Your heatmap consistency is showing. Give us a sec.",
      `${years} years under the bar. That's a lot of chalk dust.`,
      `Building ${years} years of heatmap. Bear with us.`,
    ]);

  if (years <= 7)
    return pick([
      `${years} years of heatmap! This is going to take a minute.`,
      `Rendering ${years} years of heatmap. You've earned this wait.`,
      `${years} years! Most gym memberships don't survive ${years} months.`,
      "Veteran status confirmed. Patience, champion.",
      `${years} years of heatmap. We know you love your Google Sheets.`,
    ]);

  return pick([
    `${years} years of heatmap?! We need a moment for this legend.`,
    `Rendering ${years} years. At this point it's a historical document.`,
    `${years} years of heatmap. Your spreadsheet must be a novel by now.`,
    `${years} years! Your heatmap is older than some lifters at your gym.`,
    `${years} years under the bar. The barbell knows your name by now.`,
  ]);
}

// Volume-based heatmap level:
// Level 0: No activity (no entry)
// Level 1: Light session (1-3 sets)
// Level 2: Moderate session (4-8 sets)
// Level 3: Heavy session (9+ sets) OR non-core lift PR
// Level 4: Core lift PR (strongest visual emphasis)
function getHeatmapLevel(totalSets, hasPR, hasCoreLiftPR) {
  if (hasCoreLiftPR) return 4;
  if (totalSets >= 9 || hasPR) return 3;
  if (totalSets >= 4) return 2;
  return 1;
}

// Create heatmapData with structured session info for rich tooltips
// Single O(n) pass replaces the old O(n^2) approach
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
      if (rand < 0.75) return 1;
      if (rand < 0.88) return 2;
      if (rand < 0.96) return 3;
      return 4;
    };

    for (let currentTime = start; currentTime <= end; currentTime += oneDay) {
      const count = getRandomCount();
      demoHeatmapData.push({
        date: format(new Date(currentTime), "yyyy-MM-dd"),
        count: count,
        sessionData: null,
      });
    }

    logTiming("generateHeatmapData", performance.now() - startTime, "demo");
    return demoHeatmapData;
  }

  // Build per-day data in a single O(n) pass
  const dayMap = {};

  for (const lift of parsedData) {
    if (lift.date < startDate || lift.date > endDate) continue;
    if (lift.isGoal) continue;

    const dateStr = lift.date;
    if (!dayMap[dateStr]) {
      dayMap[dateStr] = {
        totalSets: 0,
        prs: [],
        liftsByType: {},
        hasPR: false,
        hasCoreLiftPR: false,
      };
    }

    const day = dayMap[dateStr];
    day.totalSets++;

    if (!day.liftsByType[lift.liftType]) {
      day.liftsByType[lift.liftType] = [];
    }
    day.liftsByType[lift.liftType].push({
      reps: lift.reps,
      weight: lift.weight,
      unitType: lift.unitType,
    });

    if (lift.isHistoricalPR) {
      day.hasPR = true;
      day.prs.push({
        liftType: lift.liftType,
        reps: lift.reps,
        weight: lift.weight,
        unitType: lift.unitType,
      });
      if (coreLiftTypes.includes(lift.liftType)) {
        day.hasCoreLiftPR = true;
      }
    }
  }

  const heatmapData = Object.entries(dayMap).map(([date, day]) => ({
    date,
    count: getHeatmapLevel(day.totalSets, day.hasPR, day.hasCoreLiftPR),
    sessionData: {
      totalSets: day.totalSets,
      uniqueLifts: Object.keys(day.liftsByType).length,
      prs: day.prs,
      liftsByType: day.liftsByType,
    },
  }));

  logTiming("generateHeatmapData", performance.now() - startTime, `${startDate} to ${endDate}`);

  return heatmapData;
}
