"use client";

import { useRef, useState, useEffect, useContext } from "react";
import Link from "next/link";
import { devLog } from "@/lib/processing-utils";
import { useSession } from "next-auth/react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { Skeleton } from "@/components/ui/skeleton";
import { useLiftColors } from "@/lib/color-tools";

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
  TooltipProvider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  findLiftPositionInTopLifts,
  getCelebrationEmoji,
  getReadableDateString,
  getAnalyzedSessionLifts,
} from "@/lib/processing-utils";
import {
  LoaderCircle,
  ChevronLeft,
  ChevronRight,
  PlayCircle,
} from "lucide-react";

const bigFourURLs = {
  "Back Squat": "/barbell-squat-insights",
  "Bench Press": "/barbell-bench-press-insights",
  Deadlift: "/barbell-deadlift-insights",
  "Strict Press": "/barbell-strict-press-insights",
};

const LiftTypeIndicator = ({ liftType }) => {
  const { color } = useLiftColors(liftType);

  // Content to be rendered (color square and lift type text)
  const content = (
    <div className="flex flex-row items-center">
      <div
        className="mr-1 h-2.5 w-2.5 shrink-0 rounded-[2px]"
        style={{ backgroundColor: color }}
      />
      <div className="font-bold">{liftType}</div>
    </div>
  );

  // Conditionally wrap content in a Link for big four lifts
  return bigFourURLs[liftType] ? (
    <Link href={bigFourURLs[liftType]} className="underline">
      {content}
    </Link>
  ) : (
    content
  );
};

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

  // FIXME: it would be better to have the card always render and skeleton inside it
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
  // The PR Analyzer defaults to no highlight date prop expecting to get the most recent session
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

  // devLog(analyzedSessionLifts);

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
    <TooltipProvider>
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={prevDate}
                    disabled={isValidating || isFirstDate}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Previous session</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={nextDate}
                    disabled={isValidating || isLastDate}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Next session</p>
                </TooltipContent>
              </Tooltip>
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
                      <LiftTypeIndicator liftType={liftType} />
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
                                {workout.reps}@{workout.weight}
                                {workout.unitType}
                                {workout.URL && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <a
                                        href={workout.URL}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        <Button
                                          variant="ghost"
                                          className="ml-2 h-3 w-3 p-1 align-middle"
                                        >
                                          <PlayCircle className="" />
                                        </Button>
                                      </a>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>User Data URL</p>
                                    </TooltipContent>
                                  </Tooltip>
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
            <div className="flex flex-col gap-4">
              <SessionTonnage analyzedSessionLifts={analyzedSessionLifts} />
              <div>
                <strong>Session Rating:</strong> {sessionRatingRef.current}
              </div>
            </div>
          )}
        </CardFooter>
      </Card>
    </TooltipProvider>
  );
}

function SessionTonnage({ analyzedSessionLifts }) {
  if (!analyzedSessionLifts) return null;

  const tonnage = Object.values(analyzedSessionLifts)
    .flat()
    .reduce((acc, lift) => acc + (lift.weight ?? 0) * (lift.reps ?? 0), 0);

  const firstLift = Object.values(analyzedSessionLifts)?.[0]?.[0];
  const unitType = firstLift?.unitType ?? "lb"; // default to lb

  // real-world equivalents (per unit type)
  const equivalents = {
    kg: [
      { name: "blue whale", weight: 150000, emoji: "🐋" },
      { name: "elephant", weight: 6000, emoji: "🐘" },
      { name: "car", weight: 1500, emoji: "🚗" },
      { name: "cow", weight: 700, emoji: "🐄" },
      { name: "grand piano", weight: 300, emoji: "🎹" },
      { name: "vending machine", weight: 250, emoji: "🥤" },
      { name: "Eddie Hall", weight: 180, emoji: "🦍" },
      { name: "Labrador Retriever", weight: 30, emoji: "🐕" },
      { name: "rotisserie chicken", weight: 1.5, emoji: "🍗" },
    ],
    lb: [
      { name: "blue whale", weight: 330000, emoji: "🐋" },
      { name: "elephant", weight: 13200, emoji: "🐘" },
      { name: "car", weight: 3300, emoji: "🚗" },
      { name: "cow", weight: 1540, emoji: "🐄" },
      { name: "grand piano", weight: 660, emoji: "🎹" },
      { name: "vending machine", weight: 550, emoji: "🥤" },
      { name: "Eddie Hall", weight: 400, emoji: "🦍" },
      { name: "Labrador Retriever", weight: 66, emoji: "🐕" },
      { name: "rotisserie chicken", weight: 3.3, emoji: "🍗" },
    ],
  };

  const unitEquivalents = equivalents[unitType] ?? equivalents["lb"]; // defult to lb

  const randomIndex = Math.floor(Math.random() * unitEquivalents.length);
  const equivalent = unitEquivalents[randomIndex];

  const equivalentCount = (tonnage / equivalent.weight).toFixed(1);

  return (
    <div>
      <strong>Session Tonnage:</strong> {tonnage.toLocaleString()}
      {unitType}
      {`.  About ${equivalentCount} ${equivalent.name}${equivalentCount != 1 ? "s" : ""}  lifted. ${equivalent.emoji}`}
    </div>
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
