/**
 * Story of the day: one quiet stat about the lifter, joined to the greeting by
 * DashboardGreeting. It is a small reward on the way in; the three headline
 * cards below are the main event, so keep this to a single card's height.
 *
 * There is no pager. The morning shows the best story and the afternoon the
 * second best, so a lifter who checks in twice a day hears two things and
 * nothing asks them to click through the rest.
 *
 * Stories come from two places. Event stories (a PR this week, a meet or
 * lifting anniversary, a PR anniversary, the longest streak) are found by
 * lib/home-dashboard/story-of-the-day.js and only exist when the log earns
 * them. Evergreen stories are the stage's summary cards, shuffled once a day.
 * Events always outrank evergreens, so the header leads with whatever is most
 * worth celebrating today and a new lifter never sees stats they have not
 * built yet.
 */
import { useMemo, useState } from "react";
import { motion } from "motion/react";

import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { formatDateToYmdLocal } from "@/lib/date-utils";
import { calculateStreakFromDates } from "@/lib/home-dashboard/inspiration-card-metrics";
import {
  buildEventStories,
  rankEvergreenStories,
} from "@/lib/home-dashboard/story-of-the-day";
import { Skeleton } from "@/components/ui/skeleton";
import { ClassicLiftHighlightCard } from "@/components/home-dashboard/inspiration-cards/classic-lift-highlight-card";
import { ConsistencyStreakCard } from "@/components/home-dashboard/inspiration-cards/consistency-streak-card";
import { EventStoryCard } from "@/components/home-dashboard/inspiration-cards/event-story-card";
import { FirstWeekGoalCard } from "@/components/home-dashboard/inspiration-cards/first-week-goal-card";
import { JourneyProgressCard } from "@/components/home-dashboard/inspiration-cards/journey-progress-card";
import { LifetimeTonnageCard } from "@/components/home-dashboard/inspiration-cards/lifetime-tonnage-card";
import { ProgrammingTipCard } from "@/components/home-dashboard/inspiration-cards/programming-tip-card";
import { TrainingMomentumCard } from "@/components/home-dashboard/inspiration-cards/training-momentum-card";

// Which evergreen cards each stage may fall back on, in its preferred order.
const EVERGREEN_KEYS_BY_STAGE = {
  first_real_week: [
    "journey",
    "classic",
    "first-week-goal",
    "programming-tip",
    "lifetime-tonnage",
  ],
  first_month: ["journey", "consistency", "programming-tip"],
  early_base: ["journey", "momentum", "lifetime-tonnage", "consistency"],
  established: [
    "journey",
    "classic",
    "momentum",
    "lifetime-tonnage",
    "consistency",
  ],
};

/**
 * @param {Object} props
 * @param {boolean} [props.isProgressDone=false] - When false, a skeleton holds
 *   the story's height while the row-count animation runs.
 * @param {string} [props.dashboardStage="established"]
 * @param {number} [props.sessionCount=0]
 */
export function HomeInspirationCards({
  isProgressDone = false,
  dashboardStage = "established",
  sessionCount = 0,
}) {
  const { parsedData, liftTypes, topLiftsByTypeAndReps, sessionTonnageLookup } =
    useUserLiftingData();
  const athleteBio = useAthleteBio();
  // Read once, so the story cannot change under the lifter at noon.
  const [isMorning] = useState(() => new Date().getHours() < 12);

  const allSessionDates = useMemo(
    () => sessionTonnageLookup?.allSessionDates ?? [],
    [sessionTonnageLookup],
  );

  const stories = useMemo(() => {
    const todayStr = formatDateToYmdLocal(new Date());
    const streakStats = allSessionDates.length
      ? calculateStreakFromDates(allSessionDates, { referenceDate: todayStr })
      : null;
    const events = buildEventStories({
      parsedData,
      topLiftsByTypeAndReps,
      streakStats,
      todayStr,
    });
    const evergreens = rankEvergreenStories(
      EVERGREEN_KEYS_BY_STAGE[dashboardStage] ??
        EVERGREEN_KEYS_BY_STAGE.established,
      todayStr,
    );
    return [...events, ...evergreens].sort((a, b) => b.score - a.score);
  }, [parsedData, topLiftsByTypeAndReps, allSessionDates, dashboardStage]);

  if (!isProgressDone) return <StorySkeleton />;
  if (stories.length === 0) return null;

  const story = stories[isMorning ? 0 : Math.min(1, stories.length - 1)];

  return (
    <motion.div
      className="flex min-w-0"
      initial={{ opacity: 0, x: -8, filter: "blur(4px)" }}
      animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
      // Mounts once the data has loaded, by which time the greeting's thread
      // is already waiting for it, so it only needs a beat.
      transition={{ delay: 0.1, duration: 0.4, ease: "easeOut" }}
    >
      {story.kind === "evergreen" ? (
        <EvergreenStory
          storyKey={story.id}
          parsedData={parsedData}
          liftTypes={liftTypes}
          topLiftsByTypeAndReps={topLiftsByTypeAndReps}
          athleteBio={athleteBio}
          allSessionDates={allSessionDates}
          sessionTonnageLookup={sessionTonnageLookup}
          sessionCount={sessionCount}
          dashboardStage={dashboardStage}
        />
      ) : (
        <EventStoryCard story={story} />
      )}
    </motion.div>
  );
}

// ─── Supporting components ─────────────────────────────────────────────────

function EvergreenStory({
  storyKey,
  parsedData,
  liftTypes,
  topLiftsByTypeAndReps,
  athleteBio,
  allSessionDates,
  sessionTonnageLookup,
  sessionCount,
  dashboardStage,
}) {
  switch (storyKey) {
    case "journey":
      return (
        <JourneyProgressCard
          parsedData={parsedData}
          liftTypes={liftTypes}
          animationDelay={0}
        />
      );
    case "classic":
      return (
        <ClassicLiftHighlightCard
          parsedData={parsedData}
          liftTypes={liftTypes}
          topLiftsByTypeAndReps={topLiftsByTypeAndReps}
          athleteBio={athleteBio}
          animationDelay={0}
        />
      );
    case "momentum":
      return (
        <TrainingMomentumCard
          allSessionDates={allSessionDates}
          animationDelay={0}
        />
      );
    case "lifetime-tonnage":
      return (
        <LifetimeTonnageCard
          sessionTonnageLookup={sessionTonnageLookup}
          isMetric={athleteBio.isMetric}
          animationDelay={0}
        />
      );
    case "consistency":
      return (
        <ConsistencyStreakCard
          allSessionDates={allSessionDates}
          animationDelay={0}
        />
      );
    case "first-week-goal":
      return (
        <FirstWeekGoalCard
          allSessionDates={allSessionDates}
          sessionCount={sessionCount}
          animationDelay={0}
        />
      );
    case "programming-tip":
      return (
        <ProgrammingTipCard
          dashboardStage={dashboardStage}
          animationDelay={0}
        />
      );
    default:
      return null;
  }
}

// Mirrors InspirationCard's three lines so the header keeps its height when
// the story slides in.
function StorySkeleton() {
  return (
    <div className="flex min-h-[5.125rem] flex-col gap-0.5 py-1.5">
      <div className="flex h-4 items-center gap-2">
        <Skeleton className="h-3.5 w-3.5 rounded" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-5 w-48 sm:h-[1.375rem]" />
      <Skeleton className="h-3.5 w-40" />
    </div>
  );
}
