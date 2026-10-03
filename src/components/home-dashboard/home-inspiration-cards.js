/**
 * Story of the day: one quiet stat about the lifter in the dashboard header,
 * between the greeting and the sheet status, the best story first and dots to
 * read the rest. It is a small reward on the way in; the three headline cards
 * below are the main event, so keep this to a single card's height.
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
import { AnimatePresence, motion } from "motion/react";

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
  const [storyIndex, setStoryIndex] = useState(0);

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

  const safeIndex = Math.min(storyIndex, stories.length - 1);
  const story = stories[safeIndex];
  const showStory = (index) =>
    setStoryIndex((index + stories.length) % stories.length);

  return (
    <div className="flex min-w-0 items-center gap-4">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={story.id}
          className="flex min-w-0 flex-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
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
      </AnimatePresence>
      {stories.length > 1 && (
        <StoryPager
          count={stories.length}
          index={safeIndex}
          onSelect={showStory}
        />
      )}
    </div>
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

// Dots only: the header has no room for arrows, and each dot is a button so
// any story is one tap away.
function StoryPager({ count, index, onSelect }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      {Array.from({ length: count }).map((_, dotIndex) => (
        <button
          key={dotIndex}
          type="button"
          onClick={() => onSelect(dotIndex)}
          aria-label={`Story ${dotIndex + 1} of ${count}`}
          aria-current={dotIndex === index ? "true" : undefined}
          className="group flex h-6 w-3 items-center justify-center"
        >
          <span
            className={`h-1.5 w-1.5 rounded-full transition-colors ${
              dotIndex === index
                ? "bg-primary"
                : "bg-muted-foreground/30 group-hover:bg-muted-foreground/60"
            }`}
          />
        </button>
      ))}
    </div>
  );
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
