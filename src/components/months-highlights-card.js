"use client";

import { useState, useEffect, useContext } from "react";
import { useSession } from "next-auth/react";
import { useUserLiftingData } from "@/lib/use-userlift-data";
import { Skeleton } from "./ui/skeleton";
import { findLiftPositionInTopLifts } from "@/lib/processing-utils";
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
  const { parsedData, topLiftsByTypeAndReps } = useUserLiftingData();
  const { status: authStatus } = useSession();

  const recentMonthHighlights = getFirstHistoricalPRsInLastMonth(
    parsedData,
    topLiftsByTypeAndReps,
  );

  return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle>
          {authStatus === "unauthenticated" && "Demo Mode: "}This Month{"'"}s
          Highlights For All Lift Types
        </CardTitle>
        <CardDescription>Core lift types are in bold.</CardDescription>
      </CardHeader>
      <CardContent className="">
        <ul>
          {!recentMonthHighlights && <Skeleton className="h-[50vh]" />}
          {recentMonthHighlights &&
            recentMonthHighlights.map((record) => (
              <li
                key={`${record.liftType}-${record.reps}-${record.date}`}
                className="flex justify-between gap-2 py-1 md:flex-row md:py-0"
              >
                <div className="">
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
                </div>
                <div className="text-right">
                  {record.prSentenceReport && `${record.prSentenceReport}`}
                </div>
              </li>
            ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// Return a list of (up to 10) entries from the last month that are marked as historical PRs.
// FIXME: this could more intelligently select the top 10 highlights - prioritise reps 1, 3, 5, 10 if needed
function getFirstHistoricalPRsInLastMonth(parsedData, topLiftsByTypeAndReps) {
  if (!parsedData) return null;
  const startTime = performance.now();

  const today = new Date();
  const lastMonth = new Date(today);
  lastMonth.setMonth(today.getMonth() - 1);

  // Filter records that are historical PRs and fall within the last month
  const historicalPRsInLastMonth = parsedData.filter((entry) => {
    return (
      entry.isHistoricalPR &&
      new Date(entry.date) >= lastMonth &&
      new Date(entry.date) <= today
    );
  });

  // Create a map to store the first historical PR for each lift type and reps combination
  const firstPRsMap = new Map();

  for (let i = historicalPRsInLastMonth.length - 1; i >= 0; i--) {
    let entry = historicalPRsInLastMonth[i];
    const key = `${entry.liftType}-${entry.reps}`;

    // Grab our little emoji report if it was a top lift
    const { prIndex, prSentenceReport } = findLiftPositionInTopLifts(
      entry,
      topLiftsByTypeAndReps,
    );

    entry = { ...entry, prIndex: prIndex, prSentenceReport: prSentenceReport };

    // If no record for this combination, store it as the first historical PR
    if (!firstPRsMap.has(key)) {
      firstPRsMap.set(key, entry);
    }
  }

  const firstPRs = Array.from(firstPRsMap.values()).slice(0, 10); // Grab the first 10 only

  devLog(
    `getFirstHistoricalPRsInLastMonth() execution time: ` +
      `\x1b[1m${Math.round(performance.now() - startTime)}ms\x1b[0m`,
  );

  return firstPRs;
}
