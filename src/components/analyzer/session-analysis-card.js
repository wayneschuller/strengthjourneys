"use client";

import { useState, useEffect, useContext } from "react";
import { devLog } from "@/lib/processing-utils";
import { useSession } from "next-auth/react";
import { useUserLiftingData } from "@/lib/use-userlift-data";
import { Skeleton } from "@/components/ui/skeleton";
import { getLiftColor } from "@/lib/get-lift-color";

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
  const { parsedData, topLiftsByTypeAndReps, isLoading } = useUserLiftingData();
  const { status: authStatus } = useSession();

  let prFound = false;

  // Find the most recent lifting session date (with non-goal data)
  // const mostRecentDate = parsedData?.[parsedData.length - 1]?.date;
  let mostRecentDate = "";

  // Iterate backwards to find the most recent non-goal entry date
  for (let i = parsedData?.length - 1; i >= 0; i--) {
    if (!parsedData[i].isGoal) {
      mostRecentDate = parsedData[i].date;
      break; // Stop as soon as we find the most recent non-goal entry
    }
  }

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
    <Card className="flex-1">
      <CardHeader>
        <CardTitle>
          {authStatus === "unauthenticated" && "Demo Mode: "}Recent Session
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
                  <strong
                    style={{
                      textDecoration: "underline",
                      textDecorationColor: getLiftColor(liftType),
                    }}
                  >
                    {liftType}
                  </strong>
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
                            {workout.prSentenceReport
                              ? `${workout.prSentenceReport}`
                              : `${getYearlyLiftRanking(
                                  parsedData,
                                  workout.liftType,
                                  workout.reps,
                                  workout.weight,
                                  workout.date,
                                )}`}
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

function getYearlyLiftRanking(parsedData, liftType, reps, weight, date) {
  const startTime = performance.now();

  const twelveMonthsAgo = new Date(date);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const twelveMonthsAgoString = twelveMonthsAgo.toISOString().split("T")[0];

  // Filter lifts for the specific lift type and rep scheme within the last 12 months
  const relevantLifts = parsedData.filter(
    (lift) =>
      lift.liftType === liftType &&
      lift.reps === reps &&
      lift.date > twelveMonthsAgoString &&
      lift.date <= date,
  );

  // devLog(relevantLifts);

  // Sort the relevant lifts by weight in descending order, then by date in ascending order
  relevantLifts.sort((a, b) => {
    if (b.weight !== a.weight) {
      return b.weight - a.weight;
    }
    return a.date.localeCompare(b.date);
  });

  // Find the rank of the current lift
  const rank = relevantLifts.findIndex(
    (lift) =>
      lift.weight < weight || (lift.weight === weight && lift.date > date),
  );

  // If the lift doesn't rank in the top 10, return null
  if (rank >= 10 || rank === -1) {
    return "";
  }

  // Construct the ranking string
  const rankString = `#${rank} best`;
  const repString = reps === 1 ? "single" : `${reps}rm`;

  devLog(
    `getYearlyLiftRanking() execution time: ` +
      `\x1b[1m${Math.round(performance.now() - startTime)}` +
      `ms\x1b[0m`,
  );

  return `${rankString} ${repString} in the last year`;
}
