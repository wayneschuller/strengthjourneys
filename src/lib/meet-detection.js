/**
 * Meet detection: which days in a lifter's log were powerlifting meets.
 *
 * Run once per data load by UserLiftingDataProvider (as meetDays) and read
 * from there by anything that wants to mark a meet: the story of the day, the
 * classic lift, and later the charts. Nothing is stored; a note edited in the
 * sheet shows up on the next load.
 *
 * A meet is a high bar, checked against a real twelve-year log where it finds
 * exactly the five meets and nothing else. A day counts when a note names a
 * competition ("2019 South Melbourne PTC Novice Competition", "powerlifting
 * comp", "meet day"), or two or more sets carry attempt numbers. One "second
 * attempt" is just a second try, and "comp" on its own is not enough because
 * lifters write "comp pause" and "comp prep" all the time.
 *
 * The athlete sees the word "meet" (our audience is mostly American), but
 * notes are read in every dialect: an Australian writes "powerlifting comp"
 * or "powerlifting event" for the same day. The Label column counts too,
 * quietly: it is an unofficial column some sheets have, never advertised, so
 * nothing in the UI should mention it. An online contest run over a multi-day
 * window has no single meet day and is left out.
 */

import { recordTiming } from "@/lib/processing-utils";
import { toKg } from "@/lib/weight-units";

const MEET_LABEL_PATTERN =
  /\b(comp|competition|meet|championships?|nationals)\b/i;
// Case-sensitive: a capitalised Competition or Championship is a named event.
const MEET_NAMED_EVENT_PATTERN =
  /\b(Competition|Championships?|Nationals|Contest)\b/;
const MEET_NOTE_PATTERN =
  /\b(powerlifting|weightlifting|strongman|bench|deadlift) (competition|comp|meet|event|contest)\b|\bmeet day\b|\bcomp day\b/i;
const MEET_ATTEMPT_PATTERN = /\b(1st|2nd|3rd|first|second|third) attempt\b/i;
// Every pattern below needs one of these words, so a note without any of
// them is not checked further.
const MEET_HINT_PATTERN = /comp|meet|attempt|event|contest|champion|national/i;
// Notes that talk about a meet without being one: prep, rehearsals, plans
// and daydreams.
const MEET_NOTE_EXCLUDE_PATTERN =
  /\b(imagine|imagining|find|possible|prep|preparing|dreaming|thinking|practice|treat|pretend|like a|for a comp|for the comp|next comp|upcoming|mock|will be|would be|window)\b/i;
// The event's name as written in a note, e.g. "2021 Strength Haven Novice
// Powerlifting Competition". Short joining words may sit between the
// capitalised ones: "Jungle Strength and Performance Berwick Winter
// Powerlifting Comp".
const MEET_NAME_PATTERN =
  /([A-Z0-9][\w'&.-]*(?:\s+(?:(?:and|of|the|at|in|for|de|du|la)\s+)?[A-Z0-9][\w'&.-]*)*\s+(?:Powerlifting\s+)?(?:Competition|Comp|Meet|Championships?|Contest|Open))/;

/**
 * Every meet day in the log.
 *
 * @param {Array} parsedData - Canonical lift objects.
 * @returns {Map<string, {name: string|null, topSets: Object<string, Object>}>}
 *   Keyed by YYYY-MM-DD. topSets holds the heaviest set of each lift that day
 *   (by real load), which on a meet day is the attempt that counted.
 */
export function processMeetDays(parsedData) {
  const startTime = performance.now();
  const meetDays = new Map();
  if (!Array.isArray(parsedData) || parsedData.length === 0) return meetDays;

  // Pass one decides which dates are meets. Most sets have no note or label,
  // so they cost one property check, and nothing is grouped.
  const meetDates = new Set();
  const attemptSetsByDate = new Map();
  for (const entry of parsedData) {
    if (entry.isGoal || !entry.date || meetDates.has(entry.date)) continue;
    if (!entry.notes && !entry.label) continue;
    const signal = getMeetSignal(entry);
    if (signal === "meet") {
      meetDates.add(entry.date);
    } else if (signal === "attempt") {
      const attempts = (attemptSetsByDate.get(entry.date) ?? 0) + 1;
      attemptSetsByDate.set(entry.date, attempts);
      if (attempts >= 2) meetDates.add(entry.date);
    }
  }

  // Pass two gathers only the meet days' sets for their names and top sets.
  if (meetDates.size > 0) {
    const entriesByDate = new Map();
    for (const entry of parsedData) {
      if (entry.isGoal || !meetDates.has(entry.date)) continue;
      if (!entriesByDate.has(entry.date)) entriesByDate.set(entry.date, []);
      entriesByDate.get(entry.date).push(entry);
    }
    for (const date of Array.from(meetDates).sort()) {
      const entries = entriesByDate.get(date);
      meetDays.set(date, {
        name: findMeetName(entries),
        topSets: getTopSetPerLift(entries),
      });
    }
  }

  recordTiming(
    "Meet Days",
    performance.now() - startTime,
    `${meetDays.size} meet day${meetDays.size === 1 ? "" : "s"}`,
  );
  return meetDays;
}

/**
 * True when one day's sets look like a meet. Exported so the rules can be
 * checked against real logs.
 *
 * @param {Array} entries - Every lift object from one date.
 * @returns {boolean}
 */
export function isMeetSession(entries) {
  let attemptSets = 0;
  for (const entry of entries) {
    const signal = getMeetSignal(entry);
    if (signal === "meet") return true;
    if (signal === "attempt") attemptSets++;
  }
  return attemptSets >= 2;
}

// What one set says on its own: "meet" when its label or note names a
// competition, "attempt" when its note carries an attempt number (it takes
// two of those to make a meet), otherwise null.
function getMeetSignal(entry) {
  if (entry.label && MEET_LABEL_PATTERN.test(entry.label)) return "meet";
  const notes = entry.notes;
  if (!notes || typeof notes !== "string") return null;
  // Most notes never mention a competition; one cheap test skips the rest.
  if (!MEET_HINT_PATTERN.test(notes)) return null;
  if (MEET_NOTE_EXCLUDE_PATTERN.test(notes)) return null;
  if (MEET_NAMED_EVENT_PATTERN.test(notes) || MEET_NOTE_PATTERN.test(notes)) {
    return "meet";
  }
  return MEET_ATTEMPT_PATTERN.test(notes) ? "attempt" : null;
}

function findMeetName(entries) {
  const labelled = entries.find(
    (entry) => entry.label && MEET_LABEL_PATTERN.test(entry.label),
  );
  if (labelled) return labelled.label.trim();
  for (const entry of entries) {
    const match = entry.notes?.match(MEET_NAME_PATTERN);
    if (match) return match[1].trim();
  }
  return null;
}

function getTopSetPerLift(entries) {
  const topSets = {};
  for (const entry of entries) {
    if (!(entry.reps >= 1) || !(entry.weight > 0)) continue;
    const current = topSets[entry.liftType];
    if (
      !current ||
      toKg(entry.weight, entry.unitType) >
        toKg(current.weight, current.unitType)
    ) {
      topSets[entry.liftType] = entry;
    }
  }
  return topSets;
}
