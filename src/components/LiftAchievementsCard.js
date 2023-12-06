"use client";

import { useState, useEffect, useContext } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getReadableDateString } from "@/lib/SJ-utils";
import { devLog } from "@/lib/SJ-utils";

const LiftAchievementsCard = ({ liftType, parsedData }) => {
  // Check the liftType exists in the data.
  // This sometimes happens when selectedLifts doesn't match data
  // devLog(`LiftAchievementsCard: liftType:`);
  // devLog(liftType);

  if (
    !parsedData ||
    parsedData.some((lifting) => lifting.liftType === liftType) === false
  )
    return;

  const { totalCountReps, totalSets, oldestDate, newestDate } =
    getLiftTypeStats(liftType, parsedData);

  const oneRM = getLiftPR(liftType, parsedData, 1);
  const threeRM = getLiftPR(liftType, parsedData, 3);
  const fiveRM = getLiftPR(liftType, parsedData, 5);

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
      </CardContent>
    </Card>
  );
};

export default LiftAchievementsCard;

function getLiftTypeStats(liftType, parsedData) {
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

  // Find the oldest and newest date
  const dates = filteredData.map((lifting) => new Date(lifting.date));
  const oldestDate = new Date(Math.min(...dates));
  const newestDate = new Date(Math.max(...dates));

  // Return the results in an object
  return {
    totalCountReps,
    totalSets,
    oldestDate: oldestDate.toISOString().split("T")[0], // Format as "YYYY-MM-DD"
    newestDate: newestDate.toISOString().split("T")[0], // Format as "YYYY-MM-DD"
  };
}

function getLiftPR(liftType, parsedData, reps) {
  // Filter the parsedData for the specific liftType and reps
  const filteredData = parsedData.filter(
    (lifting) => lifting.liftType === liftType && lifting.reps === reps,
  );

  // Find the tuple with the best result based on weight
  const bestResult = filteredData.reduce((best, lifting) => {
    if (!best || lifting.weight > best.weight) {
      return lifting;
    }
    return best;
  }, null);

  return bestResult;
}
