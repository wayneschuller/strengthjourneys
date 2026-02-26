import Link from "next/link";
import { Trophy, Video } from "lucide-react";
import { useMemo, useRef } from "react";

import { getDisplayWeight } from "@/lib/processing-utils";
import { getBigFourPrSectionHref } from "@/lib/classic-lift-memory";
import { pickClassicLiftMemory } from "@/lib/home-dashboard/classic-lift-highlight-selection";
import { Button } from "@/components/ui/button";
import { ClassicLiftDetails } from "./classic-lift-details";
import { InspirationCard } from "./inspiration-card";

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
              <>
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
              </>
            )
          : "No classic lifts yet"
      }
      footer={
        classicLiftMemory ? (
          <ClassicLiftDetails classicLiftMemory={classicLiftMemory} />
        ) : null
      }
      footerMultiline
      action={
        classicLiftMemory?.lift?.URL || classicLiftMemory?.lift?.url ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            aria-label="Open lift video"
            title="Open lift video"
            onClick={() =>
              window.open(
                classicLiftMemory.lift.URL || classicLiftMemory.lift.url,
                "_blank",
                "noopener,noreferrer",
              )
            }
          >
            <Video className="h-3.5 w-3.5" />
          </Button>
        ) : null
      }
      animationDelay={animationDelay}
    />
  );
}
