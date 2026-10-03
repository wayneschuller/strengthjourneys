/**
 * Story of the day: one line about the lifter, joined to the greeting by
 * DashboardGreeting. A small reward on the way in; the three headline cards
 * below are the main event, so this stays a single line, a bold lead and a
 * quieter commentary, never a card.
 *
 * Which stories exist comes from lib/home-dashboard/story-of-the-day.js (the
 * event stories, which only exist when the log earns them) plus the stage's
 * summary stories. Summaries that would read as a shortfall (a dip in
 * momentum, a zero-week streak) are left out rather than softened.
 *
 * Every visit shows the next story in the rotation, so a refresh or coming
 * back to the dashboard brings a new one. The classic lift's share of turns
 * grows with the number of memories in the log (up to two visits in three for
 * a long history), and it never repeats a memory until all have been shown. A story tied to a
 * date links to that day in the log, and any story about a lift with a video
 * gets its own play button beside the line.
 *
 * Each line opens with a short kicker ("Remember this?", "On this day") that
 * says why this story is showing. The pools are per kind and hashed on the
 * story, so the same story always arrives with the same kicker.
 *
 * In the early base stage (21 to 60 sessions) the story is occasional: event
 * stories always show, summaries only on alternate days. Before that stage
 * the dashboard does not render it at all.
 *
 * Streaks are not told here: The Long Game card already owns them.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import {
  Activity,
  TrendingUp,
  Anvil,
  ArrowRight,
  Cake,
  Calendar,
  History,
  Medal,
  PlayCircle,
  Trophy,
} from "lucide-react";
import { useLocalStorage } from "usehooks-ts";

import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { formatDateToYmdLocal } from "@/lib/date-utils";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { getDisplayWeight } from "@/lib/processing-utils";
import {
  buildClassicLiftCandidates,
  getVideoUrl,
  pickClassicLiftFrom,
} from "@/lib/home-dashboard/classic-lift";
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
  getYearBestSets,
  rankSummaryStories,
} from "@/lib/home-dashboard/story-of-the-day";
import {
  STORY_REVEAL_DELAY_SECONDS,
  STORY_REVEAL_JITTER_SECONDS,
} from "@/components/home-dashboard/dashboard-greeting";

// Which summary stories each stage may draw on, in its preferred order.
const SUMMARY_KEYS_BY_STAGE = {
  // Momentum leads for a newer lifter: sessions over the last 90 days is the
  // number that tells them the habit is taking.
  early_base: ["momentum", "journey", "lifetime-tonnage", "year-bests"],
  established: [
    "journey",
    "classic",
    "momentum",
    "lifetime-tonnage",
    "year-bests",
  ],
};

// How long a revealed story must stay on screen before it counts as seen.
const STORY_SEEN_AFTER_SECONDS = 2;

// Below this the momentum story reads as a dip, so it is not told at all.
const MOMENTUM_STEADY_PERCENT = 15;

/**
 * @param {Object} props
 * @param {boolean} [props.isProgressDone=false] - Nothing shows until the
 *   data has loaded; the greeting holds the line back for longer anyway.
 * @param {string} [props.dashboardStage="established"]
 */
export function StoryOfTheDay({
  isProgressDone = false,
  dashboardStage = "established",
}) {
  const { parsedData, topLiftsByTypeAndReps, sessionTonnageLookup, meetDays } =
    useUserLiftingData();
  const { isMetric } = useAthleteBio();

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
      meetDays,
      isMetric,
      todayStr,
    });
    const yearBestSets = getYearBestSets(parsedData, todayStr);
    const summaryKeys = (
      SUMMARY_KEYS_BY_STAGE[dashboardStage] ?? SUMMARY_KEYS_BY_STAGE.established
    ).filter((key) => {
      if (key === "momentum") {
        return (
          momentum.recentSessions > 0 &&
          (momentum.previousSessions === 0 ||
            momentum.percentageChange >= -MOMENTUM_STEADY_PERCENT)
        );
      }
      // One lift is not a year yet; early January skips this story.
      if (key === "year-bests") return yearBestSets.length >= 2;
      return true;
    });
    return [
      ...events,
      ...rankSummaryStories(summaryKeys, todayStr).map((story) => ({
        ...story,
        streakStats,
        momentum,
        yearBestSets,
        todayStr,
      })),
    ].sort((a, b) => b.score - a.score);
  }, [
    parsedData,
    topLiftsByTypeAndReps,
    meetDays,
    isMetric,
    allSessionDates,
    dashboardStage,
  ]);

  if (!isProgressDone) return null;
  if (stories.length === 0) return null;
  // Early base gets the story now and then rather than every visit: always
  // when the log has earned an event (a PR, a milestone in reach, an
  // anniversary), otherwise on alternate days. Seeded on the date, so a day
  // is consistent however many times the lifter comes back.
  if (
    dashboardStage === "early_base" &&
    !stories.some((story) => story.kind !== "summary") &&
    getDayNumber(formatDateToYmdLocal(new Date())) % 2 === 1
  ) {
    return null;
  }

  return <RotatingStory stories={stories} dashboardStage={dashboardStage} />;
}

// ─── Supporting components ─────────────────────────────────────────────────

// Mounts only once the lifter's data has loaded, which only ever happens in
// the browser, so the cursor can be read on the first render (no flash of
// story one before the real one). The line is built once per mount: it is
// this visit's story, and a sheet revalidation or a random classic-lift pick
// should not swap it out from under the lifter.
function RotatingStory({ stories, dashboardStage }) {
  const {
    parsedData,
    liftTypes,
    topLiftsByTypeAndReps,
    sessionTonnageLookup,
    meetDays,
  } = useUserLiftingData();
  const athleteBio = useAthleteBio();
  const [cursor, setCursor] = useLocalStorage(
    LOCAL_STORAGE_KEYS.HOME_DASHBOARD_STORY_CURSOR,
    0,
    { initializeWithValue: true },
  );
  const [shownCursor] = useState(() =>
    Number.isInteger(cursor) && cursor >= 0 ? cursor : 0,
  );
  const [seenClassics, setSeenClassics] = useLocalStorage(
    LOCAL_STORAGE_KEYS.HOME_DASHBOARD_CLASSICS_SEEN,
    [],
    { initializeWithValue: true },
  );
  // Built once per visit: the rotation needs the count, the classic story
  // needs the list.
  const hasClassicStory = stories.some(isClassicStory);
  const classicCandidates = useMemo(() => {
    if (!hasClassicStory) return [];
    const candidates = buildClassicLiftCandidates({
      parsedData,
      isMetric: athleteBio.isMetric,
      meetDays,
    });
    logClassicLiftCandidates(candidates);
    return candidates;
  }, [hasClassicStory, parsedData, athleteBio.isMetric, meetDays]);
  const rotation = useMemo(
    () => buildRotation(stories, classicCandidates.length),
    [stories, classicCandidates.length],
  );
  const [{ line, candidates }] = useState(() => {
    const context = {
      parsedData,
      liftTypes,
      topLiftsByTypeAndReps,
      sessionTonnageLookup,
      meetDays,
      athleteBio,
      dashboardStage,
      seenClassicIds: Array.isArray(seenClassics) ? seenClassics : [],
      classicCandidates,
    };
    const shownStory = rotation[shownCursor % rotation.length];
    // The classic lift can come up empty on a thin log; the journey line
    // always has something to say.
    const shownLine =
      buildStoryLine(shownStory, context) ??
      buildStoryLine(
        { ...shownStory, kind: "summary", id: "journey" },
        context,
      );
    return {
      line: shownLine,
      candidates: IS_DEVELOPMENT
        ? describeCandidates(stories, shownStory, shownLine, context)
        : null,
    };
  });

  // Development only: every candidate in rank order, as the sentence it would
  // read, so the whole rotation can be reviewed without clicking through it.
  useEffect(() => {
    if (!candidates) return;
    console.groupCollapsed(
      `Story of the day candidates (${candidates.length}), showing #${
        candidates.findIndex((candidate) => candidate.showing) + 1
      }`,
    );
    console.table(candidates);
    console.groupEnd();
  }, [candidates]);

  // Move on to the next story only once this one has been on screen for a
  // moment. A lifter who leaves before the greeting reveals it finds the same
  // story waiting next time, so a good one is never skipped unseen.
  useEffect(() => {
    const timer = setTimeout(
      () => {
        // Absolute, not prev + 1, so a double-run effect still advances by
        // one.
        setCursor((shownCursor + 1) % rotation.length);
        // A classic lift that has been seen leaves the pool until every
        // other memory has had its turn; then the pool starts over.
        if (line?.classicId) {
          setSeenClassics((previous) => {
            const seen = (Array.isArray(previous) ? previous : []).filter(
              (id) => id !== line.classicId,
            );
            seen.push(line.classicId);
            return seen.length >= line.classicTotal ? [] : seen;
          });
        }
      },
      // The longest the reveal can take, so the story is always on screen
      // before it counts as seen.
      (STORY_REVEAL_DELAY_SECONDS +
        STORY_REVEAL_JITTER_SECONDS +
        STORY_SEEN_AFTER_SECONDS) *
        1000,
    );
    return () => clearTimeout(timer);
  }, [shownCursor, rotation.length, setCursor, setSeenClassics, line]);

  if (!line) return null;
  return <StoryLine line={line} />;
}

const IS_DEVELOPMENT =
  process.env.NEXT_PUBLIC_STRENGTH_JOURNEYS_ENV === "development";

// How many of every N visits go to a classic lift, by how many memories the
// log holds. A twelve-year log has dozens of classic lifts against one of
// each other kind of story, so it earns more turns; a short log with a
// handful keeps the classic lift to one turn per cycle so it does not repeat
// itself. Each entry: at least `min` candidates -> `classics` classic turns
// after every `stories` other stories.
const CLASSIC_SHARE_BY_COUNT = [
  { min: 40, stories: 1, classics: 2 }, // 2 of every 3 visits
  { min: 20, stories: 1, classics: 1 }, // every 2nd visit
  { min: 8, stories: 2, classics: 1 }, // every 3rd visit
];

function isClassicStory(story) {
  return story.kind === "summary" && story.id === "classic";
}

function getClassicShare(classicCount) {
  return CLASSIC_SHARE_BY_COUNT.find(({ min }) => classicCount >= min) ?? null;
}

// The visit-by-visit order: the other stories in rank order, with classic
// lift turns woven in at the share the log has earned.
function buildRotation(stories, classicCount) {
  const classic = stories.find(isClassicStory);
  const others = stories.filter((story) => story !== classic);
  const share = getClassicShare(classicCount);
  if (!classic || others.length === 0 || !share) return stories;

  const rotation = [];
  others.forEach((story, index) => {
    rotation.push(story);
    if ((index + 1) % share.stories === 0) {
      for (let i = 0; i < share.classics; i++) rotation.push(classic);
    }
  });
  // A short list of other stories might never reach a classic turn.
  if (!rotation.includes(classic)) rotation.push(classic);
  return rotation;
}

function describeClassicShare(classicCount) {
  const share = getClassicShare(classicCount);
  return share
    ? `${share.classics} of every ${share.stories + share.classics} visits`
    : "one turn per cycle";
}

function getClassicId(classic) {
  return `${classic.lift.date}|${classic.lift.liftType}`;
}

// One row per ranked story for the development console table. The story on
// screen reuses its own line, so a classic lift row matches what is showing
// rather than a second random pick.
function describeCandidates(stories, shownStory, shownLine, context) {
  return stories.map((story) => {
    const isShown = story === shownStory;
    const line = isShown ? shownLine : buildStoryLine(story, context);
    return {
      showing: isShown ? "now" : "",
      turns: isClassicStory(story)
        ? `${describeClassicShare(context.classicCandidates.length)}, ${context.seenClassicIds.length} of ${context.classicCandidates.length} seen`
        : "",
      score: story.score,
      type: story.kind === "summary" ? `summary: ${story.id}` : story.kind,
      sentence: line ? toSentence(line) : "(nothing to say)",
      link: line?.href ?? "",
      video: line?.videoUrl ? "yes" : "",
    };
  });
}

const ACCENT_CLASSES = {
  amber: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
  violet: "bg-violet-500/12 text-violet-600 dark:text-violet-400",
  emerald: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  orange: "bg-orange-500/12 text-orange-600 dark:text-orange-400",
  primary: "bg-primary/12 text-primary",
};

function StoryLine({ line }) {
  const { icon: Icon, accent, kicker, lead, commentary, href, videoUrl } = line;
  const content = (
    <>
      <span
        className={`mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
          ACCENT_CLASSES[accent] ?? ACCENT_CLASSES.primary
        }`}
      >
        <Icon className="h-3 w-3" />
      </span>
      {/* One sentence: "Kicker: lead, commentary." The gaps between the
          spans are the spaces after the colon and the comma. */}
      {kicker && (
        <span className="text-muted-foreground shrink-0 whitespace-nowrap">
          {kicker}:
        </span>
      )}
      <span className="text-foreground/80 shrink-0 font-medium whitespace-nowrap tabular-nums decoration-1 underline-offset-4 group-hover:underline">
        {lead}
        {commentary ? "," : "."}
      </span>
      {commentary && (
        <span className="text-muted-foreground min-w-0 truncate">
          {ensureFullStop(continueSentence(commentary))}
        </span>
      )}
      {href && (
        <ArrowRight className="text-muted-foreground h-3 w-3 shrink-0 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
      )}
    </>
  );
  // A step below the greeting's size: an aside, not a second headline.
  const className =
    "group flex min-w-0 items-center gap-x-1 text-xs sm:text-sm";
  const title = toSentence(line);

  return (
    <div data-story-line className="flex min-w-0 items-center gap-2">
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
          className="text-muted-foreground hover:text-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors"
        >
          <PlayCircle className="h-4 w-4" />
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
  const line = buildStoryParts(story, context);
  if (!line) return null;
  const pool = getKickerPool(story);
  // Seeded on the link too, so each classic lift (one story id, many lifts)
  // keeps its own kicker.
  return {
    ...line,
    kicker: pool ? pickVariant(pool, `${story.id}${line.href ?? ""}`) : null,
  };
}

function buildStoryParts(story, context) {
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
    case "milestoneInReach":
      return {
        icon: TrendingUp,
        accent: "emerald",
        lead: `A ${story.milestone}${story.unit} ${story.liftNoun} is in reach`,
        commentary: `going by your ${setLabel(story.lift)} ${getRecentDayPhrase(story.daysAgo, story.date)}, which estimates ${story.estimate}${story.unit}.`,
        href: logHref(story.date),
        videoUrl: getVideoUrl(story.lift),
      };
    case "yearPrs": {
      // Singles first, then triples and fives, in squat, bench, deadlift
      // order: the three most brag-worthy, with the count carrying the rest.
      const shown = [...story.prs]
        .sort((a, b) => a.reps - b.reps)
        .slice(0, 3)
        .map((set) => `${getLiftNoun(set.liftType)} ${setLabel(set)}`);
      const count = story.prs.length;
      return {
        icon: Trophy,
        accent: "amber",
        lead: `${count} lifetime best${count === 1 ? "" : "s"} in ${story.year}`,
        commentary:
          count > 3
            ? `including ${shown.join(", ")} and more.`
            : `${joinList(shown)}.`,
        href: logHref(story.date),
        videoUrl: null,
      };
    }
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
        commentary: story.bestSingles.length
          ? `with ${joinList(
              story.bestSingles.map(
                (set) => `${getLiftNoun(set.liftType)} ${weightLabel(set)}`,
              ),
            )}.`
          : story.meetName || null,
        href: logHref(story.date),
        videoUrl: story.bestSingles.map(getVideoUrl).find(Boolean) ?? null,
      };
    case "journeyBirthday":
      return {
        icon: Cake,
        accent: "emerald",
        lead: `${pluralYears(story.yearsAgo)} of lifting ${whenPhrase(story)}`,
        commentary: `starting with ${story.lift.liftType} ${setLabel(story.lift)}.`,
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
    case "summary":
      return buildSummaryLine(story, context, setLabel);
    default:
      return null;
  }
}

function buildSummaryLine(story, context, setLabel) {
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
        // Unlinked: a link to the first session undersells a whole journey.
        href: null,
      };
    }
    case "classic": {
      const candidates = context.classicCandidates ?? [];
      // Only memories not yet shown, until all have been; the pick within
      // them is still weighted by score and spread across the years.
      const seen = new Set(context.seenClassicIds ?? []);
      const unseen = candidates.filter(
        (candidate) => !seen.has(getClassicId(candidate)),
      );
      const classic = pickClassicLiftFrom(
        unseen.length > 0 ? unseen : candidates,
      );
      if (!classic) return null;
      const note = classic.lift.notes?.trim();
      const when = format(parseISO(classic.lift.date), "MMMM yyyy");
      return {
        icon: Trophy,
        accent: "amber",
        lead: `${classic.lift.liftType} ${setLabel(classic.lift)}`,
        commentary: `${classic.label}, ${when}.${note ? ` “${note}”` : ""}`,
        href: logHref(classic.lift.date),
        videoUrl: getVideoUrl(classic.lift),
        classicId: getClassicId(classic),
        classicTotal: candidates.length,
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
    case "year-bests": {
      const sets = story.yearBestSets ?? [];
      if (sets.length === 0) return null;
      return {
        icon: Medal,
        accent: "primary",
        lead: `Best of ${story.todayStr.slice(0, 4)} so far`,
        commentary: `${joinList(
          sets.map((set) => `${getLiftNoun(set.liftType)} ${setLabel(set)}`),
        )}.`,
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
        lead: `${formatLifetimeTonnage(tonnage.primaryTotal)} ${tonnage.primaryUnit} moved ${getSincePhrase(firstDate)}`,
        commentary: `${tonnage.sessionCount.toLocaleString()} sessions, about ${formatLifetimeTonnage(Math.round(tonnage.averagePerSession))} ${tonnage.primaryUnit} each.`,
        // The figure is lifetime, so the chart opens on lifetime too.
        href: "/tonnage?range=MAX",
      };
    }
    default:
      return null;
  }
}

// ─── Copy ──────────────────────────────────────────────────────────────────

// Why this story is showing, said in a few words before it. Anniversaries
// split on whether today is the day or only the same week.
const KICKERS = {
  recentPr: ["Just in", "Hot off the bar", "Fresh from the log"],
  anniversaryToday: ["On this day", "Today in your history"],
  anniversaryThisWeek: ["This week in your history", "This week, years back"],
  journeyBirthday: ["Lifting birthday", "Worth a moment", "Milestone"],
  classic: [
    "Remember this?",
    "Classic memory",
    "From the archive",
    "Throwback",
    "One for the highlight reel",
    "A favourite from the log",
  ],
  journey: ["Your story so far", "The long view", "Where it all adds up"],
  momentum: ["Lately", "Recent form", "How it is going"],
  "lifetime-tonnage": ["By the numbers", "The big picture", "All added up"],
  milestoneInReach: ["Nearly there", "Within reach", "Next up"],
  yearPrs: ["This year", "A big year", "Year in review"],
  "year-bests": ["This year so far", "Your year", "Year to date"],
};

function getKickerPool(story) {
  if (story.kind === "summary") return KICKERS[story.id];
  if (story.kind === "meetAnniversary" || story.kind === "prAnniversary") {
    return story.daysAgo === 0
      ? KICKERS.anniversaryToday
      : KICKERS.anniversaryThisWeek;
  }
  return KICKERS[story.kind];
}

// Also the short names every story uses when it lists lifts.
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

// ─── Helpers ───────────────────────────────────────────────────────────────

// "since 2014" for a log older than a year, "since March" within this
// year, "since March 2025" in between: the tonnage figure's timeframe in
// the words a lifter would use.
function getSincePhrase(firstDate) {
  const start = parseISO(firstDate);
  const now = new Date();
  if (start.getFullYear() === now.getFullYear()) {
    return `since ${format(start, "MMMM")}`;
  }
  const monthsAgo =
    (now.getFullYear() - start.getFullYear()) * 12 +
    now.getMonth() -
    start.getMonth();
  return monthsAgo >= 12
    ? `since ${start.getFullYear()}`
    : `since ${format(start, "MMMM yyyy")}`;
}

// Development only: the whole classic lift candidate list as a table, so the
// picks can be reviewed for feel against a real log.
function logClassicLiftCandidates(candidates) {
  if (!IS_DEVELOPMENT) return;
  console.groupCollapsed(`Classic lift candidates (${candidates.length})`);
  console.table(
    candidates.map(({ lift, label, source, score }) => ({
      score,
      source,
      date: lift.date,
      lift: `${lift.liftType} ${lift.reps}@${lift.weight}${lift.unitType}`,
      label,
      video: getVideoUrl(lift) ? "yes" : "",
      note: lift.notes?.trim().slice(0, 80) ?? "",
    })),
  );
  console.groupEnd();
}

// The lead and commentary read as one sentence, so the commentary carries on
// after a comma: its opening word drops to lower case unless it is an
// acronym or a number ("New PR" becomes "new PR", "PR" stays "PR").
function continueSentence(text) {
  if (/^[A-Z][a-z]/.test(text)) {
    return text.charAt(0).toLowerCase() + text.slice(1);
  }
  return text;
}

function ensureFullStop(text) {
  return /[.!?”"]$/.test(text) ? text : `${text}.`;
}

// The whole line as the sentence it reads as, for the hover title.
function toSentence({ kicker, lead, commentary }) {
  const body = commentary
    ? `${lead}, ${ensureFullStop(continueSentence(commentary))}`
    : `${lead}.`;
  return kicker ? `${kicker}: ${body}` : body;
}

// "a", "a and b", "a, b and c".
function joinList(items) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

// Lift names as they sit mid-sentence: "squat", "bench", "deadlift", "press".
function getLiftNoun(liftType) {
  return (MEET_SHORT_NAMES[liftType] ?? liftType).toLowerCase();
}

// Days since 1970 for a YYYY-MM-DD date, for day-by-day alternation.
function getDayNumber(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

function logHref(dateStr) {
  return `/log?date=${dateStr}`;
}

function whenPhrase(story) {
  return story.daysAgo === 0 ? "today" : "this week";
}

// No "this week" here: the kicker already says when.
function yearsAgo(story) {
  return `${pluralYears(story.yearsAgo)} ago`;
}

// "today", "yesterday", "on Tuesday" within the week, "on 12 Sep" beyond it.
function getRecentDayPhrase(daysAgo, dateStr) {
  if (daysAgo < 7) return getDayPhrase(daysAgo, dateStr);
  return `on ${format(parseISO(dateStr), "d MMM")}`;
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
