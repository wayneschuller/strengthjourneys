/**
 * Story of the day: finds the moments in a lifter's log worth leading the home
 * dashboard with, and ranks them.
 *
 * Event stories (a PR this week, a meet anniversary, the day they started
 * lifting, a PR anniversary) only exist when the
 * log earns them, and always outrank the evergreen summary cards the hero
 * falls back on. That ranking is what keeps a new lifter from being shown
 * lifetime stats they do not have yet.
 *
 * Anniversaries look back over the last seven days rather than only today, so
 * someone who opens the app twice a week still hears about the meet they did
 * three years ago on Tuesday.
 *
 * Everything here is pure so it can run against a real exported log in Node.
 */

import { BIG_FOUR_LIFT_TYPE_SET } from "@/lib/lifts/lift-registry";
import { subtractDaysFromStr } from "@/lib/date-utils";
import { toKg } from "@/lib/weight-units";

export const ANNIVERSARY_WINDOW_DAYS = 7;
export const RECENT_PR_WINDOW_DAYS = 7;

// Event scores sit above anything the evergreen cards can reach
// (EVERGREEN_MAX_SCORE), so a real moment always leads.
const STORY_SCORES = {
  recentPr: 100,
  meetAnniversary: 95,
  journeyBirthday: 90,
  prAnniversary: 70,
};
export const EVERGREEN_MAX_SCORE = 60;

// Rep counts that mean something to a lifter, in the order we would brag
// about them. A 7RM PR is real but rarely the headline.
const HEADLINE_REPS = [1, 3, 5, 2, 10, 8, 4, 6];

// A meet is a high bar: the Label column naming a competition, an attempt
// number, or a note that names the competition. "Comp" on its own is not
// enough, because lifters write "comp pause" and "comp prep" all the time.
const MEET_LABEL_PATTERN =
  /\b(comp|competition|meet|championships?|nationals)\b/i;
const MEET_NOTE_PATTERN =
  /\b(1st|2nd|3rd|first|second|third) attempt\b|\b(powerlifting|weightlifting|strongman|bench|deadlift) (competition|comp|meet)\b|\bmeet day\b|\bcomp day\b/i;
// Notes that talk about a meet without being one: prep, plans and daydreams.
const MEET_NOTE_EXCLUDE_PATTERN =
  /\b(imagine|imagining|find|possible|prep|preparing|dreaming|thinking|practice|treat|pretend|like a|for the comp|next comp|upcoming)\b/i;

/**
 * Builds the ranked event stories for today. Evergreen cards are ranked by the
 * caller with rankEvergreenStories and merged after these.
 *
 * @param {Object} params
 * @param {Array} params.parsedData - Canonical lift objects, oldest first.
 * @param {Object} params.topLiftsByTypeAndReps - liftType -> [reps-1] -> best-first sets.
 * @param {string} params.todayStr - Local YYYY-MM-DD.
 * @returns {Array<Object>} Stories, best first.
 */
export function buildEventStories({
  parsedData,
  topLiftsByTypeAndReps,
  todayStr,
}) {
  if (!Array.isArray(parsedData) || parsedData.length === 0 || !todayStr) {
    return [];
  }

  const stories = [
    findRecentPrStory(topLiftsByTypeAndReps, todayStr),
    ...findAnniversaryStories(parsedData, topLiftsByTypeAndReps, todayStr),
  ].filter(Boolean);

  return stories.sort((a, b) => b.score - a.score);
}

/**
 * Gives evergreen cards a score that shuffles once a day, so the fallback
 * rotation changes daily but holds still between page loads.
 *
 * @param {string[]} keys - Evergreen card keys, in the stage's preferred order.
 * @param {string} todayStr
 * @returns {Array<{id:string, kind:"evergreen", score:number}>}
 */
export function rankEvergreenStories(keys, todayStr) {
  return keys
    .map((key, index) => ({
      id: key,
      kind: "evergreen",
      // The stage's order still counts for a little, the day's seed for more.
      score:
        EVERGREEN_MAX_SCORE -
        20 -
        index * 2 +
        (hashString(`${todayStr}:${key}`) % 20),
    }))
    .sort((a, b) => b.score - a.score);
}

/**
 * True when a session looks like a competition day. Exported so the logic can
 * be checked against real logs.
 *
 * @param {Array} entries - Every lift object from one date.
 * @returns {boolean}
 */
export function isMeetSession(entries) {
  return entries.some((entry) => {
    if (entry.label && MEET_LABEL_PATTERN.test(entry.label)) return true;
    const notes = entry.notes;
    if (!notes || typeof notes !== "string") return false;
    return (
      MEET_NOTE_PATTERN.test(notes) && !MEET_NOTE_EXCLUDE_PATTERN.test(notes)
    );
  });
}

// ─── Event finders ─────────────────────────────────────────────────────────

function findRecentPrStory(topLiftsByTypeAndReps, todayStr) {
  if (!topLiftsByTypeAndReps) return null;
  const windowStart = subtractDaysFromStr(todayStr, RECENT_PR_WINDOW_DAYS - 1);

  let best = null;
  for (const [liftType, byReps] of Object.entries(topLiftsByTypeAndReps)) {
    HEADLINE_REPS.forEach((reps, repRank) => {
      const sets = byReps?.[reps - 1];
      const top = sets?.[0];
      if (!top) return;
      if (top.date < windowStart || top.date > todayStr) return;
      // A first-ever set at a rep count beats nothing, and a heavier set from
      // the same session is just the top set, so the PR needs a best from an
      // earlier day that it outweighs in real load.
      const previous = sets.find((set) => set.date < top.date);
      if (
        !previous ||
        toKg(top.weight, top.unitType) <=
          toKg(previous.weight, previous.unitType)
      ) {
        return;
      }

      const rank =
        (BIG_FOUR_LIFT_TYPE_SET.has(liftType) ? 0 : 100) + repRank * 10;
      if (!best || rank < best.rank) {
        best = { rank, liftType, top, previous };
      }
    });
  }
  if (!best) return null;

  const { liftType, top, previous } = best;
  return {
    id: `recent-pr:${liftType}:${top.reps}:${top.date}`,
    kind: "recentPr",
    score: STORY_SCORES.recentPr,
    liftType,
    date: top.date,
    lift: top,
    previous,
    daysAgo: getDaysBetween(top.date, todayStr),
  };
}

function findAnniversaryStories(parsedData, topLiftsByTypeAndReps, todayStr) {
  const windowByMonthDay = buildAnniversaryWindow(todayStr);
  const firstEntry = parsedData.find((entry) => !entry.isGoal && entry.date);

  const sessionsByDate = new Map();
  for (let i = 0; i < parsedData.length; i++) {
    const entry = parsedData[i];
    if (entry.isGoal || !entry.date) continue;
    const match = windowByMonthDay.get(entry.date.slice(5));
    if (!match) continue;
    const yearsAgo = match.year - Number(entry.date.slice(0, 4));
    if (yearsAgo < 1) continue;
    if (!sessionsByDate.has(entry.date)) sessionsByDate.set(entry.date, []);
    sessionsByDate.get(entry.date).push(entry);
  }

  const stories = [];

  if (firstEntry) {
    const match = windowByMonthDay.get(firstEntry.date.slice(5));
    const yearsAgo = match
      ? match.year - Number(firstEntry.date.slice(0, 4))
      : 0;
    if (match && yearsAgo >= 1) {
      stories.push({
        id: `journey-birthday:${firstEntry.date}`,
        kind: "journeyBirthday",
        score: STORY_SCORES.journeyBirthday,
        liftType: firstEntry.liftType,
        date: firstEntry.date,
        lift: firstEntry,
        yearsAgo,
        daysAgo: match.daysAgo,
      });
    }
  }

  // The most recent meet in the window wins if a lifter somehow competed on
  // two of these seven days across different years.
  let meet = null;
  for (const [date, entries] of sessionsByDate) {
    if (!isMeetSession(entries)) continue;
    if (!meet || date > meet.date) meet = { date, entries };
  }
  if (meet) {
    const match = windowByMonthDay.get(meet.date.slice(5));
    stories.push({
      id: `meet-anniversary:${meet.date}`,
      kind: "meetAnniversary",
      score: STORY_SCORES.meetAnniversary,
      date: meet.date,
      meetName: findMeetName(meet.entries),
      bestSingles: getHeaviestSetPerLift(meet.entries),
      // A meet's footage may be a warm-up or an attempt that is not the day's
      // top set, so keep the heaviest filmed set as a fallback.
      meetVideoLift: meet.entries
        .filter((entry) => entry.URL || entry.url)
        .sort((a, b) => b.weight - a.weight)[0],
      yearsAgo: match.year - Number(meet.date.slice(0, 4)),
      daysAgo: match.daysAgo,
    });
  }

  const prAnniversary = findPrAnniversary(
    sessionsByDate,
    windowByMonthDay,
    topLiftsByTypeAndReps,
  );
  if (prAnniversary) stories.push(prAnniversary);

  return stories;
}

// The most brag-worthy set that was a PR on the day, with a bonus when it is
// still the lifetime best.
function findPrAnniversary(
  sessionsByDate,
  windowByMonthDay,
  topLiftsByTypeAndReps,
) {
  let best = null;
  for (const [date, entries] of sessionsByDate) {
    for (const entry of entries) {
      if (!entry.isHistoricalPR) continue;
      const repRank = HEADLINE_REPS.indexOf(entry.reps);
      if (repRank === -1) continue;

      const lifetimeTop =
        topLiftsByTypeAndReps?.[entry.liftType]?.[entry.reps - 1]?.[0];
      const isStillBest =
        !!lifetimeTop &&
        lifetimeTop.date === entry.date &&
        lifetimeTop.weight === entry.weight;
      // Among PRs that have since been beaten, the one closest to today's
      // best is the better memory: a near-lifetime single beats a first-year
      // one.
      const shareOfLifetimeBest =
        lifetimeTop?.weight > 0 ? entry.weight / lifetimeTop.weight : 0;
      const rank =
        (BIG_FOUR_LIFT_TYPE_SET.has(entry.liftType) ? 0 : 100) +
        (isStillBest ? 0 : 20 + (1 - Math.min(1, shareOfLifetimeBest)) * 60) +
        repRank * 10;

      if (!best || rank < best.rank) {
        best = { rank, date, entry, isStillBest };
      }
    }
  }
  if (!best) return null;

  const match = windowByMonthDay.get(best.date.slice(5));
  return {
    id: `pr-anniversary:${best.entry.liftType}:${best.entry.reps}:${best.date}`,
    kind: "prAnniversary",
    score: STORY_SCORES.prAnniversary + (best.isStillBest ? 5 : 0),
    liftType: best.entry.liftType,
    date: best.date,
    lift: best.entry,
    isStillBest: best.isStillBest,
    yearsAgo: match.year - Number(best.date.slice(0, 4)),
    daysAgo: match.daysAgo,
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

// MM-DD for today and the six days before it, each remembering its own year
// and how many days back it is. The year matters in the first week of
// January, when part of the window sits in last year.
function buildAnniversaryWindow(todayStr) {
  const window = new Map();
  for (let daysAgo = 0; daysAgo < ANNIVERSARY_WINDOW_DAYS; daysAgo++) {
    const dateStr = subtractDaysFromStr(todayStr, daysAgo);
    window.set(dateStr.slice(5), {
      year: Number(dateStr.slice(0, 4)),
      daysAgo,
    });
  }
  return window;
}

function findMeetName(entries) {
  const labelled = entries.find(
    (entry) => entry.label && MEET_LABEL_PATTERN.test(entry.label),
  );
  if (labelled) return labelled.label.trim();
  // Fall back to the note that names the competition, trimmed to the name.
  for (const entry of entries) {
    const match = entry.notes?.match(
      /([A-Z0-9][\w'&.-]*(?:\s+[A-Z0-9][\w'&.-]*)*\s+(?:Powerlifting\s+)?(?:Competition|Comp|Meet|Championships?|Open))/,
    );
    if (match) return match[1].trim();
  }
  return null;
}

// Heaviest set of each lift that day, big four first, so a meet reads as
// squat, bench, deadlift.
function getHeaviestSetPerLift(entries) {
  const byLift = new Map();
  entries.forEach((entry) => {
    const current = byLift.get(entry.liftType);
    if (!current || entry.weight > current.weight) {
      byLift.set(entry.liftType, entry);
    }
  });
  return Array.from(byLift.values())
    .filter((entry) => BIG_FOUR_LIFT_TYPE_SET.has(entry.liftType))
    .sort(
      (a, b) =>
        MEET_LIFT_ORDER.indexOf(a.liftType) -
        MEET_LIFT_ORDER.indexOf(b.liftType),
    );
}
const MEET_LIFT_ORDER = [
  "Back Squat",
  "Bench Press",
  "Deadlift",
  "Strict Press",
];

function getDaysBetween(fromStr, toStr) {
  const from = Date.UTC(
    Number(fromStr.slice(0, 4)),
    Number(fromStr.slice(5, 7)) - 1,
    Number(fromStr.slice(8, 10)),
  );
  const to = Date.UTC(
    Number(toStr.slice(0, 4)),
    Number(toStr.slice(5, 7)) - 1,
    Number(toStr.slice(8, 10)),
  );
  return Math.round((to - from) / 86400000);
}

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}
