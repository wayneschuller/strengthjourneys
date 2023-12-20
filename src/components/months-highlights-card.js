"use client";

import { useState, useEffect, useContext } from "react";
import { ParsedDataContext } from "@/pages/_app";
import { useSession } from "next-auth/react";
import { useUserLiftData } from "@/lib/use-userlift-data";
import { Skeleton } from "./ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  coreLiftTypes,
  devLog,
  getReadableDateString,
} from "@/lib/processing-utils";

export function MonthsHighlightsCard() {
  const { parsedData } = useContext(ParsedDataContext);
  const { status: authStatus } = useSession();
  const { isLoading } = useUserLiftData();

  // FIXME: these stats are rubbish - convert to the topSetsByLiftsAndReps in global context
  const historicalPRs = getFirstHistoricalPRsInLastMonth(parsedData);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {authStatus !== "authenticated" && "Demo Mode: "}This Month{"'"}s
          Highlights For All Lift Types
        </CardTitle>
        <CardDescription>Core lift types are in bold.</CardDescription>
      </CardHeader>
      <CardContent className="">
        <ul>
          {!historicalPRs && <Skeleton className="h-[50vh]" />}
          {historicalPRs &&
            historicalPRs.map((record) => (
              <li key={`${record.liftType}-${record.reps}-${record.date}`}>
                <strong
                  className={
                    coreLiftTypes.includes(record.liftType)
                      ? "font-bold"
                      : "font-normal"
                  }
                >
                  {record.liftType} {record.reps}@{record.weight}
                  {record.unitType} ({getReadableDateString(record.date)})
                </strong>{" "}
                (hi)
              </li>
            ))}
        </ul>
      </CardContent>
    </Card>
  );
}

const getFirstHistoricalPRsInLastMonth = (parsedData) => {
  const startTime = performance.now();
  if (!parsedData) return null;

  const today = new Date();
  const lastMonth = new Date(today);
  lastMonth.setMonth(today.getMonth() - 1);

  // Filter records that are historical PRs and fall within the last month
  const historicalPRsInLastMonth = parsedData.filter((record) => {
    return (
      record.isHistoricalPR &&
      new Date(record.date) >= lastMonth &&
      new Date(record.date) <= today
    );
  });

  // Create a map to store the first historical PR for each lift type and reps combination
  const firstPRsMap = new Map();

  for (let i = historicalPRsInLastMonth.length - 1; i >= 0; i--) {
    const record = historicalPRsInLastMonth[i];
    const key = `${record.liftType}-${record.reps}`;

    // If no record for this combination, store it as the first historical PR
    if (!firstPRsMap.has(key)) {
      firstPRsMap.set(key, record);
    }
  }

  const firstPRs = Array.from(firstPRsMap.values());

  devLog(
    `getFirstHistoricalPRsInLastMonth() execution time: ` +
      `\x1b[1m${Math.round(performance.now() - startTime)}ms\x1b[0m`,
  );

  return firstPRs;
};
