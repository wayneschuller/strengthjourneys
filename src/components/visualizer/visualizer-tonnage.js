/**
 * Session tonnage chart (per-lift and all-lifts variants) with a 30-day rolling
 * average trend line. Shares its visual language with the E1RM charts via
 * chart-visuals so the two charts on a lift page read as a matched pair.
 */
import { useMemo, useRef, useEffect, useState } from "react";
import { useRouter } from "next/router";
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
import {
  TimeRangeSelect,
  calculateThresholdDate,
  getTimeRangeDescription,
  snapTimeRangeToData,
} from "@/components/visualizer/time-range-select";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { ChartContainer, ChartLegend } from "@/components/ui/chart";

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

import {
  CHART_AXIS_PROPS,
  CHART_GRID_PROPS,
  ChartAreaGradient,
  ChartGlowFilter,
  ChartInlineLabel,
  TopPointMarkers,
  chartActiveDotProps,
  chartCursorProps,
  formatWeightTick,
  getDateTickProps,
  getResponsiveLabelCount,
  paddedDateDomain,
  renderYearDividers,
  selectTopPoints,
  selectValueLabelIndices,
} from "@/components/visualizer/chart-visuals";

import { getYearLabels } from "@/components/visualizer/visualizer-processing";
import { MiniFeedbackWidget } from "@/components/feedback";
import { DemoModeBadge } from "@/components/demo-mode-badge";
import { AiReviewActions } from "@/components/ai-review-actions";
import {
  buildAiAssistantPromptLink,
  buildTonnageChartReviewPrompt,
} from "@/lib/ai-review-prompts";

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
  const router = useRouter();
  const cardRef = useRef(null);
  const highlightedDateRef = useRef(null);
  const { parsedData, isLoading, isDemoMode } = useUserLiftingData();
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);
  const { getColor } = useLiftColors();
  const { isMetric } = useAthleteBio();
  const liftColor = liftType ? getColor(liftType) : null;
  const [storedTimeRange, setTimeRange] = useLocalStorage(
    LOCAL_STORAGE_KEYS.TIME_RANGE,
    "MAX",
    {
      initializeWithValue: false,
    },
  );
  // Snap up to the nearest period that has data for this lift, without
  // overwriting the user's global preference.
  const timeRange = useMemo(
    () => snapTimeRangeToData(parsedData, liftType, storedTimeRange),
    [parsedData, liftType, storedTimeRange],
  );
  // Only meaningful on the standalone all-lifts page (src/pages/tonnage.js) — the
  // per-lift charts embedded in progress-guide pages always show their ranked
  // peaks instead, see topPoints below.
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
        domainMax: 1040,
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

    // Keep the top tick round, but extend the actual scale slightly beyond it.
    // TopPointMarkers lifts its text above the point, so ending the domain at
    // the tick can clip a near-ceiling label against the SVG boundary.
    const domainMax = roundedMax + tickInterval * 0.2;

    return { roundedMax, domainMax, tickInterval, ticks };
  }, [chartData]);

  // Scale debounce with dataset size so small datasets feel instant while large datasets
  // avoid cascading TheLatestSessionCard re-renders during fast mouse scrubbing.
  const tooltipDebounceMs = Math.min(
    50,
    Math.floor((chartData?.length ?? 0) / 12),
  );

  const displayUnit = isMetric ? "kg" : "lb";

  const dateTickProps = getDateTickProps(chartData);

  // Tonnage annotations are one line, so they can use a slightly denser budget
  // than E1RM labels while keeping the same collision-avoiding point selector.
  const topPointCount = getResponsiveLabelCount(width, {
    max: 12,
    labelWidth: 125,
  });

  // Per-lift chart only (progress-guide pages): the best sessions in range,
  // ranked, so the chart always highlights its own high points instead of
  // leaving them buried in the noise. See selectTopPoints for how the picks
  // stay spread rather than clustering on one peak week.
  const topPoints = useMemo(
    () =>
      liftType
        ? selectTopPoints(chartData, (point) => point.tonnage, {
            count: topPointCount,
          })
        : [],
    [chartData, liftType, topPointCount],
  );

  // Standalone all-lifts page only: which sessions get a value label when
  // "Show Values" is on. Over years of sessions, labelling every point buries
  // the line, so past a threshold only record-setting sessions and the latest
  // one are annotated.
  const valueLabelIndices = useMemo(
    () =>
      selectValueLabelIndices(
        chartData,
        (point) => point.tonnage,
        width >= 1280 ? 24 : 12,
      ),
    [chartData, width],
  );

  const tonnageColor = liftColor || "var(--chart-1)";
  const [hiddenSeries, setHiddenSeries] = useState({});

  const toggleSeries = (dataKey) => {
    setHiddenSeries((prev) => ({ ...prev, [dataKey]: !prev[dataKey] }));
  };

  const handleChartHighlight = (event) => {
    const point =
      event?.activePayload?.[0]?.payload ??
      chartData?.[event?.activeTooltipIndex];
    highlightedDateRef.current = point?.date ?? null;
  };

  const handleChartClick = (event) => {
    handleChartHighlight(event);
    if (highlightedDateRef.current) {
      router.push({
        pathname: "/log",
        query: { date: highlightedDateRef.current },
      });
    }
  };

  // Matches the rolling average line's dotted round-capped stroke on the chart.
  const DashedLineIcon = ({ opacity = 1 }) => (
    <svg width="12" height="12" viewBox="0 0 12 12" style={{ opacity }}>
      <line
        x1="1"
        y1="6"
        x2="11"
        y2="6"
        stroke={tonnageColor}
        strokeWidth="2"
        strokeDasharray="1 4"
        strokeLinecap="round"
        strokeOpacity="0.85"
      />
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
            onClick={(event) => {
              event.stopPropagation();
              toggleSeries(key);
            }}
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
  const tonnageSummaryLines = useMemo(
    () => buildTonnageChartSummary(chartData, displayUnit),
    [chartData, displayUnit],
  );
  const aiReviewLink = useMemo(() => {
    if (!chartData?.length) return null;
    return buildAiAssistantPromptLink(
      buildTonnageChartReviewPrompt({
        liftType,
        startDate: chartData[0].date,
        endDate: chartData[chartData.length - 1].date,
        summaryLines: tonnageSummaryLines,
      }),
    );
  }, [chartData, liftType, tonnageSummaryLines]);

  return (
    <Card ref={cardRef}>
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
        <div className="grid grid-cols-1 space-x-1" data-copy-exclude>
          <TimeRangeSelect
            timeRange={timeRange}
            setTimeRange={setTimeRange}
            liftType={liftType}
          />
        </div>
      </CardHeader>

      <CardContent className="pr-2 pl-0">
        {isLoading || !parsedData || !isMounted || !chartData ? (
          <Skeleton className="h-[400px] w-full" />
        ) : liftType ? (
          <ChartContainer
            config={chartConfig}
            className="!aspect-auto h-[400px] [&_.recharts-wrapper]:outline-none"
          >
            <AreaChart
              data={chartData}
              margin={{ left: 5, right: 20 }}
              onMouseMove={handleChartHighlight}
              onClick={handleChartClick}
              style={{ cursor: "pointer" }}
            >
              <CartesianGrid {...CHART_GRID_PROPS} />
              <XAxis
                {...CHART_AXIS_PROPS}
                dataKey="rechartsDate"
                type="number"
                scale="time"
                domain={paddedDateDomain()}
                {...dateTickProps.axisProps}
              />
              <YAxis
                {...CHART_AXIS_PROPS}
                tickFormatter={(value) => formatWeightTick(value, displayUnit)}
                domain={[0, yAxisConfig.domainMax]}
                ticks={yAxisConfig.ticks}
                hide={width < 1280}
              />

              <Tooltip
                position={{ y: 180 }}
                cursor={chartCursorProps(liftColor)}
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
                <ChartAreaGradient id="fill" color={liftColor} />
                <ChartGlowFilter id="tonnageGlow" />
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
                  fillOpacity={1}
                  filter="url(#tonnageGlow)" // soft halo around the line
                  dot={
                    ["3M", "6M"].includes(timeRange)
                      ? { r: 3, fill: "var(--background)", strokeWidth: 2 }
                      : false
                  }
                  activeDot={chartActiveDotProps(liftColor)}
                  animationDuration={900}
                  animationEasing="ease-out"
                  connectNulls
                />
              )}
              {!hiddenSeries.rollingAverageTonnage && (
                <Line
                  type="monotone"
                  dataKey="rollingAverageTonnage"
                  stroke={liftColor}
                  strokeWidth={2}
                  strokeOpacity={0.85}
                  strokeDasharray="1 5"
                  strokeLinecap="round"
                  dot={false}
                  connectNulls
                  tooltipType="none"
                  // Recharts animates a line by rewriting strokeDasharray, which
                  // mangles a fine dotted pattern like this one — it only ever
                  // drew the first few weeks. The area's grow-in carries the
                  // entrance; this line just appears with it.
                  isAnimationActive={false}
                />
              )}

              {renderYearDividers(yearLabels, !dateTickProps.axisShowsYears)}

              {/* The best sessions in range, ranked — see selectTopPoints. */}
              {!hiddenSeries.tonnage && (
                <TopPointMarkers
                  topPoints={topPoints}
                  color={liftColor}
                  getLines={({ value }) => [
                    `${Math.round(value)}${displayUnit}`,
                  ]}
                />
              )}
            </AreaChart>
          </ChartContainer>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="!aspect-auto h-[400px]"
          >
            <AreaChart
              data={chartData}
              margin={{ left: 5, right: 20 }}
              onMouseMove={handleChartHighlight}
              onClick={handleChartClick}
              style={{ cursor: "pointer" }}
            >
              <CartesianGrid {...CHART_GRID_PROPS} />
              <XAxis
                {...CHART_AXIS_PROPS}
                dataKey="rechartsDate"
                type="number"
                scale="time"
                domain={paddedDateDomain()}
                {...dateTickProps.axisProps}
              />
              <YAxis
                {...CHART_AXIS_PROPS}
                tickFormatter={(value) => formatWeightTick(value, displayUnit)}
                domain={[0, yAxisConfig.domainMax]}
                ticks={yAxisConfig.ticks}
                hide={width < 1280}
              />

              <Tooltip
                position={{ y: 180 }}
                cursor={chartCursorProps(tonnageColor)}
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
                <ChartAreaGradient id="fillTonnage" color={tonnageColor} />
                <ChartGlowFilter id="tonnageGlowAll" />
              </defs>

              <ChartLegend content={renderLegend} />
              {!hiddenSeries.tonnage && (
                <Area
                  type="monotone"
                  dataKey="tonnage"
                  stroke={tonnageColor}
                  strokeWidth={2}
                  fill="url(#fillTonnage)"
                  fillOpacity={1}
                  filter="url(#tonnageGlowAll)" // soft halo around the line
                  dot={
                    ["3M", "6M"].includes(timeRange)
                      ? { r: 3, fill: "var(--background)", strokeWidth: 2 }
                      : false
                  }
                  activeDot={chartActiveDotProps(tonnageColor)}
                  animationDuration={900}
                  animationEasing="ease-out"
                  connectNulls
                >
                  {showLabelValues && (
                    <LabelList
                      position="top"
                      offset={12}
                      content={({ x, y, value, index }) =>
                        valueLabelIndices.has(index) ? (
                          <ChartInlineLabel
                            x={x}
                            y={y - 10}
                            color="var(--foreground)"
                            textAnchor="middle"
                          >
                            {`${Math.round(value)}${displayUnit}`}
                          </ChartInlineLabel>
                        ) : null
                      }
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
                  strokeOpacity={0.85}
                  strokeDasharray="1 5"
                  strokeLinecap="round"
                  dot={false}
                  connectNulls
                  tooltipType="none"
                  // See the per-lift chart above: animating this line mangles its
                  // dotted pattern, so it renders statically.
                  isAnimationActive={false}
                />
              )}

              {renderYearDividers(yearLabels, !dateTickProps.axisShowsYears)}
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>

      <CardFooter>
        <div className="relative flex w-full flex-col items-center justify-between gap-3 md:flex-row">
          <div className="order-1" data-copy-exclude>
            <MiniFeedbackWidget
              prompt="Useful chart?"
              contextId={feedbackContextId}
              page={liftType ? "/visualizer" : "/tonnage"}
              analyticsExtra={{
                context: liftType ? "lift_tonnage_chart" : "tonnage_chart",
                lift_type: liftType || "all_lifts",
              }}
            />
          </div>
          {/* Only the standalone all-lifts page needs this: the per-lift charts
              always show their ranked peaks instead (see topPoints above). */}
          {!liftType && (
            <div
              className="order-3 flex items-center space-x-2"
              data-copy-exclude
            >
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
          )}
          <div className="order-2 md:absolute md:left-1/2 md:-translate-x-1/2">
            <AiReviewActions
              aiReviewLink={aiReviewLink}
              contentRef={cardRef}
              showText={false}
            />
            <span
              className="text-muted-foreground hidden text-xs font-medium tracking-wide italic"
              data-copy-only
            >
              strengthjourneys.xyz
            </span>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}

function buildTonnageChartSummary(chartData, displayUnit) {
  if (!chartData?.length) return [];

  const first = chartData[0];
  const latest = chartData[chartData.length - 1];
  const peak = chartData.reduce((best, point) =>
    point.tonnage > best.tonnage ? point : best,
  );

  return [
    `logged_sessions=${chartData.length}`,
    `first_session=${first.date}: ${Math.round(first.tonnage)}${displayUnit}`,
    `latest_session=${latest.date}: ${Math.round(latest.tonnage)}${displayUnit}`,
    `peak_session=${peak.date}: ${Math.round(peak.tonnage)}${displayUnit}`,
    `latest_30_day_average=${Math.round(latest.rollingAverageTonnage)}${displayUnit}`,
  ];
}

/**
 * Calculates nice round numbers for Y-axis ticks.
 * Returns an object with roundedMax and tickInterval.
 *
 * The ceiling is derived from the tick interval rather than snapped up to the
 * next power-of-ten multiple. The old approach pushed a 3,400kg peak to a
 * 5,000kg axis, so the data only filled two thirds of the chart and every
 * session looked flat. Now we take just enough headroom (~6%) to clear the peak
 * and then round up to a whole tick.
 */
function calculateNiceYAxis(maxValue) {
  if (maxValue <= 0) {
    return { roundedMax: 1000, tickInterval: 200 };
  }

  const target = maxValue * 1.06; // small headroom so the peak isn't clipped
  const magnitude = Math.pow(10, Math.floor(Math.log10(target / 5)));
  const candidates = [1, 2, 2.5, 5, 10, 20].map((m) => m * magnitude);

  // Smallest interval that still keeps the axis to at most 6 gridlines.
  const tickInterval =
    candidates.find((step) => Math.ceil(target / step) <= 6) ??
    candidates[candidates.length - 1];

  const roundedMax = Math.ceil(target / tickInterval) * tickInterval;

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
  const dateLabel = getReadableDateString(dateStr ?? label, true);
  const unitType = isMetric ? "kg" : "lb";

  return (
    <div className="border-border/50 bg-background rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
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
  const dateLabel = getReadableDateString(dateStr ?? label, true);

  const unitType = isMetric ? "kg" : "lb";
  const seriesColor = liftColor || "var(--chart-1)";

  const sessionLiftsByType =
    parsedData && dateStr
      ? getSessionLiftsByType(parsedData, dateStr, liftType)
      : null;

  return (
    <div className="border-border/50 bg-background grid max-w-[17rem] min-w-[8rem] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
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
              <div className={liftType ? "" : "mt-1 ml-6"}>
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
      <p className="border-border/50 text-muted-foreground mt-1 border-t pt-1 text-[11px]">
        Click to see full session details
      </p>
    </div>
  );
};
