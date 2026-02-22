"use client";

import { useState, useMemo } from "react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import { getDisplayWeight } from "@/lib/processing-utils";

import { Button } from "../ui/button";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useLiftColors } from "@/hooks/use-lift-colors";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { LiftJourneyCard } from "@/components/visualizer/lift-journey-card";
import { LiftTypeRepPRsDisplay } from "@/components/analyzer/lift-type-prs-display";

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
 * Expanded content for an accordion row: lift journey card + rep-range PR display.
 */
function PopularLiftAccordionExpandedCard({ liftType }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 lg:divide-x">
          <div className="lg:pr-6">
            <LiftJourneyCard liftType={liftType} asCard={false} />
          </div>
          <div className="mt-6 lg:mt-0 lg:pl-6">
            <LiftTypeRepPRsDisplay liftType={liftType} compact />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Accordion of most popular lifts (by total reps). Each row shows lift name and
 * basic stats; expanding shows the lift journey card and rep-range PRs.
 * Top 10 shown initially with "Show more" for 10 more.
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
