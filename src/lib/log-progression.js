/**
 * Session-over-session progression for the log. Spots a working set that moved
 * past the heaviest set at the same reps in the lift's recent sessions, like
 * 5@127.5kg a week after 5@125kg, so the row can say so with a badge.
 */

// The bar is the best set at the same reps across this many recent sessions,
// not just the last one. Plenty of programs wave the load within a week
// (heavy/light, or heavy/light/medium like the classic squat split), and a
// heavy day should be measured against the last heavy day, not the light day
// in between. Three covers both patterns. For a pure linear progression, where
// every session goes up, the max of the last three is simply the last one, so
// nothing is lost there.
const LOOKBACK_SESSIONS = 3;

// Sessions older than this stop counting as "last time". Beating a set from
// three months ago is a comeback, not a progression.
const MAX_GAP_DAYS = 42;

// Warm-ups climb every session by design. Only sets at or above this share of
// the session's heaviest weight count as work worth comparing.
const WORKING_SET_SHARE = 0.7;

const MAX_REPS = 12;

// Five ways of saying it, so two badges on one lift never read the same. The
// pick steps with the badge's position in the lift and is offset by date and
// lift, so it holds still across renders but reads fresh on a new day.
const PROGRESSION_PHRASES = [
  "📈 Up on last time",
  "📈 Linear progression",
  "📈 Beat last session",
  "📈 Still climbing",
  "📈 Moving up",
];

function hashPhraseSeed(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function toKg(weight, unitType) {
  return unitType === "lb" ? weight / 2.2046 : weight;
}

/**
 * The heaviest set at each rep count across the lift's last LOOKBACK_SESSIONS
 * sessions before sessionDate, within MAX_GAP_DAYS. Null when there are none.
 */
export function getPreviousSessionBests(parsedData, liftType, sessionDate) {
  if (!Array.isArray(parsedData) || !liftType || !sessionDate) return null;

  const sessionMs = Date.parse(`${sessionDate}T00:00:00Z`);
  const earlierDates = new Set();
  for (const entry of parsedData) {
    if (entry.isGoal || entry.liftType !== liftType) continue;
    if (!entry.date || entry.date >= sessionDate) continue;
    const gapDays =
      (sessionMs - Date.parse(`${entry.date}T00:00:00Z`)) / 86400000;
    if (gapDays <= MAX_GAP_DAYS) earlierDates.add(entry.date);
  }
  if (earlierDates.size === 0) return null;

  const lookbackDates = new Set(
    [...earlierDates].sort().reverse().slice(0, LOOKBACK_SESSIONS),
  );

  const bestByReps = new Map();
  for (const entry of parsedData) {
    if (entry.isGoal || entry.liftType !== liftType) continue;
    if (!lookbackDates.has(entry.date)) continue;
    const reps = entry.reps ?? 0;
    const weight = entry.weight ?? 0;
    if (reps <= 0 || weight <= 0) continue;
    const kg = toKg(weight, entry.unitType);
    const current = bestByReps.get(reps);
    // A tie goes to the more recent session, the fairer "last time".
    if (
      !current ||
      kg > current.kg ||
      (kg === current.kg && entry.date > current.set.date)
    ) {
      bestByReps.set(reps, { kg, set: entry });
    }
  }

  return { bestByReps };
}

/**
 * One entry per set, aligned with `sets`: { message, previousSet,
 * previousDate } for the set that beat the recent best at its rep count,
 * otherwise null.
 */
export function getProgressionBadges({
  sets,
  previous,
  sessionDate,
  liftType,
}) {
  const result = sets.map(() => null);
  if (!previous || sets.length === 0) return result;

  const kgBySet = sets.map((set) =>
    !set || set._pending || !(set.reps > 0) || !(set.weight > 0)
      ? 0
      : toKg(set.weight, set.unitType),
  );
  const sessionTopKg = Math.max(0, ...kgBySet);
  if (sessionTopKg <= 0) return result;

  // Today's heaviest set at each rep count; the first one wins a tie.
  const bestIndexByReps = new Map();
  sets.forEach((set, index) => {
    const kg = kgBySet[index];
    if (kg <= 0 || set.reps > MAX_REPS) return;
    const bestIndex = bestIndexByReps.get(set.reps);
    if (bestIndex === undefined || kg > kgBySet[bestIndex]) {
      bestIndexByReps.set(set.reps, index);
    }
  });

  const winners = [];
  for (const [reps, index] of bestIndexByReps) {
    const kg = kgBySet[index];
    const before = previous.bestByReps.get(reps);
    if (!before) continue;
    if (kg < sessionTopKg * WORKING_SET_SHARE) continue;
    // Beyond rounding noise from a unit conversion.
    if (kg - before.kg < 0.05) continue;
    winners.push({ index, previousSet: before.set });
  }

  winners.sort((a, b) => a.index - b.index);
  const offset = hashPhraseSeed(`${sessionDate}:${liftType}`);
  winners.forEach(({ index, previousSet }, position) => {
    result[index] = {
      message:
        PROGRESSION_PHRASES[(offset + position) % PROGRESSION_PHRASES.length],
      previousSet,
      previousDate: previousSet.date,
    };
  });
  return result;
}
