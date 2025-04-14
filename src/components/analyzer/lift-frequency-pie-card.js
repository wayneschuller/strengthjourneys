"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo } from "react";
import { devLog } from "@/lib/processing-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "next-auth/react";

import { getLiftColor } from "@/lib/get-lift-color";
import { useUserLiftingData } from "@/lib/use-userlift-data";

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

import { LabelList, Pie, PieChart } from "recharts";

export function LiftTypeFrequencyPieCard() {
  const { liftTypes, isLoading } = useUserLiftingData();
  const { status: authStatus } = useSession();

  if (isLoading) return null;
  if (!liftTypes || liftTypes.length < 1) return null;

  // Get top 5 lifts and their colors
  const pieData = liftTypes.slice(0, 5).map((item) => ({
    liftType: item.liftType,
    sets: item.totalSets,
    color: getLiftColor(item.liftType),
    fill: getLiftColor(item.liftType),
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

  return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle>
          {authStatus === "unauthenticated" && "Demo mode: "} Your Top{" "}
          {pieData?.length > 0 ? pieData.length : ""} Lifts
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square min-h-[250px]"
        >
          <PieChart>
            <Pie
              data={pieData}
              dataKey="sets"
              nameKey="liftType"
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={80}
              paddingAngle={2}
            >
              <LabelList
                dataKey="liftType"
                position="outside"
                className="fill-foreground"
              />
            </Pie>
            <ChartTooltip
              content={({ active, payload }) => {
                if (!active || !payload) return null;
                return (
                  <ChartTooltipContent>
                    {payload.map((entry) => (
                      <div key={entry.name} className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{ background: entry.payload.color }}
                          />
                          <div>{entry.name}</div>
                        </div>
                        <div className="font-bold">{entry.value} sets</div>
                      </div>
                    ))}
                  </ChartTooltipContent>
                );
              }}
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
