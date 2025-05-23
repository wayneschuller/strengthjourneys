"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo } from "react";
import { devLog } from "@/lib/processing-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "next-auth/react";
import { Separator } from "@/components/ui/separator";

import { getLiftColor } from "@/lib/get-lift-color";
import { useUserLiftingData } from "@/hooks/use-userlift-data";

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

import {
  LabelList,
  Pie,
  PieChart,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
  index,
  value,
  name,
}) => {
  const radius = outerRadius + 20;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="currentColor"
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      className="fill-foreground text-[12px] font-medium md:text-[14px]"
    >
      {name}
    </text>
  );
};

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

export function LiftTypeFrequencyPieCard() {
  const { liftTypes, isLoading } = useUserLiftingData();
  const { status: authStatus } = useSession();

  if (isLoading)
    return (
      <Card className="flex-1">
        <CardHeader>
          <CardTitle>Your Top Lifts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mx-auto aspect-square min-h-[250px]">
            <Skeleton className="h-full w-full rounded-full" />
          </div>
        </CardContent>
      </Card>
    );

  if (!liftTypes || liftTypes.length < 1) return null;

  // Get top 10 lifts and their colors
  const pieData = liftTypes.slice(0, 10).map((item) => ({
    liftType: item.liftType,
    sets: item.totalSets,
    color: getLiftColor(item.liftType),
    fill: getLiftColor(item.liftType),
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

  return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle>
          {authStatus === "unauthenticated" && "Demo mode: "}Your Most Frequent
          Lifts
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          // className="mx-auto aspect-square min-h-[300px]"
          className="mx-auto h-[280px] w-full max-w-[400px] sm:h-[320px] md:h-[360px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="sets"
                nameKey="liftType"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={120}
                paddingAngle={4}
                labelLine={false}
                animationBegin={200}
                animationDuration={800}
                animationEasing="ease-out"
              >
                {pieData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    className="stroke-background transition-opacity hover:opacity-80"
                    strokeWidth={2}
                  />
                ))}
                {/* <LabelList dataKey="liftType" content={renderCustomizedLabel} position="outside" /> */}
              </Pie>
              {/* <Legend verticalAlign="top" align="center" content={<CustomLegend />} /> */}
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload) return null;
                  const data = payload[0];
                  const sets = data.value;
                  const percentage = ((sets / totalSets) * 100).toFixed(1);

                  return (
                    <div className="rounded-md border bg-background p-3 shadow-lg">
                      <div key={data.name} className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                            style={{ background: data.payload.color }}
                          />
                          <div className="text-base font-semibold">
                            {data.name}
                          </div>
                        </div>
                        <div className="space-y-1 pl-6">
                          <div className="text-sm">
                            {sets} sets ({percentage}% of total)
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* <Separator className="my-6" /> */}

        <div>
          <h3 className="mb-2 text-sm font-semibold">
            Top {stats.length} Most Frequent Lifts
          </h3>
          <div className="space-y-2">
            {stats.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                    style={{ background: item.color }}
                  />
                  <span className="text-sm">{item.liftType}</span>
                </div>
                <span className="text-sm">
                  {item.sets} sets ({item.percentage}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
