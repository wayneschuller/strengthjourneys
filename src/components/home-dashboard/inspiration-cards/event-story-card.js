/**
 * Renders one event story from lib/home-dashboard/story-of-the-day.js (a PR
 * this week, a meet or lifting anniversary, a PR anniversary, the longest
 * streak) as an InspirationCard, with the lift's artwork beside it when we
 * have a drawing.
 *
 * Copy here is shown day after day while a story is live, so lines that would
 * repeat come from small variant sets picked by the story id.
 */
import { format, parseISO } from "date-fns";
import { Cake, Flame, History, Medal, Trophy } from "lucide-react";

import { LiftArtwork } from "@/components/lift-artwork";
import { InspirationCard } from "@/components/home-dashboard/inspiration-cards/inspiration-card";

export function EventStoryCard({ story }) {
  const content = getEventStoryContent(story);
  if (!content) return null;

  return (
    <div className="flex min-w-0 flex-1 items-center gap-4">
      <div className="min-w-0 flex-1">
        <InspirationCard
          accent={content.accent}
          icon={content.icon}
          description={content.description}
          title={content.title}
          footer={content.footer}
          footerMultiline
          animationDelay={0}
        />
      </div>
      {story.liftType && (
        <LiftArtwork
          liftType={story.liftType}
          size="tile"
          className="hidden shrink-0 sm:block md:h-20"
        />
      )}
    </div>
  );
}

function getEventStoryContent(story) {
  switch (story.kind) {
    case "recentPr": {
      const { lift, previous } = story;
      return {
        accent: "amber",
        icon: Trophy,
        description: "New PR this week",
        title: `${lift.liftType} ${formatSet(lift)}`,
        footer: `Your best ${getRepLabel(lift.reps)} ever, ${getDayPhrase(story.daysAgo, lift.date)}. The previous best was ${formatSet(previous)} in ${format(parseISO(previous.date), "MMMM yyyy")}.`,
      };
    }
    case "meetAnniversary": {
      const singles = story.bestSingles
        .map(
          (set) =>
            `${MEET_SHORT_NAMES[set.liftType] ?? set.liftType} ${set.weight}${set.unitType}`,
        )
        .join(" · ");
      const when = story.daysAgo === 0 ? "today" : "this week";
      return {
        accent: "violet",
        icon: Medal,
        description: "Meet anniversary",
        title: `Meet day, ${pluralYears(story.yearsAgo)} ago ${when}`,
        footer: [
          story.meetName
            ? `${story.meetName}, ${formatLongDate(story.date)}.`
            : `${formatLongDate(story.date)}.`,
          singles,
        ]
          .filter(Boolean)
          .join(" "),
      };
    }
    case "journeyBirthday": {
      const { lift } = story;
      const when = story.daysAgo === 0 ? "today" : "this week";
      return {
        accent: "emerald",
        icon: Cake,
        description: "Lifting anniversary",
        title: `${pluralYears(story.yearsAgo)} of lifting ${when}`,
        footer: `It started on ${formatLongDate(lift.date)} with ${lift.liftType} ${formatSet(lift)}.`,
      };
    }
    case "prAnniversary": {
      const { lift } = story;
      const when = story.daysAgo === 0 ? "today" : "this week";
      return {
        accent: "violet",
        icon: History,
        description: `${pluralYears(story.yearsAgo)} ago ${when}`,
        title: `${lift.liftType} ${formatSet(lift)}`,
        footer: story.isStillBest
          ? `${formatLongDate(lift.date)}. Still your best ${getRepLabel(lift.reps)} ever.`
          : `${formatLongDate(lift.date)}. ${pickVariant(PR_ANNIVERSARY_LINES, story.id)}`,
      };
    }
    case "longestStreak":
      return {
        accent: "orange",
        icon: Flame,
        description: "Longest streak ever",
        title: `${story.weeks} weeks in a row`,
        footer: pickVariant(LONGEST_STREAK_LINES, story.id),
      };
    default:
      return null;
  }
}

const MEET_SHORT_NAMES = {
  "Back Squat": "Squat",
  "Bench Press": "Bench",
  "Strict Press": "Press",
};

const PR_ANNIVERSARY_LINES = [
  "A lifetime PR on the day.",
  "A lifetime PR on the day, and a brick in everything since.",
  "The heaviest you had ever lifted, on the day.",
];

const LONGEST_STREAK_LINES = [
  "Three sessions a week, every week. Your best run yet, and still going.",
  "No run in your log has gone longer. Every week from here sets the record.",
  "Your longest run of three-session weeks, live right now.",
];

function formatSet(set) {
  return `${set.reps}@${set.weight}${set.unitType}`;
}

function formatLongDate(dateStr) {
  return format(parseISO(dateStr), "MMMM d, yyyy");
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

function pickVariant(pool, seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return pool[hash % pool.length];
}
