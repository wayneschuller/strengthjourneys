"use client";

import { useState, useEffect, useContext } from "react";
import { useSession } from "next-auth/react";
import { useUserLiftingData } from "@/lib/use-userlift-data";
import { Skeleton } from "@/components/ui/skeleton";
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
  const {
    parsedData,
    topLiftsByTypeAndReps,
    topLiftsByTypeAndRepsLast12Months,
  } = useUserLiftingData();
  const { status: authStatus } = useSession();

  const recentMonthHighlightsOLD = getFirstHistoricalPRsInLastMonth(
    parsedData,
    topLiftsByTypeAndReps,
  );

  const recentMonthHighlights = getRecentMonthHighlights(
    parsedData,
    topLiftsByTypeAndReps,
    topLiftsByTypeAndRepsLast12Months,
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
                  {record.lifetimeSignificanceAnnotation && (
                    <>
                      {record.lifetimeSignificanceAnnotation}
                      <br />
                    </>
                  )}
                  {/* FIXME: put a new line here */}
                  {record.lifetimeRanking > 0 &&
                    record.yearlySignificanceAnnotation && (
                      <>{record.yearlySignificanceAnnotation}</>
                    )}
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
// FIXME: include URL hyperlinks if we have them
// FIXME: This could be rewritten to include yearly PRs as well as lifetime PRs (see the getYearlyLiftRanking() in session-analysis-card.js)
function getFirstHistoricalPRsInLastMonth(parsedData, topLiftsByTypeAndReps) {
  if (!parsedData) return null;
  const startTime = performance.now();

  const today = new Date().toISOString().split("T")[0]; // Convert to "YYYY-MM-DD" string format
  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  const lastMonthStr = lastMonth.toISOString().split("T")[0]; // Convert to "YYYY-MM-DD" string format

  // Filter records that are historical PRs and fall within the last month
  const historicalPRsInLastMonth = parsedData.filter(
    ({ isHistoricalPR, date }) => {
      return isHistoricalPR && date >= lastMonthStr && date <= today;
    },
  );

  devLog(`historical PRs in last month: ${historicalPRsInLastMonth.length}`);
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

// Return a mappable array of lift tuples with extra ranking and annotation highlights
// FIXME: don't do yearly highlights with small datasets
function getRecentMonthHighlights(
  parsedData,
  topLiftsByTypeAndReps,
  topLiftsByTypeAndRepsLast12Months,
) {
  if (!parsedData) return null;
  const startTime = performance.now();

  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  const lastMonthStr = lastMonth.toISOString().split("T")[0]; // Convert to "YYYY-MM-DD" string format

  var recentMonthHighlights = [];

  parsedData.forEach((entry) => {
    if (entry.date < lastMonthStr) return; // Skip entries older than one month

    if (entry.isGoal) return; // Dreams do not count

    // Ensure that the reps value is within the expected range
    if (entry.reps < 1 || entry.reps > 20) {
      return;
    }

    // Grab our little emoji report if it was a top lift
    const { rank: yearlyRanking, annotation: yearlySignificanceAnnotation } =
      findLiftPositionInTopLifts(entry, topLiftsByTypeAndRepsLast12Months);

    const {
      rank: lifetimeRanking,
      annotation: lifetimeSignificanceAnnotation,
    } = findLiftPositionInTopLifts(entry, topLiftsByTypeAndReps);

    // For yearly ranking we only want the top 10.
    if (yearlyRanking !== -1 && yearlyRanking < 10) {
      const highlight = {
        ...entry,
        yearlySignificanceAnnotation:
          yearlySignificanceAnnotation + " of the year",
        yearlyRanking: yearlyRanking,
      };

      // If this was a lifetime PR add that info as well
      if (lifetimeRanking !== -1 && lifetimeSignificanceAnnotation) {
        highlight.lifetimeSignificanceAnnotation =
          lifetimeSignificanceAnnotation + " ever";
        highlight.lifetimeRanking = lifetimeRanking;
      }

      recentMonthHighlights.push(highlight);
    }
  });

  // Sort by lifetimeRanking and then yearlyRanking
  recentMonthHighlights.sort((a, b) => {
    if (a.lifetimeRanking === undefined && b.lifetimeRanking !== undefined) {
      return 1; // `a` should come after `b`
    }
    if (a.lifetimeRanking !== undefined && b.lifetimeRanking === undefined) {
      return -1; // `a` should come before `b`
    }
    if (a.lifetimeRanking !== undefined && b.lifetimeRanking !== undefined) {
      if (a.lifetimeRanking !== b.lifetimeRanking) {
        return a.lifetimeRanking - b.lifetimeRanking;
      }
    }
    return a.yearlyRanking - b.yearlyRanking;
  });

  devLog(
    `getRecentMonthHighlights() execution time: ` +
      `\x1b[1m${Math.round(performance.now() - startTime)}ms\x1b[0m`,
  );

  // devLog(recentMonthHighlights);

  recentMonthHighlights.length = 15; // Cap at top 15 entries

  return recentMonthHighlights;
}
