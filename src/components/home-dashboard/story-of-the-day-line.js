/**
 * Story of the day: one line about the lifter, joined to the greeting by
 * DashboardGreeting. A small reward on the way in; the three headline cards
 * below are the main event, so this stays a single line, a bold lead and a
 * quieter commentary, never a card.
 *
 * Which stories exist comes from lib/home-dashboard/story-of-the-day.js (the
 * event stories, which only exist when the log earns them) plus the stage's
 * evergreen stories. Evergreens that would read as a shortfall (a dip in
 * momentum, a zero-week streak) are left out rather than softened.
 *
 * Every visit shows the next story in the ranked list, best first, so a
 * refresh or coming back to the dashboard brings a new one. A story tied to a
 * date links to that day in the log, and any story about a lift with a video
 * gets its own play button beside the line.
 *
 * Streaks are not told here: The Long Game card already owns them.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import {
  Activity,
  Anvil,
  ArrowRight,
  Cake,
  Calendar,
  History,
  Lightbulb,
  Medal,
  PlayCircle,
  Target,
  Trophy,
} from "lucide-react";
import { useLocalStorage } from "usehooks-ts";

import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { formatDateToYmdLocal } from "@/lib/date-utils";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { getDisplayWeight } from "@/lib/processing-utils";
import { pickClassicLiftMemory } from "@/lib/home-dashboard/classic-lift-highlight-selection";
import {
  calculateLifetimeTonnageFromLookup,
  calculateSessionMomentumFromDates,
  calculateStreakFromDates,
  calculateTotalStats,
  formatJourneyLength,
  formatLifetimeTonnage,
} from "@/lib/home-dashboard/inspiration-card-metrics";
import {
  buildEventStories,
  rankEvergreenStories,
} from "@/lib/home-dashboard/story-of-the-day";

// Which evergreen stories each stage may draw on, in its preferred order.
const EVERGREEN_KEYS_BY_STAGE = {
  first_real_week: ["journey", "classic", "first-week-goal", "programming-tip"],
  first_month: ["journey", "programming-tip"],
  early_base: ["journey", "momentum", "lifetime-tonnage"],
  established: ["journey", "classic", "momentum", "lifetime-tonnage"],
};

// Below this the momentum story reads as a dip, so it is not told at all.
const MOMENTUM_STEADY_PERCENT = 15;

/**
 * @param {Object} props
 * @param {boolean} [props.isProgressDone=false] - Nothing shows until the
 *   data has loaded; the greeting holds the line back for longer anyway.
 * @param {string} [props.dashboardStage="established"]
 * @param {number} [props.sessionCount=0]
 */
export function StoryOfTheDay({
  isProgressDone = false,
  dashboardStage = "established",
  sessionCount = 0,
}) {
  const { parsedData, topLiftsByTypeAndReps, sessionTonnageLookup } =
    useUserLiftingData();

  const allSessionDates = useMemo(
    () => sessionTonnageLookup?.allSessionDates ?? [],
    [sessionTonnageLookup],
  );

  const stories = useMemo(() => {
    const todayStr = formatDateToYmdLocal(new Date());
    const streakStats = allSessionDates.length
      ? calculateStreakFromDates(allSessionDates, { referenceDate: todayStr })
      : null;
    const momentum = calculateSessionMomentumFromDates(allSessionDates);
    const events = buildEventStories({
      parsedData,
      topLiftsByTypeAndReps,
      todayStr,
    });
    const evergreenKeys = (
      EVERGREEN_KEYS_BY_STAGE[dashboardStage] ??
      EVERGREEN_KEYS_BY_STAGE.established
    ).filter((key) => {
      if (key === "momentum") {
        return (
          momentum.recentSessions > 0 &&
          (momentum.previousSessions === 0 ||
            momentum.percentageChange >= -MOMENTUM_STEADY_PERCENT)
        );
      }
      return true;
    });
    return [
      ...events,
      ...rankEvergreenStories(evergreenKeys, todayStr).map((story) => ({
        ...story,
        streakStats,
        momentum,
        todayStr,
      })),
    ].sort((a, b) => b.score - a.score);
  }, [parsedData, topLiftsByTypeAndReps, allSessionDates, dashboardStage]);

  if (!isProgressDone) return null;
  if (stories.length === 0) return null;

  return (
    <RotatingStory
      stories={stories}
      dashboardStage={dashboardStage}
      sessionCount={sessionCount}
    />
  );
}

// ─── Supporting components ─────────────────────────────────────────────────

// Mounts only once the lifter's data has loaded, which only ever happens in
// the browser, so the cursor can be read on the first render (no flash of
// story one before the real one). The line is built once per mount: it is
// this visit's story, and a sheet revalidation or a random classic-lift pick
// should not swap it out from under the lifter.
function RotatingStory({ stories, dashboardStage, sessionCount }) {
  const { parsedData, liftTypes, topLiftsByTypeAndReps, sessionTonnageLookup } =
    useUserLiftingData();
  const athleteBio = useAthleteBio();
  const [cursor, setCursor] = useLocalStorage(
    LOCAL_STORAGE_KEYS.HOME_DASHBOARD_STORY_CURSOR,
    0,
    { initializeWithValue: true },
  );
  const [shownCursor] = useState(() =>
    Number.isInteger(cursor) && cursor >= 0 ? cursor : 0,
  );
  const [line] = useState(() => {
    const context = {
      parsedData,
      liftTypes,
      topLiftsByTypeAndReps,
      sessionTonnageLookup,
      athleteBio,
      dashboardStage,
      sessionCount,
    };
    const story = stories[shownCursor % stories.length];
    // The classic lift can come up empty on a thin log; the journey line
    // always has something to say.
    return (
      buildStoryLine(story, context) ??
      buildStoryLine({ ...story, kind: "evergreen", id: "journey" }, context)
    );
  });

  useEffect(() => {
    // Absolute, not prev + 1, so a double-run effect still advances by one.
    setCursor((shownCursor + 1) % stories.length);
  }, [shownCursor, stories.length, setCursor]);

  if (!line) return null;
  return <StoryLine line={line} />;
}

const ACCENT_CLASSES = {
  amber: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
  violet: "bg-violet-500/12 text-violet-600 dark:text-violet-400",
  emerald: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  orange: "bg-orange-500/12 text-orange-600 dark:text-orange-400",
  primary: "bg-primary/12 text-primary",
};

function StoryLine({ line }) {
  const { icon: Icon, accent, lead, commentary, href, videoUrl } = line;
  const content = (
    <>
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          ACCENT_CLASSES[accent] ?? ACCENT_CLASSES.primary
        }`}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="text-foreground shrink-0 font-semibold whitespace-nowrap tabular-nums decoration-1 underline-offset-4 group-hover:underline">
        {lead}
      </span>
      {commentary && (
        <span className="text-muted-foreground min-w-0 truncate">
          {commentary}
        </span>
      )}
      {href && (
        <ArrowRight className="text-muted-foreground h-3.5 w-3.5 shrink-0 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
      )}
    </>
  );
  const className =
    "group flex min-w-0 items-center gap-2.5 text-sm sm:text-base";
  const title = [lead, commentary].filter(Boolean).join(". ");

  return (
    <div className="flex min-w-0 items-center gap-2">
      {href ? (
        <Link href={href} className={className} title={title}>
          {content}
        </Link>
      ) : (
        <div className={className} title={title}>
          {content}
        </div>
      )}
      {/* Its own button beside the line, not inside it: the line goes to the
          log, this goes to the footage. */}
      {videoUrl && (
        <a
          href={videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Watch the video of this lift"
          title="Watch the video"
          className="text-muted-foreground hover:text-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors"
        >
          <PlayCircle className="h-4.5 w-4.5" />
        </a>
      )}
    </div>
  );
}

// ─── Story lines ───────────────────────────────────────────────────────────

/**
 * Turns a ranked story into the line's parts: icon, accent, a bold lead (the
 * set or the number), a quieter commentary, and the log date it links to.
 * Returns null when the story has nothing to say.
 */
function buildStoryLine(story, context) {
  const { isMetric } = context.athleteBio;
  const setLabel = (set) => {
    const { value, unit } = getDisplayWeight(set, isMetric);
    return `${set.reps}@${value}${unit}`;
  };
  const weightLabel = (set) => {
    const { value, unit } = getDisplayWeight(set, isMetric);
    return `${value}${unit}`;
  };

  switch (story.kind) {
    case "recentPr":
      return {
        icon: Trophy,
        accent: "amber",
        lead: `${story.liftType} ${setLabel(story.lift)}`,
        commentary: `New PR ${getDayPhrase(story.daysAgo, story.date)}, up from ${setLabel(story.previous)}.`,
        href: logHref(story.date),
        videoUrl: getVideoUrl(story.lift),
      };
    case "meetAnniversary":
      return {
        icon: Medal,
        accent: "violet",
        lead: `Meet day, ${yearsAgo(story)}`,
        commentary:
          story.bestSingles
            .map(
              (set) =>
                `${MEET_SHORT_NAMES[set.liftType] ?? set.liftType} ${weightLabel(set)}`,
            )
            .join(" · ") ||
          story.meetName ||
          null,
        href: logHref(story.date),
        videoUrl:
          story.bestSingles.map(getVideoUrl).find(Boolean) ??
          getVideoUrl(story.meetVideoLift),
      };
    case "journeyBirthday":
      return {
        icon: Cake,
        accent: "emerald",
        lead: `${pluralYears(story.yearsAgo)} of lifting ${whenPhrase(story)}`,
        commentary: `It started with ${story.lift.liftType} ${setLabel(story.lift)}.`,
        href: logHref(story.date),
        videoUrl: getVideoUrl(story.lift),
      };
    case "prAnniversary":
      return {
        icon: History,
        accent: "violet",
        lead: `${story.liftType} ${setLabel(story.lift)}`,
        commentary: `${capitalize(yearsAgo(story))}. ${
          story.isStillBest
            ? `Still your best ${getRepLabel(story.lift.reps)} ever.`
            : pickVariant(PR_ANNIVERSARY_LINES, story.id)
        }`,
        href: logHref(story.date),
        videoUrl: getVideoUrl(story.lift),
      };
    case "evergreen":
      return buildEvergreenLine(story, context, setLabel);
    default:
      return null;
  }
}

function buildEvergreenLine(story, context, setLabel) {
  const { parsedData, liftTypes, athleteBio } = context;
  const firstDate = parsedData?.find((entry) => !entry.isGoal)?.date;

  switch (story.id) {
    case "journey": {
      if (!firstDate) return null;
      const { totalReps, totalSets } = calculateTotalStats(liftTypes);
      return {
        icon: Calendar,
        accent: "primary",
        lead: formatJourneyLength(firstDate),
        commentary: `${totalReps.toLocaleString()} reps across ${totalSets.toLocaleString()} sets.`,
        // Where it all started.
        href: logHref(firstDate),
      };
    }
    case "classic": {
      const { age, bodyWeight, sex, standards, isMetric } = athleteBio;
      const memory = pickClassicLiftMemory({
        parsedData,
        liftTypes,
        topLiftsByTypeAndReps: context.topLiftsByTypeAndReps,
        hasBioData:
          !!(age && bodyWeight && standards) &&
          Object.keys(standards).length > 0,
        age,
        bodyWeight,
        sex,
        isMetric,
      });
      if (!memory?.lift) return null;
      const note = memory.lift.notes?.trim();
      const when = format(parseISO(memory.lift.date), "MMM yyyy");
      return {
        icon: Trophy,
        accent: "amber",
        lead: `${memory.lift.liftType} ${setLabel(memory.lift)}`,
        commentary: note
          ? `${when}: “${note}”`
          : `${memory.reasonLabel}, ${when}.`,
        href: logHref(memory.lift.date),
        videoUrl: getVideoUrl(memory.lift),
      };
    }
    case "momentum": {
      const { recentSessions, previousSessions, percentageChange, windowDays } =
        story.momentum;
      const isUp =
        previousSessions > 0 && percentageChange > MOMENTUM_STEADY_PERCENT;
      const verdict =
        previousSessions === 0
          ? "Building your baseline."
          : isUp
            ? `Up on the ${windowDays} days before.`
            : `Steady with the ${windowDays} days before.`;
      return {
        icon: Activity,
        accent: "emerald",
        lead: `${recentSessions} sessions in ${windowDays} days`,
        commentary: `${verdict} ${pickVariant(
          isUp ? MOMENTUM_UP_LINES : MOMENTUM_STEADY_LINES,
          story.todayStr,
        )}`,
        href: null,
      };
    }
    case "lifetime-tonnage": {
      const tonnage = calculateLifetimeTonnageFromLookup(
        context.sessionTonnageLookup,
        athleteBio.isMetric ? "kg" : "lb",
      );
      if (tonnage.primaryTotal <= 0) return null;
      return {
        icon: Anvil,
        accent: "violet",
        lead: `${formatLifetimeTonnage(tonnage.primaryTotal)} ${tonnage.primaryUnit} moved`,
        commentary: `${tonnage.sessionCount.toLocaleString()} sessions, about ${formatLifetimeTonnage(Math.round(tonnage.averagePerSession))} ${tonnage.primaryUnit} each.`,
        href: "/tonnage",
      };
    }
    case "first-week-goal": {
      const { sessionsThisWeek = 0 } = story.streakStats ?? {};
      return {
        icon: Target,
        accent: "emerald",
        lead: `${context.sessionCount} session${context.sessionCount === 1 ? "" : "s"} logged`,
        commentary:
          sessionsThisWeek >= 3
            ? "Three this week. The habit is forming."
            : "One honest workout at a time.",
        href: null,
      };
    }
    case "programming-tip": {
      const isFirstMonth = context.dashboardStage === "first_month";
      const tips = isFirstMonth ? FIRST_MONTH_TIPS : FIRST_WEEK_TIPS;
      return {
        icon: Lightbulb,
        accent: "amber",
        lead: isFirstMonth
          ? "Build a repeatable month"
          : "Keep week one simple",
        commentary: pickVariant(tips, story.todayStr),
        href: null,
      };
    }
    default:
      return null;
  }
}

// ─── Copy ──────────────────────────────────────────────────────────────────

const MEET_SHORT_NAMES = {
  "Back Squat": "Squat",
  "Bench Press": "Bench",
  "Strict Press": "Press",
};

const PR_ANNIVERSARY_LINES = [
  "A lifetime PR on the day.",
  "The heaviest you had ever lifted, on the day.",
  "A brick in everything since.",
];

const MOMENTUM_STEADY_LINES = [
  "Boring works. Keep it boring.",
  "This is how progress is built.",
  "Consistent beats dramatic.",
  "Steady work is real work.",
  "The plan is working. Stay with it.",
];

const MOMENTUM_UP_LINES = [
  "Strong block. Keep the pace.",
  "This is what progress looks like.",
  "Good run. Stay on the gas.",
  "You moved this block forward.",
];

const FIRST_WEEK_TIPS = [
  "Run the same basic lifts twice before changing anything.",
  "Keep the last rep looking clean.",
  "A simple week beats an ambitious one you cannot repeat.",
  "Write down every set. The habit matters as much as the weight.",
];

const FIRST_MONTH_TIPS = [
  "Squat and press often, deadlift once a week, leave a rep in reserve.",
  "If recovery feels rough, add consistency before load.",
  "Repeat lifts often enough that technique improves each session.",
  "Let the logbook get boring before you make it impressive.",
];

// ─── Helpers ───────────────────────────────────────────────────────────────

// Sheets carry the column as URL; some imports spell it url.
function getVideoUrl(lift) {
  return lift?.URL || lift?.url || null;
}

function logHref(dateStr) {
  return `/log?date=${dateStr}`;
}

function whenPhrase(story) {
  return story.daysAgo === 0 ? "today" : "this week";
}

function yearsAgo(story) {
  return `${pluralYears(story.yearsAgo)} ago ${whenPhrase(story)}`;
}

function getDayPhrase(daysAgo, dateStr) {
  if (daysAgo === 0) return "today";
  if (daysAgo === 1) return "yesterday";
  return `on ${format(parseISO(dateStr), "EEEE")}`;
}

function getRepLabel(reps) {
  if (reps === 1) return "single";
  if (reps === 2) return "double";
  if (reps === 3) return "triple";
  return `set of ${reps}`;
}

function pluralYears(years) {
  return `${years} year${years === 1 ? "" : "s"}`;
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function pickVariant(pool, seed = "") {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return pool[hash % pool.length];
}
