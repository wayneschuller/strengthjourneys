"use client";

import { useState, useEffect, useContext } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getCelebrationEmoji,
  getReadableDateString,
} from "@/lib/processing-utils";
import { devLog } from "@/lib/processing-utils";
import { ParsedDataContext } from "@/pages/_app";
import { Skeleton } from "./ui/skeleton";

export function LiftAchievementsCard({ liftType }) {
  const { liftTypes, topLiftsByTypeAndReps } = useContext(ParsedDataContext);

  const lift = liftTypes?.find((lift) => lift.liftType === liftType);
  const totalReps = lift ? lift.totalReps : null;
  const totalSets = lift ? lift.totalSets : null;
  const newestDate = lift ? lift.newestDate : null;
  const oldestDate = lift ? lift.oldestDate : null;

  const topLiftsByReps = topLiftsByTypeAndReps?.[liftType];
  const oneRM = topLiftsByReps?.[0]?.[0];
  const threeRM = topLiftsByReps?.[2]?.[0];
  const fiveRM = topLiftsByReps?.[4]?.[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{liftType} Achievements</CardTitle>
      </CardHeader>
      <CardContent>
        {!liftTypes && <Skeleton className="h-64" />}
        {liftTypes && (
          <div>
            <div className="grid grid-cols-2 gap-x-1">
              <div className="font-semibold">Total reps (sets):</div>
              <div>
                {totalReps} ({totalSets})
              </div>
              <div className="font-semibold">First lift:</div>
              <div>{getReadableDateString(oldestDate)}</div>
              <div className="font-semibold">Most recent lift:</div>{" "}
              <div>{getReadableDateString(newestDate)}</div>
              {oneRM && <div className="font-semibold">Best single:</div>}
              {oneRM && (
                <div>
                  {oneRM.weight}
                  {oneRM.unitType} ({getReadableDateString(oneRM.date)})
                </div>
              )}
              {threeRM && <div className="font-semibold">Best triple:</div>}
              {threeRM && (
                <div>
                  {threeRM.weight}
                  {threeRM.unitType} ({getReadableDateString(threeRM.date)})
                </div>
              )}
              {fiveRM && <div className="font-semibold">Best five:</div>}
              {fiveRM && (
                <div>
                  {fiveRM.weight}
                  {fiveRM.unitType} ({getReadableDateString(fiveRM.date)})
                </div>
              )}
            </div>
            <RecentLiftHighlights
              liftType={liftType}
              topLiftsByTypeAndReps={topLiftsByTypeAndReps}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const RecentLiftHighlights = ({ liftType, topLiftsByTypeAndReps }) => {
  if (!topLiftsByTypeAndReps) return null;

  // Helper function to check if a date is within the last month
  const isWithinLastMonth = (dateString) => {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    return new Date(dateString) >= oneMonthAgo;
  };

  // Map the lifts for the given type to include their index, then filter for recent highlights
  const recentHighlights = topLiftsByTypeAndReps[liftType]
    ?.flatMap((repRange, repIndex) =>
      repRange.map((entry, entryIndex) => ({ ...entry, repIndex, entryIndex })),
    )
    .filter((entry) => isWithinLastMonth(entry.date))
    .sort((a, b) => a.entryIndex - b.entryIndex) // Sort by entryIndex in ascending order
    .slice(0, 10); // Only show 10 highlights per card

  if (!recentHighlights) return null;

  // FIXME: Ideally these would expand out with animation?
  return (
    <div>
      <div className="font-semibold">Recent Highlights for {liftType}:</div>
      {recentHighlights.length > 0 ? (
        <ul>
          {recentHighlights.map((lift, index) => (
            <li key={index}>
              {lift.reps}@{lift.weight}
              {lift.unitType} ({getReadableDateString(lift.date)}),{" "}
              {getCelebrationEmoji(lift.entryIndex)} #{lift.entryIndex + 1} best{" "}
              {lift.reps}RM ever.
            </li>
          ))}
        </ul>
      ) : (
        <p>No recent lifts found for this type.</p>
      )}
    </div>
  );
};
