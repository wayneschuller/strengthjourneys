"use client";

import { useState, useEffect, useContext } from "react";
import { ParsedDataContext } from "@/pages/_app";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { coreLiftTypes, devLog } from "@/lib/SJ-utils";
import { getReadableDateString } from "@/lib/SJ-utils";

const MonthsHighlightsCard = () => {
  const { parsedData, selectedLiftTypes } = useContext(ParsedDataContext);
  if (!parsedData) return;
  if (!selectedLiftTypes) return;

  // devLog(`Monthly:`);
  // devLog(selectedLiftsPRs);
  // FIXME: put an isLoading skeleton in here internally?
  // {isLoading && (
  //   <div className="flex">
  //     <Skeleton className="h-36 w-11/12 flex-1" />
  //   </div>
  // )}
  const historicalPRs = getFirstHistoricalPRsInLastMonth(parsedData);

  return (
    <Card>
      <CardHeader>
        <CardTitle>This Month{"'"}s Highlights</CardTitle>
        <CardDescription>Core lift types are in bold.</CardDescription>
      </CardHeader>
      <CardContent>
        {/* ooh yeah */}

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
};

export default MonthsHighlightsCard;

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
