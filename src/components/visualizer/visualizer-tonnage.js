
import { useMemo, useEffect, useState } from "react";
import { useLiftColors } from "@/hooks/use-lift-colors";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useLocalStorage, useWindowSize } from "usehooks-ts";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { devLog, logTiming, getDisplayWeight } from "@/lib/processing-utils";
import { getReadableDateString } from "@/lib/date-utils";
import { LiftTypeIndicator } from "@/components/lift-type-indicator";
import { SessionRow } from "@/components/visualizer/visualizer-utils";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ReferenceLine } from "recharts";
import {
  TimeRangeSelect,
  calculateThresholdDate,
  getTimeRangeDescription,
} from "@/components/visualizer/time-range-select";

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
} from "@/components/ui/chart";

import {
  CartesianGrid,
  Area,
  AreaChart,
  Line,
  LabelList,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

import { getYearLabels } from "@/components/visualizer/visualizer-processing";
import { MiniFeedbackWidget } from "@/components/feedback";
import { DemoModeBadge } from "@/components/demo-mode-badge";

/**
 * Chart showing session tonnage (weight × reps) over time with a rolling average trend line.
 * Every data point is a single session, so hover snaps to each session individually.
 * Optional setHighlightDate syncs with TheLatestSessionCard for date hover.
 *
 * @param {Object} props
 * @param {function(string)} [props.setHighlightDate] - Callback when user hovers a point; receives
 *   ISO date string. Used to sync with TheLatestSessionCard on the Analyzer page.
 * @param {string} [props.liftType] - Display name of the lift to filter tonnage. When omitted,
 *   shows total tonnage across all lifts.
 */
export function TonnageChart({ setHighlightDate, liftType }) {
  const { parsedData, isLoading, isDemoMode } = useUserLiftingData();
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);
  const { getColor } = useLiftColors();
  const { isMetric } = useAthleteBio();
  const liftColor = liftType ? getColor(liftType) : null;
  const [timeRange, setTimeRange] = useLocalStorage(LOCAL_STORAGE_KEYS.TIME_RANGE, "MAX", {
    initializeWithValue: false,
  });
  const [showLabelValues, setShowLabelValues] = useLocalStorage(
    LOCAL_STORAGE_KEYS.SHOW_LABEL_VALUES,
    false,
    { initializeWithValue: false },
  );

  // Used to hide the y-axis and other UI elements on smaller screens
  const { width } = useWindowSize({ initializeWithValue: false });

  const rangeFirstDate = calculateThresholdDate(timeRange, setTimeRange);
  const feedbackContextId = `tonnage_chart_${(liftType || "all_lifts")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")}`;

  // Always per-session so every data point is a hoverable session
  const chartData = useMemo(() => {
    if (!parsedData || parsedData.length === 0) return null;
    return processTonnageData(
      parsedData,
      rangeFirstDate,
      timeRange,
      liftType,
      "perSession",
      isMetric,
    );
  }, [parsedData, rangeFirstDate, timeRange, liftType, isMetric]);

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

  // Scale debounce with dataset size so small datasets feel instant while large datasets
  // avoid cascading TheLatestSessionCard re-renders during fast mouse scrubbing.
  const tooltipDebounceMs = Math.min(50, Math.floor((chartData?.length ?? 0) / 12));

  const displayUnit = isMetric ? "kg" : "lb";

  const formatXAxisDate = (tickItem) => {
    const date = new Date(tickItem);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const tonnageColor = liftColor || "var(--chart-1)";
  const [hiddenSeries, setHiddenSeries] = useState({});

  const toggleSeries = (dataKey) => {
    setHiddenSeries((prev) => ({ ...prev, [dataKey]: !prev[dataKey] }));
  };

  const DashedLineIcon = ({ opacity = 1 }) => (
    <svg width="12" height="12" viewBox="0 0 12 12" style={{ opacity }}>
      <line x1="0" y1="6" x2="12" y2="6" stroke={tonnageColor} strokeWidth="2" strokeDasharray="3 2" strokeOpacity="0.6" />
    </svg>
  );

  const chartConfig = {
    tonnage: {
      label: liftType ? `${liftType} Tonnage` : "Session Tonnage",
      color: tonnageColor,
    },
    rollingAverageTonnage: {
      label: "30-Day Average",
      color: tonnageColor,
      icon: DashedLineIcon,
    },
  };

  const seriesKeys = Object.keys(chartConfig);
  const renderLegend = () => (
    <div className="flex items-center justify-center gap-4 pt-3">
      {seriesKeys.map((key) => {
        const cfg = chartConfig[key];
        const isHidden = hiddenSeries[key];
        return (
          <button
            key={key}
            type="button"
            className="flex items-center gap-1.5 text-sm transition-opacity"
            style={{ opacity: isHidden ? 0.35 : 1 }}
            onClick={() => toggleSeries(key)}
          >
            {cfg.icon ? (
              <cfg.icon opacity={isHidden ? 0.35 : 1} />
            ) : (
              <div
                className="h-2 w-2 shrink-0 rounded-[2px]"
                style={{ backgroundColor: cfg.color }}
              />
            )}
            {cfg.label}
          </button>
        );
      })}
    </div>
  );

  const yearLabels = getYearLabels(chartData);

  return (
    <Card>
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1 text-pretty">
          <CardTitle className="flex flex-wrap items-center gap-2">
            {isDemoMode && <DemoModeBadge />}
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
        {isLoading || !parsedData || !isMounted || !chartData ? (
          <Skeleton className="h-[400px] w-full" />
        ) : liftType ? (
          <ChartContainer config={chartConfig} className="h-[400px] !aspect-auto">
              <AreaChart
                data={chartData}
                margin={{ left: 5, right: 20 }}
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
                  tickFormatter={(value) => `${value}${displayUnit}`}
                  domain={[0, yAxisConfig.roundedMax]}
                  ticks={yAxisConfig.ticks}
                  hide={width < 1280}
                />

                <Tooltip
                  position={{ y: 180 }}
                  content={(props) => (
                    <TonnageTooltipContent
                      {...props}
                      liftType={liftType}
                      parsedData={parsedData}
                      liftColor={liftColor}
                      setHighlightDate={setHighlightDate}
                      debounceMs={tooltipDebounceMs}
                      isMetric={isMetric}
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
                <ChartLegend content={renderLegend} />
                {!hiddenSeries.tonnage && (
                  <Area
                    key={liftType}
                    type="monotone"
                    dataKey="tonnage"
                    stroke={liftColor}
                    strokeWidth={2}
                    fill={`url(#fill)`}
                    fillOpacity={0.4}
                    dot={
                      ["3M", "6M"].includes(timeRange)
                        ? { r: 3, fill: "var(--background)", strokeWidth: 2 }
                        : false
                    }
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
                            {`${Math.round(value)}${displayUnit}`}
                          </text>
                        )}
                      />
                    )}
                  </Area>
                )}
                {!hiddenSeries.rollingAverageTonnage && (
                  <Line
                    type="monotone"
                    dataKey="rollingAverageTonnage"
                    stroke={liftColor}
                    strokeWidth={2}
                    strokeOpacity={0.6}
                    strokeDasharray="6 3"
                    dot={false}
                    connectNulls
                    tooltipType="none"
                  />
                )}

                {yearLabels.map(({ date, label }) => (
                  <ReferenceLine
                    key={`label-${date}`}
                    x={date}
                    stroke="none"
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
        ) : (
          <ChartContainer config={chartConfig} className="h-[400px] !aspect-auto">
            <AreaChart
              data={chartData}
              margin={{ left: 5, right: 20 }}
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
                tickFormatter={(value) => `${value}${displayUnit}`}
                domain={[0, yAxisConfig.roundedMax]}
                ticks={yAxisConfig.ticks}
                hide={width < 1280}
              />

              <Tooltip
                position={{ y: 180 }}
                content={(props) => (
                  <TonnageTooltipMinimal
                    {...props}
                    setHighlightDate={setHighlightDate}
                    debounceMs={tooltipDebounceMs}
                    isMetric={isMetric}
                  />
                )}
              />

              <defs>
                <linearGradient id="fillTonnage" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={tonnageColor}
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="50%"
                    stopColor={tonnageColor}
                    stopOpacity={0.05}
                  />
                </linearGradient>
              </defs>

              <ChartLegend content={renderLegend} />
              {!hiddenSeries.tonnage && (
                <Area
                  type="monotone"
                  dataKey="tonnage"
                  stroke={tonnageColor}
                  fill="url(#fillTonnage)"
                  fillOpacity={0.4}
                  dot={
                    ["3M", "6M"].includes(timeRange)
                      ? { r: 3, fill: "var(--background)", strokeWidth: 2 }
                      : false
                  }
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
                          {`${Math.round(value)}${displayUnit}`}
                        </text>
                      )}
                    />
                  )}
                </Area>
              )}

              {!hiddenSeries.rollingAverageTonnage && (
                <Line
                  type="monotone"
                  dataKey="rollingAverageTonnage"
                  stroke={tonnageColor}
                  strokeWidth={2}
                  strokeOpacity={0.6}
                  strokeDasharray="6 3"
                  dot={false}
                  connectNulls
                  tooltipType="none"
                />
              )}

              {yearLabels.map(({ date, label }) => (
                <ReferenceLine
                  key={`label-${date}`}
                  x={date}
                  stroke="none"
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
        <div className="flex w-full items-center justify-between">
          <MiniFeedbackWidget
            prompt="Useful chart?"
            contextId={feedbackContextId}
            page={liftType ? "/visualizer" : "/tonnage"}
            analyticsExtra={{
              context: liftType ? "lift_tonnage_chart" : "tonnage_chart",
              lift_type: liftType || "all_lifts",
            }}
          />
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
 * Aggregates total tonnage per session date from parsedData.
 * If liftType is provided, filters to only that lift type.
 * Includes a 30-day rolling average for the trend line.
 */
function processTonnageData(
  parsedData,
  thresholdDateStr,
  timeRange,
  liftType,
  _aggregationType = "perSession",
  isMetric = false,
) {
  const startTime = performance.now();
  const tonnageMap = new Map();

  parsedData.forEach((tuple) => {
    if (liftType && tuple.liftType !== liftType) return;

    const dateKey = tuple.date;
    if (dateKey >= thresholdDateStr) {
      const { value: displayWeight } = getDisplayWeight(tuple, isMetric);
      const tonnage = displayWeight * tuple.reps;
      tonnageMap.set(dateKey, (tonnageMap.get(dateKey) || 0) + tonnage);
    }
  });

  const chartData = Array.from(tonnageMap.entries())
    .map(([date, tonnage]) => ({
      date,
      rechartsDate: new Date(date).getTime(),
      tonnage,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // 30-day calendar rolling average for the trend line
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  let windowStart = 0;
  for (let i = 0; i < chartData.length; i++) {
    const cutoff = chartData[i].rechartsDate - THIRTY_DAYS_MS;
    while (chartData[windowStart].rechartsDate < cutoff) windowStart++;
    let sum = 0;
    for (let j = windowStart; j <= i; j++) sum += chartData[j].tonnage;
    const count = i - windowStart + 1;
    chartData[i].rollingAverageTonnage = Math.round(sum / count);
  }

  logTiming("processTonnageData", performance.now() - startTime);

  return chartData;
}

// Minimal tooltip for the tonnage page where the session card shows details.
const TonnageTooltipMinimal = ({
  payload,
  label,
  setHighlightDate,
  debounceMs = 0,
  isMetric = false,
}) => {
  const dateStr = payload?.[0]?.payload?.date || null;

  useEffect(() => {
    if (!dateStr || !setHighlightDate) return;
    const timer = setTimeout(() => setHighlightDate(dateStr), debounceMs);
    return () => clearTimeout(timer);
  }, [dateStr, setHighlightDate, debounceMs]);

  if (!payload || payload.length === 0) return null;

  const tonnage = payload[0].value;
  const date = new Date(label);
  const dateLabel = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const unitType = isMetric ? "kg" : "lb";

  return (
    <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-bold">{dateLabel}</p>
      <p>{`${tonnage.toFixed(0)}${unitType}`}</p>
    </div>
  );
};

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


// Recharts tooltip for the tonnage chart; renders per-session details and
// drives the session card highlight via setHighlightDate.
const TonnageTooltipContent = ({
  payload,
  label,
  liftType,
  parsedData,
  liftColor,
  setHighlightDate,
  debounceMs = 0,
  isMetric = false,
}) => {
  const dateStr = payload?.[0]?.payload?.date || null;

  // Drive session card highlight on hover (must be before early return)
  useEffect(() => {
    if (!dateStr || !setHighlightDate) return;
    const timer = setTimeout(() => setHighlightDate(dateStr), debounceMs);
    return () => clearTimeout(timer);
  }, [dateStr, setHighlightDate, debounceMs]);

  if (!payload || payload.length === 0) return null;

  const tonnage = payload[0].value;
  const rollingAverageTonnage = payload[0].payload?.rollingAverageTonnage;
  const date = new Date(label);

  const dateLabel = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const unitType = isMetric ? "kg" : "lb";
  const seriesColor = liftColor || "var(--chart-1)";

  const sessionLiftsByType =
    parsedData && dateStr
      ? getSessionLiftsByType(parsedData, dateStr, liftType)
      : null;

  return (
    <div className="grid min-w-[8rem] max-w-[17rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-bold">{dateLabel}</p>
      <div className="flex flex-row items-center">
        <div
          className="mr-1 h-2.5 w-2.5 shrink-0 rounded-[2px]"
          style={{ backgroundColor: seriesColor }}
        />
        <div className="font-semibold">
          {liftType ? `${liftType} Tonnage` : "Total Tonnage"}
        </div>
        <div className="ml-2">{`${tonnage.toFixed(0)}${unitType}`}</div>
      </div>
      {rollingAverageTonnage != null && (
        <div className="flex flex-row items-center">
          <svg
            className="mr-1 shrink-0"
            width="10"
            height="10"
            viewBox="0 0 10 10"
          >
            <line
              x1="0"
              y1="5"
              x2="10"
              y2="5"
              stroke={seriesColor}
              strokeWidth="2"
              strokeDasharray="3 2"
              strokeOpacity="0.6"
            />
          </svg>
          <div className="font-semibold">30-Day Avg</div>
          <div className="ml-2">{`${Math.round(rollingAverageTonnage)}${unitType}`}</div>
        </div>
      )}

      {sessionLiftsByType && Object.keys(sessionLiftsByType).length > 0 && (
        <div className="mt-2">
          {Object.entries(sessionLiftsByType).map(([liftTypeName, lifts]) => (
            <div key={liftTypeName} className="mb-2 text-xs last:mb-0">
              {!liftType && <LiftTypeIndicator liftType={liftTypeName} />}
              <div className={liftType ? "" : "ml-6 mt-1"}>
                <SessionRow
                  date={dateStr}
                  lifts={lifts}
                  isMetric={isMetric}
                  showDate={false}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
