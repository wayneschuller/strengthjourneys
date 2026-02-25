import { useMemo } from "react";

import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { ClassicLiftHighlightCard } from "@/components/home-dashboard/inspiration-cards/classic-lift-highlight-card";
import { ConsistencyStreakCard } from "@/components/home-dashboard/inspiration-cards/consistency-streak-card";
import { HomeInspirationCardsSkeleton } from "@/components/home-dashboard/inspiration-cards/home-inspiration-cards-skeleton";
import { JourneyProgressCard } from "@/components/home-dashboard/inspiration-cards/journey-progress-card";
import { LifetimeTonnageCard } from "@/components/home-dashboard/inspiration-cards/lifetime-tonnage-card";
import { TrainingMomentumCard } from "@/components/home-dashboard/inspiration-cards/training-momentum-card";

/**
 * Shows a row of stat cards with key metrics: journey length, classic lift memory,
 * session momentum (90-day comparison), lifetime tonnage, and weekly consistency streak.
 * Uses useUserLiftingData and useAthleteBioData internally.
 *
 * @param {Object} props
 * @param {boolean} [props.isProgressDone=false] - When true, the actual stat cards are rendered.
 *   When false, a skeleton placeholder is shown (e.g. while row-count animation is running
 *   on the home dashboard).
 */
export function HomeInspirationCards({ isProgressDone = false }) {
  const { parsedData, liftTypes, topLiftsByTypeAndReps, sessionTonnageLookup } =
    useUserLiftingData();
  const athleteBio = useAthleteBio();

  const allSessionDates = useMemo(
    () => sessionTonnageLookup?.allSessionDates ?? [],
    [sessionTonnageLookup],
  );

  return (
    <div className="col-span-full grid grid-cols-2 gap-5 xl:grid-cols-3 2xl:grid-cols-5">
      {!isProgressDone && <HomeInspirationCardsSkeleton />}
      {isProgressDone && (
        <>
          <JourneyProgressCard
            parsedData={parsedData}
            liftTypes={liftTypes}
            animationDelay={0}
          />
          <ClassicLiftHighlightCard
            parsedData={parsedData}
            liftTypes={liftTypes}
            topLiftsByTypeAndReps={topLiftsByTypeAndReps}
            athleteBio={athleteBio}
            animationDelay={200}
          />
          <TrainingMomentumCard
            allSessionDates={allSessionDates}
            animationDelay={400}
          />
          <LifetimeTonnageCard
            sessionTonnageLookup={sessionTonnageLookup}
            isMetric={athleteBio.isMetric}
            animationDelay={600}
          />
          <ConsistencyStreakCard
            allSessionDates={allSessionDates}
            animationDelay={800}
          />
        </>
      )}
    </div>
  );
}

export { HomeInspirationCards as SectionTopCards };
