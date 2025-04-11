"use client";

import { useMemo, useEffect } from "react";
import { getLiftColor } from "@/lib/get-lift-color";
import { SidePanelSelectLiftsButton } from "../side-panel-lift-chooser";
import { useUserLiftingData } from "@/lib/use-userlift-data";
import { useLocalStorage, useWindowSize } from "usehooks-ts";
import { useSession } from "next-auth/react";
import { devLog, getReadableDateString } from "@/lib/processing-utils";
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

export function VisualizerShadcn({ setHighlightDate }) {
  const { parsedData, selectedLiftTypes } = useUserLiftingData();
  const { status: authStatus } = useSession();

  // devLog(parsedData);

  const [timeRange, setTimeRange] = useLocalStorage(
    "SJ_timeRange",
    "MAX", // MAX, 3M, 6M, 1Y, 2Y, 5Y etc.
    {
      initializeWithValue: false,
    },
  );

  const [showLabelValues, setShowLabelValues] = useLocalStorage(
    "SJ_showLabelValues",
    false,
  );
  const [showAllData, setShowAllData] = useLocalStorage("SJ_showAllData", true); // Show weekly bests or all data
  const [e1rmFormula, setE1rmFormula] = useLocalStorage("formula", "Brzycki");

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
      ),
    [parsedData, e1rmFormula, selectedLiftTypes, timeRange, showAllData],
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

  const handleMouseMove = (event) => {
    if (event && event.activePayload) {
      const activeIndex = event.activeTooltipIndex;
      // devLog(event);
      // setHighlightDate(event.activeLabel);
      setHighlightDate(event.activePayload[0]?.payload?.date); // Set the date string payload precisely
    }
  };

  let tickJump = 100; // 100 for pound jumps on y-Axis.
  if (chartData?.[0]?.unitType === "kg") tickJump = 50; // 50 for kg jumps on y-Axis

  // FIXME: We need more dynamic x-axis ticks
  const formatXAxisDateString = (tickItem) => {
    const date = new Date(tickItem);
    return date.toLocaleString("en-US", { month: "short", day: "numeric" });
  };

  // const MultiLiftTooltipContent = ({
  //   active,
  //   payload,
  //   label,
  //   selectedLiftTypes,
  // }) => {
  //   // devLog(payload);
  //   if (active && payload && payload.length) {
  //     // Right now we have put key info into the chartData paylod. But we could simply lookup the date in parsedData/topLifts for info
  //     const tuple = payload[0].payload;

  //     // devLog(tuple);
  //     const dateLabel = getReadableDateString(tuple.date);
  //     const tooltipsPerLift = [];

  //     selectedLiftTypes.forEach((liftType) => {
  //       const reps = tuple[`${liftType}_reps`];
  //       const weight = tuple[`${liftType}_weight`];
  //       const oneRepMax = tuple[`${liftType}`];
  //       const unitType = tuple.unitType;

  //       if (reps && weight && oneRepMax) {
  //         let labelContent = "";
  //         if (reps === 1) {
  //           labelContent = `Lifted ${reps}@${weight}${unitType}`;
  //         } else {
  //           labelContent = `Potential 1@${oneRepMax}${unitType} from lifting ${reps}@${weight}${unitType}`;
  //         }

  //         const color = getLiftColor(liftType);
  //         tooltipsPerLift.push({
  //           liftType: liftType,
  //           label: labelContent,
  //           color: color,
  //           reps: reps,
  //         });
  //       }
  //     });

  //     // devLog(liftLabels);

  //     return (
  //       <div className="grid min-w-[8rem] max-w-[24rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
  //         <p className="font-bold">{dateLabel}</p>
  //         {tooltipsPerLift.map(({ liftType, label, color, reps, index }) => (
  //           <div key={liftType}>
  //             <div className="flex flex-row items-center">
  //               <div
  //                 className="mr-1 h-2.5 w-2.5 shrink-0 rounded-[2px]"
  //                 style={{ backgroundColor: color }} // Use css style because tailwind is picky
  //               />
  //               <div className="font-semibold">{liftType}</div>
  //             </div>
  //             <div className="">{label}</div>
  //           </div>
  //         ))}
  //       </div>
  //     );
  //   }

  //   return null;
  // };

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
          <SidePanelSelectLiftsButton />
          <TimeRangeSelect timeRange={timeRange} setTimeRange={setTimeRange} />
        </div>
      </CardHeader>

      <CardContent className="pl-0 pr-2">
        <ChartContainer config={chartConfig} className="">
          <AreaChart
            accessibilityLayer
            data={chartData}
            margin={{ left: 5, right: 20 }}
            onMouseMove={handleMouseMove}
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
                (value) => `${value}${chartData[0]?.unitType || ""}` // Default to first item's unitType
              }
              ticks={Array.from(
                { length: Math.ceil(roundedMaxWeightValue / tickJump) },
                (v, i) => i * tickJump,
              )}
              // allowDataOverflow
            />
            <Tooltip
              content={
                <MultiLiftTooltipContent
                  selectedLiftTypes={selectedLiftTypes}
                  e1rmFormula={e1rmFormula}
                />
              }
              formatter={(value, name, props) =>
                `${value} ${props.payload.unitType}`
              }
              position={{ y: 10 }}
              cursor={{
                stroke: "#8884d8",
                strokeWidth: 2,
                strokeDasharray: "5 5",
              }} // Recharts tooltip cursor is the vertical reference line that follows the mouse
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
                  dataKey={liftType}
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
                      content={({ x, y, value, index }) => (
                        <text
                          x={x}
                          y={y}
                          dy={-10}
                          fontSize={12}
                          textAnchor="middle"
                          className="fill-foreground"
                        >
                          {`${value}${chartData[index].unitType}`}
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
