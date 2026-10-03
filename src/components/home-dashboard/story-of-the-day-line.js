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
 * Every visit shows the next story in the ranked list, best first, so a
 * refresh or coming back to the dashboard brings a new one. A story tied to a
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
 * Streaks are told only in the early base stage, where a run of three-session
 * weeks is the habit worth reinforcing. Established lifters get them from The
 * Long Game card instead.
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
  Flame,
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
import { STORY_REVEAL_DELAY_SECONDS } from "@/components/home-dashboard/dashboard-greeting";

// Which summary stories each stage may draw on, in its preferred order.
const SUMMARY_KEYS_BY_STAGE = {
  early_base: [
    "journey",
    "consistency",
    "momentum",
    "lifetime-tonnage",
    "year-bests",
  ],
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
      // Two weeks is the shortest run worth calling a run.
      if (key === "consistency") return (streakStats?.currentStreak ?? 0) >= 2;
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
  const [line] = useState(() => {
    const context = {
      parsedData,
      liftTypes,
      topLiftsByTypeAndReps,
      sessionTonnageLookup,
      meetDays,
      athleteBio,
      dashboardStage,
    };
    const story = stories[shownCursor % stories.length];
    // The classic lift can come up empty on a thin log; the journey line
    // always has something to say.
    return (
      buildStoryLine(story, context) ??
      buildStoryLine({ ...story, kind: "summary", id: "journey" }, context)
    );
  });

  // Move on to the next story only once this one has been on screen for a
  // moment. A lifter who leaves before the greeting reveals it finds the same
  // story waiting next time, so a good one is never skipped unseen.
  useEffect(() => {
    const timer = setTimeout(
      // Absolute, not prev + 1, so a double-run effect still advances by one.
      () => setCursor((shownCursor + 1) % stories.length),
      (STORY_REVEAL_DELAY_SECONDS + STORY_SEEN_AFTER_SECONDS) * 1000,
    );
    return () => clearTimeout(timer);
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
      const candidates = buildClassicLiftCandidates({
        parsedData,
        isMetric: athleteBio.isMetric,
        meetDays: context.meetDays,
      });
      logClassicLiftCandidates(candidates);
      const classic = pickClassicLiftFrom(candidates);
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
    case "consistency": {
      const { currentStreak, bestStreak, sessionsThisWeek } =
        story.streakStats ?? {};
      if (!currentStreak) return null;
      return {
        icon: Flame,
        accent: "orange",
        lead: `${currentStreak} three-session weeks in a row`,
        commentary:
          sessionsThisWeek >= 3
            ? "and this week is already in the bank."
            : currentStreak >= bestStreak
              ? "your longest run yet."
              : `your best run so far is ${bestStreak} weeks.`,
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
  consistency: ["Showing up", "Week after week", "The habit is forming"],
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
  if (process.env.NEXT_PUBLIC_STRENGTH_JOURNEYS_ENV !== "development") return;
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
