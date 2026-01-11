"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
  CardDescription,
} from "@/components/ui/card";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import {
  getCelebrationEmoji,
  getReadableDateString,
} from "@/lib/processing-utils";

import { devLog } from "@/lib/processing-utils";
import { useWindowSize } from "usehooks-ts";
import { Skeleton } from "@/components/ui/skeleton";
import { SidePanelSelectLiftsButton } from "@/components/side-panel-lift-chooser";
import { useSession } from "next-auth/react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { Maximize2, Minimize2 } from "lucide-react";
import { Button, buttonVariants } from "../ui/button";
import { Separator } from "../ui/separator";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useLiftColors, LiftColorPicker } from "@/hooks/use-lift-colors";
import { findBestE1RM } from "@/lib/processing-utils";
import { useReadLocalStorage } from "usehooks-ts";

export function LiftAchievementsCard({ liftType, isExpanded, onToggle }) {
  const { liftTypes } = useUserLiftingData();
  const [parent, enableAnimations] = useAutoAnimate(/* optional config */);
  const { getColor } = useLiftColors();

  const lift = liftTypes?.find((lift) => lift.liftType === liftType);
  const totalReps = lift ? lift.totalReps : null;
  const totalSets = lift ? lift.totalSets : null;

  return (
    <Card
      onClick={() => {
        if (!isExpanded) onToggle();
      }}
    >
      <CardHeader className="relative">
        <div className="absolute right-0 top-0 p-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                {isExpanded ? (
                  <Button variant="ghost" size="icon" onClick={onToggle}>
                    <Minimize2 />
                  </Button>
                ) : (
                  <Button variant="ghost" size="icon" onClick={onToggle}>
                    <Maximize2 />
                  </Button>
                )}
              </TooltipTrigger>
              <TooltipContent>
                {isExpanded ? "Minimise" : "Expand to full analysis"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <CardTitle
          className={cn("mr-5 text-pretty", isExpanded && "text-3xl")}
          style={{
            textDecoration: "underline",
            textDecorationColor: `${getColor(liftType)}`,
          }}
        >
          {liftType}
          {isExpanded && " Detailed Analysis"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!liftTypes && <Skeleton className="h-64" />}
        {liftTypes && (
          <div ref={parent}>
            {!isExpanded && (
              <div className="grid grid-cols-2 gap-x-1">
                <div className="font-semibold">Total reps:</div>
                <div>{totalReps}</div>
                <div className="font-semibold">Total sets:</div>
                <div>{totalSets}</div>
              </div>
            )}
            {isExpanded && <ExpandedLiftAchievements liftType={liftType} />}
          </div>
        )}
      </CardContent>
      <CardFooter className="text-sm font-extralight">
        {isExpanded && <LiftColorPicker liftType={liftType} />}
      </CardFooter>
    </Card>
  );
}

// A big card telling the user good stuff about a particular lift type
// FIXME: this would be a great place to make the color for this lift type configurable
export function ExpandedLiftAchievements({ liftType }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:justify-stretch">
      <div className="md:w-1/2">
        <LiftTypeSummaryStatistics liftType={liftType} />
        <Separator orientation="horizontal" className="col-span-2 my-4" />
        <LiftTypeRecentHighlights liftType={liftType} />
      </div>
      <div>
        <Separator orientation="vertical" className="hidden md:block" />
        <Separator orientation="horizontal" className="block md:hidden" />
      </div>
      <div className="md:w-1/2">
        <LiftTypeRepPRsAccordion liftType={liftType} />
      </div>
    </div>
  );
}

// Show some good overview summary statistics for this liftType.
//
// FIXME: be creative, could we show them progress to the next milestone that we calculate?
// e.g.: next plate milestone, next round number milestone (in either units)
// Also reward them for what milestones they have, by the same formula
// So create a milestones function.
// Visually showing progress to the next milestone would be good - progress bar.
export const LiftTypeSummaryStatistics = ({ liftType }) => {
  const { liftTypes, topLiftsByTypeAndReps } = useUserLiftingData();
  const e1rmFormula =
    useReadLocalStorage("formula", { initializeWithValue: false }) ?? "Brzycki";

  if (!liftTypes) return null;
  if (!topLiftsByTypeAndReps) return null;

  const lift = liftTypes?.find((lift) => lift.liftType === liftType);
  const newestDate = lift ? lift.newestDate : null;
  const oldestDate = lift ? lift.oldestDate : null;
  const totalReps = lift ? lift.totalReps : null;
  const totalSets = lift ? lift.totalSets : null;

  const topLiftsByReps = topLiftsByTypeAndReps?.[liftType];
  const oneRM = topLiftsByReps?.[0]?.[0];
  const threeRM = topLiftsByReps?.[2]?.[0];
  const fiveRM = topLiftsByReps?.[4]?.[0];

  const { bestLift, bestE1RMWeight, unitType } = findBestE1RM(
    liftType,
    topLiftsByTypeAndReps,
    e1rmFormula,
  );

  // devLog(`best ${liftType} is ${bestE1RMWeight}${unitType}`);
  // devLog(bestLift);

  return (
    <div className="grid grid-cols-3 justify-start">
      <div className="col-span-3 text-lg font-semibold">
        {liftType} Summary Statistics:
      </div>
      <div className="font-semibold">Total Reps:</div>
      <div className="col-span-2">{totalReps}</div>
      <div className="font-semibold"> Total Sets: </div>
      <div className="col-span-2">{totalSets}</div>
      <div className="font-semibold">First lift: </div>
      <div className="col-span-2">{getReadableDateString(oldestDate)}</div>
      <div className="font-semibold">Most recent lift:</div>{" "}
      <div className="col-span-2">{getReadableDateString(newestDate)}</div>
      {oneRM && <div className="font-semibold">Best single:</div>}
      {oneRM && (
        <div className="col-span-2">
          {oneRM.weight}
          {oneRM.unitType} ({getReadableDateString(oneRM.date)})
        </div>
      )}
      {threeRM && <div className="font-semibold">Best triple:</div>}
      {threeRM && (
        <div className="col-span-2">
          {threeRM.weight}
          {threeRM.unitType} ({getReadableDateString(threeRM.date)})
        </div>
      )}
      {fiveRM && <div className="font-semibold">Best five:</div>}
      {fiveRM && (
        <div className="col-span-2">
          {fiveRM.weight}
          {fiveRM.unitType} ({getReadableDateString(fiveRM.date)})
        </div>
      )}
      {bestLift && (
        <div className="col-span-3 mt-4">
          Your highest potential {liftType} is {bestE1RMWeight}
          {unitType} based on your {getReadableDateString(bestLift.date)} set of{" "}
          {bestLift.reps}@{bestLift.weight}
          {bestLift.unitType} (using {e1rmFormula} formula).
        </div>
      )}
    </div>
  );
};

export const LiftTypeRepPRsAccordion = ({ liftType }) => {
  const { topLiftsByTypeAndReps } = useUserLiftingData();
  if (!topLiftsByTypeAndReps) return null;

  const topLiftsByReps = topLiftsByTypeAndReps?.[liftType];
  if (!topLiftsByReps) return null;

  return (
    <div className="">
      <div className="text-lg font-semibold">{liftType} Rep Range PRs:</div>
      <Accordion type="single" collapsible className="w-full px-4 md:px-0">
        {topLiftsByReps.slice(0, 10).map((repRange, index) => {
          if (repRange.length === 0) return null; // Skip if the array is empty

          return (
            <AccordionItem
              key={`${liftType}-${index + 1}`}
              value={`${liftType}-${index + 1}`}
            >
              <AccordionTrigger>
                {`${index + 1}@${repRange[0].weight}${repRange[0].unitType}`},{" "}
                {getReadableDateString(repRange[0].date)}.
              </AccordionTrigger>
              <AccordionContent>
                <div>
                  <ol className="list-decimal pl-[2rem]">
                    {repRange.slice(0, 20).map((lift, liftIndex) => (
                      <li key={liftIndex}>
                        <div className="grid grid-cols-4 even:bg-accent-foreground/20 dark:even:bg-muted/40 md:grid-cols-6">
                          <div>
                            {`${index + 1}@${lift.weight}${lift.unitType}  `}
                          </div>
                          <div>
                            {lift.URL && (
                              <a
                                className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
                                target="_blank"
                                href={lift.URL}
                              >
                                {getReadableDateString(lift.date)}
                              </a>
                            )}
                            {!lift.URL && (
                              <div>{getReadableDateString(lift.date)}</div>
                            )}
                          </div>
                          <div className="col-span-2 md:col-span-4">
                            <TruncatedText text={lift.notes} />
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
};

export const LiftTypeRecentHighlights = ({ liftType }) => {
  const { topLiftsByTypeAndReps } = useUserLiftingData();
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
    .slice(0, 10); // Only show top n highlights per card

  if (!recentHighlights || recentHighlights.length <= 0) return null;

  return (
    <div>
      <div className="mb-2 text-lg font-semibold">
        Recent {liftType} Highlights (Last Four Weeks):
      </div>
      <ul>
        {recentHighlights.map((lift, index) => (
          <li
            key={index}
            className="mb-1 grid grid-cols-4 even:bg-accent-foreground/20 dark:even:bg-muted/40 md:grid-cols-6"
          >
            <div>
              {lift.reps}@{lift.weight}
              {lift.unitType}
            </div>
            <div>{getReadableDateString(lift.date)}</div>
            <div className="col-span-2">
              {getCelebrationEmoji(lift.entryIndex)} #{lift.entryIndex + 1} best{" "}
              {lift.reps}RM ever.
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export function SelectedLiftsIndividualLiftCards() {
  const { parsedData, selectedLiftTypes } = useUserLiftingData();
  const [expandedCard, setExpandedCard] = useState(null);
  const [parent] = useAutoAnimate(/* optional config */);
  const { width } = useWindowSize({ initializeWithValue: false });
  let isMobile = false;

  useEffect(() => {
    // devLog(selectedLiftTypes);
    if (selectedLiftTypes.length === 1) setExpandedCard(selectedLiftTypes[0]);
  }, [selectedLiftTypes]);

  if (width <= 768) {
    isMobile = true;
  }

  const toggleCard = (liftType) => {
    // Collapse the current card if it's expanded
    setExpandedCard(expandedCard === liftType ? null : liftType);
  };

  // Find the expanded card
  const expandedCardData = selectedLiftTypes.find(
    (lift) => lift === expandedCard,
  );

  // Filter out the expanded card from the list
  let otherCards = selectedLiftTypes;
  if (!isMobile)
    otherCards = selectedLiftTypes.filter((lift) => lift !== expandedCard);

  // For mobile a simple 1 col grid with an expanding lift card is fine and easy.
  // For desktop we want a clicked lift card to rise and go full width at the top of the lift card section
  // So expanded should mean we put it in it's own row.
  // Do this before the grid starts so we don't even have to worry about grid cols.

  return (
    <div
      ref={parent}
      className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4"
    >
      {!isMobile && expandedCardData && (
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
          isExpanded={isMobile ? expandedCard === lift : false} // Allow mobile to expand in place
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

const TruncatedText = ({ text }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const truncLength = 100;

  if (!text) return null;

  const truncatedText =
    text.length > truncLength ? text.substring(0, truncLength) + "..." : text;

  return (
    <div className="text-pretty" onClick={() => setIsExpanded(!isExpanded)}>
      {isExpanded ? text : truncatedText}
    </div>
  );
};
