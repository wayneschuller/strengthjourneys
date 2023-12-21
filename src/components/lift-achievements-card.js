"use client";

import { useState, useEffect, useContext } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
  CardDescription,
} from "@/components/ui/card";
import {
  getCelebrationEmoji,
  getReadableDateString,
} from "@/lib/processing-utils";
import { devLog } from "@/lib/processing-utils";
import { ParsedDataContext } from "@/pages/_app";
import { Skeleton } from "./ui/skeleton";
import { SidePanelSelectLiftsButton } from "@/components/side-panel-lift-chooser";
import { useSession } from "next-auth/react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { Maximize2, Minimize2 } from "lucide-react";
import { Button } from "./ui/button";

export function LiftAchievementsCard({ liftType, isExpanded, onToggle }) {
  // const [expand, setExpand] = useState(false);
  const { liftTypes, topLiftsByTypeAndReps } = useContext(ParsedDataContext);
  const [parent, enableAnimations] = useAutoAnimate(/* optional config */);

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
    <Card
      // className={isExpanded ? "col-span-4" : "col-span-1"}
      onClick={onToggle}
    >
      <CardHeader className="relative">
        {/* <div className="flex flex-row justify-between align-top"> */}

        <div className="absolute right-0 top-0 p-2">
          {isExpanded ? (
            <Button variant="ghost" size="icon">
              <Minimize2 />
            </Button>
          ) : (
            <Button variant="ghost" size="icon">
              <Maximize2 />
            </Button>
          )}
        </div>
        <CardTitle className="text-pretty mr-2">{liftType}</CardTitle>
      </CardHeader>
      <CardContent>
        {!liftTypes && <Skeleton className="h-64" />}
        {liftTypes && (
          <div ref={parent}>
            <div className="grid grid-cols-2 gap-x-1">
              <div className="font-semibold">Total reps (sets):</div>
              <div>
                {totalReps} ({totalSets})
              </div>
              <div className="font-semibold">First lift:</div>
              <div>{getReadableDateString(oldestDate)}</div>
              <div className="font-semibold">Most recent lift:</div>{" "}
              <div>{getReadableDateString(newestDate)}</div>
            </div>
            {isExpanded && oneRM && (
              <div className="font-semibold">Best single:</div>
            )}
            {isExpanded && oneRM && (
              <div>
                {oneRM.weight}
                {oneRM.unitType} ({getReadableDateString(oneRM.date)})
              </div>
            )}
            {isExpanded && threeRM && (
              <div className="font-semibold">Best triple:</div>
            )}
            {isExpanded && threeRM && (
              <div>
                {threeRM.weight}
                {threeRM.unitType} ({getReadableDateString(threeRM.date)})
              </div>
            )}
            {isExpanded && fiveRM && (
              <div className="font-semibold">Best five:</div>
            )}
            {isExpanded && fiveRM && (
              <div>
                {fiveRM.weight}
                {fiveRM.unitType} ({getReadableDateString(fiveRM.date)})
              </div>
            )}
            {isExpanded && (
              <RecentLiftHighlights
                liftType={liftType}
                topLiftsByTypeAndReps={topLiftsByTypeAndReps}
              />
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="text-sm font-extralight">
        Click{" "}
        {isExpanded
          ? "to reduce to summary view"
          : `for full ${liftType} analysis`}
      </CardFooter>
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
  const [expandedCard, setExpandedCard] = useState(null);
  const [parent, enableAnimations] = useAutoAnimate(/* optional config */);

  useEffect(() => {
    // devLog(selectedLiftTypes);
    if (selectedLiftTypes.length === 1) setExpandedCard(selectedLiftTypes[0]);
  }, [selectedLiftTypes]);

  const toggleCard = (liftType) => {
    // Collapse the current card if it's expanded
    if (expandedCard === liftType) {
      setExpandedCard(null);
    } else {
      // Collapse any expanded card first
      setExpandedCard(null);

      // Wait for moment and then expand the new card (FIXME: is this dumb?)
      setTimeout(() => {
        setExpandedCard(liftType);
      }, 300);
    }
  };

  // Find the expanded card
  const expandedCardData = selectedLiftTypes.find(
    (lift) => lift === expandedCard,
  );

  // Filter out the expanded card from the list
  const otherCards = selectedLiftTypes.filter((lift) => lift !== expandedCard);

  // FIXME: we need to do some engineering for mobile vs the rest.
  // For mobile a simple 1 col grid with an expanding lift card is fine and easy.
  // For desktop we want a clicked lift card to rise and go full width at the top of the lift card section
  // So expanded should mean we put it in it's own row.
  // Do this before the grid starts so we don't even have to worry about grid cols (as below).
  // JUst do a ismobile jsx condition for the old way and the new way

  return (
    <div
      ref={parent}
      className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4"
    >
      {expandedCardData && (
        <div className={`col-span-1 md:col-span-2 xl:col-span-4`}>
          <LiftAchievementsCard
            key={`${expandedCard}-card`}
            liftType={expandedCard}
            parsedData={parsedData}
            isExpanded={true}
            onToggle={() => toggleCard(expandedCard)}
          />
        </div>
      )}

      {otherCards.map((lift) => (
        <LiftAchievementsCard
          key={`${lift}-card`}
          liftType={lift}
          parsedData={parsedData}
          isExpanded={false}
          onToggle={() => toggleCard(lift)}
        />
      ))}

      <div className={`col-span-1 md:col-span-2 xl:col-span-4`}>
        <Card>
          <CardHeader>
            <CardTitle>Analyzing Other Lifts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="">
              Click the dumbbell icon below for selecting which lifts appear in
              this section, or use the dumbell icon in the top navigation bar.
              These selected lifts are also used in the{" "}
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
    </div>
  );
}
