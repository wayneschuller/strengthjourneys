"use client";

import { useState, useEffect, useContext } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  findLiftPositionInTopLifts,
  getCelebrationEmoji,
  getReadableDateString,
} from "@/lib/processing-utils";
import { devLog } from "@/lib/processing-utils";
import { ParsedDataContext } from "@/pages/_app";

export function SessionAnalysisCard() {
  const { parsedData, topLiftsByTypeAndReps } = useContext(ParsedDataContext);

  const mostRecentDate = parsedData[parsedData.length - 1].date;
  const recentWorkouts = parsedData.filter(
    (workout) => workout.date === mostRecentDate,
  );

  // Group workouts by liftType
  const groupedWorkouts = recentWorkouts.reduce((acc, workout) => {
    const { liftType } = workout;
    acc[liftType] = acc[liftType] || [];
    const prIndex = findLiftPositionInTopLifts(workout, topLiftsByTypeAndReps);
    acc[liftType].push({ ...workout, prIndex: prIndex });
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Session Analysis</CardTitle>
        <CardDescription>
          Lifting Session Date: {getReadableDateString(mostRecentDate)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {Object.keys(groupedWorkouts).length > 0 ? (
          <ul>
            {Object.entries(groupedWorkouts).map(([liftType, workouts]) => (
              <li key={liftType} className="pb-2">
                <strong>{liftType}</strong>
                <ul className="pl-4">
                  {workouts.map((workout, index) => (
                    <li
                      key={index}
                      className={workout.prIndex !== -1 ? "font-bold" : ""}
                    >
                      {workout.reps}@{workout.weight}
                      {workout.unitType}{" "}
                      {workout.prIndex !== -1 &&
                        `(#${workout.prIndex + 1} of all time)`}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        ) : (
          <p>No workouts available for the most recent date.</p>
        )}
      </CardContent>
      <CardFooter>Session rating: Awesome</CardFooter>
    </Card>
  );
}
