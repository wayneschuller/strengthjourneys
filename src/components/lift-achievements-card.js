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
import { ParsedDataContext } from "@/pages/_app";
import { Skeleton } from "./ui/skeleton";
import { SidePanelSelectLiftsButton } from "@/components/side-panel-lift-chooser";
import { useSession } from "next-auth/react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { Maximize2, Minimize2 } from "lucide-react";
import { Button, buttonVariants } from "./ui/button";
import { Separator } from "./ui/separator";

export function LiftAchievementsCard({ liftType, isExpanded, onToggle }) {
  const { liftTypes, topLiftsByTypeAndReps } = useContext(ParsedDataContext);
  const [parent, enableAnimations] = useAutoAnimate(/* optional config */);

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
        <CardTitle className="mr-4">
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
        {/* Click{" "} */}
        {/* {isExpanded */}
        {/* ? "to reduce to summary view" */}
        {/* : `for full ${liftType} analysis`} */}
      </CardFooter>
    </Card>
  );
}

// A big card telling the user good stuff about a particular lift type
function ExpandedLiftAchievements({ liftType }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:justify-stretch">
      <div className="md:w-1/2">
        <SummaryStatistics liftType={liftType} />
        <Separator orientation="horizontal" className="col-span-2 my-4" />
        <RecentLiftHighlights liftType={liftType} />
      </div>
      <div>
        <Separator orientation="vertical" className="hidden md:block" />
        <Separator orientation="horizontal" className="block md:hidden" />
      </div>
      <div className="md:w-1/2">
        <RepPRsAccordion liftType={liftType} />
      </div>
    </div>
  );
}

const SummaryStatistics = ({ liftType }) => {
  const { liftTypes, topLiftsByTypeAndReps } = useContext(ParsedDataContext);

  const lift = liftTypes?.find((lift) => lift.liftType === liftType);
  const newestDate = lift ? lift.newestDate : null;
  const oldestDate = lift ? lift.oldestDate : null;
  const totalReps = lift ? lift.totalReps : null;
  const totalSets = lift ? lift.totalSets : null;

  const topLiftsByReps = topLiftsByTypeAndReps?.[liftType];
  const oneRM = topLiftsByReps?.[0]?.[0];
  const threeRM = topLiftsByReps?.[2]?.[0];
  const fiveRM = topLiftsByReps?.[4]?.[0];
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
    </div>
  );
};

const RepPRsAccordion = ({ liftType }) => {
  const { topLiftsByTypeAndReps } = useContext(ParsedDataContext);
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
                        <div className="grid grid-cols-4 md:grid-cols-6">
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

const RecentLiftHighlights = ({ liftType }) => {
  const { topLiftsByTypeAndReps } = useContext(ParsedDataContext);
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
          <li key={index}>
            <div className="grid grid-cols-4">
              <div>
                {lift.reps}@{lift.weight}
                {lift.unitType}
              </div>
              <div>{getReadableDateString(lift.date)}</div>
              <div className="col-span-2">
                {getCelebrationEmoji(lift.entryIndex)} #{lift.entryIndex + 1}{" "}
                best {lift.reps}RM ever.
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export function SelectedLiftsIndividualLiftCards() {
  const { parsedData, selectedLiftTypes } = useContext(ParsedDataContext);
  const [expandedCard, setExpandedCard] = useState(null);
  const [parent] = useAutoAnimate(/* optional config */);
  const { width } = useWindowSize();
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
