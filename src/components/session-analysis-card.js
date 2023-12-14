"use client";

import { useState, useEffect, useContext } from "react";
import { devLog } from "@/lib/processing-utils";
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
  CardFooter,
} from "@/components/ui/card";

import {
  findLiftPositionInTopLifts,
  getCelebrationEmoji,
  getReadableDateString,
} from "@/lib/processing-utils";

export function SessionAnalysisCard() {
  const { parsedData, topLiftsByTypeAndReps } = useContext(ParsedDataContext);
  const { data: session, status } = useSession();

  // Computed data for this component
  let prFound = false;
  const mostRecentDate = parsedData?.[parsedData.length - 1]?.date;
  const recentWorkouts = parsedData?.filter(
    (workout) => workout.date === mostRecentDate,
  );

  // Group workouts by liftType
  const groupedWorkouts = recentWorkouts?.reduce((acc, workout) => {
    const { liftType } = workout;
    acc[liftType] = acc[liftType] || [];
    const prIndex = findLiftPositionInTopLifts(workout, topLiftsByTypeAndReps);
    if (prIndex !== -1) prFound = true;
    acc[liftType].push({ ...workout, prIndex: prIndex });

    return acc;
  }, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {status === "unauthenticated" && "Demo Mode: "}Recent Session Analysis
        </CardTitle>
        <CardDescription>
          Lifting Session Date: {getReadableDateString(mostRecentDate)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!groupedWorkouts && <Skeleton className="flex h-[60vh] flex-1" />}
        {groupedWorkouts &&
          (Object.keys(groupedWorkouts).length > 0 ? (
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
                        <div className="ml-6 inline-block">
                          {workout.prIndex !== -1 &&
                            `${getCelebrationEmoji(workout.prIndex)}  #${
                              workout.prIndex + 1
                            } best ${workout.reps}RM ever`}
                        </div>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : (
            <p>No workouts available for the most recent date.</p>
          ))}
      </CardContent>
      <CardFooter>
        {groupedWorkouts && (
          <div>
            Session rating:{" "}
            {prFound
              ? "Awesome"
              : "You beat 100% of people who stayed on the couch."}
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
