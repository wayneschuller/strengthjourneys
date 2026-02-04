"use client";

import { useMemo } from "react";
import { useLiftColors } from "@/hooks/use-lift-colors";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useLocalStorage, useWindowSize } from "usehooks-ts";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { devLog, getReadableDateString } from "@/lib/processing-utils";
import { parseISO, startOfWeek, startOfMonth, format } from "date-fns";
import { LiftTypeIndicator } from "@/components/lift-type-indicator";
import { SessionRow } from "./visualizer-utils";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ReferenceLine, Line, ResponsiveContainer } from "recharts";
import {
  TimeRangeSelect,
  calculateThresholdDate,
  getTimeRangeDescription,
} from "./time-range-select";

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
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";

import {
  CartesianGrid,
  Area,
  AreaChart,
  LabelList,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

import { getYearLabels } from "./visualizer-processing";

export function TonnageChart({ setHighlightDate, liftType }) {
  const { parsedData } = useUserLiftingData();
  const { getColor } = useLiftColors();
  const liftColor = liftType ? getColor(liftType) : null;
  const [timeRange, setTimeRange] = useLocalStorage(LOCAL_STORAGE_KEYS.TIME_RANGE, "MAX", {
    initializeWithValue: false,
  });
  const [showLabelValues, setShowLabelValues] = useLocalStorage(
    LOCAL_STORAGE_KEYS.SHOW_LABEL_VALUES,
    false,
    { initializeWithValue: false },
  );
  const [aggregationType, setAggregationType] = useLocalStorage(
    LOCAL_STORAGE_KEYS.TONNAGE_AGGREGATION_TYPE,
    "perSession",
    { initializeWithValue: false },
  );

  // Used to hide the y-axis and other UI elements on smaller screens
  const { width } = useWindowSize({ initializeWithValue: false });

  const rangeFirstDate = calculateThresholdDate(timeRange, setTimeRange);

  const chartData = useMemo(() => {
    if (!parsedData || parsedData.length === 0) return [];
    return processTonnageData(
      parsedData,
      rangeFirstDate,
      timeRange,
      liftType,
      aggregationType,
    );
  }, [parsedData, rangeFirstDate, liftType, aggregationType]);

  // Calculate Y-axis values with nice round numbers
  const yAxisConfig = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return {
        roundedMax: 1000,
        tickInterval: 200,
        ticks: [0, 200, 400, 600, 800, 1000],
      };
    }

    const maxTonnage = Math.max(...chartData.map((d) => d.tonnage));
    // Calculate nice number - the rounding algorithm naturally provides headroom by rounding up
    const { roundedMax, tickInterval } = calculateNiceYAxis(maxTonnage);

    // Generate tick values
    const ticks = [];
    for (let tick = 0; tick <= roundedMax; tick += tickInterval) {
      ticks.push(tick);
    }

    return { roundedMax, tickInterval, ticks };
  }, [chartData]);

  if (!parsedData) return null; // <-- gracefully handle null loading state

  // devLog(chartData);

  // devLog(timeRange);

  const unitType = parsedData?.[0]?.unitType ?? "";

  const handleMouseMove = (event) => {
    if (event && event.activePayload && setHighlightDate) {
      setHighlightDate(event.activePayload[0]?.payload?.date);
    }
  };

  const formatXAxisDate = (tickItem) => {
    const date = new Date(tickItem);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Define a valid chartConfig for shadcnui
  // Use lift color when liftType is provided, otherwise use default theme color
  const chartConfig = {
    tonnage: {
      label: liftType ? `${liftType} Tonnage` : "Tonnage",
      color: liftColor || "hsl(var(--chart-2))", // uses theme's chart color or lift-specific color
    },
  };

  const yearLabels = getYearLabels(chartData);

  return (
    <Card>
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1 text-pretty">
          <CardTitle>
            {liftType ? `${liftType} Tonnage` : "Total Tonnage"}
          </CardTitle>
          <CardDescription>
            {getTimeRangeDescription(rangeFirstDate, parsedData)}
          </CardDescription>
        </div>
        <div className="grid grid-cols-1 space-x-1">
          <TimeRangeSelect timeRange={timeRange} setTimeRange={setTimeRange} />
        </div>
      </CardHeader>

      <CardContent className="pl-0 pr-2">
        {liftType ? (
          <ResponsiveContainer width="100%" height={400} className="">
            <ChartContainer config={chartConfig} className="">
              <AreaChart
                data={chartData}
                margin={{ left: 5, right: 20 }}
                onMouseMove={handleMouseMove}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="rechartsDate"
                  type="number"
                  scale="time"
                  domain={[
                    (dataMin) => dataMin - 2 * 24 * 60 * 60 * 1000,
                    (dataMax) => dataMax + 2 * 24 * 60 * 60 * 1000,
                  ]}
                  tickFormatter={formatXAxisDate}
                />
                <YAxis
                  tickFormatter={(value) => `${value}${unitType}`}
                  domain={[0, yAxisConfig.roundedMax]}
                  ticks={yAxisConfig.ticks}
                  hide={width < 1280}
                />

                <Tooltip
                  content={(props) => (
                    <TonnageTooltipContent
                      {...props}
                      liftType={liftType}
                      aggregationType={aggregationType}
                      parsedData={parsedData}
                      liftColor={liftColor}
                    />
                  )}
                />

                <defs>
                  <linearGradient
                    id={`fill`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                    key={liftType}
                  >
                    <stop offset="5%" stopColor={liftColor} stopOpacity={0.8} />
                    <stop
                      offset="50%"
                      stopColor={liftColor}
                      stopOpacity={0.05}
                    />
                  </linearGradient>
                </defs>
                <Area
                  key={liftType}
                  type="monotone"
                  dataKey="tonnage"
                  stroke={liftColor}
                  name={liftType}
                  strokeWidth={2}
                  fill={`url(#fill)`}
                  fillOpacity={0.4}
                  dot={["3M", "6M"].includes(timeRange)} // Show point dots in short time ranges
                  connectNulls
                >
                  {showLabelValues && (
                    <LabelList
                      position="top"
                      offset={12}
                      content={({ x, y, value }) => (
                        <text
                          x={x}
                          y={y}
                          dy={-10}
                          fontSize={12}
                          textAnchor="middle"
                          className="fill-foreground"
                        >
                          {`${Math.round(value)}${unitType}`}
                        </text>
                      )}
                    />
                  )}
                </Area>

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
          </ResponsiveContainer>
        ) : (
          <ChartContainer config={chartConfig}>
            <AreaChart
              data={chartData}
              margin={{ left: 5, right: 20 }}
              onMouseMove={handleMouseMove}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="rechartsDate"
                type="number"
                scale="time"
                domain={[
                  (dataMin) => dataMin - 2 * 24 * 60 * 60 * 1000,
                  (dataMax) => dataMax + 2 * 24 * 60 * 60 * 1000,
                ]}
                tickFormatter={formatXAxisDate}
              />
              <YAxis
                tickFormatter={(value) => `${value}${unitType}`}
                domain={[0, yAxisConfig.roundedMax]}
                ticks={yAxisConfig.ticks}
                hide={width < 1280}
              />

              <Tooltip
                content={(props) => (
                  <TonnageTooltipContent
                    {...props}
                    liftType={liftType}
                    aggregationType={aggregationType}
                    parsedData={parsedData}
                    liftColor={liftColor}
                  />
                )}
              />

              <defs>
                <linearGradient id="fillTonnage" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="hsl(var(--chart-2))"
                    stopOpacity={0.9}
                  />
                  <stop
                    offset="50%"
                    stopColor="hsl(var(--chart-2))"
                    stopOpacity={0.09}
                  />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="tonnage"
                stroke="hsl(var(--chart-1))"
                fill="url(#fillTonnage)"
                dot={["3M", "6M"].includes(timeRange)} // Show point dots in short time ranges
                connectNulls
              >
                {showLabelValues && (
                  <LabelList
                    position="top"
                    offset={12}
                    content={({ x, y, value }) => (
                      <text
                        x={x}
                        y={y}
                        dy={-10}
                        fontSize={12}
                        textAnchor="middle"
                        className="fill-foreground"
                      >
                        {`${Math.round(value)}${unitType}`}
                      </text>
                    )}
                  />
                )}
              </Area>

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

      <CardFooter>
        <div className="flex w-full flex-col items-center justify-between gap-2 md:flex-row">
          <div className="flex items-center space-x-2">
            <Label className="font-light" htmlFor="show-values">
              Show Values
            </Label>
            <Switch
              id="show-values"
              value={showLabelValues}
              checked={showLabelValues}
              onCheckedChange={(show) => setShowLabelValues(show)}
            />
          </div>
          <ToggleGroup
            type="single"
            value={aggregationType}
            onValueChange={(value) => {
              if (value) setAggregationType(value);
            }}
            variant="outline"
          >
            <ToggleGroupItem value="perSession" aria-label="Per Session">
              Per Session
            </ToggleGroupItem>
            <ToggleGroupItem value="perWeek" aria-label="Per Week">
              Per Week
            </ToggleGroupItem>
            <ToggleGroupItem value="perMonth" aria-label="Per Month">
              Per Month
            </ToggleGroupItem>
          </ToggleGroup>
          <div></div>
        </div>
      </CardFooter>
    </Card>
  );
}

/**
 * Calculates nice round numbers for Y-axis ticks
 * Returns an object with roundedMax and tickInterval
 * Uses a scale based on powers of 10 with multipliers (1, 2, 5, 10, 20, 50, etc.)
 */
function calculateNiceYAxis(maxValue) {
  if (maxValue <= 0) {
    return { roundedMax: 1000, tickInterval: 200 };
  }

  // Calculate the order of magnitude
  const magnitude = Math.floor(Math.log10(maxValue));
  const normalized = maxValue / Math.pow(10, magnitude);

  // Nice number multipliers: 1, 2, 5, 10, 20, 50, 100, etc.
  const niceMultipliers = [1, 2, 5, 10, 20, 50];
  let niceMultiplier = 1;

  // Find the smallest nice multiplier that's greater than normalized
  for (const multiplier of niceMultipliers) {
    if (multiplier >= normalized) {
      niceMultiplier = multiplier;
      break;
    }
  }

  // If normalized is larger than all multipliers, use 100
  if (normalized > niceMultipliers[niceMultipliers.length - 1]) {
    niceMultiplier = 100;
  }

  const roundedMax = niceMultiplier * Math.pow(10, magnitude);

  // Calculate tick interval - aim for about 5-8 ticks
  const targetTicks = 6;
  const rawInterval = roundedMax / targetTicks;
  const intervalMagnitude = Math.floor(Math.log10(rawInterval));
  const normalizedInterval = rawInterval / Math.pow(10, intervalMagnitude);

  // Find nice interval multiplier
  let intervalMultiplier = 1;
  for (const multiplier of niceMultipliers) {
    if (multiplier >= normalizedInterval) {
      intervalMultiplier = multiplier;
      break;
    }
  }

  const tickInterval = intervalMultiplier * Math.pow(10, intervalMagnitude);

  return { roundedMax, tickInterval };
}

/**
 * Aggregates total tonnage per date, per week, or per month from parsedData
 * If liftType is provided, filters to only that lift type
 * aggregationType: "perSession" (default), "perWeek", or "perMonth"
 */

function processTonnageData(
  parsedData,
  thresholdDateStr,
  timeRange,
  liftType,
  aggregationType = "perSession",
) {
  const startTime = performance.now();
  const tonnageMap = new Map();

  parsedData.forEach((tuple) => {
    // Filter by liftType if provided
    if (liftType && tuple.liftType !== liftType) {
      return;
    }

    const dateKey = tuple.date; // already "YYYY-MM-DD"
    if (dateKey >= thresholdDateStr) {
      const tonnage = tuple.weight * tuple.reps;

      if (aggregationType === "perWeek") {
        // Group by week (Monday as start of week)
        const entryDate = parseISO(dateKey);
        const weekStart = format(
          startOfWeek(entryDate, { weekStartsOn: 1 }),
          "yyyy-MM-dd",
        );
        tonnageMap.set(weekStart, (tonnageMap.get(weekStart) || 0) + tonnage);
      } else if (aggregationType === "perMonth") {
        // Group by month (first day of month)
        const entryDate = parseISO(dateKey);
        const monthStart = format(startOfMonth(entryDate), "yyyy-MM-dd");
        tonnageMap.set(monthStart, (tonnageMap.get(monthStart) || 0) + tonnage);
      } else {
        // Group by session (per date)
        tonnageMap.set(dateKey, (tonnageMap.get(dateKey) || 0) + tonnage);
      }
    }
  });

  const chartData = Array.from(tonnageMap.entries())
    .map(([date, tonnage]) => ({
      date, // keep string date for use in setHighlightDate on mouseover
      rechartsDate: new Date(date).getTime(), // numeric timestamp for X-axis
      tonnage,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Add rolling average
  // Note: chartData elements represent different time periods based on aggregationType:
  // - "perSession": each element = 1 day
  // - "perWeek": each element = 1 week (Monday-Sunday)
  // - "perMonth": each element = 1 month
  // The windowSize below is the number of these aggregated periods to include in the rolling average
  const windowSize =
    aggregationType === "perWeek" ? 4 : aggregationType === "perMonth" ? 3 : 7; // 4-week moving average for weekly, 3-month for monthly, 7-day for daily
  for (let i = 0; i < chartData.length; i++) {
    const windowData = chartData.slice(Math.max(0, i - windowSize + 1), i + 1);
    const avg =
      windowData.reduce((sum, d) => sum + d.tonnage, 0) / windowData.length;

    chartData[i].rollingAverageTonnage = isNaN(avg) ? null : Math.round(avg);
  }

  devLog(
    `processTonnageData() execution time: \x1b[1m${Math.round(
      performance.now() - startTime,
    )}ms\x1b[0m`,
  );

  return chartData;
}

// Helper function to get session lifts grouped by lift type
function getSessionLiftsByType(parsedData, dateStr, chartLiftType) {
  if (!parsedData || !dateStr) return {};

  // Filter lifts for the given date, excluding goals
  const sessionLifts = parsedData.filter(
    (lift) =>
      lift.date === dateStr &&
      lift.isGoal !== true &&
      (!chartLiftType || lift.liftType === chartLiftType),
  );

  // Group by lift type
  const liftsByType = {};
  sessionLifts.forEach((lift) => {
    if (!liftsByType[lift.liftType]) {
      liftsByType[lift.liftType] = [];
    }
    liftsByType[lift.liftType].push(lift);
  });

  return liftsByType;
}

// Helper function to get week data aggregated
function getWeekLiftsData(parsedData, weekStartStr, chartLiftType) {
  if (!parsedData || !weekStartStr) {
    return {
      sessions: [],
      liftTypes: [],
      sessionDetails: [],
      totalSessions: 0,
      totalSets: 0,
      avgTonnagePerSession: 0,
      liftsByType: {},
    };
  }

  const weekStart = parseISO(weekStartStr);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndStr = format(weekEnd, "yyyy-MM-dd");

  // Filter lifts for the week, excluding goals
  const weekLifts = parsedData.filter(
    (lift) =>
      lift.date >= weekStartStr &&
      lift.date <= weekEndStr &&
      lift.isGoal !== true &&
      (!chartLiftType || lift.liftType === chartLiftType),
  );

  // Get unique session dates
  const sessionDates = [...new Set(weekLifts.map((lift) => lift.date))].sort();

  // Calculate session details (tonnage per session with lifts)
  const sessionDetails = sessionDates.map((date) => {
    const sessionLifts = weekLifts.filter((lift) => lift.date === date);
    const sessionTonnage = sessionLifts.reduce(
      (sum, lift) => sum + lift.weight * lift.reps,
      0,
    );
    return {
      date,
      tonnage: sessionTonnage,
      liftCount: sessionLifts.length,
      lifts: sessionLifts,
    };
  });

  // Get lift types
  const liftTypes = [...new Set(weekLifts.map((lift) => lift.liftType))];

  // Group by lift type
  const liftsByType = {};
  weekLifts.forEach((lift) => {
    if (!liftsByType[lift.liftType]) {
      liftsByType[lift.liftType] = [];
    }
    liftsByType[lift.liftType].push(lift);
  });

  const totalSessions = sessionDates.length;
  const totalSets = weekLifts.length;
  const totalTonnage = sessionDetails.reduce(
    (sum, session) => sum + session.tonnage,
    0,
  );
  const avgTonnagePerSession =
    totalSessions > 0 ? totalTonnage / totalSessions : 0;

  return {
    sessions: sessionDates,
    liftTypes,
    sessionDetails,
    totalSessions,
    totalSets,
    avgTonnagePerSession,
    liftsByType,
  };
}

// Helper function to get month data aggregated
function getMonthLiftsData(parsedData, monthStartStr, chartLiftType) {
  if (!parsedData || !monthStartStr) {
    return {
      sessions: [],
      liftTypes: [],
      weeklyBreakdown: [],
      sessionDetails: [],
      totalSessions: 0,
      totalSets: 0,
      avgTonnagePerSession: 0,
      liftsByType: {},
    };
  }

  const monthStart = parseISO(monthStartStr);
  const monthEnd = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() + 1,
    0,
  );
  const monthEndStr = format(monthEnd, "yyyy-MM-dd");

  // Filter lifts for the month, excluding goals
  const monthLifts = parsedData.filter(
    (lift) =>
      lift.date >= monthStartStr &&
      lift.date <= monthEndStr &&
      lift.isGoal !== true &&
      (!chartLiftType || lift.liftType === chartLiftType),
  );

  // Get unique session dates
  const sessionDates = [...new Set(monthLifts.map((lift) => lift.date))].sort();

  // Calculate session details (tonnage per session with lifts)
  const sessionDetails = sessionDates.map((date) => {
    const sessionLifts = monthLifts.filter((lift) => lift.date === date);
    const sessionTonnage = sessionLifts.reduce(
      (sum, lift) => sum + lift.weight * lift.reps,
      0,
    );
    return {
      date,
      tonnage: sessionTonnage,
      liftCount: sessionLifts.length,
      lifts: sessionLifts,
    };
  });

  // Get lift types
  const liftTypes = [...new Set(monthLifts.map((lift) => lift.liftType))];

  // Calculate weekly breakdown
  const weeklyBreakdown = [];
  let currentWeekStart = startOfWeek(monthStart, { weekStartsOn: 1 });

  while (currentWeekStart <= monthEnd) {
    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekEnd.getDate() + 6);

    // Only include weeks that overlap with the month
    if (currentWeekEnd >= monthStart && currentWeekStart <= monthEnd) {
      const weekStartStr = format(currentWeekStart, "yyyy-MM-dd");
      const weekEndStr = format(
        currentWeekEnd > monthEnd ? monthEnd : currentWeekEnd,
        "yyyy-MM-dd",
      );

      const weekLifts = monthLifts.filter(
        (lift) => lift.date >= weekStartStr && lift.date <= weekEndStr,
      );
      const weekTonnage = weekLifts.reduce(
        (sum, lift) => sum + lift.weight * lift.reps,
        0,
      );
      const weekSessionDates = [...new Set(weekLifts.map((lift) => lift.date))];

      weeklyBreakdown.push({
        weekStart: weekStartStr,
        weekEnd: weekEndStr,
        tonnage: weekTonnage,
        sessionCount: weekSessionDates.length,
      });
    }

    // Move to next week
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
  }

  // Group by lift type
  const liftsByType = {};
  monthLifts.forEach((lift) => {
    if (!liftsByType[lift.liftType]) {
      liftsByType[lift.liftType] = [];
    }
    liftsByType[lift.liftType].push(lift);
  });

  const totalSessions = sessionDates.length;
  const totalSets = monthLifts.length;
  const totalTonnage = sessionDetails.reduce(
    (sum, session) => sum + session.tonnage,
    0,
  );
  const avgTonnagePerSession =
    totalSessions > 0 ? totalTonnage / totalSessions : 0;

  return {
    sessions: sessionDates,
    liftTypes,
    weeklyBreakdown,
    sessionDetails,
    totalSessions,
    totalSets,
    avgTonnagePerSession,
    liftsByType,
  };
}

const TonnageTooltipContent = ({
  payload,
  label,
  liftType,
  aggregationType = "perSession",
  parsedData,
  liftColor,
}) => {
  if (!payload || payload.length === 0) return null;

  const tonnage = payload[0].value;
  const date = new Date(label);

  let dateLabel;
  if (aggregationType === "perWeek") {
    // Show week range (Monday to Sunday)
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    dateLabel = `${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`;
  } else if (aggregationType === "perMonth") {
    // Show month (e.g., "January 2024")
    dateLabel = format(date, "MMMM yyyy");
  } else {
    dateLabel = date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  // Get unit type from parsedData or default to empty string
  const unitType = parsedData?.[0]?.unitType ?? "";

  // Extract date string from payload (format: "YYYY-MM-DD")
  const dateStr = payload[0]?.payload?.date || null;

  // Get data based on aggregation type
  let sessionLiftsByType = null;
  let weekData = null;
  let monthData = null;

  if (aggregationType === "perSession" && parsedData && dateStr) {
    sessionLiftsByType = getSessionLiftsByType(parsedData, dateStr, liftType);
  } else if (aggregationType === "perWeek" && parsedData && dateStr) {
    weekData = getWeekLiftsData(parsedData, dateStr, liftType);
  } else if (aggregationType === "perMonth" && parsedData && dateStr) {
    monthData = getMonthLiftsData(parsedData, dateStr, liftType);
  }

  return (
    <div className="grid min-w-[8rem] max-w-[24rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-bold">{dateLabel}</p>
      <div className="flex flex-row items-center">
        <div
          className="mr-1 h-2.5 w-2.5 shrink-0 rounded-[2px]"
          style={{ backgroundColor: liftColor || "hsl(var(--chart-2))" }}
        />
        <div className="font-semibold">
          {liftType ? `${liftType} Tonnage` : "Total Tonnage"}
        </div>
        <div className="ml-2">{`${tonnage.toFixed(0)}${unitType}`}</div>
      </div>

      {/* Per Session: Show lifts */}
      {sessionLiftsByType && Object.keys(sessionLiftsByType).length > 0 && (
        <div className="mt-2">
          {Object.entries(sessionLiftsByType).map(([liftTypeName, lifts]) => (
            <div key={liftTypeName} className="mb-2 text-xs last:mb-0">
              {!liftType && <LiftTypeIndicator liftType={liftTypeName} />}
              <div className={liftType ? "" : "ml-6 mt-1"}>
                <SessionRow
                  date={dateStr}
                  lifts={lifts}
                  unitType={lifts[0]?.unitType ?? ""}
                  showDate={false}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Per Week: Show rich data */}
      {weekData && weekData.totalSessions > 0 && (
        <div className="mt-2">
          {liftType && weekData.sessionDetails.length > 0 ? (
            // Per-lift chart: show one row per session with sets
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {weekData.sessionDetails.map((session) => {
                const sessionDate = new Date(session.date);
                const formattedDate = sessionDate.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                });
                return (
                  <SessionRow
                    key={session.date}
                    date={session.date}
                    lifts={session.lifts}
                    unitType={unitType}
                  />
                );
              })}
            </div>
          ) : (
            // Total tonnage chart: show summary stats
            <div className="space-y-2">
              <div className="text-xs">
                <span className="font-semibold">{weekData.totalSessions}</span>{" "}
                {weekData.totalSessions === 1 ? "session" : "sessions"}
                {weekData.totalSessions > 0 && (
                  <span className="ml-2 text-muted-foreground">
                    Avg: {weekData.avgTonnagePerSession.toFixed(0)}
                    {unitType}/session
                  </span>
                )}
              </div>

              {weekData.liftTypes.length > 0 && (
                <div>
                  <div className="mb-1 text-xs font-semibold">Lift Types:</div>
                  <div className="flex flex-wrap gap-1">
                    {weekData.liftTypes.map((liftTypeName) => (
                      <LiftTypeIndicator
                        key={liftTypeName}
                        liftType={liftTypeName}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Per Month: Show rich data */}
      {monthData && monthData.totalSessions > 0 && (
        <div className="mt-2">
          {liftType && monthData.sessionDetails.length > 0 ? (
            // Per-lift chart: show one row per session with sets
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {monthData.sessionDetails.map((session) => {
                const sessionDate = new Date(session.date);
                const formattedDate = sessionDate.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                });
                return (
                  <SessionRow
                    key={session.date}
                    date={session.date}
                    lifts={session.lifts}
                    unitType={unitType}
                  />
                );
              })}
            </div>
          ) : (
            // Total tonnage chart: show summary stats
            <div className="space-y-2">
              <div className="text-xs">
                <span className="font-semibold">{monthData.totalSessions}</span>{" "}
                {monthData.totalSessions === 1 ? "session" : "sessions"}
                {monthData.totalSessions > 0 && (
                  <span className="ml-2 text-muted-foreground">
                    Avg: {monthData.avgTonnagePerSession.toFixed(0)}
                    {unitType}/session
                  </span>
                )}
              </div>

              {monthData.liftTypes.length > 0 && (
                <div>
                  <div className="mb-1 text-xs font-semibold">Lift Types:</div>
                  <div className="flex flex-wrap gap-1">
                    {monthData.liftTypes.map((liftTypeName) => (
                      <LiftTypeIndicator
                        key={liftTypeName}
                        liftType={liftTypeName}
                      />
                    ))}
                  </div>
                </div>
              )}

              {monthData.weeklyBreakdown.length > 0 && (
                <div>
                  <div className="mb-1 text-xs font-semibold">
                    Weekly Breakdown:
                  </div>
                  <div className="space-y-0.5">
                    {monthData.weeklyBreakdown.map((week, index) => {
                      const weekStartDate = new Date(week.weekStart);
                      const weekEndDate = new Date(week.weekEnd);
                      const weekLabel = `${format(weekStartDate, "MMM d")} - ${format(weekEndDate, "MMM d")}`;
                      return (
                        <div
                          key={week.weekStart}
                          className="flex justify-between text-xs"
                        >
                          <span>
                            Week {index + 1} ({weekLabel}): {week.sessionCount}{" "}
                            {week.sessionCount === 1 ? "session" : "sessions"}
                          </span>
                          <span className="text-muted-foreground">
                            {week.tonnage.toFixed(0)}
                            {unitType}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
