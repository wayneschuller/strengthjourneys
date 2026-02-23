"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { cn } from "@/lib/utils";

import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useLiftColors } from "@/hooks/use-lift-colors";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

import {
  Pie,
  PieChart,
  Cell,
  Sector,
  BarChart,
  Bar,
  XAxis,
} from "recharts";

const bigFourURLs = {
  "Back Squat": "/barbell-squat-insights",
  "Bench Press": "/barbell-bench-press-insights",
  Deadlift: "/barbell-deadlift-insights",
  "Strict Press": "/barbell-strict-press-insights",
};

const RADIAN = Math.PI / 180;
const SUBTLE_CHART_OUTLINE = "hsl(var(--foreground) / 0.28)";
const STRONG_CHART_OUTLINE = "hsl(var(--foreground) / 0.65)";

function ActivePieSliceShape(props) {
  return (
    <g style={{ filter: "drop-shadow(0 3px 8px hsl(var(--foreground) / 0.18))" }}>
      <Sector
        {...props}
        outerRadius={(props.outerRadius ?? 0) + 6}
        stroke={STRONG_CHART_OUTLINE}
        strokeWidth={4}
        strokeLinejoin="round"
      />
    </g>
  );
}

const renderCustomizedLabel = ({
  cx,
  cy,
  midAngle,
  outerRadius,
  percent,
  name,
}) => {
  if (!percent || percent < 0.035) return null;

  const cos = Math.cos(-midAngle * RADIAN);
  const sin = Math.sin(-midAngle * RADIAN);
  const sx = cx + (outerRadius + 2) * cos;
  const sy = cy + (outerRadius + 2) * sin;
  const mx = cx + (outerRadius + 10) * cos;
  const my = cy + (outerRadius + 14) * sin;
  const ex = mx + (cos >= 0 ? 7 : -7);
  const ey = my;
  const textAnchor = cos >= 0 ? "start" : "end";

  return (
    <g>
      <path
        d={`M ${sx} ${sy} L ${mx} ${my} L ${ex} ${ey}`}
        fill="none"
        stroke="hsl(var(--muted-foreground) / 0.45)"
        strokeWidth={1.25}
      />
      <text
        x={ex + (cos >= 0 ? 2 : -2)}
        y={ey}
        textAnchor={textAnchor}
        dominantBaseline="central"
        className="fill-foreground text-[11px] font-medium md:text-[12px]"
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
                "cursor-pointer rounded-md outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/50",
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
              <td className="whitespace-nowrap py-1 text-right text-sm">
                {item.reps.toLocaleString()} reps
              </td>
              <td className="whitespace-nowrap py-1 text-right text-sm">
                {item.sets} sets ({item.percentage}%)
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

function parseDateUTC(ymd) {
  if (!ymd) return null;
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateShortUTC(date, cadence) {
  if (!(date instanceof Date)) return "";
  if (cadence === "year") {
    return String(date.getUTCFullYear());
  }
  if (cadence === "quarter") {
    const q = Math.floor(date.getUTCMonth() / 3) + 1;
    return `Q${q} ${String(date.getUTCFullYear()).slice(-2)}`;
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}

function startOfBucketUTC(date, cadence) {
  const d = new Date(date);
  if (cadence === "week") {
    const day = d.getUTCDay(); // 0=Sun
    const mondayOffset = (day + 6) % 7;
    d.setUTCDate(d.getUTCDate() - mondayOffset);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }
  if (cadence === "month") {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  }
  if (cadence === "quarter") {
    const qMonth = Math.floor(d.getUTCMonth() / 3) * 3;
    return new Date(Date.UTC(d.getUTCFullYear(), qMonth, 1));
  }
  return new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
}

function addBucketUTC(date, cadence, count = 1) {
  const d = new Date(date);
  if (cadence === "week") {
    d.setUTCDate(d.getUTCDate() + count * 7);
    return d;
  }
  if (cadence === "month") {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + count, 1));
  }
  if (cadence === "quarter") {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + count * 3, 1));
  }
  return new Date(Date.UTC(d.getUTCFullYear() + count, 0, 1));
}

function bucketKeyUTC(date, cadence) {
  const d = startOfBucketUTC(date, cadence);
  return d.toISOString().slice(0, 10);
}

function countBucketsInRange(firstDate, lastDate, cadence) {
  let count = 0;
  let current = startOfBucketUTC(firstDate, cadence);
  const end = startOfBucketUTC(lastDate, cadence);
  while (current <= end && count < 5000) {
    count += 1;
    current = addBucketUTC(current, cadence, 1);
  }
  return count;
}

function chooseCadence(firstDate, lastDate, targetBars = 10) {
  const options = ["week", "month", "quarter", "year"];
  const scored = options.map((cadence) => {
    const count = countBucketsInRange(firstDate, lastDate, cadence);
    const distance = Math.abs(count - targetBars);
    const lowPenalty = count < 4 ? (4 - count) * 3 : 0;
    const highPenalty = count > 14 ? (count - 14) * 0.6 : 0;
    return {
      cadence,
      count,
      score: distance + lowPenalty + highPenalty,
    };
  });

  scored.sort((a, b) => a.score - b.score);
  return scored[0]?.cadence ?? "month";
}

function buildLiftChronology(parsedData, liftType, targetBars = 10) {
  if (!parsedData?.length || !liftType) return null;

  const validEntries = parsedData.filter((entry) => !entry.isGoal && entry.date);
  if (!validEntries.length) return null;

  const firstDate = parseDateUTC(validEntries[0].date);
  const lastDate = parseDateUTC(validEntries[validEntries.length - 1].date);
  if (!firstDate || !lastDate) return null;

  const totalWeeks = countBucketsInRange(firstDate, lastDate, "week");
  if (totalWeeks < 10) return null;

  const cadence = chooseCadence(firstDate, lastDate, targetBars);
  const sums = new Map();

  parsedData.forEach((entry) => {
    if (entry.isGoal) return;
    if (entry.liftType !== liftType) return;
    if (typeof entry.reps !== "number") return;
    const d = parseDateUTC(entry.date);
    if (!d) return;
    const key = bucketKeyUTC(d, cadence);
    sums.set(key, (sums.get(key) ?? 0) + (entry.reps ?? 0));
  });

  const bars = [];
  let cursor = startOfBucketUTC(firstDate, cadence);
  const end = startOfBucketUTC(lastDate, cadence);
  let i = 0;
  while (cursor <= end && i < 5000) {
    const key = cursor.toISOString().slice(0, 10);
    bars.push({
      bucket: key,
      label: formatDateShortUTC(cursor, cadence),
      reps: sums.get(key) ?? 0,
      index: i,
    });
    cursor = addBucketUTC(cursor, cadence, 1);
    i += 1;
  }

  const maxReps = bars.reduce((m, b) => Math.max(m, b.reps), 0);
  const nonZeroBars = bars.filter((b) => b.reps > 0).length;
  const hasAnyLiftData = nonZeroBars > 0;

  if (!hasAnyLiftData) return null;

  return {
    cadence,
    bars,
    maxReps,
    nonZeroBars,
    startLabel: formatDateShortUTC(bars[0] ? parseDateUTC(bars[0].bucket) : firstDate, cadence),
    endLabel: formatDateShortUTC(
      bars[bars.length - 1] ? parseDateUTC(bars[bars.length - 1].bucket) : lastDate,
      cadence,
    ),
  };
}

function MiniLiftChronologyChart({ liftType, color, chronology }) {
  if (!liftType || !chronology?.bars?.length) return null;

  const chartConfig = {
    reps: {
      label: "Reps",
      color,
    },
  };

  return (
    <ChartContainer
      config={chartConfig}
      className="mt-1 mb-5 h-[72px] w-full select-none !aspect-auto [&_.recharts-surface]:focus:outline-none [&_.recharts-surface]:focus-visible:outline-none"
      onMouseDownCapture={(e) => e.preventDefault()}
    >
        <BarChart data={chronology.bars} margin={{ top: 6, right: 2, left: 2, bottom: 4 }}>
          <XAxis dataKey="label" hide />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const item = payload?.[0]?.payload;
                  if (!item) return "";
                  return item.label;
                }}
                formatter={(value) => (
                  <div className="flex w-full items-center justify-between gap-3">
                    <span className="text-muted-foreground">Reps</span>
                    <span className="font-mono font-medium tabular-nums">
                      {Number(value).toLocaleString()}
                    </span>
                  </div>
                )}
              />
            }
          />
          <Bar dataKey="reps" radius={[2, 2, 0, 0]} fill={color} fillOpacity={0.75}>
            {chronology.bars.map((bar, index) => (
              <Cell
                key={`mini-bar-${index}`}
                fill={color}
                opacity={bar.reps > 0 ? 0.9 : 0.12}
                stroke={SUBTLE_CHART_OUTLINE}
                strokeWidth={bar.reps > 0 ? 1.25 : 0.75}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
  );
}

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
        </CardContent>
      </Card>
    );

  if (!liftTypes || liftTypes.length < 1) return null;

  // Get reactive colors for top 10 lifts
  const topLifts = liftTypes.slice(0, 10);
  const liftColors = {};
  topLifts.forEach((item) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const color = getColor(item.liftType);
    liftColors[item.liftType] = color;
  });

  // Get top 10 lifts and their colors
  const pieData = topLifts.map((item) => ({
    liftType: item.liftType,
    sets: item.totalSets,
    reps: item.totalReps,
    color: liftColors[item.liftType],
    fill: liftColors[item.liftType],
  }));

  // Calculate total sets for percentage
  const totalSets = pieData.reduce((sum, item) => sum + item.sets, 0);

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
  const activePieIndex = explicitSelectedLiftType
    ? pieData.findIndex((item) => item.liftType === explicitSelectedLiftType)
    : -1;

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
      <CardContent className="flex flex-1 flex-col">
        <ChartContainer
          config={chartConfig}
          // className="mx-auto aspect-square min-h-[300px]"
          className="mx-auto h-[280px] w-full max-w-[440px] sm:h-[310px] md:h-[330px]"
        >
            <PieChart>
              <Pie
                data={pieData}
                dataKey="sets"
                nameKey="liftType"
                cx="50%"
                cy="52%"
                innerRadius={60}
                outerRadius={108}
                paddingAngle={4}
                label={renderCustomizedLabel}
                labelLine={false}
                animationBegin={200}
                animationDuration={800}
                animationEasing="ease-out"
                activeIndex={activePieIndex >= 0 ? activePieIndex : undefined}
                activeShape={ActivePieSliceShape}
                onClick={(data) => setSelectedLiftType(data?.liftType ?? null)}
              >
                {pieData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    className="cursor-pointer transition-opacity"
                    stroke={
                      explicitSelectedLiftType === entry.liftType
                        ? STRONG_CHART_OUTLINE
                        : SUBTLE_CHART_OUTLINE
                    }
                    strokeWidth={
                      explicitSelectedLiftType === entry.liftType ? 4 : 2.5
                    }
                    strokeLinejoin="round"
                    opacity={
                      !explicitSelectedLiftType ||
                      explicitSelectedLiftType === entry.liftType
                        ? 1
                        : 0.7
                    }
                  />
                ))}
                {/* <LabelList dataKey="liftType" content={renderCustomizedLabel} position="outside" /> */}
              </Pie>
              {/* <Legend verticalAlign="top" align="center" content={<CustomLegend />} /> */}
            </PieChart>
        </ChartContainer>

        <MiniLiftChronologyChart
          liftType={effectiveSelectedLiftType}
          color={selectedLiftColor}
          chronology={selectedLiftChronology}
        />

        <TopLiftsTable
          stats={stats}
          selectedLiftType={effectiveSelectedLiftType}
          onSelectLift={setSelectedLiftType}
        />
      </CardContent>
    </Card>
  );
}
