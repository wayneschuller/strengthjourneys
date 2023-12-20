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
  const { data: session, status: authStatus } = useSession();

  let prFound = false;
  const mostRecentDate = parsedData?.[parsedData.length - 1]?.date;
  const recentWorkouts = parsedData?.filter(
    (workout) => workout.date === mostRecentDate,
  );

  // Group workouts by liftType
  const groupedWorkouts = recentWorkouts?.reduce((acc, entry) => {
    const { liftType } = entry;
    acc[liftType] = acc[liftType] || [];
    const { prIndex, prSentenceReport } = findLiftPositionInTopLifts(
      entry,
      topLiftsByTypeAndReps,
    );
    if (prIndex !== -1) prFound = true;
    acc[liftType].push({
      ...entry,
      prIndex: prIndex,
      prSentenceReport: prSentenceReport,
    });

    return acc;
  }, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {authStatus !== "authenticated" && "Demo Mode: "}Recent Session
          Analysis
        </CardTitle>
        <CardDescription>
          Lifting Session Date:{" "}
          {groupedWorkouts && getReadableDateString(mostRecentDate)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!groupedWorkouts && <Skeleton className="h-[50vh]" />}
        {groupedWorkouts &&
          (Object.keys(groupedWorkouts).length > 0 ? (
            <ul>
              {Object.entries(groupedWorkouts).map(([liftType, workouts]) => (
                <li key={liftType} className="pb-2">
                  <strong>{liftType}</strong>
                  <ul className="pl-4">
                    {workouts.map((workout, index) => (
                      <li key={index}>
                        <div className="flex flex-row justify-between">
                          <div
                            className={
                              workout.prIndex !== -1 ? "font-bold" : ""
                            }
                          >
                            {workout.reps}@{workout.weight}
                            {workout.unitType}{" "}
                          </div>
                          <div className="ml-6 inline-block">
                            {workout.prSentenceReport &&
                              `${workout.prSentenceReport}`}
                          </div>
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
            <strong>Session rating:</strong>{" "}
            {prFound
              ? "Awesome"
              : "You are beating 100% of people who won't get off the couch."}
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
