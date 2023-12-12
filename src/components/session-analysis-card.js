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
  getCelebrationEmoji,
  getReadableDateString,
} from "@/lib/processing-utils";
import { devLog } from "@/lib/processing-utils";
import { ParsedDataContext } from "@/pages/_app";

export function SessionAnalysisCard() {
  const { parsedData } = useContext(ParsedDataContext);

  const mostRecentDate = parsedData[parsedData.length - 1].date;
  const recentWorkouts = parsedData.filter(
    (workout) => workout.date === mostRecentDate,
  );

  // Group workouts by liftType
  const groupedWorkouts = recentWorkouts.reduce((acc, workout) => {
    const { liftType } = workout;
    acc[liftType] = acc[liftType] || [];
    acc[liftType].push(workout);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Session Analysis</CardTitle>
        <CardDescription>
          Date: {getReadableDateString(mostRecentDate)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {Object.keys(groupedWorkouts).length > 0 ? (
          <ul>
            {Object.entries(groupedWorkouts).map(([liftType, workouts]) => (
              <li key={liftType} className="pb-2">
                <strong>{liftType}</strong>
                <ul>
                  {workouts.map((workout, index) => (
                    <li key={index} className="pl-4">
                      {workout.reps}@{workout.weight}
                      {workout.unitType}
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
