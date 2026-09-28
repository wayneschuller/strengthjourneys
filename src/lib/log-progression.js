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

// A session whose best effort sits this far under the recent best was a light
// day. The streak steps over it rather than ending, so heavy/light programs
// can build a streak at all.
const LIGHT_DAY_SHARE = 0.9;

// A progressing set has to be real work for this lift right now, at least
// this share of the recent best effort. Without it, once heavy days move to
// triples, the light day's fives keep "beating" the last light day's fives.
// A back-off five after heavy singles sits well above it.
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

// Epley, only to tell a light day from a heavy one across rep counts.
function effort({ reps, kg }) {
  return kg * (1 + reps / 30);
}

function toComparableSet(entry) {
  const reps = entry?.reps ?? 0;
  const weight = entry?.weight ?? 0;
  if (entry?._pending || reps <= 0 || weight <= 0) return null;
  return { reps, kg: toKg(weight, entry.unitType), entry };
}

function markWorkingSets(sets) {
  const topKg = Math.max(0, ...sets.map((set) => set.kg));
  return sets.map((set) => ({
    ...set,
    working: set.kg >= topKg * WORKING_SET_SHARE && set.reps <= MAX_REPS,
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

  return [...byDate.keys()].sort().map((date) => {
    const sets = markWorkingSets(byDate.get(date));
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
 * The recent working set this one moved past, or null when it did not. A set
 * progresses when nothing recent matched it on both reps and weight, and some
 * recent working set it is directly comparable to sits under it: the same
 * reps at less weight, or fewer reps (within MAX_REP_STEP) at no more weight.
 */
function findBeatenSet(set, lookback) {
  let beaten = null;
  for (const session of lookback) {
    for (const prior of session.sets) {
      if (prior.reps >= set.reps && prior.kg >= set.kg - EPSILON_KG) {
        return null;
      }
      if (!prior.working) continue;
      if (prior.reps > set.reps || prior.reps < set.reps - MAX_REP_STEP) {
        continue;
      }
      if (prior.kg > set.kg + EPSILON_KG) continue;
      // The closest comparison wins: most reps, then most weight, then the
      // most recent session (lookback runs newest first).
      if (
        !beaten ||
        prior.reps > beaten.reps ||
        (prior.reps === beaten.reps && prior.kg > beaten.kg + EPSILON_KG)
      ) {
        beaten = prior;
      }
    }
  }
  return beaten;
}

// The sets in a session that progressed. Each rep count speaks through its
// heaviest working set, so a 5@125 on the way to 5@127.5 stays quiet. Rep
// counts are judged apart: a heavy triple does not silence a new best five.
function getSessionProgress(sets, lookback) {
  const recentBest = getRecentBestEffort(lookback);
  const bestByReps = new Map();
  for (const set of sets) {
    if (!set.working) continue;
    if (effort(set) < recentBest * SERIOUS_EFFORT_SHARE) continue;
    const current = bestByReps.get(set.reps);
    if (!current || set.kg > current.kg) bestByReps.set(set.reps, set);
  }
  const results = [];
  for (const set of bestByReps.values()) {
    const beaten = findBeatenSet(set, lookback);
    if (beaten) results.push({ set, beaten });
  }
  return results;
}

function getRecentBestEffort(lookback) {
  return Math.max(0, ...lookback.map((session) => session.topEffort));
}

function isLightDay(topEffort, lookback) {
  const recentBest = getRecentBestEffort(lookback);
  return recentBest > 0 && topEffort < recentBest * LIGHT_DAY_SHARE;
}

function strongest(progress) {
  return progress.reduce((best, item) =>
    effort(item.set) > effort(best.set) ? item : best,
  );
}

// Walks back from the session before today, counting sessions that progressed.
// Light days are stepped over; a real attempt that held, a gap past
// MAX_GAP_DAYS, or the start of the log ends the walk.
function getPriorStreak(history) {
  const chain = [];
  for (
    let i = history.length - 1;
    i >= 0 && history.length - i <= MAX_STREAK_WALK;
    i -= 1
  ) {
    const session = history[i];
    const lookback = getLookback(history, i, session.date);
    if (lookback.length === 0) break;
    const progress = getSessionProgress(session.sets, lookback);
    if (progress.length > 0) {
      chain.unshift(strongest(progress).set.entry);
      continue;
    }
    if (isLightDay(session.topEffort, lookback)) continue;
    break;
  }
  return chain;
}

/**
 * One entry per set, aligned with `sets`, for the sets that progressed:
 * { message, previousSet, previousDate, streak, chain }. The strongest
 * progressing set carries the streak; any others get a plain phrase.
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
  if (progress.length === 0) return result;

  const lead = strongest(progress);
  const priorChain = getPriorStreak(history);
  const streak = priorChain.length + 1;
  const offset = hashPhraseSeed(`${sessionDate}:${liftType}`);
  const tier = STREAK_TIERS.find(({ min }) => streak >= min);

  progress
    .slice()
    .sort((a, b) => indexBySet.get(a.set) - indexBySet.get(b.set))
    .forEach((item, position) => {
      const isLead = item === lead;
      const message =
        isLead && tier
          ? tier.phrases[offset % tier.phrases.length](streak)
          : PROGRESSION_PHRASES[
              (offset + position) % PROGRESSION_PHRASES.length
            ];
      result[indexBySet.get(item.set)] = {
        message,
        previousSet: item.beaten.entry,
        previousDate: item.beaten.entry.date,
        streak: isLead ? streak : 1,
        chain: isLead ? [...priorChain, item.set.entry] : [item.set.entry],
      };
    });
  return result;
}
