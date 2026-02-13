"use client";

import { format } from "date-fns";
import { useState, useEffect, useContext } from "react";
import { useSession } from "next-auth/react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
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
  devLogTiming,
  getReadableDateString,
} from "@/lib/processing-utils";

export function MonthsHighlightsCard() {
  const {
    parsedData,
    topLiftsByTypeAndReps,
    topLiftsByTypeAndRepsLast12Months,
  } = useUserLiftingData();
  const { status: authStatus } = useSession();

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
            recentMonthHighlights.map((record, index) => (
              <li
                key={`${record.liftType}-${record.reps}-${index}`}
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
                    {record.URL ? (
                      <a
                        href={record.URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        {record.liftType} {record.reps}@{record.weight}
                        {record.unitType}
                      </a>
                    ) : (
                      <>
                        {record.liftType} {record.reps}@{record.weight}
                        {record.unitType}
                      </>
                    )}{" "}
                    ({getReadableDateString(record.date)})
                  </strong>{" "}
                </div>
                <div className="text-right">
                  {record.lifetimeSignificanceAnnotation && (
                    <>
                      {record.lifetimeSignificanceAnnotation}
                      <br />
                    </>
                  )}
                  {/* Show yearly PRs  (except when it is a #1 lifetime ranking)  */}
                  {(record.lifetimeRanking === undefined ||
                    record.lifetimeRanking > 0) &&
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

// Return a mappable array of lift tuples with extra ranking and annotation highlights
// FIXME: don't do yearly highlights with small datasets
// FIXME: this could more intelligently select the top 10 highlights - prioritise reps 1, 3, 5, 10 if needed
function getRecentMonthHighlights(
  parsedData,
  topLiftsByTypeAndReps,
  topLiftsByTypeAndRepsLast12Months,
) {
  if (!parsedData) return null;
  const startTime = performance.now();

  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  const lastMonthStr = format(lastMonth, "yyyy-MM-dd"); // Local date, not UTC

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
    if (a.reps !== b.reps) {
      return a.reps - b.reps; // Sort by reps ascending
    }
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

  devLogTiming("getRecentMonthHighlights", performance.now() - startTime);

  recentMonthHighlights.length = 15; // Cap at top 15 entries
  // devLog(recentMonthHighlights);

  return recentMonthHighlights;
}
