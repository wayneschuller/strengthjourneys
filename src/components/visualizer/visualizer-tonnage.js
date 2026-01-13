"use client";

import { useMemo } from "react";
import { useLiftColors } from "@/hooks/use-lift-colors";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useLocalStorage, useWindowSize } from "usehooks-ts";
import { devLog, getReadableDateString } from "@/lib/processing-utils";
import { parseISO, startOfWeek, startOfMonth, format } from "date-fns";
import { LiftTypeIndicator } from "@/components/lift-type-indicator";
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
  const [timeRange, setTimeRange] = useLocalStorage("SJ_timeRange", "MAX", {
    initializeWithValue: false,
  });
  const [showLabelValues, setShowLabelValues] = useLocalStorage(
    "SJ_showLabelValues",
    false,
  );
  const [aggregationType, setAggregationType] = useLocalStorage(
    "SJ_tonnageAggregationType",
    "perSession",
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
                  domain={[0, (dataMax) => dataMax * 1.2]}
                  hide={width < 1280}
                />

                <Tooltip
                  content={(props) => (
                    <TonnageTooltipContent
                      {...props}
                      liftType={liftType}
                      aggregationType={aggregationType}
                      parsedData={parsedData}
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
                domain={[0, (dataMax) => dataMax * 1.2]}
                hide={width < 1280}
              />

              <Tooltip
                content={(props) => (
                  <TonnageTooltipContent
                    {...props}
                    liftType={liftType}
                    aggregationType={aggregationType}
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

const TonnageTooltipContent = ({
  payload,
  label,
  liftType,
  aggregationType = "perSession",
  parsedData,
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

  // Get session lifts if aggregationType is perSession
  // Extract date string from payload (format: "YYYY-MM-DD")
  const dateStr =
    aggregationType === "perSession" && payload[0]?.payload?.date
      ? payload[0].payload.date
      : null;

  const sessionLiftsByType =
    aggregationType === "perSession" && parsedData && dateStr
      ? getSessionLiftsByType(parsedData, dateStr, liftType)
      : null;

  return (
    <div className="grid min-w-[8rem] max-w-[24rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-bold">{dateLabel}</p>
      <div className="flex flex-row items-center">
        <div className="mr-1 h-2.5 w-2.5 shrink-0 rounded-[2px] bg-primary" />
        <div className="font-semibold">
          {liftType ? `${liftType} Tonnage` : "Total Tonnage"}
        </div>
      </div>
      <div>{`${tonnage.toFixed(0)}${unitType}`}</div>
      {sessionLiftsByType && Object.keys(sessionLiftsByType).length > 0 && (
        <div className="mt-2 border-t border-border/50 pt-2">
          {Object.entries(sessionLiftsByType).map(([liftTypeName, lifts]) => (
            <div key={liftTypeName} className="mb-2 last:mb-0">
              <LiftTypeIndicator liftType={liftTypeName} />
              <div className="ml-6 mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                {lifts.map((lift, index) => (
                  <span key={index} className="text-xs">
                    {lift.reps}@{lift.weight}
                    {lift.unitType}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
