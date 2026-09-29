/**
 * Ranks the big four by which one the athlete is due to train next, and
 * proposes a linear-progression top set for each.
 *
 * "Due" reads the athlete's own pattern from the last couple of months, in
 * three layers:
 *  - Weekday. A lift trained on this weekday most weeks is the strongest
 *    signal there is: bench every Wednesday means today is bench day.
 *  - Rhythm. Days since the lift, against its own typical gap, so a squat
 *    trained every 3 days is due sooner than a weekly deadlift.
 *  - Companions. A lift that mostly shares a session with a competition lift
 *    (press after Friday deadlifts) follows that lift instead of leading.
 * The competition lifts also get a mild edge over press, since most
 * barbell programs build around the big three.
 *
 * The proposed top set comes from the lift block's own target logic, so the
 * number on the card is the one the block offers once the lift starts.
 */

import { BIG_FOUR_LIFT_TYPES, getCuratedLift } from "@/lib/lifts/lift-registry";
import { getDaysBetweenYmd, parseYmdUtc } from "@/lib/date-utils";
import {
  RECENT_TOP_SET_SESSION_LIMIT,
  getRecentTopSetHistory,
  getTargetTopSetSummary,
} from "@/components/log/lift-block-coaching-state";

// The pattern window. Long enough to hold a few sessions of a weekly lift,
// short enough that last season's split doesn't set today's order.
const RHYTHM_WINDOW_DAYS = 60;

// After this long away, one more increment isn't the honest next step. The
// card shows what was lifted last and leaves the jump out.
const STALE_TOP_SET_DAYS = 42;

// A weekday counts as the lift's day once it has held at least this many
// sessions, making up at least this share of the lift's recent sessions.
const WEEKDAY_MIN_SESSIONS = 3;
const WEEKDAY_MIN_SHARE = 0.5;
// Done this recently, the lift already had its day this week, moved earlier.
const WEEKDAY_RECENT_DAYS = 3;
// Weekday beats rhythm: a lift on its day outranks one merely overdue.
const WEEKDAY_BONUS = 1;

// Past this many times its usual gap, a lift is no more due today. Without a
// cap, one neglected lift outranks the athlete's actual schedule.
const MAX_OVERDUE_RATIO = 1.5;

// Press and friends still rank, just a little behind the competition lifts.
const SUPPORTING_LIFT_WEIGHT = 0.8;

// A supporting lift sharing at least this share of its recent sessions with
// one competition lift is that lift's companion.
const COMPANION_MIN_SESSIONS = 3;
const COMPANION_MIN_SHARE = 0.6;

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/**
 * @param {Object} params
 * @param {Array} params.parsedData - The athlete's parsed lifts.
 * @param {string} params.referenceDate - YYYY-MM-DD, usually today.
 * @param {boolean} params.isMetric
 * @returns {Array<{
 *   liftType: string,
 *   lastDate: string|null,
 *   daysSince: number|null,
 *   cadenceDays: number|null,
 *   isDue: boolean,
 *   usualWeekday: string|null,
 *   companionOf: string|null,
 *   lastTopSet: {reps: number, weight: number}|null,
 *   nextTopSet: {reps: number, weight: number}|null,
 *   unit: string,
 * }>} All four lifts, most due first, with each companion straight after its
 *   lift. Empty when none has been trained.
 */
export function getBigFourNextUp({ parsedData, referenceDate, isMetric }) {
  if (!Array.isArray(parsedData) || !referenceDate) return [];

  const unit = isMetric ? "kg" : "lb";
  const minIncrement = isMetric ? 2.5 : 5;
  const todayWeekday = parseYmdUtc(referenceDate).getUTCDay();
  const priorByLift = Object.fromEntries(
    BIG_FOUR_LIFT_TYPES.map((liftType) => [liftType, []]),
  );
  for (const entry of parsedData) {
    if (entry.isGoal || !entry.date || entry.date >= referenceDate) continue;
    priorByLift[entry.liftType]?.push(entry);
  }

  const lifts = BIG_FOUR_LIFT_TYPES.map((liftType, registryIndex) => {
    const prior = priorByLift[liftType];
    const dates = [...new Set(prior.map((e) => e.date))].sort();
    const recentDates = dates.filter(
      (date) => getDaysBetweenYmd(date, referenceDate) <= RHYTHM_WINDOW_DAYS,
    );
    const lastDate = dates.at(-1) ?? null;
    const daysSince = lastDate
      ? getDaysBetweenYmd(lastDate, referenceDate)
      : null;
    const cadenceDays = getCadenceDays(recentDates);
    const isOnItsWeekday =
      daysSince >= WEEKDAY_RECENT_DAYS &&
      isUsualWeekday(recentDates, todayWeekday);
    const isCompetitionLift = Boolean(getCuratedLift(liftType)?.powerlifting);
    const rhythmRatio = cadenceDays ? daysSince / cadenceDays : null;

    const history = getRecentTopSetHistory({
      prior,
      isMetric,
      limit: RECENT_TOP_SET_SESSION_LIMIT,
    });
    const last = history.at(-1) ?? null;
    const target = getTargetTopSetSummary({
      topSetHistory: history,
      minIncrement,
    });
    const isStale = daysSince === null || daysSince > STALE_TOP_SET_DAYS;

    return {
      liftType,
      registryIndex,
      recentDates,
      isCompetitionLift,
      // Out of the pattern entirely, so it ranks after the lifts in rotation.
      score:
        rhythmRatio === null
          ? null
          : Math.min(rhythmRatio, MAX_OVERDUE_RATIO) *
              (isCompetitionLift ? 1 : SUPPORTING_LIFT_WEIGHT) +
            (isOnItsWeekday ? WEEKDAY_BONUS : 0),
      lastDate,
      daysSince,
      cadenceDays,
      isDue: isOnItsWeekday || rhythmRatio >= 1,
      usualWeekday: isOnItsWeekday ? WEEKDAY_NAMES[todayWeekday] : null,
      companionOf: null,
      lastTopSet: last ? { reps: last.reps, weight: last.weight } : null,
      nextTopSet:
        target && !isStale
          ? {
              reps: target.reps,
              // Rounded to the plates, since a kg log viewed in lb would
              // otherwise propose something like 221.6lb.
              weight:
                Math.round((target.weight + minIncrement) / minIncrement) *
                minIncrement,
            }
          : null,
      unit,
    };
  });

  if (lifts.every((lift) => !lift.lastDate)) return [];

  for (const lift of lifts) {
    lift.companionOf = findCompanionHost(lift, lifts);
  }

  const leads = lifts
    .filter((lift) => !lift.companionOf)
    .sort((a, b) => {
      if (a.score !== null && b.score !== null) {
        return b.score - a.score || b.daysSince - a.daysSince;
      }
      if (a.score !== null) return -1;
      if (b.score !== null) return 1;
      // Outside the pattern: the more recently trained lift is the likelier
      // comeback, and never-trained lifts keep registry order at the end.
      if (a.lastDate && b.lastDate) return b.lastDate.localeCompare(a.lastDate);
      if (a.lastDate || b.lastDate) return a.lastDate ? -1 : 1;
      return a.registryIndex - b.registryIndex;
    });
  const ordered = leads.flatMap((lead) => [
    lead,
    ...lifts.filter((lift) => lift.companionOf === lead.liftType),
  ]);

  return ordered.map(
    ({
      registryIndex: _index,
      recentDates: _dates,
      isCompetitionLift: _competition,
      score: _score,
      ...lift
    }) => lift,
  );
}

/**
 * The competition lift a supporting lift usually rides along with, or null.
 * Only a supporting lift can be a companion, so squat and bench on the same
 * full-body day never demote each other.
 */
function findCompanionHost(lift, lifts) {
  if (lift.isCompetitionLift) return null;
  const sessions = lift.recentDates.length;
  if (sessions < COMPANION_MIN_SESSIONS) return null;

  let best = null;
  for (const host of lifts) {
    if (!host.isCompetitionLift) continue;
    const hostDates = new Set(host.recentDates);
    const shared = lift.recentDates.filter((d) => hostDates.has(d)).length;
    if (shared / sessions < COMPANION_MIN_SHARE) continue;
    if (!best || shared > best.shared)
      best = { liftType: host.liftType, shared };
  }
  return best?.liftType ?? null;
}

/** Whether the lift lands on this weekday most weeks it's trained. */
function isUsualWeekday(recentDates, weekday) {
  const onWeekday = recentDates.filter(
    (date) => parseYmdUtc(date).getUTCDay() === weekday,
  ).length;
  return (
    onWeekday >= WEEKDAY_MIN_SESSIONS &&
    onWeekday / recentDates.length >= WEEKDAY_MIN_SHARE
  );
}

/**
 * The lift's typical days between sessions inside the rhythm window, or null
 * when it wasn't trained there. The median ignores one missed week. A lift
 * trained once in the window counts the window as its interval, so it still
 * ranks, just as a slow one.
 */
function getCadenceDays(recent) {
  if (recent.length === 0) return null;
  if (recent.length === 1) return RHYTHM_WINDOW_DAYS / 2;

  const gaps = recent
    .slice(1)
    .map((date, i) => getDaysBetweenYmd(recent[i], date))
    .sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  return gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2;
}

/** "5@152.5kg", the app's usual shorthand for a set. */
export function formatNextUpSet(set, unit) {
  if (!set) return null;
  return `${set.reps}@${set.weight}${unit}`;
}
