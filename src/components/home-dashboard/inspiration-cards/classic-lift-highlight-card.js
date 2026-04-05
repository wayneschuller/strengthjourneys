import Link from "next/link";
import { Trophy, PlayCircle } from "lucide-react";
import { useMemo, useRef } from "react";

import { getDisplayWeight } from "@/lib/processing-utils";
import { getBigFourPrSectionHref } from "@/lib/classic-lift-memory";
import { pickClassicLiftMemory } from "@/lib/home-dashboard/classic-lift-highlight-selection";
import { ClassicLiftDetails } from "@/components/home-dashboard/inspiration-cards/classic-lift-details";
import { InspirationCard } from "@/components/home-dashboard/inspiration-cards/inspiration-card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ClassicLiftHighlightCard({
  parsedData,
  liftTypes,
  topLiftsByTypeAndReps,
  athleteBio,
  animationDelay = 0,
}) {
  const { age, bodyWeight, sex, standards, isMetric } = athleteBio;
  const hasBioData =
    age && bodyWeight && standards && Object.keys(standards).length > 0;

  const classicLiftSelectionRef = useRef(null);
  const classicLiftMemory = useMemo(
    () =>
      pickClassicLiftMemory({
        parsedData,
        liftTypes,
        topLiftsByTypeAndReps,
        hasBioData,
        age,
        bodyWeight,
        sex,
        isMetric,
        selectionCacheRef: classicLiftSelectionRef,
      }),
    [
      parsedData,
      liftTypes,
      topLiftsByTypeAndReps,
      hasBioData,
      age,
      bodyWeight,
      sex,
      isMetric,
    ],
  );

  const displayWeight = classicLiftMemory?.lift
    ? getDisplayWeight(classicLiftMemory.lift, isMetric ?? false)
    : null;
  const bigFourPrHref = classicLiftMemory?.lift?.liftType
    ? getBigFourPrSectionHref(classicLiftMemory.lift.liftType)
    : null;

  return (
    <InspirationCard
      accent="amber"
      icon={Trophy}
      description="Classic Lift"
      title={
        classicLiftMemory && displayWeight
          ? (
              <span className="inline-flex items-center gap-1.5">
                {bigFourPrHref ? (
                  <Link
                    href={bigFourPrHref}
                    className="font-medium text-primary hover:underline"
                  >
                    {classicLiftMemory.lift.liftType}
                  </Link>
                ) : (
                  classicLiftMemory.lift.liftType
                )}{" "}
                {classicLiftMemory.lift.reps}@
                {displayWeight.value}
                {displayWeight.unit}
                {(classicLiftMemory.lift.URL || classicLiftMemory.lift.url) && (
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a
                          href={classicLiftMemory.lift.URL || classicLiftMemory.lift.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Watch video"
                          className="text-muted-foreground/50 hover:text-foreground transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <PlayCircle className="h-4 w-4" />
                        </a>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p>Watch video</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </span>
            )
          : "No classic lifts yet"
      }
      footer={
        classicLiftMemory ? (
          <ClassicLiftDetails classicLiftMemory={classicLiftMemory} />
        ) : null
      }
      footerMultiline
      animationDelay={animationDelay}
    />
  );
}
