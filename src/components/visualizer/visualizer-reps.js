
// -------------------------------
/**
 * visualizer-reps.js
 *
 * ShadCN-style card component with a chart that visualises Singles, Triples, and Fives
 * for a given lift.  It expects the already-parsed `data` array you use
 * elsewhere in Strength Journeys:
 *
 *   {
 *     date: "2025-07-11",
 *     liftType: "Back Squat",
 *     reps: 5,
 *     weight: 112.5,
 *     unitType: "lb",
 *   }
 *
 * Assumptions
 * ───────────
 * • parsedData is chronologically ordered oldest→newest.
 * • You only need the heaviest set per calendar day for each rep range.
 */

import { useMemo, useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { devLog } from "@/lib/processing-utils";
import { useLocalStorage, useWindowSize } from "usehooks-ts";

import {
  TimeRangeSelect,
  calculateThresholdDate,
  getTimeRangeDescription,
} from "./time-range-select";

import {
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Area,
  Legend,
  ReferenceLine,
} from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { useSession } from "next-auth/react";
// import { brightenHexColor, saturateHexColor } from "@/lib/get-lift-color";
import { useLiftColors } from "@/hooks/use-lift-colors";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { getDisplayWeight } from "@/lib/processing-utils";
import { getYearLabels } from "./visualizer-processing";
import { ChartContainer } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { VisualizerRepsTooltip } from "./visualizer-utils";
import { Badge } from "@/components/ui/badge";

const repTabs = [
  { label: "Singles", reps: 1 },
  { label: "Triples", reps: 3 },
  { label: "Fives", reps: 5 },
];

/**
 * Chart showing weight progression over time for 1RM, 3RM, and 5RM. Used on lift pages.
 *
 * @param {Object} props
 * @param {Array} [props.data] - Pre-computed chart data. When omitted, derives from useUserLiftingData.
 * @param {string} [props.liftType] - Display name of the lift to chart (e.g. "Bench Press").
 */
export function VisualizerReps({ data, liftType }) {
  const { parsedData, isLoading } = useUserLiftingData();
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);
  const { status: authStatus } = useSession();
  const { getColor } = useLiftColors();
  const liftColor = getColor(liftType);
  const { isMetric } = useAthleteBio();

  const [timeRange, setTimeRange] = useLocalStorage(
    LOCAL_STORAGE_KEYS.TIME_RANGE,
    "MAX", // MAX, 3M, 6M, 1Y, 2Y, 5Y etc.
    {
      initializeWithValue: false,
    },
  );

  // Used to hide the y-axis and other UI elements on smaller screens
  const { width } = useWindowSize({ initializeWithValue: false });

  // Add state for toggling line visibility
  const [visible, setVisible] = useState({ 1: true, 3: true, 5: true });
  const handleLegendClick = (reps) => {
    setVisible((prev) => ({ ...prev, [reps]: !prev[reps] }));
  };

  // Compute daily bests for each rep range
  const chartDataByReps = useMemo(() => {
    if (!parsedData) {
      // Return empty arrays for each rep if data is not loaded
      const empty = {};
      repTabs.forEach((t) => {
        empty[t.reps] = [];
      });
      return empty;
    }
    const result = {};
    repTabs.forEach((t) => {
      result[t.reps] = getDailyBest(
        parsedData,
        liftType,
        t.reps,
        timeRange,
        setTimeRange,
      );
    });
    return result;
  }, [parsedData, liftType, timeRange, setTimeRange]);

  // Merge all dates for X axis
  const allDates = Array.from(
    new Set(
      repTabs.flatMap((t) => chartDataByReps[t.reps].map((d) => d.date)).sort(),
    ),
  );

  // Build chart data: one object per date, with weight for each rep range.
  // null when parsedData not yet loaded (matches the mini pattern for gating ChartContainer).
  const chartData = !parsedData ? null : allDates.map((date) => {
    const entry = { date };
    repTabs.forEach((t) => {
      const found = chartDataByReps[t.reps].find((d) => d.date === date);
      // Convert to display unit so y-axis and tooltip show the user's preferred unit
      entry[`reps${t.reps}`] = found ? getDisplayWeight(found, isMetric).value : null;
      entry[`reps${t.reps}_tuple`] = found || null; // Store the full tuple (raw) for tooltip
    });
    // Add rechartsDate field for consistency with visualizer-processing.js
    entry.rechartsDate = Date.UTC(
      new Date(date).getFullYear(),
      new Date(date).getMonth(),
      new Date(date).getDate(),
    );
    return entry;
  });

  // devLog(chartData);

  const yearLabels = getYearLabels(chartData);

  // Chart config for ChartContainer (for theming/colors)
  const chartConfig = repTabs.reduce((acc, t) => {
    acc[t.label] = { label: t.label, color: liftColor };
    return acc;
  }, {});

  // Custom legend renderer
  function CustomLegend() {
    // Helper to get dash pattern
    const getDash = (reps) =>
      reps === 1 ? "0" : reps === 3 ? "6 4" : reps === 5 ? "2 4" : "0";
    return (
      <div className="flex items-center justify-center gap-4 pt-3">
        {repTabs.map((t) => {
          const repColor = getRepColor(t.reps, liftColor);
          return (
            <button
              key={t.reps}
              type="button"
              onClick={() => handleLegendClick(t.reps)}
              className={`flex items-center gap-1.5 transition-opacity focus:outline-none ${visible[t.reps] ? "opacity-100" : "opacity-50"}`}
              style={{ cursor: "pointer" }}
              aria-pressed={visible[t.reps] ? "true" : "false"}
              tabIndex={0}
            >
              <svg
                width="28"
                height="8"
                viewBox="0 0 28 8"
                className="inline-block align-middle"
              >
                <line
                  x1="2"
                  y1="4"
                  x2="26"
                  y2="4"
                  stroke={repColor}
                  strokeWidth="3"
                  strokeDasharray={getDash(t.reps)}
                  strokeLinecap="round"
                />
              </svg>
              <span style={{ color: repColor }}>{t.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // Always render a single Card, with conditional CardContent
  return (
    <Card>
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <CardTitle className="flex items-center gap-2">
          {authStatus === "unauthenticated" && "Demo Mode: "}
          {liftType} Singles, Triples and Fives
          <Badge
            variant="outline"
            className="ml-2 bg-green-100 text-xs text-green-800"
          >
            New!
          </Badge>
        </CardTitle>
        <TimeRangeSelect timeRange={timeRange} setTimeRange={setTimeRange} />
      </CardHeader>
      <CardContent className="pl-0 pr-2">
        {isLoading || !parsedData || !isMounted || !chartData ? (
          <div className="flex h-[300px] w-full items-center justify-center">
            <Skeleton className="h-full w-full" />
          </div>
        ) : !allDates.length ? (
          <p className="text-muted-foreground">No data for {liftType}.</p>
        ) : (
          <ChartContainer config={chartConfig} className="h-[400px] !aspect-auto">
              <AreaChart data={chartData} margin={{ left: 5, right: 20 }}>
                <defs>
                  {repTabs.map((t) => {
                    const repColor = getRepColor(t.reps, liftColor);
                    return (
                      <linearGradient
                        key={`fill-reps${t.reps}`}
                        id={`fill-reps${t.reps}`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor={repColor}
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="50%"
                          stopColor={repColor}
                          stopOpacity={0.05}
                        />
                      </linearGradient>
                    );
                  })}
                </defs>
                {/* <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.08} /> */}
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="rechartsDate"
                  type="number"
                  scale="time"
                  domain={[
                    (dataMin) =>
                      new Date(dataMin).setDate(
                        new Date(dataMin).getDate() - 2,
                      ),
                    (dataMax) =>
                      new Date(dataMax).setDate(
                        new Date(dataMax).getDate() + 2,
                      ),
                  ]}
                  tickFormatter={formatXAxisDateString}
                />
                <YAxis
                  domain={["auto", "auto"]}
                  hide={width < 1280}
                  axisLine={false}
                  tickFormatter={(value) => `${value}${isMetric ? "kg" : "lb"}`}
                  // width={60}
                  // tick={{ fill: "#d1d5db", fontSize: 12 }}
                />
                <Tooltip
                  content={<VisualizerRepsTooltip isMetric={isMetric} />}
                  position={{ y: 10 }}
                  cursor={{
                    stroke: "#8884d8",
                    strokeWidth: 2,
                    strokeDasharray: "5 5",
                  }} // Recharts tooltip cursor is the vertical reference line that follows the mouse
                />
                <Legend content={<CustomLegend />} />
                {repTabs.map((t) => {
                  const repColor = getRepColor(t.reps, liftColor);
                  return visible[t.reps] ? (
                    <Area
                      key={t.reps}
                      type="monotone"
                      dataKey={`reps${t.reps}`}
                      name={`reps${t.reps}`}
                      stroke={repColor}
                      strokeWidth={2}
                      strokeDasharray={
                        t.reps === 1
                          ? "0"
                          : t.reps === 3
                            ? "6 4"
                            : t.reps === 5
                              ? "2 4"
                              : "0"
                      }
                      fill={`url(#fill-reps${t.reps})`}
                      fillOpacity={0.4}
                      dot={false}
                      connectNulls
                    />
                  ) : null;
                })}
                {/* Year labels to show year start */}
                {yearLabels.map(({ date, label }) => (
                  <ReferenceLine
                    key={`label-${date}`}
                    x={date} // Position label at January 1 of each year
                    stroke="none" // No visible line
                    label={{
                      value: label,
                      position: "insideBottom",
                      fontSize: 14,
                      fill: "#666",
                    }}
                  />
                ))}
              </AreaChart>
            </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

// FIXME: This code could be shared with VisualizerMini
const formatXAxisDateString = (tickItem) => {
  const date = new Date(tickItem);
  return date.toLocaleString("en-US", { month: "short", day: "numeric" });
};

// ────────────────────────────────────────────────────────────
// util: collapse many sets on the same day → single best set
// ────────────────────────────────────────────────────────────
const getDailyBest = (data, liftType, repsWanted, timeRange, setTimeRange) => {
  const bestByDate = Object.create(null); // bare object map

  const rangeFirstDate = calculateThresholdDate(timeRange, setTimeRange);

  data.forEach((s) => {
    if (s.liftType !== liftType || s.reps !== repsWanted) return;

    if (s.date < rangeFirstDate) return; // Skip if date out of range of chart
    if (s.isGoal) return; // FIXME: implement goal dashed lines at some point
    // → YYYY-MM-DD (guaranteed stable)
    const dateKey = s.date;

    // keep the heaviest weight for that day
    if (!bestByDate[dateKey] || s.weight > bestByDate[dateKey].weight) {
      // Store the full tuple for future flexibility
      bestByDate[dateKey] = { ...s, date: dateKey };
    }
  });

  // because incoming data is already chronological, Object.values()
  // preserves order → no extra sort needed
  return Object.values(bestByDate);
};

function getRepColor(reps, liftColor) {
  if (reps === 1) return liftColor;
  // if (reps === 3) return brightenHexColor(liftColor, 1.25);
  // if (reps === 5) return saturateHexColor(liftColor, 1.3);
  return liftColor;
}
