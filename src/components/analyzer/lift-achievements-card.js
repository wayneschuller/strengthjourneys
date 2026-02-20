"use client";

import { useState, useEffect, useMemo } from "react";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
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
  getDisplayWeight,
  getReadableDateString,
} from "@/lib/processing-utils";

import { devLog } from "@/lib/processing-utils";
import { useWindowSize } from "usehooks-ts";
import { Skeleton } from "@/components/ui/skeleton";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { Maximize2, Minimize2 } from "lucide-react";
import { Button, buttonVariants } from "../ui/button";
import { Separator } from "../ui/separator";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useLiftColors, LiftColorPicker } from "@/hooks/use-lift-colors";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { findBestE1RM } from "@/lib/processing-utils";
import { useReadLocalStorage } from "usehooks-ts";

/**
 * Card showing a lift's journey summary, PRs, recent highlights, and expandable detailed analysis.
 * Used on the Analyzer page and can be expanded to full-width for focused analysis.
 *
 * @param {Object} props
 * @param {string} props.liftType - Display name of the lift (e.g. "Bench Press").
 * @param {boolean} props.isExpanded - Whether the card is in expanded (full-width) mode.
 * @param {function()} props.onToggle - Callback to toggle between expanded and collapsed states.
 */
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
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggle();
                    }}
                  >
                    <Minimize2 />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggle();
                    }}
                  >
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
  const { liftTypes, topLiftsByTypeAndReps, topTonnageByType, topTonnageByTypeLast12Months } =
    useUserLiftingData();
  const { isMetric } = useAthleteBio();
  const e1rmFormula =
    useReadLocalStorage(LOCAL_STORAGE_KEYS.FORMULA, { initializeWithValue: false }) ?? "Brzycki";

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

  const heaviestSession = topTonnageByType?.[liftType]?.[0];
  const heaviestLast12 = topTonnageByTypeLast12Months?.[liftType]?.[0];
  const showHeaviestLast12 =
    heaviestLast12 &&
    heaviestSession &&
    (heaviestLast12.date !== heaviestSession.date ||
      heaviestLast12.tonnage !== heaviestSession.tonnage);

  const heaviestSessionDisplay = heaviestSession
    ? getDisplayWeight({ weight: heaviestSession.tonnage, unitType: heaviestSession.unitType }, isMetric)
    : null;
  const heaviestLast12Display = heaviestLast12
    ? getDisplayWeight({ weight: heaviestLast12.tonnage, unitType: heaviestLast12.unitType }, isMetric)
    : null;
  const e1rmDisplay = bestLift
    ? getDisplayWeight({ weight: bestE1RMWeight, unitType: bestLift.unitType }, isMetric)
    : null;
  const bestLiftDisplay = bestLift ? getDisplayWeight(bestLift, isMetric) : null;

  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
      <div className="col-span-2 text-lg font-semibold">
        {liftType} Summary Statistics:
      </div>
      <div className="font-semibold shrink-0">Total Reps:</div>
      <div>{totalReps}</div>
      <div className="font-semibold shrink-0">Total Sets:</div>
      <div>{totalSets}</div>
      <div className="font-semibold shrink-0">First lift:</div>
      <div>{getReadableDateString(oldestDate)}</div>
      <div className="font-semibold shrink-0">Most recent lift:</div>
      <div>{getReadableDateString(newestDate)}</div>
      {oneRM && <div className="font-semibold shrink-0">Best single:</div>}
      {oneRM && (
        <div>
          {getDisplayWeight(oneRM, isMetric).value}
          {getDisplayWeight(oneRM, isMetric).unit} ({getReadableDateString(oneRM.date)})
        </div>
      )}
      {threeRM && <div className="font-semibold shrink-0">Best triple:</div>}
      {threeRM && (
        <div>
          {getDisplayWeight(threeRM, isMetric).value}
          {getDisplayWeight(threeRM, isMetric).unit} ({getReadableDateString(threeRM.date)})
        </div>
      )}
      {fiveRM && <div className="font-semibold shrink-0">Best five:</div>}
      {fiveRM && (
        <div>
          {getDisplayWeight(fiveRM, isMetric).value}
          {getDisplayWeight(fiveRM, isMetric).unit} ({getReadableDateString(fiveRM.date)})
        </div>
      )}
      {heaviestSession && (
        <>
          <div className="font-semibold shrink-0">Heaviest session:</div>
          <div>
            {Math.round(heaviestSessionDisplay.value).toLocaleString()} {heaviestSessionDisplay.unit} (
            {getReadableDateString(heaviestSession.date)})
          </div>
        </>
      )}
      {showHeaviestLast12 && (
        <>
          <div className="font-semibold shrink-0">Heaviest (12 mo):</div>
          <div>
            {Math.round(heaviestLast12Display.value).toLocaleString()} {heaviestLast12Display.unit} (
            {getReadableDateString(heaviestLast12.date)})
          </div>
        </>
      )}
      {bestLift && (
        <div className="col-span-2 mt-4">
          Your highest potential {liftType} is {e1rmDisplay.value}
          {e1rmDisplay.unit} based on your {getReadableDateString(bestLift.date)} set of{" "}
          {bestLift.reps}@{bestLiftDisplay.value}
          {bestLiftDisplay.unit} (using {e1rmFormula} formula).
        </div>
      )}
    </div>
  );
};

export const LiftTypeRepPRsAccordion = ({ liftType }) => {
  const { topLiftsByTypeAndReps } = useUserLiftingData();
  const { isMetric } = useAthleteBio();
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
                {index + 1}@{getDisplayWeight(repRange[0], isMetric).value}{getDisplayWeight(repRange[0], isMetric).unit},{" "}
                {getReadableDateString(repRange[0].date)}.
              </AccordionTrigger>
              <AccordionContent>
                <div>
                  <ol className="list-decimal pl-[2rem]">
                    {repRange.slice(0, 20).map((lift, liftIndex) => (
                      <li key={liftIndex}>
                        <div className="grid grid-cols-4 even:bg-muted/40 md:grid-cols-6">
                          <div>
                            {index + 1}@{getDisplayWeight(lift, isMetric).value}{getDisplayWeight(lift, isMetric).unit}{"  "}
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
  const { isMetric } = useAthleteBio();
  if (!topLiftsByTypeAndReps) return null;

  // Compute cutoff once, then use string comparison in the filter
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const oneMonthAgoStr = oneMonthAgo.toISOString().slice(0, 10); // "YYYY-MM-DD"

  // Map the lifts for the given type to include their index, then filter for recent highlights
  const recentHighlights = topLiftsByTypeAndReps[liftType]
    ?.flatMap((repRange, repIndex) =>
      repRange.map((entry, entryIndex) => ({ ...entry, repIndex, entryIndex })),
    )
    .filter((entry) => entry.date >= oneMonthAgoStr)
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
            className="mb-1 grid grid-cols-4 even:bg-muted/40 md:grid-cols-6"
          >
            <div>
              {lift.reps}@{getDisplayWeight(lift, isMetric).value}
              {getDisplayWeight(lift, isMetric).unit}
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

const LIFTS_VISIBLE_INITIAL = 8;
const LIFTS_PER_PAGE = 8;

const ACCORDION_INITIAL = 10;
const ACCORDION_PAGE_SIZE = 10;

/** Grid template for accordion rows: Lift | Reps | Sets | 1RM | 3RM | 5RM. */
const ACCORDION_ROW_GRID =
  "md:grid md:grid-cols-[minmax(0,1fr)_auto_auto_minmax(5rem,auto)_minmax(5rem,auto)_minmax(5rem,auto)] md:gap-x-4";

/** Center data columns on desktop (reps, sets, 1RM, 3RM, 5RM). */
const ACCORDION_COL_CENTER = "md:text-center";

/** Space reserved so header grid matches row grid width (chevron + gap). Row uses mr-8; header uses pr-12. */
const ACCORDION_CHEVRON_GAP = "mr-8 md:mr-8";
const ACCORDION_HEADER_RIGHT_SPACE = "pr-12 md:pr-12";

/**
 * One-line summary for the accordion trigger: lift name, reps, sets, and on larger screens 1RM / 3RM / 5RM (lifetime PRs). List is ordered by reps (desc).
 */
function PopularLiftAccordionTriggerRow({ liftType }) {
  const { liftTypes, topLiftsByTypeAndReps } = useUserLiftingData();
  const { getColor } = useLiftColors();
  const { isMetric } = useAthleteBio();

  const lift = liftTypes?.find((l) => l.liftType === liftType);
  const topLiftsByReps = topLiftsByTypeAndReps?.[liftType];
  const oneRM = topLiftsByReps?.[0]?.[0];
  const threeRM = topLiftsByReps?.[2]?.[0];
  const fiveRM = topLiftsByReps?.[4]?.[0];

  const totalReps = lift?.totalReps ?? 0;
  const totalSets = lift?.totalSets ?? 0;

  const prCell = (pr) =>
    pr ? `${getDisplayWeight(pr, isMetric).value}${getDisplayWeight(pr, isMetric).unit}` : "—";

  return (
    <div className="w-full min-w-0 text-left">
      {/* Mobile: lift name + "X reps" only */}
      <div className={`md:hidden ${ACCORDION_CHEVRON_GAP}`}>
        <span
          className="font-semibold text-pretty underline decoration-2"
          style={{ textDecorationColor: getColor(liftType) }}
        >
          {liftType}
        </span>
        <span className="text-muted-foreground text-sm"> {totalReps.toLocaleString()} reps</span>
      </div>
      {/* Desktop: full grid */}
      <div className={`hidden min-w-0 md:block ${ACCORDION_ROW_GRID} ${ACCORDION_CHEVRON_GAP}`}>
        <span
          className="font-semibold text-pretty underline decoration-2"
          style={{ textDecorationColor: getColor(liftType) }}
        >
          {liftType}
        </span>
        <span className={`text-muted-foreground text-sm ${ACCORDION_COL_CENTER}`}>
          {totalReps.toLocaleString()}
        </span>
        <span className={`text-muted-foreground text-sm ${ACCORDION_COL_CENTER}`}>
          {totalSets.toLocaleString()}
        </span>
        <span
          className={`text-muted-foreground text-sm ${ACCORDION_COL_CENTER}`}
          title="1RM (lifetime)"
        >
          {prCell(oneRM)}
        </span>
        <span
          className={`text-muted-foreground text-sm ${ACCORDION_COL_CENTER}`}
          title="3RM (lifetime)"
        >
          {prCell(threeRM)}
        </span>
        <span
          className={`text-muted-foreground text-sm ${ACCORDION_COL_CENTER}`}
          title="5RM (lifetime)"
        >
          {prCell(fiveRM)}
        </span>
      </div>
    </div>
  );
}

/**
 * Full analysis card shown inside an accordion panel (reuses ExpandedLiftAchievements).
 */
function PopularLiftAccordionExpandedCard({ liftType }) {
  const { getColor } = useLiftColors();
  return (
    <Card>
      <CardHeader>
        <CardTitle
          className="text-xl text-pretty"
          style={{
            textDecoration: "underline",
            textDecorationColor: getColor(liftType),
          }}
        >
          {liftType} Detailed Analysis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ExpandedLiftAchievements liftType={liftType} />
      </CardContent>
      <CardFooter className="text-sm font-extralight">
        <LiftColorPicker liftType={liftType} />
      </CardFooter>
    </Card>
  );
}

/**
 * Accordion of most popular lifts (by total reps). Each row shows lift name and
 * basic stats; expanding shows the full analysis (summary stats, recent
 * highlights, rep-range PRs). Top 10 shown initially with "Show more" for 10 more.
 */
export function PopularLiftsAccordion() {
  const { liftTypes } = useUserLiftingData();
  const [visibleCount, setVisibleCount] = useState(ACCORDION_INITIAL);
  const [openItems, setOpenItems] = useState([]);

  const sortedByReps = useMemo(() => {
    if (!liftTypes?.length) return [];
    return [...liftTypes].sort((a, b) => (b.totalReps ?? 0) - (a.totalReps ?? 0));
  }, [liftTypes]);

  const visibleLifts = useMemo(
    () => sortedByReps.slice(0, visibleCount),
    [sortedByReps, visibleCount],
  );
  const hasMore = visibleCount < sortedByReps.length;
  const remaining = sortedByReps.length - visibleCount;

  const visibleIds = useMemo(
    () => visibleLifts.map((l) => l.liftType),
    [visibleLifts],
  );
  const allExpanded =
    visibleIds.length > 0 &&
    visibleIds.every((id) => openItems.includes(id));

  const toggleExpandAll = () =>
    setOpenItems(allExpanded ? [] : visibleIds);

  const totalLiftTypes = sortedByReps.length;
  const isAllLifts = totalLiftTypes <= 10;
  const cardTitle = isAllLifts
    ? "All your lifts"
    : "Your most popular lifts";
  const cardDescription =
    !isAllLifts &&
    "Top lifts by volume. Expand any row for full stats, PRs and highlights.";

  if (!liftTypes?.length) return null;

  return (
    <Card className="mt-4">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle>{cardTitle}</CardTitle>
            {cardDescription && (
              <CardDescription>{cardDescription}</CardDescription>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleExpandAll}
            className="shrink-0"
          >
            {allExpanded ? "Collapse all" : "Expand all"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div
          className={`hidden border-b pb-2 text-muted-foreground text-sm font-medium md:block ${ACCORDION_ROW_GRID} ${ACCORDION_HEADER_RIGHT_SPACE}`}
          aria-hidden
        >
          <span>Lift</span>
          <span className={ACCORDION_COL_CENTER}>Reps</span>
          <span className={ACCORDION_COL_CENTER}>Sets</span>
          <span className={ACCORDION_COL_CENTER} title="1 rep max (lifetime)">1RM</span>
          <span className={ACCORDION_COL_CENTER} title="3 rep max (lifetime)">3RM</span>
          <span className={ACCORDION_COL_CENTER} title="5 rep max (lifetime)">5RM</span>
        </div>
        <Accordion
          type="multiple"
          value={openItems}
          onValueChange={setOpenItems}
          className="w-full"
        >
          {visibleLifts.map((lift) => (
            <AccordionItem key={lift.liftType} value={lift.liftType}>
              <AccordionTrigger className="py-3 hover:no-underline">
                <PopularLiftAccordionTriggerRow liftType={lift.liftType} />
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-0">
                <PopularLiftAccordionExpandedCard liftType={lift.liftType} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        {hasMore && (
          <div className="mt-4 flex justify-center">
            <Button
              variant="outline"
              onClick={() => setVisibleCount((c) => c + ACCORDION_PAGE_SIZE)}
            >
              Show more ({remaining} remaining)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Renders lift achievement cards for the most popular lifts (by total reps),
 * with a "Show more" button to reveal another 8 at a time. No dependency on
 * SelectedLifts localStorage or the side-panel lift chooser.
 */
export function PopularLiftsIndividualLiftCards() {
  const { parsedData, liftTypes } = useUserLiftingData();
  const [expandedCard, setExpandedCard] = useState(null);
  const [visibleCount, setVisibleCount] = useState(LIFTS_VISIBLE_INITIAL);
  const [parent] = useAutoAnimate(/* optional config */);
  const { width } = useWindowSize({ initializeWithValue: false });
  const isMobile = width !== undefined && width <= 768;

  const sortedByReps = useMemo(() => {
    if (!liftTypes?.length) return [];
    return [...liftTypes].sort((a, b) => (b.totalReps ?? 0) - (a.totalReps ?? 0));
  }, [liftTypes]);

  const visibleLiftTypes = useMemo(
    () => sortedByReps.slice(0, visibleCount).map((l) => l.liftType),
    [sortedByReps, visibleCount],
  );

  const hasMore = visibleCount < sortedByReps.length;
  const toggleCard = (liftType) => {
    setExpandedCard((current) => (current === liftType ? null : liftType));
  };

  useEffect(() => {
    if (visibleLiftTypes.length === 1) setExpandedCard(visibleLiftTypes[0]);
  }, [visibleLiftTypes]);

  const expandedCardData = visibleLiftTypes.find((lift) => lift === expandedCard);
  const otherCards = isMobile
    ? visibleLiftTypes
    : visibleLiftTypes.filter((lift) => lift !== expandedCard);

  if (!liftTypes?.length) return null;

  return (
    <div
      ref={parent}
      className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4"
    >
      {!isMobile && expandedCardData && (
        <div className="col-span-1 md:col-span-2 xl:col-span-4">
          <LiftAchievementsCard
            key={`${expandedCard}-card`}
            liftType={expandedCardData}
            parsedData={parsedData}
            isExpanded={true}
            onToggle={() => toggleCard(expandedCardData)}
          />
        </div>
      )}

      {otherCards.map((lift) => (
        <LiftAchievementsCard
          key={`${lift}-card`}
          liftType={lift}
          parsedData={parsedData}
          isExpanded={isMobile ? expandedCard === lift : false}
          onToggle={() => toggleCard(lift)}
        />
      ))}

      {hasMore && (
        <div className="col-span-1 md:col-span-2 xl:col-span-4 flex justify-center">
          <Button
            variant="outline"
            onClick={() => setVisibleCount((c) => c + LIFTS_PER_PAGE)}
          >
            Show more ({sortedByReps.length - visibleCount} remaining)
          </Button>
        </div>
      )}
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
