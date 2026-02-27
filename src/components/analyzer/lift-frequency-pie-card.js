import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { MiniFeedbackWidget } from "@/components/feedback";

import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useLiftColors } from "@/hooks/use-lift-colors";

import { ChartContainer } from "@/components/ui/chart";

import { Pie, PieChart, Cell } from "recharts";

import {
  buildLiftChronology,
  MiniLiftChronologyChart,
} from "@/components/mini-lift-chronology-chart";

const bigFourURLs = {
  "Back Squat": "/barbell-squat-insights",
  "Bench Press": "/barbell-bench-press-insights",
  Deadlift: "/barbell-deadlift-insights",
  "Strict Press": "/barbell-strict-press-insights",
};

const RADIAN = Math.PI / 180;
const SUBTLE_CHART_OUTLINE = "var(--muted-foreground)";
const STRONG_CHART_OUTLINE = "var(--muted-foreground)";
const HOVER_CHART_OUTLINE = "var(--muted-foreground)";

const renderCustomizedLabel = (
  { cx, cy, midAngle, outerRadius, name, payload },
  selectedLiftType,
) => {
  const cos = Math.cos(-midAngle * RADIAN);
  const sin = Math.sin(-midAngle * RADIAN);
  const sx = cx + (outerRadius + 2) * cos;
  const sy = cy + (outerRadius + 2) * sin;
  const mx = cx + (outerRadius + 10) * cos;
  const my = cy + (outerRadius + 14) * sin;
  const ex = mx + (cos >= 0 ? 7 : -7);
  const ey = my;
  const textAnchor = cos >= 0 ? "start" : "end";
  const isSelected = payload?.liftType === selectedLiftType;

  return (
    <g>
      <path
        d={`M ${sx} ${sy} L ${mx} ${my} L ${ex} ${ey}`}
        fill="none"
        stroke="var(--muted-foreground)"
        strokeOpacity={0.45}
        strokeWidth={1.25}
      />
      <text
        x={ex + (cos >= 0 ? 2 : -2)}
        y={ey}
        textAnchor={textAnchor}
        dominantBaseline="central"
        className={cn(
          "fill-foreground text-[11px] md:text-[12px]",
          isSelected ? "font-bold" : "font-medium",
        )}
      >
        {name}
      </text>
    </g>
  );
};

// Custom recharts legend rendering color swatches and lift names in a wrapping flex row.
const CustomLegend = ({ payload }) => {
  return (
    <div className="mt-4 flex flex-wrap justify-center gap-4">
      {payload.map((entry, index) => (
        <div key={`legend-${index}`} className="flex items-center gap-2">
          <div
            // className="h-3 w-3 rounded-md"
            className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
            style={{ background: entry.color }}
          />
          <span className="text-sm">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

// Tabular list of top lifts showing color swatch, name (linked for big-four), reps, and set percentage.
const TopLiftsTable = ({ stats, selectedLiftType, onSelectLift }) => {
  return (
    <div>
      <table className="w-full">
        <tbody>
          {stats.map((item, index) => (
            <tr
              key={index}
              onClick={() => onSelectLift?.(item.liftType)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectLift?.(item.liftType);
                }
              }}
              tabIndex={0}
              className={cn(
                "hover:bg-muted/40 focus-visible:bg-muted/50 cursor-pointer rounded-md transition-colors outline-none",
                selectedLiftType === item.liftType && "bg-muted/60",
              )}
              aria-label={`Show ${item.liftType} reps over time`}
            >
              <td className="py-1">
                <div className="flex min-w-0 items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                    style={{ background: item.color }}
                  />
                  {bigFourURLs[item.liftType] ? (
                    <Link
                      href={bigFourURLs[item.liftType]}
                      className="truncate text-sm underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {item.liftType}
                    </Link>
                  ) : (
                    <span className="truncate text-sm">{item.liftType}</span>
                  )}
                </div>
              </td>
              <td className="py-1 text-right text-sm whitespace-nowrap">
                {item.reps.toLocaleString()} reps
              </td>
              <td className="py-1 text-right text-sm whitespace-nowrap">
                {item.sets} sets ({item.percentage}%)
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};


/**
 * Card showing a donut pie chart of the top 10 most frequent lift types by set count,
 * with an interactive tooltip and a summary table below the chart.
 * Reads liftTypes from UserLiftingDataProvider; takes no props.
 *
 * @param {Object} props
 */
export function LiftTypeFrequencyPieCard() {
  const { liftTypes, parsedData, isLoading } = useUserLiftingData();
  const { status: authStatus } = useSession();
  const { getColor } = useLiftColors();
  const [selectedLiftType, setSelectedLiftType] = useState(null);
  const [hoveredLiftType, setHoveredLiftType] = useState(null);

  if (isLoading)
    return (
      <Card className="flex h-full flex-1 flex-col">
        <CardHeader>
          <CardTitle>Your Top Lifts</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col">
          <div className="mx-auto aspect-square min-h-[250px]">
            <Skeleton className="h-full w-full rounded-full" />
          </div>
          <div className="mx-auto mt-5 mb-5 h-[72px] w-full max-w-[440px]">
            <Skeleton className="h-full w-full" />
          </div>
        </CardContent>
      </Card>
    );

  if (!liftTypes || liftTypes.length < 1) return null;

  // Get reactive colors for top 10 lifts
  const topLifts = liftTypes.slice(0, 10);
  const liftColors = {};
  topLifts.forEach((item) => {
    const color = getColor(item.liftType);
    liftColors[item.liftType] = color;
  });

  // Get top 10 lifts and their colors
  let pieData = topLifts.map((item) => ({
    liftType: item.liftType,
    sets: item.totalSets,
    reps: item.totalReps,
    color: liftColors[item.liftType],
    fill: liftColors[item.liftType],
  }));

  // Calculate total sets for percentage
  const totalSets = pieData.reduce((sum, item) => sum + item.sets, 0);
  pieData = pieData.map((item) => ({
    ...item,
    percentageValue: totalSets > 0 ? item.sets / totalSets : 0,
  }));

  // Create chart config for shadcn chart
  const chartConfig = {
    sets: {
      label: "Sets",
    },
    ...pieData.reduce((config, lift) => {
      config[lift.liftType] = {
        label: lift.liftType,
        color: lift.color,
      };
      return config;
    }, {}),
  };

  // Calculate statistics
  const stats = pieData.map((item) => ({
    ...item,
    percentage: ((item.sets / totalSets) * 100).toFixed(1),
  }));

  const effectiveSelectedLiftType =
    stats.find((item) => item.liftType === selectedLiftType)?.liftType ??
    stats[0]?.liftType ??
    null;
  const explicitSelectedLiftType =
    stats.find((item) => item.liftType === selectedLiftType)?.liftType ?? null;

  const selectedLiftColor =
    stats.find((item) => item.liftType === effectiveSelectedLiftType)?.color ??
    "#3b82f6";

  const selectedLiftChronology = buildLiftChronology(
    parsedData,
    effectiveSelectedLiftType,
    10,
  );

  return (
    <Card className="flex h-full flex-1 flex-col">
      <CardHeader>
        <CardTitle>
          {authStatus === "unauthenticated" && "Demo mode: "}Your Most Frequent
          Lifts
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col pt-0">
        <ChartContainer
          config={chartConfig}
          // className="mx-auto aspect-square min-h-[300px]"
          className="mx-auto h-[248px] w-full max-w-[440px] sm:h-[278px] md:h-[292px]"
        >
          <PieChart>
            <Pie
              data={pieData}
              dataKey="sets"
              nameKey="liftType"
              cx="50%"
              cy="46%"
              innerRadius={60}
              outerRadius={108}
              paddingAngle={4}
              label={(props) =>
                renderCustomizedLabel(props, explicitSelectedLiftType)
              }
              labelLine={false}
              isAnimationActive={false}
              onMouseLeave={() => setHoveredLiftType(null)}
              onMouseEnter={(data) =>
                setHoveredLiftType(data?.liftType ?? null)
              }
              onClick={(data) => setSelectedLiftType(data?.liftType ?? null)}
            >
              {pieData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  className="cursor-pointer transition-opacity"
                  stroke={
                    hoveredLiftType === entry.liftType
                      ? HOVER_CHART_OUTLINE
                      : explicitSelectedLiftType === entry.liftType
                        ? STRONG_CHART_OUTLINE
                        : SUBTLE_CHART_OUTLINE
                  }
                  strokeWidth={
                    hoveredLiftType === entry.liftType
                      ? 1.75
                      : explicitSelectedLiftType === entry.liftType
                        ? 1.5
                        : 1
                  }
                  strokeLinejoin="round"
                  strokeOpacity={
                    hoveredLiftType === entry.liftType
                      ? 1
                      : explicitSelectedLiftType === entry.liftType
                        ? 1
                        : 0.3
                  }
                  opacity={1}
                />
              ))}
              {/* <LabelList dataKey="liftType" content={renderCustomizedLabel} position="outside" /> */}
            </Pie>
            {/* <Legend verticalAlign="top" align="center" content={<CustomLegend />} /> */}
          </PieChart>
        </ChartContainer>

        {selectedLiftChronology ? (
          <MiniLiftChronologyChart
            liftType={effectiveSelectedLiftType}
            color={selectedLiftColor}
            chronology={selectedLiftChronology}
          />
        ) : (
          <div className="mx-auto mb-5 h-[72px] w-full max-w-[440px]">
            <Skeleton className="h-full w-full" />
          </div>
        )}

        <TopLiftsTable
          stats={stats}
          selectedLiftType={effectiveSelectedLiftType}
          onSelectLift={setSelectedLiftType}
        />
      </CardContent>
      <CardFooter className="pt-0">
        <MiniFeedbackWidget
          prompt="Useful card?"
          contextId="lift_frequency_pie_card"
          page="/analyzer"
          analyticsExtra={{ context: "lift_frequency_pie_card" }}
        />
      </CardFooter>
    </Card>
  );
}
