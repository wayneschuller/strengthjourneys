"use client";

import { useRef, useState, useEffect, useContext } from "react";
import { devLog } from "@/lib/processing-utils";
import { useSession } from "next-auth/react";
import { useUserLiftingData } from "@/lib/use-userlift-data";
import { Skeleton } from "@/components/ui/skeleton";
import { getLiftColor } from "@/lib/get-lift-color";

import { Button } from "@/components/ui/button";

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
  getAnalyzedSessionLifts,
} from "@/lib/processing-utils";
import { LoaderCircle, ChevronLeft, ChevronRight } from "lucide-react";

export function SessionAnalysisCard({
  highlightDate = null,
  setHighlightDate,
}) {
  const {
    parsedData,
    topLiftsByTypeAndReps,
    topLiftsByTypeAndRepsLast12Months,
    isValidating,
  } = useUserLiftingData();
  const { status: authStatus } = useSession();

  const sessionRatingRef = useRef(null); // Used to avoid randomised rating changes on rerenders

  useEffect(() => {
    sessionRatingRef.current = null; // Reset the session rating when the highlight date changes
  }, [highlightDate]);

  if (!parsedData) {
    return <Skeleton className="h-[50vh]" />;
  }
  let sessionDate = highlightDate;
  const isFirstDate =
    parsedData?.length > 0 && sessionDate === parsedData[0]?.date;
  let isLastDate =
    parsedData?.length > 0 &&
    sessionDate === parsedData[parsedData.length - 1]?.date;

  // The Visualizer will normally set the highlight date prop based on chart mouseover.
  // The PR Analyzer will call this component without a highlight date, so find the most recent session
  if (!sessionDate) {
    // Iterate backwards to find the most recent non-goal entry date
    for (let i = parsedData?.length - 1; i >= 0; i--) {
      if (!parsedData[i].isGoal) {
        sessionDate = parsedData[i].date;
        break; // Stop as soon as we find the most recent non-goal entry
      }
    }
    isLastDate = true;
  }

  const analyzedSessionLifts = getAnalyzedSessionLifts(
    sessionDate,
    parsedData,
    topLiftsByTypeAndReps,
    topLiftsByTypeAndRepsLast12Months,
  );

  if (analyzedSessionLifts && !sessionRatingRef.current) {
    sessionRatingRef.current = getCreativeSessionRating(analyzedSessionLifts);
  }

  const prevDate = () => {
    if (!parsedData || !sessionDate) return;

    // Find the index of the current session date
    const currentIndex = parsedData.findIndex(
      (entry) => entry.date === sessionDate,
    );

    // Iterate backward to find the previous unique date
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (parsedData[i].date !== sessionDate) {
        setHighlightDate(parsedData[i].date); // Update the highlight date
        break;
      }
    }
  };

  const nextDate = () => {
    if (!parsedData || !sessionDate) return;

    // Find the index of the current session date
    const currentIndex = parsedData.findIndex(
      (entry) => entry.date === sessionDate,
    );

    // Iterate forward to find the next unique date
    for (let i = currentIndex + 1; i < parsedData.length; i++) {
      if (parsedData[i].date !== sessionDate) {
        setHighlightDate(parsedData[i].date); // Update the highlight date
        break;
      }
    }
  };

  return (
    <Card className="flex-1">
      <CardHeader className="">
        <CardTitle className="flex flex-row items-center justify-between">
          {authStatus === "unauthenticated" && "Demo Mode: "}
          {analyzedSessionLifts &&
            getReadableDateString(sessionDate, true)}{" "}
          Session
          {isValidating && (
            <LoaderCircle className="ml-3 inline-flex h-5 w-5 animate-spin" />
          )}
          <div className="flex flex-row items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={prevDate}
              disabled={isValidating || isFirstDate}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={nextDate}
              disabled={isValidating || isLastDate}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardTitle>
        <CardDescription>
          <div>Session overview and analysis</div>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!analyzedSessionLifts && <Skeleton className="h-[50vh]" />}
        {analyzedSessionLifts &&
          (Object.keys(analyzedSessionLifts).length > 0 ? (
            <ul>
              {Object.entries(analyzedSessionLifts).map(
                ([liftType, workouts]) => (
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
                                workout.lifetimeRanking !== -1
                                  ? "font-bold"
                                  : ""
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
                ),
              )}
            </ul>
          ) : (
            <p>No workouts available for the most recent date.</p>
          ))}
      </CardContent>
      <CardFooter>
        {analyzedSessionLifts && (
          <div>
            <strong>Session rating:</strong> {sessionRatingRef.current}
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

  // Gather some statistics on this session
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

  // FIXME: detect if they do a single in all of squat/bench/deadlift in one session - autodetect powerlifting meet

  // Give some feedback from least impressive session to best

  // Some randomising to make the feedback appear to be artificially intelligent
  let mehIndex = Math.floor(Math.random() * mehEncouragements.length);
  let victorIndex = Math.floor(Math.random() * victoriousNouns.length);
  let treatIndex = Math.floor(Math.random() * celebrationTreat.length);

  const totalSetCount = Object.values(workouts).reduce(
    (sum, lifts) => sum + lifts.length,
    0,
  );

  // 5 or less sets, they may have the app open during a session.
  if (!yearlyPRFound && !lifetimePRFound && totalSetCount <= 5)
    return `Good start. Now do more sets to become the ${victoriousNouns[victorIndex]}.`;

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
    return `Someone get this ${victoriousNouns[victorIndex]} some ${celebrationTreat[treatIndex]}. Lifetime PR today.`;

  // If they get a lifetime non-#1 PR (e.g.: top 20 lifetime)
  return `You truly are the ${victoriousNouns[victorIndex]} with a lifetime top 20 in this session.`;
}

const mehEncouragements = [
  "You are beating 100% of people who won't get off the couch.",
  "Arnold would be proud of you right now.",
  "You are doing better than you think.",
  "Now go get some protein.",
  "Don't worry, you'll get there.",
  "Maybe try ordering some Captain America underpants.",
  "At least you are not a marathon runner",
  "INSERT AI GENERATED FEIGNED COMPLIMENT",
  "No top lifts today. Maybe next time.",
  "Another day at the office for this `athlete`.",
];

const victoriousNouns = [
  "champion",
  "winner",
  "hero",
  "savage",
  "baddie",
  "top dog",
  "professional",
  "top banana (or other fruit)",
  "big cheese",
  "big low-carb enchilada",
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
  "cocktail sausages",
  "freshly brewed coffee",
  "cigars",
  "grass-fed steak",
  "mouldy cheese",
  "milk by the gallon",
  "whey protein of an unusually pleasant flavouring",
  "fresh mountain air",
];
