import { useMemo } from "react";

import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { ClassicLiftHighlightCard } from "@/components/home-dashboard/inspiration-cards/classic-lift-highlight-card";
import { ConsistencyStreakCard } from "@/components/home-dashboard/inspiration-cards/consistency-streak-card";
import { FirstWeekGoalCard } from "@/components/home-dashboard/inspiration-cards/first-week-goal-card";
import { HomeInspirationCardsSkeleton } from "@/components/home-dashboard/inspiration-cards/home-inspiration-cards-skeleton";
import { JourneyProgressCard } from "@/components/home-dashboard/inspiration-cards/journey-progress-card";
import { LifetimeTonnageCard } from "@/components/home-dashboard/inspiration-cards/lifetime-tonnage-card";
import { ProgrammingTipCard } from "@/components/home-dashboard/inspiration-cards/programming-tip-card";
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
export function HomeInspirationCards({
  isProgressDone = false,
  dashboardStage = "established",
  sessionCount = 0,
}) {
  const {
    parsedData,
    liftTypes,
    topLiftsByTypeAndReps,
    sessionTonnageLookup,
  } = useUserLiftingData();
  const athleteBio = useAthleteBio();

  const allSessionDates = useMemo(
    () => sessionTonnageLookup?.allSessionDates ?? [],
    [sessionTonnageLookup],
  );

  const cards = useMemo(() => {
    const journeyCard = (
      <JourneyProgressCard
        key="journey"
        parsedData={parsedData}
        liftTypes={liftTypes}
        animationDelay={0}
      />
    );
    const classicLiftCard = (
      <ClassicLiftHighlightCard
        key="classic"
        parsedData={parsedData}
        liftTypes={liftTypes}
        topLiftsByTypeAndReps={topLiftsByTypeAndReps}
        athleteBio={athleteBio}
        animationDelay={200}
      />
    );
    const sharedCards = [journeyCard, classicLiftCard];

    if (dashboardStage === "first_real_week") {
      return [
        ...sharedCards,
        <FirstWeekGoalCard
          key="first-week-goal"
          allSessionDates={allSessionDates}
          sessionCount={sessionCount}
          animationDelay={400}
        />,
        <ProgrammingTipCard
          key="programming-tip"
          dashboardStage={dashboardStage}
          animationDelay={600}
        />,
        <LifetimeTonnageCard
          key="lifetime-tonnage"
          sessionTonnageLookup={sessionTonnageLookup}
          isMetric={athleteBio.isMetric}
          animationDelay={800}
        />,
      ];
    }

    if (dashboardStage === "first_month") {
      return [
        journeyCard,
        <ConsistencyStreakCard
          key="consistency"
          allSessionDates={allSessionDates}
          animationDelay={200}
        />,
        <ProgrammingTipCard
          key="programming-tip"
          dashboardStage={dashboardStage}
          animationDelay={400}
        />,
      ];
    }

    return [
      ...sharedCards,
      <TrainingMomentumCard
        key="momentum"
        allSessionDates={allSessionDates}
        animationDelay={400}
      />,
      <LifetimeTonnageCard
        key="lifetime-tonnage"
        sessionTonnageLookup={sessionTonnageLookup}
        isMetric={athleteBio.isMetric}
        animationDelay={600}
      />,
      <ConsistencyStreakCard
        key="consistency"
        allSessionDates={allSessionDates}
        animationDelay={800}
      />,
    ];
  }, [
    parsedData,
    liftTypes,
    topLiftsByTypeAndReps,
    athleteBio,
    dashboardStage,
    allSessionDates,
    sessionCount,
    sessionTonnageLookup,
  ]);

  return (
    <div className="col-span-full flex flex-wrap gap-5 [&>*]:min-w-[220px] [&>*]:flex-1">
      {!isProgressDone && <HomeInspirationCardsSkeleton />}
      {isProgressDone && cards}
    </div>
  );
}
