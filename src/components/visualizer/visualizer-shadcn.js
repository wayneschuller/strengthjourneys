/**
 * Full multi-lift E1RM visualizer with lift selection, time range controls,
 * and shared processing for historical training charts.
 */
import { Fragment, useMemo, useEffect, useState } from "react";
import {
  SidePanelSelectLiftsButton,
  VISUALIZER_STORAGE_PREFIX,
} from "@/components/side-panel-lift-chooser";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useLocalStorage, useWindowSize } from "usehooks-ts";
import { useSession } from "next-auth/react";
import { useLiftColors } from "@/hooks/use-lift-colors";
import { LOCAL_STORAGE_KEYS, getSelectedLiftsKey } from "@/lib/localStorage-keys";
import { BIG_FOUR_LIFT_TYPES, devLog } from "@/lib/processing-utils";
import { getReadableDateString } from "@/lib/date-utils";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { e1rmFormulae } from "@/lib/estimate-e1rm";
import { DemoModeBadge } from "@/components/demo-mode-badge";
import { subMonths } from "date-fns";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  E1RMFormulaSelect,
  SpecialHtmlLabel,
  MultiLiftTooltipContent,
} from "@/components/visualizer/visualizer-utils";
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
  ChartLegendContent,
} from "@/components/ui/chart";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  CartesianGrid,
  Area,
  AreaChart,
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

import { processVisualizerData, getYearLabels } from "@/components/visualizer/visualizer-processing";

// Wraps MultiLiftTooltipContent and syncs the hovered date to TheLatestSessionCard via setHighlightDate.
// recharts v3 doesn't reliably populate activePayload in onMouseMove for numeric/time XAxis,
// but it always calls Tooltip content when a data point is active.
function SyncedMultiLiftTooltip({ active, payload, label, selectedLiftTypes, setHighlightDate, debounceMs = 0 }) {
  const date = active && payload?.length > 0 ? payload[0]?.payload?.date : null;

  useEffect(() => {
    if (!date || !setHighlightDate) return;
    const timer = setTimeout(() => setHighlightDate(date), debounceMs);
    return () => clearTimeout(timer);
  }, [date, setHighlightDate, debounceMs]);

  return <MultiLiftTooltipContent active={active} payload={payload} label={label} selectedLiftTypes={selectedLiftTypes} />;
}

/**
 * Main strength visualizer card showing estimated one-rep maxes over time for one or more lifts
 * as a multi-series area chart. Includes lift selection, time range, weekly/all-data toggle,
 * value labels, and E1RM formula controls.
 *
 * @param {Object} props
 * @param {function(string)} [props.setHighlightDate] - Callback invoked on chart hover with the
 *   hovered ISO date string; used to sync with TheLatestSessionCard.
 */
export function VisualizerShadcn({ setHighlightDate }) {
  const { isDemoMode, parsedData, liftTypes } = useUserLiftingData();
  const { status: authStatus } = useSession();
  const { getColor } = useLiftColors();
  const { isMetric, bodyWeight, bodyWeightIsDefault } = useAthleteBio();

  const [selectedLiftTypes, setSelectedLiftTypes] = useState(BIG_FOUR_LIFT_TYPES);

  // Hydrate from localStorage when liftTypes is available
  useEffect(() => {
    if (authStatus === "loading" || !liftTypes?.length) return;

    const localStorageKey = getSelectedLiftsKey(isDemoMode, VISUALIZER_STORAGE_PREFIX);
    let stored = null;
    try {
      const raw = typeof window !== "undefined" && localStorage.getItem(localStorageKey);
      stored = raw ? JSON.parse(raw) : null;
    } catch {
      stored = null;
    }

    const liftTypeSet = new Set(liftTypes.map((l) => l.liftType));
    let resolved = Array.isArray(stored) && stored.length
      ? stored.filter((lt) => liftTypeSet.has(lt))
      : null;

    if (!resolved?.length) {
      resolved = BIG_FOUR_LIFT_TYPES.filter((lt) => liftTypeSet.has(lt));
      if (typeof window !== "undefined") {
        localStorage.setItem(localStorageKey, JSON.stringify(resolved));
      }
    }

    setSelectedLiftTypes(resolved);
  }, [authStatus, isDemoMode, liftTypes]);

  // Get reactive colors for all selected lift types
  const liftColors = {};
  selectedLiftTypes.forEach((liftType) => {
    liftColors[liftType] = getColor(liftType);
  });

  // devLog(parsedData);

  const [timeRange, setTimeRange] = useLocalStorage(
    LOCAL_STORAGE_KEYS.TIME_RANGE,
    "MAX", // MAX, 3M, 6M, 1Y, 2Y, 5Y etc.
    {
      initializeWithValue: false,
    },
  );

  const [showLabelValues, setShowLabelValues] = useLocalStorage(
    LOCAL_STORAGE_KEYS.SHOW_LABEL_VALUES,
    false,
    { initializeWithValue: false },
  );
  const [showAllData, setShowAllData] = useLocalStorage(
    LOCAL_STORAGE_KEYS.SHOW_ALL_DATA,
    true,
    { initializeWithValue: false },
  ); // Show weekly bests or all data
  const [e1rmFormula, setE1rmFormula] = useLocalStorage(
    LOCAL_STORAGE_KEYS.FORMULA,
    "Brzycki",
    { initializeWithValue: false },
  );

  // Used to hide the y-axis on smaller screens
  const { width } = useWindowSize({ initializeWithValue: false });

  const rangeFirstDate = calculateThresholdDate(timeRange, setTimeRange);

  const {
    dataset: chartData,
    weightMax,
    weightMin,
  } = useMemo(
    () =>
      processVisualizerData(
        parsedData,
        e1rmFormula,
        selectedLiftTypes,
        rangeFirstDate,
        showAllData,
        isMetric,
        bodyWeight,
        bodyWeightIsDefault,
      ),
    [
      parsedData,
      e1rmFormula,
      selectedLiftTypes,
      rangeFirstDate,
      showAllData,
      isMetric,
      bodyWeight,
      bodyWeightIsDefault,
    ],
  );

  // Ranked high points per selected lift, shown only when "Show Values" is on.
  // Unlike the single-lift charts elsewhere, this view can carry up to four
  // series at once, so the labels stay opt-in rather than always-on, and the
  // per-lift budget shrinks as more lifts are shown so four series worth of
  // labels don't bury the chart the way the old one-label-per-point-per-lift
  // toggle did. Computed unconditionally (must be, as a hook) but cheaply
  // skipped when the toggle is off.
  const topPointsByLift = useMemo(() => {
    if (!showLabelValues) return {};
    const count = Math.max(2, 6 - selectedLiftTypes.length);
    return Object.fromEntries(
      selectedLiftTypes.map((liftType) => [
        liftType,
        selectTopPoints(chartData, (point) => point[liftType], { count }),
      ]),
    );
  }, [chartData, selectedLiftTypes, showLabelValues]);

  // devLog("Rendering <VisualizerShadcn />...");
  if (!Array.isArray(parsedData) || parsedData.length === 0) return null;
  // devLog(chartData);

  const yearLabels = getYearLabels(chartData);
  const dateTickProps = getDateTickProps(chartData);

  const roundedMaxWeightValue = weightMax * (width > 1280 ? 1.3 : 1.5);

  // Shadcn charts needs this for theming but we just do custom colors anyway
  const chartConfig = Object.fromEntries(
    selectedLiftTypes.map((liftType, index) => [
      liftType,
      {
        label: liftType,
      },
    ]),
  );

  // Scale debounce with dataset size so small datasets feel instant while large datasets
  // avoid cascading TheLatestSessionCard re-renders during fast mouse scrubbing.
  // Formula: ~10ms at 120 pts, ~25ms at 300 pts, capped at 50ms at 600+ pts.
  const tooltipDebounceMs = Math.min(50, Math.floor(chartData.length / 12));
  devLog(`VisualizerShadcn: ${chartData.length} chart data points, debounceMs=${tooltipDebounceMs}`);

  // Dynamic tick spacing based on the data range so lighter lifts get
  // a readable Y-axis instead of 50kg jumps that compress everything.
  const dataRange = roundedMaxWeightValue;
  let tickJump;
  if (dataRange <= 30) tickJump = 5;
  else if (dataRange <= 60) tickJump = 10;
  else if (dataRange <= 150) tickJump = 20;
  else if (dataRange <= 300) tickJump = isMetric ? 50 : 50;
  else tickJump = isMetric ? 50 : 100;

  return (
    <Card>
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1 text-pretty">
          <CardTitle className="flex flex-wrap items-center gap-2">
            {isDemoMode && <DemoModeBadge />}
            {selectedLiftTypes.length === 1 && selectedLiftTypes[0]} Estimated
            One Rep Maxes
          </CardTitle>
          <CardDescription>
            {getTimeRangeDescription(rangeFirstDate, parsedData)}
          </CardDescription>
        </div>
        <div className="grid grid-cols-2 space-x-1">
          <SidePanelSelectLiftsButton
            selectedLiftTypes={selectedLiftTypes}
            setSelectedLiftTypes={setSelectedLiftTypes}
            storagePrefix={VISUALIZER_STORAGE_PREFIX}
            title="Choose Lifts"
            description={
              <>
                Select which lifts to show on your strength visualizer chart.
                <p>
                  (numbers in parentheses show your total sets for each lift
                  type)
                </p>
              </>
            }
          />
          <TimeRangeSelect timeRange={timeRange} setTimeRange={setTimeRange} />
        </div>
      </CardHeader>

      <CardContent className="pl-0 pr-2">
        <ChartContainer config={chartConfig} className="h-[400px] !aspect-auto">
          <AreaChart
            accessibilityLayer
            data={chartData}
            margin={{ left: 5, right: 20 }}
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
              domain={[
                Math.floor(weightMin / tickJump) * tickJump,
                roundedMaxWeightValue,
              ]}
              hide={width < 1280}
              tickFormatter={
                (value) =>
                  formatWeightTick(value, chartData[0]?.displayUnit || "") // Use displayUnit from processed chart data
              }
              ticks={Array.from(
                { length: Math.ceil(roundedMaxWeightValue / tickJump) + 1 },
                (v, i) => i * tickJump,
              )}
              // allowDataOverflow
            />
            <Tooltip
              content={
                <SyncedMultiLiftTooltip
                  selectedLiftTypes={selectedLiftTypes}
                  setHighlightDate={setHighlightDate}
                  debounceMs={tooltipDebounceMs}
                />
              }
              position={{ y: 40 }}
              cursor={chartCursorProps(
                // A single crosshair colour only makes sense to tie to a lift
                // when exactly one is selected; otherwise keep it neutral.
                selectedLiftTypes.length === 1
                  ? liftColors[selectedLiftTypes[0]]
                  : "var(--muted-foreground)",
              )}
            />
            <defs>
              {selectedLiftTypes.map((liftType) => {
                const liftSlug = liftType.split(" ").join("_"); // SVG id requires no spaces in lift type label
                return (
                  <Fragment key={liftType}>
                    <ChartAreaGradient
                      id={`fill-${liftSlug}`}
                      color={liftColors[liftType]}
                    />
                    <ChartGlowFilter id={`glow-${liftSlug}`} />
                  </Fragment>
                );
              })}
            </defs>
            {selectedLiftTypes.map((liftType) => {
              const liftSlug = liftType.split(" ").join("_");
              return (
                <Area
                  key={liftType}
                  type="monotone"
                  dataKey={liftType}
                  stroke={liftColors[liftType]}
                  name={liftType}
                  strokeWidth={2}
                  fill={`url(#fill-${liftSlug})`}
                  fillOpacity={1}
                  filter={`url(#glow-${liftSlug})`} // soft halo around the line
                  dot={["3M", "6M"].includes(timeRange)} // Show point dots in short time ranges
                  activeDot={chartActiveDotProps(liftColors[liftType])}
                  animationDuration={900}
                  animationEasing="ease-out"
                  connectNulls
                >
                  {/* Special user provided labels of special events/lifts */}
                  <LabelList
                    dataKey="label"
                    content={<SpecialHtmlLabel />}
                    position="top"
                  />
                </Area>
              );
            })}
            {/* Ranked high points per lift, opt-in via the Show Values switch.
                Replaces the old always-dense per-point labels, which became an
                unreadable smear across several years and four lift types. */}
            {showLabelValues &&
              selectedLiftTypes.map((liftType, index) => (
                <TopPointMarkers
                  key={`top-${liftType}`}
                  topPoints={topPointsByLift[liftType] || []}
                  color={liftColors[liftType]}
                  getLines={e1rmMarkerLines(liftType)}
                  // Stagger each lift's label stack higher than the last so two
                  // lifts peaking around the same week don't print on top of
                  // each other — see TopPointMarkers' labelOffset doc.
                  labelOffset={index * 22}
                  // With several lifts on screen, foreground/muted text can't
                  // tell one label from another — tint each with its own lift
                  // colour so a label reads back to its line the same way the
                  // legend does. A single selected lift keeps the plain
                  // foreground styling, since there's nothing to disambiguate.
                  labelColor={
                    selectedLiftTypes.length > 1
                      ? liftColors[liftType]
                      : undefined
                  }
                />
              ))}
            {/* Faint year boundary dividers with the year beneath them */}
            {renderYearDividers(yearLabels, !dateTickProps.axisShowsYears)}
            <ChartLegend
              content={<ChartLegendContent />}
              className="tracking-tight md:text-lg"
              verticalAlign="top"
            />
          </AreaChart>
        </ChartContainer>
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
          <div className="flex items-center space-x-1">
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
          <div>
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
