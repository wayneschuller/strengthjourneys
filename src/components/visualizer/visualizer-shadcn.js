"use client";

import { useState, useRef, useMemo } from "react";
import { subMonths } from "date-fns";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CartesianGrid,
  Area,
  AreaChart,
  LabelList,
  Line,
  LineChart,
  XAxis,
  YAxis,
  ReferenceLine,
  Tooltip,
} from "recharts";
import { getLiftColor, brightenHexColor } from "@/lib/get-lift-color";
import { SidePanelSelectLiftsButton } from "../side-panel-lift-chooser";
import { useUserLiftingData } from "@/lib/use-userlift-data";
import { estimateE1RM } from "@/lib/estimate-e1rm";
import { devLog } from "@/lib/processing-utils";
import { useLocalStorage } from "usehooks-ts";
import { getReadableDateString } from "@/lib/processing-utils";
import { e1rmFormulae } from "@/lib/estimate-e1rm";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

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
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

import { ChartLegend, ChartLegendContent } from "@/components/ui/chart";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// FIXME: I have a function to do this which removes current year
const formatXAxisDateString = (tickItem) => {
  const date = new Date(tickItem);
  return date.toLocaleString("en-US", { month: "short", day: "numeric" });
};

export function VisualizerShadcn({ setHighlightDate }) {
  const { parsedData, selectedLiftTypes, topLiftsByTypeAndReps, isLoading } =
    useUserLiftingData();
  const [timeRange, setTimeRange] = useLocalStorage(
    "SJ_timeRange",
    "1900-01-01", // The start date threshold for inclusion in the chart
  );
  const [showLabelValues, setShowLabelValues] = useLocalStorage(
    "SJ_showLabelValues",
    false,
  );
  const [showAllData, setShowAllData] = useLocalStorage("SJ_showAllData", true); // Show weekly bests or all data
  const [e1rmFormula, setE1rmFormula] = useLocalStorage(
    "e1rmFormula",
    "Brzycki",
  );

  // Use useRef for variables that don't require re-render
  const activeDateRef = useRef(null); // FIXME: no longer needed now that we just chart on the string version
  const tooltipXRef = useRef(0);

  const referenceLine = useMemo(() => {
    if (activeDateRef.current) {
      return (
        <ReferenceLine
          x={activeDateRef.current}
          strokeDasharray="5 6"
          strokeWidth={3}
        />
      );
    }
    return null;
  }, [activeDateRef.current]);

  if (isLoading) return;
  if (!parsedData) return;

  const {
    dataset: chartData,
    weightMax,
    weightMin,
  } = processVisualizerData(
    parsedData,
    e1rmFormula,
    selectedLiftTypes,
    timeRange,
    showAllData,
  );

  // Round maxWeightValue up to the next multiple of 50
  // const roundedMaxWeightValue = Math.ceil(maxWeightValue / 50) * 50;
  const roundedMaxWeightValue = weightMax * 1.3;
  // const roundedMaxWeightValue = Math.ceil((maxWeightValue * 1.3) / 50) * 50; // rounding to nearest 50
  // devLog(maxValue);

  // Not sure why recharts needs this, but no legend without it
  const chartConfig = Object.fromEntries(
    selectedLiftTypes.map((liftType, index) => [
      liftType,
      {
        label: liftType,
      },
    ]),
  );

  const handleMouseMove = (event) => {
    if (event && event.activePayload) {
      const activeIndex = event.activeTooltipIndex;
      // devLog(event);
      // setActiveDate(event.activeLabel);
      // setToolTipX(event.chartX);
      activeDateRef.current = event.activeLabel;
      tooltipXRef.current = event.chartX;

      setHighlightDate(event.activePayload[0].payload.date);
    }
  };

  let tickJump = 100; // 100 for pound jumps on y-Axis.
  if (chartData[0].unitType === "kg") tickJump = 50; // 50 for kg jumps on y-Axis

  // -----------------------------------------------------------------------------
  // CustomToolTipContent
  // -----------------------------------------------------------------------------
  const CustomTooltipContent = ({
    active,
    payload,
    label,
    selectedLiftTypes,
  }) => {
    // devLog(payload);
    if (active && payload && payload.length) {
      // FIXME: we could map the payloads, or simply lookup the date in parseddata and do our own analysis or old code toplifts

      const tuple = payload[0].payload;

      // devLog(tuple);
      const dateLabel = getReadableDateString(tuple.date);
      const tooltipsPerLift = [];

      selectedLiftTypes.forEach((liftType) => {
        const reps = tuple[`${liftType}_reps`];
        const weight = tuple[`${liftType}_weight`];
        const oneRepMax = tuple[`${liftType}`];
        const unitType = tuple.unitType;

        if (reps && weight && oneRepMax) {
          let labelContent = "";
          if (reps === 1) {
            labelContent = `Lifted ${reps}@${weight}${unitType}`;
          } else {
            labelContent = `Potential 1@${oneRepMax}@${unitType} from lifting ${reps}@${weight}${unitType}`;
          }

          const color = getLiftColor(liftType);
          tooltipsPerLift.push({
            liftType: liftType,
            label: labelContent,
            color: color,
            reps: reps,
          });
        }
      });

      // devLog(liftLabels);

      return (
        <div className="grid min-w-[8rem] max-w-[24rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
          <p className="font-bold">{dateLabel}</p>
          {tooltipsPerLift.map(({ liftType, label, color, reps }) => (
            <div>
              <div className="flex flex-row items-center">
                <div
                  className="mr-1 h-2.5 w-2.5 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: color }} // Use css style because tailwind is picky
                />
                <div className="font-semibold">{liftType}</div>
              </div>
              <div className="">{label}</div>
            </div>
          ))}
        </div>
      );
    }

    return null;
  };

  return (
    <Card>
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1 text-center sm:text-left">
          <CardTitle>
            {selectedLiftTypes.length === 1 && selectedLiftTypes[0]} Estimated
            One Rep Maxes
          </CardTitle>
          <CardDescription>
            {getTimeRangeDescription(timeRange, parsedData)}
          </CardDescription>
        </div>
        <div className="grid grid-cols-2 space-x-1">
          <SidePanelSelectLiftsButton />
          <TimeRangeSelect timeRange={timeRange} setTimeRange={setTimeRange} />
        </div>
      </CardHeader>

      <CardContent className="pl-0 pr-2">
        <ChartContainer config={chartConfig}>
          <AreaChart
            accessibilityLayer
            data={chartData}
            // margin={{ left: 5, right: 5, }}
            onMouseMove={handleMouseMove}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              // type="number"
              // scale="time"
              // domain={[ (dataMin) => new Date(dataMin).setDate(new Date(dataMin).getDate() - 2), (dataMax) => new Date(dataMax).setDate(new Date(dataMax).getDate() + 2), ]}
              tickFormatter={formatXAxisDateString}
              // interval="equidistantPreserveStart"
            />
            <YAxis
              domain={[
                Math.floor(weightMin / tickJump) * tickJump,
                roundedMaxWeightValue,
              ]}
              // hide={true}
              axisLine={false}
              tickFormatter={(value, index) =>
                `${value}${chartData[index].unitType}`
              }
              ticks={Array.from(
                { length: Math.ceil(roundedMaxWeightValue / tickJump) },
                (v, i) => i * tickJump,
              )}
              allowDataOverflow
            />
            {referenceLine}
            {false && activeDateRef.current && (
              <ReferenceLine
                x={activeDateRef.current}
                // stroke="red" // FIXME: Doesn't seem to apply?
                // stroke="var(--color-foreground)" // FIXME: Doesn't work either
                strokeDasharray="5 6"
                strokeWidth={3}
                // label={activeDate}
              />
            )}
            <Tooltip
              content={
                <CustomTooltipContent
                  selectedLiftTypes={selectedLiftTypes}
                  e1rmFormula={e1rmFormula}
                />
              }
              formatter={(value, name, props) =>
                `${value} ${props.payload.unitType}`
              }
              position={{ x: tooltipXRef.current - 80, y: 10 }}
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
                      stopColor={getLiftColor(liftType)}
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="50%"
                      stopColor={getLiftColor(liftType)}
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
                  // dataKey={`y_${line.label}`}
                  dataKey={liftType}
                  // data={line.data}
                  stroke={getLiftColor(liftType)}
                  name={liftType}
                  strokeWidth={2}
                  fill={`url(#fill${gradientId})`}
                  fillOpacity={0.4}
                  dot={false}
                  connectNulls
                >
                  {showLabelValues && (
                    <LabelList
                      position="top"
                      offset={12}
                      className="fill-foreground"
                      content={({ x, y, value, index }) => (
                        <text
                          x={x}
                          y={y}
                          dy={-10}
                          fontSize={12}
                          textAnchor="middle"
                        >
                          {`${value}${chartData[index].unitType}`}
                        </text>
                      )}
                    />
                  )}
                </Area>
              );
            })}
            <ChartLegend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <div className="flex w-full flex-col justify-between gap-2 md:flex-row">
          <div className="flex items-center space-x-2">
            <Label className="font-light" htmlFor="show-values">
              Show All Values
            </Label>
            <Switch
              id="show-values"
              value={showLabelValues}
              checked={showLabelValues}
              onCheckedChange={(show) => setShowLabelValues(show)}
            />
          </div>
          <div className="flex items-center space-x-1">
            <Label className="font-light" htmlFor="show-values">
              Weekly Bests
            </Label>
            <Switch
              id="all-data"
              value={showAllData}
              checked={showAllData}
              onCheckedChange={(show) => setShowAllData(show)}
            />
            <Label className="font-light" htmlFor="show-values">
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

function processVisualizerData(
  parsedData,
  e1rmFormula,
  selectedLiftTypes,
  timeRange,
  showAllData = false,
) {
  const startTime = performance.now();

  const dataMap = new Map();
  const recentLifts = {}; // Used for weekly bests data decimation
  const decimationDaysWindow = 7; // Only chart the best e1rm in the N day window

  let weightMax = 0;
  let weightMin = 1000;

  parsedData.forEach(({ date, liftType, reps, weight, isGoal, unitType }) => {
    if (date < timeRange) return; // Skip if date out of range of chart

    if (isGoal) return; // FIXME: implement goal dashed lines at some point

    // Skip if the lift type is not selected
    if (selectedLiftTypes && !selectedLiftTypes.includes(liftType)) {
      return;
    }

    const oneRepMax = estimateE1RM(reps, weight, e1rmFormula);

    if (!dataMap.has(date)) {
      dataMap.set(date, {});
    }
    const liftData = dataMap.get(date);

    if (weightMax < oneRepMax) weightMax = oneRepMax;
    if (weight < weightMin) weightMin = weight;

    // Data decimation - skip lower lifts if there was something bigger the last N day window
    // FIXME: this is slowing down the loop?
    const currentDate = new Date(date);
    if (!showAllData && recentLifts[liftType]) {
      const recentDate = new Date(recentLifts[liftType].date);
      const dayDiff = (currentDate - recentDate) / (1000 * 60 * 60 * 24);

      // Check if we already have a much better lift in the data decimation window
      if (
        dayDiff <= decimationDaysWindow &&
        oneRepMax <= recentLifts[liftType].oneRepMax * 0.95
      ) {
        return; // Skip this entry
      }
    }

    if (!liftData[liftType] || oneRepMax > liftData[liftType]) {
      liftData[liftType] = oneRepMax;
      // const timeStamp = new Date(date).getTime(); // Convert to Unix timestamp for x-axis
      // liftData.x = timeStamp;
      liftData.unitType = unitType;
      liftData[`${liftType}_reps`] = reps;
      liftData[`${liftType}_weight`] = weight;
    }

    recentLifts[liftType] = { date: date, oneRepMax: oneRepMax }; // Store the full entry for best of week comparisons
  });

  const dataset = [];
  dataMap.forEach((lifts, date) => {
    dataset.push({ date, ...lifts });
  });

  devLog(
    "processVisualizerDataCHAD execution time: " +
      `\x1b[1m${Math.round(performance.now() - startTime)}` +
      `ms\x1b[0m`,
  );

  return { dataset, weightMax, weightMin };
}

// This is the version that produces an array of objects per lift each with an array of line data
// But we found the tooltips work better for multiline if you have one dataset of chartData per date with whatever lifts happened on that date
function processVisualizerDataOLD(
  parsedData,
  e1rmFormula,
  selectedLiftTypes,
  timeRange,
  showAllData = false,
) {
  if (parsedData === null) {
    console.log(`Error: visualizerProcessParsedData passed null.`);
    return;
  }

  const startTime = performance.now();

  const datasets = {}; // We build chart.js datasets with the lift type as the object key
  const recentLifts = {}; // Used for weekly bests data decimation
  const decimationDaysWindow = 7; // Only chart the best e1rm in the N day window

  // Loop through the data and find the best E1RM on each date for this liftType
  parsedData.forEach((entry) => {
    const liftTypeKey = entry.liftType;

    if (entry.date < timeRange) return; // Skip if date out of range of chart

    // Skip if the lift type is not selected
    if (selectedLiftTypes && !selectedLiftTypes.includes(liftTypeKey)) {
      return;
    }

    if (entry.isGoal) return; // FIXME: implement goal dashed lines at some point

    // Lazy initialization of dataset for the lift type
    if (!datasets[liftTypeKey]) {
      const color = getLiftColor(liftTypeKey);
      const brightColor = brightenHexColor(color, 1.1);
      datasets[liftTypeKey] = {
        label: liftTypeKey,
        data: new Map(), // Using Map for efficient lookups
        color: color,
        brightColor: brightColor,
      };
    }

    const oneRepMax = estimateE1RM(entry.reps, entry.weight, e1rmFormula);
    const currentDate = new Date(entry.date);

    // Check if the current date already has a better E1RM
    if (datasets[liftTypeKey].data.has(entry.date)) {
      const currentData = datasets[liftTypeKey].data.get(entry.date);
      if (currentData.oneRepMax >= oneRepMax) {
        return; // Skip update if the existing E1RM is greater or equal
      }
    }

    // Data decimation - skip lower lifts if there was something bigger the last N day window
    if (!showAllData && recentLifts[liftTypeKey]) {
      const recentDate = new Date(recentLifts[liftTypeKey].date);
      const dayDiff = (currentDate - recentDate) / (1000 * 60 * 60 * 24);

      // Check if we already have a much better lift in the data decimation window
      if (
        dayDiff <= decimationDaysWindow &&
        oneRepMax <= recentLifts[liftTypeKey].oneRepMax * 0.95
      ) {
        return; // Skip this entry
      }
    }

    const timeStamp = new Date(entry.date).getTime(); // Convert to Unix timestamp for x-axis

    const fullEntry = {
      ...entry, // Spread the original entry to include all properties
      x: timeStamp,
      oneRepMax: oneRepMax,
      [`y_${liftTypeKey}`]: oneRepMax,
    };

    // Record this new best e1rm on this date
    datasets[liftTypeKey].data.set(entry.date, fullEntry);
    recentLifts[liftTypeKey] = fullEntry; // Store the full entry for future comparisons
  });

  // Convert object into an array of objects with the date included
  const sortedDatasets = Object.values(datasets).map((dataset) => ({
    ...dataset,
    data: Array.from(dataset.data.values()),
  }));

  devLog(
    "processVisualizerDataSHAD execution time: " +
      `\x1b[1m${Math.round(performance.now() - startTime)}` +
      `ms\x1b[0m`,
  );

  return sortedDatasets;
}

// Used in the chart card description
const getTimeRangeDescription = (timeRange, parsedData) => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-based index, January is 0

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  let timeRangeDate = new Date(timeRange);
  if (timeRange === "1900-01-01") {
    // Special case for the "All Time" category
    timeRangeDate = new Date(parsedData[0].date); // Use first user data date for "All Time" option
  }

  let month = timeRangeDate.getMonth();
  let year = timeRangeDate.getFullYear();

  return `${monthNames[month]} ${year !== currentYear ? `${year}` : ""} - ${monthNames[currentMonth]} ${currentYear}`;
};

// These are the full period targets we will use for Visualizer chart time domains
// This allows us to offer time domains on the visualizer that match the user data
// The algorithm assumes each period is longer than the next
const periodTargets = [
  {
    label: "Last 3 months",
    months: 3,
  },
  {
    label: "Last 6 months",
    months: 6,
  },
  {
    label: "Last year",
    months: 12,
  },
  {
    label: "Last 2 years",
    months: 12 * 2,
  },
  {
    label: "Last 5 years",
    months: 12 * 5,
  },
  // All Time option will be pushed manually
];

function TimeRangeSelect({ timeRange, setTimeRange }) {
  const { parsedData } = useUserLiftingData();

  // This is the first date in "YYYY-MM-DD" format
  // FIXME: Should we find the first date for selected lifts only?
  const firstDateStr = parsedData[0].date;

  const todayStr = new Date().toISOString().split("T")[0];

  let validSelectTimeDomains = [];

  periodTargets.forEach((period) => {
    const dateMonthsAgo = subMonths(new Date(), period.months);
    const thresholdDateStr = dateMonthsAgo.toISOString().split("T")[0];

    if (firstDateStr < thresholdDateStr) {
      validSelectTimeDomains.push({
        label: period.label,
        timeRangeThreshold: thresholdDateStr,
      });
    }
  });

  // Manually push "All Time" option
  validSelectTimeDomains.push({
    label: "All time",
    timeRangeThreshold: "1900-01-01",
  });

  // devLog(validSelectTimeDomains);

  return (
    <Select value={timeRange} onValueChange={setTimeRange}>
      <SelectTrigger
        className="w-[160px] rounded-lg sm:ml-auto"
        aria-label="Select a value"
      >
        <SelectValue placeholder="All time" />
      </SelectTrigger>
      <SelectContent className="rounded-xl">
        {validSelectTimeDomains.map((period) => (
          <SelectItem
            key={`${period.label}-${period.timeRangeThreshold}`}
            value={period.timeRangeThreshold}
            className="rounded-lg"
          >
            {period.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function E1RMFormulaSelect({ e1rmFormula, setE1rmFormula }) {
  return (
    <div className="flex flex-row items-center space-x-2">
      <div className="text-sm font-light">E1RM Algorithm</div>
      <Select value={e1rmFormula} onValueChange={setE1rmFormula}>
        <SelectTrigger
          className="w-[160px] rounded-lg sm:ml-auto"
          aria-label="Select a value"
        >
          <SelectValue placeholder="Brzycki" />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          {e1rmFormulae.map((formula) => (
            <SelectItem key={formula} value={formula} className="rounded-lg">
              {formula}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
