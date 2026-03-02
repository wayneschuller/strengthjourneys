
import { format } from "date-fns";
import { cloneElement, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTheme } from "next-themes";
import CalendarHeatmap from "react-calendar-heatmap";
import {
  coreLiftTypes,
  devLog,
  logTiming,
  getReadableDateString,
  getDisplayWeight,
} from "@/lib/processing-utils";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { LoaderCircle } from "lucide-react";
import { gaEvent, GA_EVENT_TAGS } from "@/lib/analytics";
import { MiniFeedbackWidget } from "@/components/feedback";
import { ShareCopyButton } from "@/components/share-copy-button";
import { useSession } from "next-auth/react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useLocalStorage } from "usehooks-ts";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
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

/**
 * Card displaying one calendar heatmap per year of the user's training history, with PR-weighted
 * color intensity. Includes a "Copy heatmap" button that renders the card to clipboard via html2canvas.
 * Reads parsedData from UserLiftingDataProvider; takes no props.
 *
 * @param {Object} props
 */
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
  // initializeWithValue: false → SSR renders "daily" (default), client hydrates from localStorage on mount
  const [viewMode, setViewMode] = useLocalStorage(
    LOCAL_STORAGE_KEYS.HEATMAP_VIEW_MODE,
    "daily",
    { initializeWithValue: false },
  );

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
        // Pass a Promise directly to ClipboardItem so navigator.clipboard.write()
        // is called while the document is still focused. The browser holds the
        // clipboard operation open while html2canvas renders — safe to switch apps.
        const blobPromise = html2canvas(shareRef.current, {
          ignoreElements: (element) => element.id === "ignoreCopy",
        }).then((canvas) => new Promise((resolve) => canvas.toBlob(resolve, "image/png")));

        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blobPromise }),
        ]);
        console.log("Heatmap copied to clipboard");
        gaEvent(GA_EVENT_TAGS.HEATMAP_SHARE_CLIPBOARD, { page: "/analyzer" });
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
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>
                {authStatus === "unauthenticated" && "Demo mode: "}Activity
                History For All Lift Types
              </CardTitle>
              {intervals && (
                <CardDescription>
                  Your strength journey from{" "}
                  {new Date(intervals[0].startDate).getFullYear()} -{" "}
                  {new Date(
                    intervals[intervals.length - 1].endDate,
                  ).getFullYear()}
                  .
                </CardDescription>
              )}
            </div>
            {!isSharing && intervals?.length > 2 && (
              <div className="flex shrink-0 rounded-md border p-0.5 text-xs">
                {[
                  { key: "daily", label: "Daily" },
                  { key: "weekly", label: "Weekly" },
                  ...(intervals?.length >= 5
                    ? [{ key: "monthly", label: "Monthly" }]
                    : []),
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    className={`rounded px-2 py-0.5 font-medium transition-colors ${
                      viewMode === key
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setViewMode(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!intervals && <Skeleton className="h-64 w-11/12 flex-1" />}
          {intervals && (
            <>
              {viewMode === "daily" && (
                <div className="grid grid-cols-1 gap-6">
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
              )}
              {viewMode === "weekly" && (
                <WeeklyHeatmapMatrix
                  parsedData={parsedData}
                  startYear={new Date(intervals[0].startDate).getFullYear()}
                  endYear={new Date(
                    intervals[intervals.length - 1].endDate,
                  ).getFullYear()}
                  isSharing={isSharing}
                />
              )}
              {viewMode === "monthly" && (
                <MonthlyHeatmapMatrix
                  parsedData={parsedData}
                  startYear={new Date(intervals[0].startDate).getFullYear()}
                  endYear={new Date(
                    intervals[intervals.length - 1].endDate,
                  ).getFullYear()}
                  isSharing={isSharing}
                />
              )}
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
            <div className="flex w-full items-center justify-between gap-3">
              <MiniFeedbackWidget
                contextId="heatmap_card"
                page="/analyzer"
                analyticsExtra={{ context: "activity_heatmaps_card" }}
              />
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

// Single-year calendar heatmap with a custom tooltip showing PR details and lift breakdown per day.
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

// Tooltip popup showing date, total sets, PR badges, and per-lift set breakdowns for a heatmap cell.
function HeatmapTooltipContent({ value }) {
  const { sessionData, date } = value;
  const { isMetric } = useAthleteBio();
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
                {pr.reps}@{getDisplayWeight(pr, isMetric).value}
                {getDisplayWeight(pr, isMetric).unit}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1">
        {visibleLifts.map((liftType) => (
          <div key={liftType}>
            <LiftTypeIndicator liftType={liftType} />
            <SessionRow lifts={liftsByType[liftType]} showDate={false} isMetric={isMetric} />
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

// Shared matrix layout constants (used by both weekly and monthly views)
const WEEKLY_GAP = 2; // px gap between cells
const WEEKLY_YEAR_W = 48; // px for year label column

const WEEKLY_MONTH_LABELS = [
  { label: "Jan", week: 1 },
  { label: "Feb", week: 5 },
  { label: "Mar", week: 9 },
  { label: "Apr", week: 14 },
  { label: "May", week: 18 },
  { label: "Jun", week: 22 },
  { label: "Jul", week: 27 },
  { label: "Aug", week: 31 },
  { label: "Sep", week: 35 },
  { label: "Oct", week: 40 },
  { label: "Nov", week: 44 },
  { label: "Dec", week: 48 },
];

// Returns which calendar week of the year (1–53) a date string falls in.
// Week 1 = Jan 1–7, week 2 = Jan 8–14, etc. No ISO week ambiguity.
function getCalendarWeekOfYear(dateStr) {
  const date = new Date(dateStr + "T00:00:00");
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((date - startOfYear) / 86400000) + 1;
  return Math.ceil(dayOfYear / 7);
}

// Returns "MMM d" for the first day of the given (year, weekNum) pair.
function getWeekStartDate(year, weekNum) {
  const jan1 = new Date(year, 0, 1);
  const weekStart = new Date(jan1.getTime() + (weekNum - 1) * 7 * 86400000);
  return format(weekStart, "MMM d");
}

// Builds { [year]: { [weekNum]: { sessions, count } } }.
// count is capped at 3: 0=none, 1=1 day, 2=2 days, 3=3+ days (won).
function generateWeeklyHeatmapData(parsedData, startYear, endYear, isDemoMode) {
  if (isDemoMode) {
    const result = {};
    for (let year = startYear; year <= endYear; year++) {
      result[year] = {};
      for (let week = 1; week <= 53; week++) {
        const rand = Math.random();
        const count = rand < 0.25 ? 0 : rand < 0.42 ? 1 : rand < 0.60 ? 2 : 3;
        result[year][week] = { sessions: count, count };
      }
    }
    return result;
  }

  const weekMap = {};
  for (const lift of parsedData) {
    if (lift.isGoal) continue;
    const year = parseInt(lift.date.substring(0, 4));
    if (year < startYear || year > endYear) continue;
    const weekNum = getCalendarWeekOfYear(lift.date);
    if (!weekMap[year]) weekMap[year] = {};
    if (!weekMap[year][weekNum]) weekMap[year][weekNum] = { sessionDays: new Set() };
    weekMap[year][weekNum].sessionDays.add(lift.date);
  }

  const result = {};
  for (const [yearStr, weeks] of Object.entries(weekMap)) {
    result[yearStr] = {};
    for (const [weekStr, week] of Object.entries(weeks)) {
      const sessions = week.sessionDays.size;
      result[yearStr][weekStr] = { sessions, count: Math.min(sessions, 3) };
    }
  }
  return result;
}

// All-years matrix: one row per year, one cell per week (1–53).
// Cells fill the full available card width via CSS grid.
// Color is applied via inline style using --heatmap-N CSS variables so themes work.
function WeeklyHeatmapMatrix({ parsedData, startYear, endYear, isSharing }) {
  const { status: authStatus } = useSession();
  const isDemoMode = authStatus === "unauthenticated";
  const [hoveredValue, setHoveredValue] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0, showBelow: false });

  const weeklyData = useMemo(
    () => generateWeeklyHeatmapData(parsedData, startYear, endYear, isDemoMode),
    [parsedData, startYear, endYear, isDemoMode],
  );

  const years = [];
  for (let y = startYear; y <= endYear; y++) years.push(y);

  // Used to distinguish future weeks (no data yet) from past missed weeks
  const todayDate = new Date();
  const currentYear = todayDate.getFullYear();
  const currentWeekNum = getCalendarWeekOfYear(format(todayDate, "yyyy-MM-dd"));

  const handleMouseOver = useCallback((e, year, weekNum, data) => {
    const cellRect = e.target.getBoundingClientRect();
    const x = cellRect.left + cellRect.width / 2;
    const y = cellRect.top;
    const showBelow = y < 200;
    setTooltipPos({
      x: Math.max(100, Math.min(x, window.innerWidth - 100)),
      y: showBelow ? cellRect.bottom + 8 : y - 8,
      showBelow,
    });
    setHoveredValue({ year, weekNum, ...data });
  }, []);

  const handleMouseLeave = useCallback(() => setHoveredValue(null), []);

  // 53-column grid that fills available width; gap between cells
  const cellGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(53, 1fr)",
    gap: WEEKLY_GAP,
    flex: 1,
  };

  return (
    <div className="relative w-full">
      {/* Month label header — same 53-col grid so columns align with cells */}
      <div className="mb-1 flex w-full items-end">
        <div className="shrink-0" style={{ width: WEEKLY_YEAR_W }} />
        <div style={cellGridStyle}>
          {WEEKLY_MONTH_LABELS.map(({ label, week }) => (
            <span
              key={label}
              className="overflow-visible whitespace-nowrap text-[9px] text-muted-foreground lg:text-[11px] 2xl:text-xs"
              style={{ gridColumn: week }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Year rows */}
      <div className="flex w-full flex-col gap-[2px]">
        {years.map((year) => (
          <div key={year} className="flex w-full items-center">
            <div
              className="shrink-0 pr-2 text-right text-xs text-muted-foreground lg:text-sm"
              style={{ width: WEEKLY_YEAR_W }}
            >
              {year}
            </div>
            <div style={cellGridStyle}>
              {Array.from({ length: 53 }, (_, i) => i + 1).map((weekNum) => {
                const isFuture =
                  year > currentYear ||
                  (year === currentYear && weekNum > currentWeekNum);
                const data = weeklyData[year]?.[weekNum];
                const count = data?.count ?? 0;
                // Future weeks: invisible. Past empty: faint. Training: colored.
                // 3+ sessions uses --heatmap-4 (darkest) for distinct visual weight.
                const cellStyle = isFuture
                  ? { aspectRatio: "1" }
                  : count === 0
                    ? {
                        aspectRatio: "1",
                        backgroundColor: "var(--heatmap-0)",
                        opacity: 0.3,
                      }
                    : {
                        aspectRatio: "1",
                        backgroundColor: `var(--heatmap-${count === 3 ? 4 : count})`,
                      };
                return (
                  <div
                    key={weekNum}
                    className="rounded-sm"
                    style={cellStyle}
                    onMouseOver={
                      data && !isFuture
                        ? (e) => handleMouseOver(e, year, weekNum, data)
                        : undefined
                    }
                    onMouseLeave={
                      data && !isFuture ? handleMouseLeave : undefined
                    }
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-4 text-[10px] text-muted-foreground">
        <span>Sessions per week:</span>
        {[
          { count: 1, label: "1" },
          { count: 2, label: "2" },
          { count: 3, label: "3+" },
        ].map(({ count, label }) => (
          <div key={count} className="flex items-center gap-1">
            <div
              className="shrink-0 rounded-sm"
              style={{
                width: 12,
                height: 12,
                backgroundColor: `var(--heatmap-${count === 3 ? 4 : count})`,
              }}
            />
            <span>{label}</span>
          </div>
        ))}
      </div>

      {/* Tooltip */}
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
          <WeeklyTooltipContent value={hoveredValue} />
        </div>
      )}
    </div>
  );
}

function WeeklyTooltipContent({ value }) {
  const { year, weekNum, sessions } = value;
  return (
    <div className="grid min-w-[8rem] max-w-[16rem] items-start gap-1 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-bold">
        Week of {getWeekStartDate(year, weekNum)}, {year}
      </p>
      <p className="text-muted-foreground">
        {sessions === 0
          ? "No training sessions"
          : `${sessions} training ${sessions === 1 ? "day" : "days"}`}
      </p>
    </div>
  );
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Builds { [year]: { [month 1-12]: { activeWeeks, count 0-4, weekBreakdown } } }.
// count = distinct calendar weeks with at least one session, capped at 4.
// weekBreakdown = [{ sessions }] sorted by week order within the month, for tooltips.
function generateMonthlyHeatmapData(parsedData, startYear, endYear, isDemoMode) {
  if (isDemoMode) {
    const result = {};
    for (let year = startYear; year <= endYear; year++) {
      result[year] = {};
      for (let month = 1; month <= 12; month++) {
        const rand = Math.random();
        const count =
          rand < 0.12 ? 0 : rand < 0.28 ? 1 : rand < 0.50 ? 2 : rand < 0.75 ? 3 : 4;
        const weekBreakdown = Array.from({ length: count }, () => ({
          sessions: Math.floor(Math.random() * 4) + 1,
        }));
        result[year][month] = { activeWeeks: count, count, weekBreakdown };
      }
    }
    return result;
  }

  // Per week within each month, collect unique training days (dates)
  const monthMap = {};
  for (const lift of parsedData) {
    if (lift.isGoal) continue;
    const year = parseInt(lift.date.substring(0, 4));
    if (year < startYear || year > endYear) continue;
    const month = parseInt(lift.date.substring(5, 7));
    const weekNum = getCalendarWeekOfYear(lift.date);
    if (!monthMap[year]) monthMap[year] = {};
    if (!monthMap[year][month]) monthMap[year][month] = {};
    if (!monthMap[year][month][weekNum]) monthMap[year][month][weekNum] = new Set();
    monthMap[year][month][weekNum].add(lift.date);
  }

  const result = {};
  for (const [yearStr, months] of Object.entries(monthMap)) {
    result[yearStr] = {};
    for (const [monthStr, weekData] of Object.entries(months)) {
      // Sort by week number so tooltip rows are chronological
      const weekBreakdown = Object.entries(weekData)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .map(([, days]) => ({ sessions: days.size }));
      const activeWeeks = weekBreakdown.length;
      result[yearStr][monthStr] = {
        activeWeeks,
        count: Math.min(activeWeeks, 4),
        weekBreakdown,
      };
    }
  }
  return result;
}

// All-years monthly matrix: one row per year, one cell per month (1–12).
// Color = active weeks that month: 0 blank, 1 light, 2 medium, 3 strong, 4 full.
function MonthlyHeatmapMatrix({ parsedData, startYear, endYear, isSharing }) {
  const { status: authStatus } = useSession();
  const isDemoMode = authStatus === "unauthenticated";
  const [hoveredValue, setHoveredValue] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0, showBelow: false });

  const monthlyData = useMemo(
    () => generateMonthlyHeatmapData(parsedData, startYear, endYear, isDemoMode),
    [parsedData, startYear, endYear, isDemoMode],
  );

  const years = [];
  for (let y = startYear; y <= endYear; y++) years.push(y);

  const todayDate = new Date();
  const currentYear = todayDate.getFullYear();
  const currentMonth = todayDate.getMonth() + 1;

  const handleMouseOver = useCallback((e, year, month, data) => {
    const cellRect = e.target.getBoundingClientRect();
    const x = cellRect.left + cellRect.width / 2;
    const y = cellRect.top;
    const showBelow = y < 200;
    setTooltipPos({
      x: Math.max(100, Math.min(x, window.innerWidth - 100)),
      y: showBelow ? cellRect.bottom + 8 : y - 8,
      showBelow,
    });
    setHoveredValue({ year, month, ...(data ?? {}) });
  }, []);

  const handleMouseLeave = useCallback(() => setHoveredValue(null), []);

  const cellGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(12, 1fr)",
    gap: WEEKLY_GAP,
    flex: 1,
  };

  return (
    <div className="relative w-full">
      {/* Month name header */}
      <div className="mb-1 flex w-full items-end">
        <div className="shrink-0" style={{ width: WEEKLY_YEAR_W }} />
        <div style={cellGridStyle}>
          {MONTH_NAMES.map((name) => (
            <span
              key={name}
              className="text-center text-[9px] text-muted-foreground lg:text-[11px] 2xl:text-xs"
            >
              {name}
            </span>
          ))}
        </div>
      </div>

      {/* Year rows */}
      <div className="flex w-full flex-col gap-[2px]">
        {years.map((year) => (
          <div key={year} className="flex w-full items-center">
            <div
              className="shrink-0 pr-2 text-right text-xs text-muted-foreground lg:text-sm"
              style={{ width: WEEKLY_YEAR_W }}
            >
              {year}
            </div>
            <div style={cellGridStyle}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                const isFuture =
                  year > currentYear ||
                  (year === currentYear && month > currentMonth);
                const data = monthlyData[year]?.[month];
                const count = data?.count ?? 0;
                const cellStyle = isFuture
                  ? { height: 28 }
                  : count === 0
                    ? { height: 28, backgroundColor: "var(--heatmap-0)", opacity: 0.3 }
                    : { height: 28, backgroundColor: `var(--heatmap-${count})` };
                return (
                  <div
                    key={month}
                    className="rounded"
                    style={cellStyle}
                    onMouseOver={
                      !isFuture
                        ? (e) => handleMouseOver(e, year, month, data)
                        : undefined
                    }
                    onMouseLeave={!isFuture ? handleMouseLeave : undefined}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-4 text-[10px] text-muted-foreground">
        <span>Active weeks per month:</span>
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="flex items-center gap-1">
            <div
              className="shrink-0 rounded"
              style={{ width: 12, height: 12, backgroundColor: `var(--heatmap-${n})` }}
            />
            <span>{n === 4 ? "4+" : n}</span>
          </div>
        ))}
      </div>

      {/* Tooltip */}
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
          <MonthlyTooltipContent value={hoveredValue} />
        </div>
      )}
    </div>
  );
}

function weekEmoji(sessions) {
  if (sessions >= 3) return "🏆";
  if (sessions === 2) return "💪";
  if (sessions === 1) return "✅";
  return "💩";
}

function MonthlyTooltipContent({ value }) {
  const { year, month, weekBreakdown } = value;
  return (
    <div className="grid min-w-[10rem] max-w-[18rem] items-start gap-1 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-bold">
        {MONTH_NAMES[month - 1]} {year}
      </p>
      {weekBreakdown?.length > 0 ? (
        <div className="flex flex-col gap-0.5">
          {weekBreakdown.map(({ sessions }, i) => (
            <p key={i} className="text-muted-foreground">
              <span className="font-semibold text-foreground">Week {i + 1}:</span>{" "}
              {sessions} {sessions === 1 ? "session" : "sessions"}{" "}
              {weekEmoji(sessions)}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">No training sessions 💩</p>
      )}
    </div>
  );
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

  return heatmapData;
}
