/**
 * Single-lift E1RM visualizer used inside lift-specific detail pages.
 * Shares chart processing with the full visualizer so estimates stay aligned.
 */
import { useMemo, useState, useEffect } from "react";
import { useLiftColors } from "@/hooks/use-lift-colors";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { useLocalStorage, useWindowSize } from "usehooks-ts";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { devLog } from "@/lib/processing-utils";

import {
  E1RMFormulaSelect,
  SpecialHtmlLabel,
  SingleLiftTooltipContent,
} from "@/components/visualizer/visualizer-utils";

import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ReferenceLine, ReferenceArea, ReferenceDot } from "recharts";
import { Checkbox } from "@/components/ui/checkbox";

import {
  CHART_AXIS_PROPS,
  CHART_GRID_PROPS,
  ChartAreaGradient,
  ChartBandGradient,
  ChartGlowFilter,
  ChartInlineLabel,
  TopPointMarkers,
  chartActiveDotProps,
  chartCursorProps,
  e1rmMarkerLines,
  formatWeightTick,
  getDateTickProps,
  paddedDateDomain,
  renderYearDividers,
  selectTopPoints,
} from "@/components/visualizer/chart-visuals";

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

import { ChartContainer } from "@/components/ui/chart";

import { CartesianGrid, Area, AreaChart, XAxis, YAxis, Tooltip } from "recharts";

import { getYearLabels, processVisualizerData } from "@/components/visualizer/visualizer-processing";
import { MiniFeedbackWidget } from "@/components/feedback";
import { DemoModeBadge } from "@/components/demo-mode-badge";

// How many high points to mark inside the selected range. Each one has to clear
// the separation rule below, so this is a ceiling rather than a guarantee — a
// short range with few sessions will simply mark fewer.
const TOP_SESSION_COUNT = 5;

/**
 * E1RM over time chart for a single lift. Shows estimated 1RM progression with optional formula
 * and time range controls. Used on lift pages (e.g. /bench-press).
 *
 * @param {Object} props
 * @param {string} [props.liftType] - Display name of the lift to chart (e.g. "Bench Press").
 */
export function VisualizerMini({ liftType }) {
  const { parsedData, isDemoMode, isLoading } = useUserLiftingData();
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);
  const { getColor } = useLiftColors();
  const liftColor = getColor(liftType);

  const { isMetric, bodyWeight, standards, bodyWeightIsDefault } = useAthleteBio();

  // devLog(parsedData);

  const [storedTimeRange, setTimeRange] = useLocalStorage(
    LOCAL_STORAGE_KEYS.TIME_RANGE,
    "MAX", // MAX, 3M, 6M, 1Y, 2Y, 5Y etc.
    {
      initializeWithValue: false,
    },
  );
  // Snap up to the nearest period that has data for this lift, without
  // overwriting the user's global preference. Lets a "3M" power user keep
  // their setting while rare lifts transparently widen to whatever fits.
  const timeRange = useMemo(
    () => snapTimeRangeToData(parsedData, liftType, storedTimeRange),
    [parsedData, liftType, storedTimeRange],
  );

  const [showAllData, setShowAllData] = useLocalStorage(
    LOCAL_STORAGE_KEYS.SHOW_ALL_DATA,
    true,
    {
      initializeWithValue: false,
    },
  ); // Show weekly bests or all data

  const [e1rmFormula, setE1rmFormula] = useLocalStorage(LOCAL_STORAGE_KEYS.FORMULA, "Brzycki", {
    initializeWithValue: false,
  });

  const [showStandards, setShowStandards] = useLocalStorage(
    LOCAL_STORAGE_KEYS.VIS_MINI_SHOW_STANDARDS,
    true,
    {
      initializeWithValue: false,
    },
  );

  const [showBodyweightMultiples, setShowBodyweightMultiples] = useLocalStorage(
    LOCAL_STORAGE_KEYS.VIS_MINI_SHOW_BODYWEIGHT_MULTIPLES,
    true,
    {
      initializeWithValue: false,
    },
  );

  // Used to hide the y-axis and other UI elements on smaller screens
  const { width } = useWindowSize({ initializeWithValue: false });

  const rangeFirstDate = calculateThresholdDate(timeRange, setTimeRange);
  const feedbackContextId = `visualizer_mini_${liftType
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")}`;

  const {
    dataset: chartData,
    weightMax,
    weightMin,
  } = useMemo(
    () =>
      processVisualizerData(
        parsedData,
        e1rmFormula,
        [liftType],
        rangeFirstDate,
        showAllData,
        isMetric,
        bodyWeight,
        bodyWeightIsDefault,
      ),
    [
      parsedData,
      e1rmFormula,
      liftType,
      rangeFirstDate,
      showAllData,
      isMetric,
      bodyWeight,
      bodyWeightIsDefault,
    ],
  );

  // if (authStatus !== "authenticated") return; // Don't show at all for anon mode
  // devLog(chartData);

  const yearLabels = getYearLabels(chartData);
  const dateTickProps = getDateTickProps(chartData);

  // The best sessions inside the selected time range, ranked, so the chart always
  // highlights the high points of whatever window you are looking at. See
  // selectTopPoints for how the picks stay spread instead of clustering on one
  // peak week.
  const topPoints = useMemo(
    () =>
      selectTopPoints(chartData, (point) => point[liftType], {
        count: TOP_SESSION_COUNT,
      }),
    [chartData, liftType],
  );

  const strengthRanges = standards?.[liftType] || null;

  // The chart ceiling must cover the data AND the highest visible strength
  // standard so reference lines don't get clipped.  The old hardcoded
  // Math.max(100, ...) crushed lighter lifts into the bottom of the chart.
  // Keep the headroom tight so the line fills the frame and the progression
  // looks like a climb; small screens get a bit more room for value labels.
  const dataBasedMax = weightMax * (width > 1280 ? 1.15 : 1.35);
  const roundedMaxWeightValue = dataBasedMax;

  // Shadcn charts needs this for theming but we just do custom colors anyway
  const chartConfig = { [liftType]: { label: liftType } };

  const handleMouseMove = (event) => {
    if (event && event.activePayload) {
      const activeIndex = event.activeTooltipIndex;
      // devLog(event);
      // setHighlightDate(event.activeLabel);
    }
  };

  // Dynamic tick spacing based on the data range so lighter lifts get
  // a readable Y-axis instead of 50kg jumps that compress everything.
  const dataRange = roundedMaxWeightValue - 0; // min is 0 in this chart
  let tickJump;
  if (dataRange <= 30) tickJump = 5;
  else if (dataRange <= 60) tickJump = 10;
  else if (dataRange <= 150) tickJump = 20;
  else if (dataRange <= 300) tickJump = isMetric ? 50 : 50;
  else tickJump = isMetric ? 50 : 100;

  // Semantic color progression: cool (easy) → warm (elite). Works across all themes.
  const strengthStandardColors = {
    physicallyActive: "#3b82f6", // blue-500
    beginner: "#22c55e",        // green-500
    intermediate: "#f59e0b",    // amber-500
    advanced: "#f97316",        // orange-500
    elite: "#ef4444",           // red-500
  };
  const strengthStandardLabels = {
    physicallyActive: "Physically Active",
    beginner: "Beginner",
    intermediate: "Intermediate",
    advanced: "Advanced",
    elite: "Elite",
  };

  // Show all standards the user has reached + exactly one next target.
  // No point showing Elite to a beginner — keep the chart focused and motivating.
  const orderedStandardKeys = ["physicallyActive", "beginner", "intermediate", "advanced", "elite"];
  const orderedStandards = strengthRanges
    ? orderedStandardKeys.map((key) => ({ key, val: strengthRanges[key] })).filter((s) => s.val != null)
    : [];
  const nextStandardIndex = orderedStandards.findIndex((s) => weightMax < s.val);
  const visibleStandardCount = nextStandardIndex === -1 ? orderedStandards.length : nextStandardIndex + 1;
  const visibleStandards = orderedStandards.slice(0, visibleStandardCount);
  // Bands: one per zone the user has passed through (not including the next target's zone)
  const visibleBandCount = nextStandardIndex === -1 ? orderedStandards.length : nextStandardIndex;

  // Ensure the chart ceiling covers the highest visible standard (with padding)
  const highestVisibleStandard = visibleStandards.length > 0
    ? visibleStandards[visibleStandards.length - 1].val
    : 0;
  const effectiveMax = Math.max(roundedMaxWeightValue, highestVisibleStandard * 1.15);

  return (
    <Card className="">
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1 text-pretty">
          <CardTitle className="flex flex-wrap items-center gap-2">
            {isDemoMode && <DemoModeBadge />}
            {liftType} Estimated One Rep Maxes
          </CardTitle>
          <CardDescription>
            {getTimeRangeDescription(rangeFirstDate, parsedData)}
          </CardDescription>
        </div>
        {width > 1280 && (
          <div className="mr-4 flex flex-col gap-2">
            <div className="flex items-center gap-1">
              <Checkbox
                id="show-standards"
                value={showStandards}
                checked={showStandards}
                onCheckedChange={(show) => setShowStandards(show)}
              />
              <Label htmlFor="show-standards">Show Strength Standards</Label>
            </div>
            <div className="flex items-center gap-1">
              <Checkbox
                id="show-bodyweight-multiples"
                checked={showBodyweightMultiples}
                onCheckedChange={(checked) =>
                  setShowBodyweightMultiples(checked)
                }
              />
              <Label htmlFor="show-bodyweight-multiples">
                Show Bodyweight Multiples
              </Label>
            </div>
          </div>
        )}
        <TimeRangeSelect timeRange={timeRange} setTimeRange={setTimeRange} liftType={liftType} />
      </CardHeader>

      <CardContent className="pl-0 pr-2">
        {isLoading || !parsedData || !isMounted ? (
          <Skeleton className="h-[400px] w-full" />
        ) : chartData && (
            <ChartContainer config={chartConfig} className="h-[400px] !aspect-auto">
              <AreaChart
                accessibilityLayer
                data={chartData}
                margin={{ left: 5, right: 20 }}
                // onMouseMove={handleMouseMove}
              >
                <CartesianGrid {...CHART_GRID_PROPS} />
                {/* Strength standard background bands — rendered first so they sit behind
                    the chart data. Only zones the user has passed through are shown;
                    the next unreached standard gets a line but no band beyond it. */}
                {strengthRanges && showStandards && width > 768 &&
                  Array.from({ length: visibleBandCount }, (_, i) => ({
                    y1: visibleStandards[i].val,
                    y2: visibleStandards[i + 1]?.val ?? Math.max(100, roundedMaxWeightValue),
                    key: visibleStandards[i].key,
                  })).map(({ y1, y2, key }) => (
                    <ReferenceArea
                      key={`band-${y1}`}
                      y1={y1}
                      y2={y2}
                      fill={`url(#band-${key})`}
                      fillOpacity={1}
                      stroke="none"
                    />
                  ))
                }
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
                  domain={[0, effectiveMax]}
                  hide={width < 1280}
                  tickFormatter={
                    (value) =>
                      formatWeightTick(value, chartData[0]?.displayUnit || "") // Default to first item's displayUnit
                  }
                  ticks={Array.from(
                    { length: Math.ceil(effectiveMax / tickJump) + 1 },
                    (v, i) => i * tickJump,
                  )}
                  // allowDataOverflow
                />
                <Tooltip
                  content={(props) => (
                    <SingleLiftTooltipContent
                      {...props}
                      liftType={liftType}
                      parsedData={parsedData}
                      liftColor={liftColor}
                      isMetric={isMetric}
                    />
                  )}
                  formatter={(value, name, props) =>
                    `${value} ${props.payload.displayUnit || ""}`
                  }
                  position={{ y: 180 }}
                  cursor={chartCursorProps(liftColor)} // Recharts tooltip cursor is the vertical reference line that follows the mouse
                />
                <defs>
                  <ChartAreaGradient id="fill" color={liftColor} />
                  <ChartGlowFilter id="e1rmGlow" />
                  {/* One band gradient per strength zone in view */}
                  {visibleStandards.map(({ key }) => (
                    <ChartBandGradient
                      key={`band-gradient-${key}`}
                      id={`band-${key}`}
                      color={strengthStandardColors[key]}
                    />
                  ))}
                </defs>
                <Area
                  key={liftType}
                  type="monotone"
                  dataKey={liftType}
                  stroke={liftColor}
                  name={liftType}
                  strokeWidth={2}
                  fill={`url(#fill)`}
                  fillOpacity={1}
                  filter="url(#e1rmGlow)" // soft halo around the line
                  dot={false}
                  activeDot={chartActiveDotProps(liftColor)}
                  animationDuration={900}
                  animationEasing="ease-out"
                  connectNulls
                />
                {/* Faint year boundary dividers with the year beneath them */}
                {renderYearDividers(yearLabels, !dateTickProps.axisShowsYears)}

                {/* The best sessions in range, ranked. A multi-rep session names
                    the set that produced the estimate above the estimate itself
                    (5@115kg / 123kg); a single is its own estimate, so one line
                    says everything. */}
                <TopPointMarkers
                  topPoints={topPoints}
                  color={liftColor}
                  getLines={e1rmMarkerLines(liftType)}
                />

                {/* Strength standards: color-coded lines for all reached levels + one next target. */}
                {strengthRanges && showStandards && width > 768 &&
                  visibleStandards.map(({ key, val }) => {
                    const unitType = isMetric ? "kg" : "lb";
                    const color = strengthStandardColors[key];
                    return (
                      <ReferenceLine
                        key={key}
                        y={val}
                        stroke={color}
                        strokeWidth={1.5}
                        strokeDasharray="6 4"
                        label={{
                          // Anchored at the left (oldest) edge on purpose. These
                          // labels are long, and at the right edge they sat on top
                          // of the most recent sessions — the part of the line
                          // people actually came to look at.
                          content: ({ viewBox }) => (
                            <ChartInlineLabel
                              x={viewBox.x + 6}
                              y={viewBox.y - 5}
                              color={color}
                              textAnchor="start"
                            >
                              {`${strengthStandardLabels[key]} (${val}${unitType})`}
                            </ChartInlineLabel>
                          ),
                        }}
                      />
                    );
                  })
                }
                {/* Bodyweight multiples: use liftColor so lines feel tied to the chart area. */}
                {showBodyweightMultiples && bodyWeight > 0 && width >= 1280 &&
                  [0.5, 1.0, 1.5, 2.0, 2.5, 3.0].map((multiple) => {
                    const weightValue = Math.round(multiple * bodyWeight);
                    if (weightValue > roundedMaxWeightValue || weightValue <= 0) return null;
                    return (
                      <ReferenceLine
                        key={`bw-${multiple}`}
                        y={weightValue}
                        stroke={liftColor}
                        strokeWidth={1.5}
                        strokeDasharray="3 6"
                        strokeOpacity={0.7}
                        label={{
                          // Right edge, opposite the strength standards on the left.
                          // Bodyweight multiples often land within a kilo or two of a
                          // standard (0.5xBW vs Physically Active, say), so splitting
                          // the two families across the plot keeps them from
                          // colliding. These are short enough to cover very little of
                          // the recent line.
                          content: ({ viewBox }) => (
                            <ChartInlineLabel
                              x={viewBox.x + viewBox.width - 6}
                              y={viewBox.y - 5}
                              color={liftColor}
                            >
                              {`${multiple}xBW`}
                            </ChartInlineLabel>
                          ),
                        }}
                      />
                    );
                  })
                }
              </AreaChart>
            </ChartContainer>
        )}
      </CardContent>
      <CardFooter>
        <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-3 md:items-center">
          <div className="justify-self-start">
            <MiniFeedbackWidget
              prompt="Useful chart?"
              contextId={feedbackContextId}
              page="/visualizer"
              analyticsExtra={{
                context: "visualizer_mini_card",
                lift_type: liftType,
              }}
            />
          </div>
          <div className="flex items-center space-x-1 md:justify-self-center">
            <Label className="font-light" htmlFor="all-data">
              Weekly Bests
            </Label>
            <Switch
              id="all-data"
              value={showAllData}
              checked={showAllData}
              onCheckedChange={(show) => setShowAllData(show)}
            />
            <Label className="font-light" htmlFor="all-data">
              All Data
            </Label>
          </div>
          <div className="md:justify-self-end">
            <E1RMFormulaSelect
              e1rmFormula={e1rmFormula}
              setE1rmFormula={setE1rmFormula}
            />
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
