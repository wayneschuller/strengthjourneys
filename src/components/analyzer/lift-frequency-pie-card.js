"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useContext, useState, useEffect } from "react";
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
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";

import { LabelList, Pie, PieChart } from "recharts";

export function LiftTypeFrequencyPieCard() {
  const { liftTypes, isLoading } = useUserLiftingData();
  const { status: authStatus } = useSession();

  if (isLoading) return;
  if (!liftTypes || liftTypes.length < 1) return;

  const pieData = liftTypes
    ?.map((item) => ({
      liftType: item.liftType,
      sets: item.totalSets,
      color: getLiftColor(item.liftType),
      fill: getLiftColor(item.liftType),
    }))
    .slice(0, 5); // Up to 5 lifts

  // devLog(liftTypes);
  // devLog(pieData);

  const chartConfig = {
    sets: {
      label: "Sets",
    },
    ...pieData.reduce((config, lift) => {
      config[lift.liftType] = {
        label: lift.liftType,
        color: getLiftColor(lift.liftType),
      };
      return config;
    }, {}),
  };

  const chartData = pieData;

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
            <ChartTooltip
              content={<ChartTooltipContent nameKey="liftType" />}
            />
            <Pie data={chartData} dataKey="sets" />
            <ChartLegend
              content={<ChartLegendContent nameKey="liftType" />}
              className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center"
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
