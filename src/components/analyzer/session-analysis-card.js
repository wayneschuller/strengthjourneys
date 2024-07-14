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

export function SessionAnalysisCard({ highlightDate, SetHighlightDate }) {
  const { parsedData, topLiftsByTypeAndReps, isLoading } = useUserLiftingData();
  const { status: authStatus } = useSession();

  let prFound = false;

  let sessionDate = highlightDate;

  if (!sessionDate) {
    // Iterate backwards to find the most recent non-goal entry date
    for (let i = parsedData?.length - 1; i >= 0; i--) {
      if (!parsedData[i].isGoal) {
        sessionDate = parsedData[i].date;
        break; // Stop as soon as we find the most recent non-goal entry
      }
    }
  }

  const recentWorkouts = parsedData?.filter(
    (workout) => workout.date === sessionDate && workout.isGoal !== true,
  );

  // Group workouts by liftType
  const groupedWorkouts = recentWorkouts?.reduce((acc, entry) => {
    const { liftType } = entry;
    acc[liftType] = acc[liftType] || [];
    const { rank: prIndex, annotation: prSentenceReport } =
      findLiftPositionInTopLifts(entry, topLiftsByTypeAndReps);
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
          {authStatus === "unauthenticated" && "Demo Mode: "}
          {groupedWorkouts && getReadableDateString(sessionDate, true)} Session
        </CardTitle>
        <CardDescription>Session overview and analysis</CardDescription>
      </CardHeader>
      <CardContent>
        {!groupedWorkouts && <Skeleton className="h-[50vh]" />}
        {groupedWorkouts &&
          (Object.keys(groupedWorkouts).length > 0 ? (
            <ul>
              {Object.entries(groupedWorkouts).map(([liftType, workouts]) => (
                <li key={liftType} className="pb-2">
                  <div className="flex flex-row items-center">
                    <div
                      className="mr-1 h-2.5 w-2.5 shrink-0 rounded-[2px]"
                      style={{ backgroundColor: getLiftColor(liftType) }} // Use css style because tailwind is picky
                    />
                    <div className="font-bold">{liftType}</div>
                  </div>
                  <ul className="pl-4">
                    {workouts.map((workout, index) => (
                      <li key={index}>
                        <div className="flex flex-row justify-between">
                          <div
                            className={
                              workout.prIndex !== -1 ? "font-bold" : ""
                            }
                          >
                            {workout.URL ? (
                              <a
                                href={workout.URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline"
                              >
                                {workout.reps}@{workout.weight}
                                {workout.unitType}{" "}
                              </a>
                            ) : (
                              <>
                                {workout.reps}@{workout.weight}
                                {workout.unitType}{" "}
                              </>
                            )}
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

// FIXME: we actually have topLiftsByTypeAndRepsLast12Months now - we could simply lookup from this cache (see monthly card code)
function getYearlyLiftRanking(parsedData, liftType, reps, weight, date) {
  const startTime = performance.now();
  return "";

  if (reps < 1) return "";

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
