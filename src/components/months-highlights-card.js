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
  const { parsedData, selectedLiftTypes } = useContext(ParsedDataContext);
  const { status } = useSession();
  const { isLoading } = useUserLiftData();

  // FIXME: if possible try to put this skeleton inside the card we will already use
  if (!parsedData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>This Month{"'"}s Highlights</CardTitle>
          <CardDescription>Core lift types are in bold.</CardDescription>
        </CardHeader>
        <CardContent className="">
          <Skeleton className="flex h-[50vh] flex-1" />
        </CardContent>
      </Card>
    );
  }

  // FIXME: these stats are rubbish - convert to the topSetsByLiftsAndReps in global context
  const historicalPRs = getFirstHistoricalPRsInLastMonth(parsedData);

  return (
    <Card className="hover:ring-1">
      <CardHeader>
        <CardTitle>
          {status === "unauthenticated" && "Demo Mode: "}This Month{"'"}s
          Highlights
        </CardTitle>
        <CardDescription>Core lift types are in bold.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <ul>
          {historicalPRs.map((record) => (
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
              </strong>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// Function to get top lifts for different rep ranges for a specified lift type
function getLiftTypePRs(parsedData, liftType) {
  const startTime = performance.now();

  // Initialize liftTypePRs array with empty arrays for each rep range (0 to 10)
  const liftTypePRs = Array.from({ length: 11 }, () => []);

  // Filter entries for the specified lift type
  const liftTypeEntries = parsedData.filter(
    (entry) => entry.liftType === liftType,
  );

  // Sort entries based on weight in descending order
  const sortedEntries = liftTypeEntries.sort((a, b) => b.weight - a.weight);

  // Populate liftTypePRs array for each rep range
  for (let reps = 1; reps <= 10; reps++) {
    const liftTypeEntriesForReps = sortedEntries.filter(
      (entry) => entry.reps === reps,
    );
    liftTypePRs[reps] = liftTypeEntriesForReps.slice(0, 20);
  }

  devLog(
    `getLiftTypePRs(${liftType}) execution time: ` +
      `\x1b[1m${Math.round(performance.now() - startTime)}` +
      `ms\x1b[0m`,
  );
  return liftTypePRs;
}

export const getHistoricalPRsInLastMonth = (parsedData) => {
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

  return historicalPRsInLastMonth;
};

export const getFirstHistoricalPRsInLastMonth = (parsedData) => {
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

  return firstPRs;
};
