"use client";

import { useState, useEffect, useContext } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getCelebrationEmoji,
  getReadableDateString,
} from "@/lib/processing-utils";
import { devLog } from "@/lib/processing-utils";
import { ParsedDataContext } from "@/pages/_app";
import { Skeleton } from "./ui/skeleton";
import { SidePanelSelectLiftsButton } from "@/components/side-panel-lift-chooser";
import { CardFooter } from "@/components/ui/card";
import { useSession } from "next-auth/react";

export function LiftAchievementsCard({ liftType }) {
  const { liftTypes, topLiftsByTypeAndReps } = useContext(ParsedDataContext);

  const lift = liftTypes?.find((lift) => lift.liftType === liftType);
  const totalReps = lift ? lift.totalReps : null;
  const totalSets = lift ? lift.totalSets : null;
  const newestDate = lift ? lift.newestDate : null;
  const oldestDate = lift ? lift.oldestDate : null;

  const topLiftsByReps = topLiftsByTypeAndReps?.[liftType];
  const oneRM = topLiftsByReps?.[0]?.[0];
  const threeRM = topLiftsByReps?.[2]?.[0];
  const fiveRM = topLiftsByReps?.[4]?.[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{liftType} Achievements</CardTitle>
      </CardHeader>
      <CardContent>
        {!liftTypes && <Skeleton className="h-64" />}
        {liftTypes && (
          <div>
            <div className="grid grid-cols-2 gap-x-1">
              <div className="font-semibold">Total reps (sets):</div>
              <div>
                {totalReps} ({totalSets})
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
            <RecentLiftHighlights
              liftType={liftType}
              topLiftsByTypeAndReps={topLiftsByTypeAndReps}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const RecentLiftHighlights = ({ liftType, topLiftsByTypeAndReps }) => {
  if (!topLiftsByTypeAndReps) return null;

  // Helper function to check if a date is within the last month
  const isWithinLastMonth = (dateString) => {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    return new Date(dateString) >= oneMonthAgo;
  };

  // Map the lifts for the given type to include their index, then filter for recent highlights
  const recentHighlights = topLiftsByTypeAndReps[liftType]
    ?.flatMap((repRange, repIndex) =>
      repRange.map((entry, entryIndex) => ({ ...entry, repIndex, entryIndex })),
    )
    .filter((entry) => isWithinLastMonth(entry.date))
    .sort((a, b) => a.entryIndex - b.entryIndex) // Sort by entryIndex in ascending order
    .slice(0, 5); // Only show top n highlights per card

  if (!recentHighlights || recentHighlights.length <= 0) return null;

  // FIXME: Ideally these would expand out with animation?
  return (
    <div>
      <div className="mt-4 font-semibold">
        Recent Highlights for {liftType}:
      </div>
      <ul>
        {recentHighlights.map((lift, index) => (
          <li key={index}>
            {lift.reps}@{lift.weight}
            {lift.unitType} ({getReadableDateString(lift.date)}),{" "}
            {getCelebrationEmoji(lift.entryIndex)} #{lift.entryIndex + 1} best{" "}
            {lift.reps}RM ever.
          </li>
        ))}
      </ul>
    </div>
  );
};
export function SelectedLiftsIndividualLiftCards() {
  const { parsedData, selectedLiftTypes } = useContext(ParsedDataContext);
  const { status: authStatus } = useSession();

  let xlGridCols = "";

  // Let's do some clever col stuff for desktop xl size
  switch (selectedLiftTypes.length) {
    case 1:
      xlGridCols = "1";
      break;
    case 2:
      xlGridCols = "2";
      break;
    default:
      xlGridCols = "4";
  }

  return (
    <div
      className={`mt-4 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-${xlGridCols}`}
    >
      {authStatus === "unauthenticated" && (
        <div className={`md:col-span-2 xl:col-span-${xlGridCols}`}>
          <Card>
            <CardHeader>
              <CardTitle>Demo Mode: Individual Lift Analysis Section</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="">
                Click the dumbbell icon below for selecting which lifts appear
                in this section, or use the dumbell icon in the top navigation
                bar. These selected lifts are also used in the{" "}
                <Link
                  href="/visualizer"
                  className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
                >
                  Visualizer
                </Link>{" "}
                chart.
              </div>
            </CardContent>
            <CardFooter className="flex justify-around">
              <SidePanelSelectLiftsButton isIconMode={false} />
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Map through each of the selected lifts  */}
      {selectedLiftTypes.map((lift) => (
        <LiftAchievementsCard
          key={`${lift}-card`}
          liftType={lift}
          parsedData={parsedData}
        />
      ))}

      {authStatus === "authenticated" && (
        <div className={`md:col-span-2 xl:col-span-${xlGridCols}`}>
          <Card>
            <CardHeader>
              <CardTitle>Analyzing Other Lifts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="">
                At any time click the dumbell button to select other lifts for
                analysis. The dumbell button is also in the top right corner of
                the navigation bar.
              </div>
            </CardContent>
            <CardFooter className="flex justify-around">
              <SidePanelSelectLiftsButton isIconMode={false} />
            </CardFooter>
          </Card>
        </div>
      )}
      <div className="mt-4"></div>
    </div>
  );
}
