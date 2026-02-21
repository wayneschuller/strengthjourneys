"use client";

import { useMemo, useEffect, useState } from "react";
import {
  SidePanelSelectLiftsButton,
  VISUALIZER_STORAGE_PREFIX,
} from "../side-panel-lift-chooser";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useLocalStorage, useWindowSize } from "usehooks-ts";
import { useSession } from "next-auth/react";
import { useLiftColors } from "@/hooks/use-lift-colors";
import { LOCAL_STORAGE_KEYS, getSelectedLiftsKey } from "@/lib/localStorage-keys";
import {
  BIG_FOUR_LIFT_TYPES,
  devLog,
  getReadableDateString,
} from "@/lib/processing-utils";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { e1rmFormulae } from "@/lib/estimate-e1rm";
import { subMonths } from "date-fns";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ReferenceLine } from "recharts";
import {
  E1RMFormulaSelect,
  SpecialHtmlLabel,
  MultiLiftTooltipContent,
} from "./visualizer-utils";
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

import { processVisualizerData, getYearLabels } from "./visualizer-processing";

// Wraps MultiLiftTooltipContent and syncs the hovered date to SessionAnalysisCard via setHighlightDate.
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
 *   hovered ISO date string; used to sync with SessionAnalysisCard.
 */
export function VisualizerShadcn({ setHighlightDate }) {
  const { parsedData, liftTypes } = useUserLiftingData();
  const { status: authStatus } = useSession();
  const { getColor } = useLiftColors();
  const { isMetric } = useAthleteBio();

  const [selectedLiftTypes, setSelectedLiftTypes] = useState(BIG_FOUR_LIFT_TYPES);

  // Hydrate from localStorage when liftTypes is available
  useEffect(() => {
    if (authStatus === "loading" || !liftTypes?.length) return;

    const localStorageKey = getSelectedLiftsKey(
      authStatus === "unauthenticated",
      VISUALIZER_STORAGE_PREFIX
    );
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
  }, [authStatus, liftTypes]);

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
      ),
    [parsedData, e1rmFormula, selectedLiftTypes, rangeFirstDate, showAllData, isMetric],
  );

  // devLog("Rendering <VisualizerShadcn />...");
  if (!parsedData) return;
  // devLog(chartData);

  const yearLabels = getYearLabels(chartData);

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
  // avoid cascading SessionAnalysisCard re-renders during fast mouse scrubbing.
  // Formula: ~10ms at 120 pts, ~25ms at 300 pts, capped at 50ms at 600+ pts.
  const tooltipDebounceMs = Math.min(50, Math.floor(chartData.length / 12));
  devLog(`VisualizerShadcn: ${chartData.length} chart data points, debounceMs=${tooltipDebounceMs}`);

  let tickJump = isMetric ? 50 : 100; // 50 for kg, 100 for lb

  // FIXME: We need more dynamic x-axis ticks
  const formatXAxisDateString = (tickItem) => {
    const date = new Date(tickItem);
    return date.toLocaleString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <Card>
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1 text-pretty">
          <CardTitle>
            {authStatus === "unauthenticated" && "Demo Mode: "}
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
            <CartesianGrid vertical={false} />
            <XAxis
              // dataKey="date"
              dataKey="rechartsDate"
              type="number"
              scale="time"
              domain={[
                (dataMin) =>
                  new Date(dataMin).setDate(new Date(dataMin).getDate() - 2),
                (dataMax) =>
                  new Date(dataMax).setDate(new Date(dataMax).getDate() + 2),
              ]}
              tickFormatter={formatXAxisDateString}
              // interval="equidistantPreserveStart"
            />
            <YAxis
              domain={[
                Math.floor(weightMin / tickJump) * tickJump,
                Math.max(100, roundedMaxWeightValue),
              ]}
              hide={width < 1280}
              axisLine={false}
              tickFormatter={
                (value) => `${value}${chartData[0]?.displayUnit || ""}` // Use displayUnit from processed chart data
              }
              ticks={Array.from(
                { length: Math.ceil(roundedMaxWeightValue / tickJump) },
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
              cursor={{
                stroke: "#8884d8",
                strokeWidth: 2,
                strokeDasharray: "5 5",
              }}
            />
            <defs>
              {selectedLiftTypes.map((liftType, index) => {
                const gradientId = `fill${liftType.split(" ").join("_")}`; // SVG id requires no spaces in life type label
                return (
                  <linearGradient
                    id={`fill${gradientId}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                    key={`${liftType}-${index}`} // Add a unique key for React rendering
                  >
                    <stop
                      offset="5%"
                      stopColor={liftColors[liftType]}
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="50%"
                      stopColor={liftColors[liftType]}
                      stopOpacity={0.05}
                    />
                  </linearGradient>
                );
              })}
            </defs>
            {selectedLiftTypes.map((liftType, index) => {
              const gradientId = `fill${liftType.split(" ").join("_")}`; // SVG id requires no spaces in life type label
              return (
                <Area
                  key={liftType}
                  type="monotone"
                  dataKey={liftType}
                  stroke={liftColors[liftType]}
                  name={liftType}
                  strokeWidth={2}
                  fill={`url(#fill${gradientId})`}
                  fillOpacity={0.4}
                  dot={["3M", "6M"].includes(timeRange)} // Show point dots in short time ranges
                  connectNulls
                >
                  {showLabelValues && (
                    <LabelList
                      position="top"
                      offset={12}
                      content={({ x, y, value, index }) => (
                        <text
                          x={x}
                          y={y}
                          dy={-10}
                          fontSize={12}
                          textAnchor="middle"
                          className="fill-foreground"
                        >
                          {`${value}${chartData[index].displayUnit || ""}`}
                        </text>
                      )}
                    />
                  )}
                  {/* Special user provided labels of special events/lifts */}
                  <LabelList
                    dataKey="label"
                    content={<SpecialHtmlLabel />}
                    position="top"
                  />
                </Area>
              );
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
