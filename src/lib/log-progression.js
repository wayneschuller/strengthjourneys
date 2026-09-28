/**
 * Session-over-session progression for the log. Spots a working set that
 * moved past what the lift did in its recent sessions, either more weight at
 * the same reps (5@127.5kg after 5@125kg) or more reps at the same or more
 * weight (6@125kg after 5@125kg), and counts how many sessions in a row the
 * lift has kept doing it.
 */

// The bar is set by this many recent sessions, not just the last one. Plenty
// of programs wave the load within a week (heavy/light, or heavy/light/medium
// like the classic squat split), and a heavy day should be measured against
// the last heavy day, not the light day in between. Three covers both. For a
// pure linear progression, where every session goes up, the best of the last
// three is simply the last one, so nothing is lost there.
const LOOKBACK_SESSIONS = 3;

// Sessions older than this stop counting as "last time". Beating a set from
// three months ago is a comeback, not a progression.
const MAX_GAP_DAYS = 42;

// Warm-ups climb every session by design. Only sets at or above this share of
// the session's heaviest weight count as work worth comparing.
const WORKING_SET_SHARE = 0.7;

// A progressing set has to be real work for this lift right now, at least
// this share of the recent best effort. Without it, once heavy days move to
// triples, the light day's fives keep "beating" the last light day's fives.
// A back-off five after heavy singles sits well above it. The set it beat has
// to clear the same share of its own session's top effort, so a warm-up on
// the way to a heavy day is never the thing that was beaten.
const SERIOUS_EFFORT_SHARE = 0.8;

const MAX_REPS = 12;

// Adding reps is progress within a small step. 8@125 after 5@125 is a
// different kind of set, not the same one done better.
const MAX_REP_STEP = 2;

// Rounding noise from kg/lb conversion.
const EPSILON_KG = 0.05;

const MAX_STREAK_WALK = 60;

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

// Streak tiers widen as they climb, so a novice adding weight every session
// sees the badge change character at 3, 5, 8 and 12 rather than every time.
// The count itself is always exact.
const STREAK_TIERS = [
  {
    min: 12,
    phrases: [
      (n) => `🚀 ${n} in a row`,
      (n) => `🚀 ${n} and counting`,
      (n) => `🚀 ${n} session run`,
      (n) => `🚀 ${n} straight`,
      (n) => `🚀 ${n} for ${n}`,
    ],
  },
  {
    min: 8,
    phrases: [
      (n) => `🔥 ${n} and counting`,
      (n) => `🔥 ${n} in a row`,
      (n) => `🔥 ${n} session run`,
      (n) => `🔥 ${n} straight`,
      (n) => `🔥 ${n} for ${n}`,
    ],
  },
  {
    min: 5,
    phrases: [
      (n) => `🔥 ${n} in a row`,
      (n) => `🔥 ${n} straight`,
      (n) => `🔥 ${n} session climb`,
      (n) => `🔥 ${n} for ${n}`,
      (n) => `🔥 On a ${n} run`,
    ],
  },
  {
    min: 3,
    phrases: [
      (n) => `📈 ${n} in a row`,
      (n) => `📈 ${n} straight`,
      (n) => `📈 ${n} session climb`,
      (n) => `📈 ${n} for ${n}`,
      (n) => `📈 Up ${n} running`,
    ],
  },
  {
    min: 2,
    phrases: [
      () => "📈 Two in a row",
      () => "📈 Back to back",
      () => "📈 Up twice running",
      () => "📈 Two straight",
      () => "📈 Two for two",
    ],
  },
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

function daysBetween(fromYmd, toYmd) {
  return (
    (Date.parse(`${toYmd}T00:00:00Z`) - Date.parse(`${fromYmd}T00:00:00Z`)) /
    86400000
  );
}

// Epley, only to compare how hard sets were across rep counts.
function effort({ reps, kg }) {
  return kg * (1 + reps / 30);
}

function toComparableSet(entry) {
  const reps = entry?.reps ?? 0;
  const weight = entry?.weight ?? 0;
  if (entry?._pending || reps <= 0 || weight <= 0) return null;
  return { reps, kg: toKg(weight, entry.unitType), entry };
}

function markWorkingSets(sets, sessionIndex = null) {
  const topKg = Math.max(0, ...sets.map((set) => set.kg));
  const topEffort = Math.max(0, ...sets.map(effort));
  return sets.map((set) => ({
    ...set,
    sessionIndex,
    working: set.kg >= topKg * WORKING_SET_SHARE && set.reps <= MAX_REPS,
    serious: effort(set) >= topEffort * SERIOUS_EFFORT_SHARE,
  }));
}

/**
 * The lift's sessions before beforeDate, oldest first, each with its sets in
 * comparable form. Built once per lift so the streak walk stays cheap.
 */
export function getLiftSessionHistory(parsedData, liftType, beforeDate) {
  if (!Array.isArray(parsedData) || !liftType || !beforeDate) return [];

  const byDate = new Map();
  for (const entry of parsedData) {
    if (entry.isGoal || entry.liftType !== liftType) continue;
    if (!entry.date || entry.date >= beforeDate) continue;
    const set = toComparableSet(entry);
    if (!set) continue;
    if (!byDate.has(entry.date)) byDate.set(entry.date, []);
    byDate.get(entry.date).push(set);
  }

  return [...byDate.keys()].sort().map((date, sessionIndex) => {
    const sets = markWorkingSets(byDate.get(date), sessionIndex);
    return {
      date,
      sets,
      topEffort: Math.max(...sets.map(effort)),
    };
  });
}

// The sessions that set the bar for a session on `date`: the last few before
// it, within MAX_GAP_DAYS. `endIndex` is exclusive.
function getLookback(history, endIndex, date) {
  const lookback = [];
  for (let i = endIndex - 1; i >= 0; i -= 1) {
    if (lookback.length >= LOOKBACK_SESSIONS) break;
    if (daysBetween(history[i].date, date) > MAX_GAP_DAYS) break;
    lookback.push(history[i]);
  }
  return lookback;
}

/**
 * The recent serious sets this one moved past, closest comparison first, or
 * an empty list when it did not progress. A set progresses when nothing
 * recent matched it on both reps and weight, and some recent serious set it
 * is directly comparable to sits under it: the same reps at less weight, or
 * fewer reps (within MAX_REP_STEP) at no more weight.
 */
function findBeatenSets(set, lookback) {
  const beaten = [];
  for (const session of lookback) {
    for (const prior of session.sets) {
      if (prior.reps >= set.reps && prior.kg >= set.kg - EPSILON_KG) {
        return [];
      }
      if (!prior.working || !prior.serious) continue;
      if (prior.reps > set.reps || prior.reps < set.reps - MAX_REP_STEP) {
        continue;
      }
      if (prior.kg > set.kg + EPSILON_KG) continue;
      // A repeat of the same set is a hold, and only the latest one counts.
      // Otherwise a stalled week would be stepped over by linking back to the
      // identical set before it.
      if (
        beaten.some(
          (other) =>
            other.reps === prior.reps &&
            Math.abs(other.kg - prior.kg) <= EPSILON_KG,
        )
      ) {
        continue;
      }
      beaten.push(prior);
    }
  }
  // Most reps, then most weight; the sort is stable, so the most recent
  // session wins what is left (lookback runs newest first).
  return beaten.sort((a, b) => b.reps - a.reps || b.kg - a.kg);
}

// The sets in a session that progressed. Each rep count speaks through its
// heaviest working set, so a 5@125 on the way to 5@127.5 stays quiet. Rep
// counts are judged apart: a heavy triple does not silence a new best five.
function getSessionProgress(sets, lookback) {
  const recentBest = getRecentBestEffort(lookback);
  const bestByReps = new Map();
  for (const set of sets) {
    if (!isProgressCandidate(set, recentBest)) continue;
    const current = bestByReps.get(set.reps);
    if (!current || set.kg > current.kg) bestByReps.set(set.reps, set);
  }
  const results = [];
  for (const set of bestByReps.values()) {
    const beaten = findBeatenSets(set, lookback);
    if (beaten.length > 0) results.push({ set, beaten });
  }
  return results;
}

function getRecentBestEffort(lookback) {
  return Math.max(0, ...lookback.map((session) => session.topEffort));
}

function isProgressCandidate(set, recentBest) {
  return set.working && effort(set) >= recentBest * SERIOUS_EFFORT_SHARE;
}

// Follows one set's own line back: the sets it beat, whether those had beaten
// something in their own session, and so on. The streak belongs to the set
// that climbed, so a heavy single never borrows the fives' run. Where a set
// beat several, the line runs through whichever has the longest run behind
// it, so 6@127.5 after 5@127.5 after 7@125 reads as one staircase. Light days
// drop out on their own, because the bar is set by the heavier sessions
// around them.
//
// Returns the run ending at `set`, oldest first, or an empty list when `set`
// did not progress in its own session. `memo` keeps the walk linear.
function getRunEndingAt(history, set, memo, depth = 0) {
  if (memo.has(set)) return memo.get(set);
  let run = [];
  const session = history[set.sessionIndex];
  const lookback = getLookback(history, set.sessionIndex, session.date);
  if (
    depth < MAX_STREAK_WALK &&
    lookback.length > 0 &&
    isProgressCandidate(set, getRecentBestEffort(lookback))
  ) {
    const beaten = findBeatenSets(set, lookback);
    if (beaten.length > 0) {
      run = [...getLongestRun(history, beaten, memo, depth + 1).run, set.entry];
    }
  }
  memo.set(set, run);
  return run;
}

// Of the sets something beat, the one with the longest run behind it. Ties
// keep the closest comparison, which findBeatenSets put first.
function getLongestRun(history, beaten, memo, depth = 0) {
  let best = {
    set: beaten[0],
    run: getRunEndingAt(history, beaten[0], memo, depth),
  };
  for (const set of beaten.slice(1)) {
    const run = getRunEndingAt(history, set, memo, depth);
    if (run.length > best.run.length) best = { set, run };
  }
  return best;
}

/**
 * One entry per set, aligned with `sets`, for the sets that progressed:
 * { message, previousSet, previousDate, streak, chain }. Each set carries
 * its own streak, traced through the sets it grew out of.
 */
export function getProgressionBadges({ sets, history, sessionDate, liftType }) {
  const result = sets.map(() => null);
  if (!Array.isArray(history) || history.length === 0 || sets.length === 0) {
    return result;
  }

  const lookback = getLookback(history, history.length, sessionDate);
  if (lookback.length === 0) return result;

  const comparable = sets
    .map((set, index) => ({ set: toComparableSet(set), index }))
    .filter(({ set }) => set);
  if (comparable.length === 0) return result;
  const marked = markWorkingSets(comparable.map(({ set }) => set));
  const indexBySet = new Map(
    marked.map((set, i) => [set, comparable[i].index]),
  );

  const progress = getSessionProgress(marked, lookback);
  const offset = hashPhraseSeed(`${sessionDate}:${liftType}`);

  const memo = new Map();
  progress
    .slice()
    .sort((a, b) => indexBySet.get(a.set) - indexBySet.get(b.set))
    .forEach((item, position) => {
      const { set: previous, run } = getLongestRun(history, item.beaten, memo);
      const chain = [...run, item.set.entry];
      const streak = chain.length;
      const tier = STREAK_TIERS.find(({ min }) => streak >= min);
      const message = tier
        ? tier.phrases[(offset + position) % tier.phrases.length](streak)
        : PROGRESSION_PHRASES[(offset + position) % PROGRESSION_PHRASES.length];
      result[indexBySet.get(item.set)] = {
        message,
        previousSet: previous.entry,
        previousDate: previous.entry.date,
        streak,
        chain,
      };
    });
  return result;
}
