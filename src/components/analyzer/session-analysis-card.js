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
  const {
    parsedData,
    topLiftsByTypeAndReps,
    topLiftsByTypeAndRepsLast12Months,
    isLoading,
  } = useUserLiftingData();
  const { status: authStatus } = useSession();

  let lifetimePRFound = false;
  let yearlyPRFound = false;

  let sessionDate = highlightDate;

  // The PR Analyzer will call this component without a highlight date, so find the most recent session
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

    const {
      rank: lifetimeRanking,
      annotation: lifetimeSignificanceAnnotation,
    } = findLiftPositionInTopLifts(entry, topLiftsByTypeAndReps);

    if (lifetimeRanking !== -1) lifetimePRFound = true;

    let { rank: yearlyRanking, annotation: yearlySignificanceAnnotation } =
      findLiftPositionInTopLifts(entry, topLiftsByTypeAndRepsLast12Months);

    if (yearlyRanking !== -1) yearlyPRFound = true;

    // If the yearly ranking is not better than an existing lifetime ranking, don't show it
    if (lifetimeRanking !== -1 && yearlyRanking >= lifetimeRanking) {
      yearlyRanking = null;
      yearlySignificanceAnnotation = null;
    }

    acc[liftType].push({
      ...entry,
      lifetimeRanking: lifetimeRanking,
      lifetimeSignificanceAnnotation: lifetimeSignificanceAnnotation,
      yearlyRanking: yearlyRanking,
      yearlySignificanceAnnotation: yearlySignificanceAnnotation,
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
                              workout.lifetimeRanking !== -1 ? "font-bold" : ""
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
                            {/* If both exist they should be separated by a comma */}
                            {workout.lifetimeSignificanceAnnotation &&
                              `${workout.lifetimeSignificanceAnnotation}`}
                            {workout.lifetimeSignificanceAnnotation &&
                              workout.yearlySignificanceAnnotation &&
                              ", "}
                            {workout.yearlySignificanceAnnotation &&
                              `${workout.yearlySignificanceAnnotation} of the year`}
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
            {getCreativeSessionRating(groupedWorkouts)}
          </div>
        )}
      </CardFooter>
    </Card>
  );
}

function getCreativeSessionRating(workouts) {
  if (!workouts) return "";

  // Loop through workouts and count how many lifetimeRanking or yearlyRanking are not -1
  let totalPRs = 0;
  let totalYearlyPRs = 0;
  let lifetimePRFound = false;
  let yearlyPRFound = false;
  Object.values(workouts).forEach((lifts) => {
    lifts.forEach((lift) => {
      if (lift.lifetimeRanking !== -1) totalPRs++;
      if (lift.yearlyRanking !== -1) totalYearlyPRs++;
      if (lift.lifetimeRanking === 0) lifetimePRFound = true;
      if (lift.yearlyRanking === 0) yearlyPRFound = true;
    });
  });

  // devLog("totalPRs", totalPRs);
  // devLog("totalYearlyPRs", totalYearlyPRs);

  // Give some feedback from worst session to best

  // Some randomising to make the feedback appear to be artificially intelligent
  let mehIndex = Math.floor(Math.random() * mehEncouragements.length - 1);
  let victorIndex = Math.floor(Math.random() * victoriousNouns.length - 1);
  let treatIndex = Math.floor(Math.random() * celebrationTreat.length - 1);

  if (totalPRs === 0 && totalYearlyPRs === 0)
    return mehEncouragements[mehIndex];

  // If they get a yearly #1
  if (yearlyPRFound)
    return `Look at the ${victoriousNouns[victorIndex]} over here getting the lift of the year.`;

  // No lifetime PRs but some yearly non-#1 PRs
  if (totalPRs === 0 && totalYearlyPRs > 0)
    return `Just watching the ${victoriousNouns[victorIndex]} hitting some of the best lifts of the year.`;

  // If they get a lifetime #1
  // This is the biggest reward.
  if (lifetimePRFound)
    return `Someone get this ${victoriousNouns[victorIndex]} some ${celebrationTreat[treatIndex]}. Lifetime PR today!`;

  // If they get a lifetime non-#1 PR (e.g.: top 20 lifetime)
  return `You truly are the ${victoriousNouns[victorIndex]} with a lifetime top 20 today.`;
}

const mehEncouragements = [
  "You are beating 100% of people who won't get off the couch.",
  "Arnold would be proud of you right now",
  "You are doing better than you think",
  "Now go get some protein",
];

const victoriousNouns = [
  "champion",
  "winner",
  "hero",
  "conqueror",
  "victor",
  "master",
  "overcomer",
  "triumphator",
  "subduer",
  "vanquisher",
  "top dog",
  "lord of the rings",
  "king of the hill",
  "ruler of the roost",
  "top banana",
  "big cheese",
  "big enchilada",
  "big fish",
  "big kahuna",
  "big wheel",
  "bigshot",
  "bigwig",
  "boss",
];

const celebrationTreat = [
  "beers",
  "champagne",
  "cocktails",
  "coffee",
  "cigars",
  "grass-fed steak",
  "mouldy cheese",
];
