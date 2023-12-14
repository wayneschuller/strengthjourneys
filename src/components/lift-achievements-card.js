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
  const { parsedData, selectedLiftTypes, topLiftsByTypeAndReps } =
    useContext(ParsedDataContext);

  if (parsedData?.length < 1) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{liftType} Achievements</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64" />
        </CardContent>
      </Card>
    );
  }

  const { totalCountReps, totalSets, oldestDate, newestDate } =
    getLiftTypeStats(liftType, parsedData);

  const topLiftsByReps = topLiftsByTypeAndReps[liftType];
  const oneRM = topLiftsByReps?.[0]?.[0];
  const threeRM = topLiftsByReps?.[2]?.[0];
  const fiveRM = topLiftsByReps?.[4]?.[0];

  return (
    <Card className="hover:ring-1">
      <CardHeader>
        <CardTitle>{liftType} Achievements</CardTitle>
        {/* <CardDescription>Card Description</CardDescription> */}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-x-1">
          <div className="font-semibold">Total reps (sets):</div>
          <div>
            {totalCountReps} ({totalSets})
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
      </CardContent>
    </Card>
  );
}

function getLiftTypeStats(liftType, parsedData) {
  // devLog(`getLiftTypeStats()...`);

  // Filter the parsedData for the specific liftType
  const filteredData = parsedData.filter(
    (lifting) => lifting.liftType === liftType,
  );

  // Calculate total count of reps and total number of sets
  const totalCountReps = filteredData.reduce(
    (total, lifting) => total + lifting.reps,
    0,
  );
  const totalSets = filteredData.length;

  // Extract dates, ensuring they are valid, and sort them
  // FIXME: We had a bug with invalid dates here, we should check dates at initial parsing
  const dates = filteredData
    .map((lift) => new Date(lift.date))
    .filter((date) => !isNaN(date.getTime())); // Checks if the date is valid

  // Select the oldest and newest dates, if available
  const oldestDate = dates.length > 0 ? dates[0] : new Date();
  const newestDate = dates.length > 0 ? dates[dates.length - 1] : new Date();

  // Format the dates as "YYYY-MM-DD"
  const formatDate = (date) => date.toISOString().split("T")[0];

  // Return the results in an object
  return {
    totalCountReps,
    totalSets,
    oldestDate: formatDate(oldestDate),
    newestDate: formatDate(newestDate),
  };
}

const RecentLiftHighlights = ({ liftType, topLiftsByTypeAndReps }) => {
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
