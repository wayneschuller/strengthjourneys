/**
 * A first guess at an athlete's sex and bodyweight from what they lift, for
 * the import preview. A lifter who has just handed over a file has usually
 * never told us about themselves, and the alternative is ranking everyone as
 * the same 200lb man.
 *
 * It is a guess and is treated as one: the preview shows it as a sentence the
 * athlete can correct, and nothing is saved until they touch it or confirm
 * it. Two cautions shape the rules:
 *
 * - Sex is only ever guessed as female on strong evidence. Lifting numbers
 *   overlap heavily between a newer man and a trained woman, and "male" is
 *   already the default, so a doubtful case returns null and leaves it alone.
 * - Bodyweight is pulled most of the way back towards an ordinary lifter's.
 *   Strength says far more about training age than about size, and since the
 *   ranking divides by bodyweight, a guess that tracked strength closely
 *   would rank every lifter as average.
 *
 * Pure, so it can run against a real exported log in Node.
 */

import { findBestE1RM } from "@/lib/processing-utils";
import { LB_PER_KG, toKg } from "@/lib/weight-units";

// Roughly what a lifter a few years in manages, as multiples of bodyweight.
const TYPICAL_RATIOS = {
  male: { "Back Squat": 1.5, "Bench Press": 1.1, Deadlift: 1.8 },
  female: { "Back Squat": 1.1, "Bench Press": 0.65, Deadlift: 1.4 },
};

// An ordinary lifter's bodyweight in kg, and the range a guess may land in.
const BODYWEIGHT_KG = {
  male: { typical: 84, min: 62, max: 115 },
  female: { typical: 66, min: 48, max: 90 },
};

// How far a guess moves from the typical bodyweight towards what the lifts
// alone would suggest.
const STRENGTH_PULL = 0.4;

// A woman's bench sits lower against her squat and deadlift than a man's
// does. All of these must hold, on a history long enough to trust.
const FEMALE_SIGNAL = {
  minSessions: 60,
  maxBenchKg: 50,
  maxBenchToSquat: 0.55,
  maxBenchToDeadlift: 0.42,
};

/**
 * @param {Object} args
 * @param {Object} args.topLiftsByTypeAndReps - From useUserLiftingData().
 * @param {number} args.sessionCount - Training days in the history.
 * @param {string} [args.e1rmFormula]
 * @returns {{sex: "male"|"female"|null, bodyWeightKg: number|null}}
 *   sex is null when the lifts do not settle it; bodyWeightKg is null when
 *   there is no squat, bench or deadlift to go on.
 */
export function guessAthleteBio({
  topLiftsByTypeAndReps,
  sessionCount,
  e1rmFormula,
}) {
  if (!topLiftsByTypeAndReps) return { sex: null, bodyWeightKg: null };

  const bestKg = {};
  for (const liftType of Object.keys(TYPICAL_RATIOS.male)) {
    const best = findBestE1RM(liftType, topLiftsByTypeAndReps, e1rmFormula);
    if (best.bestE1RMWeight > 0) {
      bestKg[liftType] = toKg(best.bestE1RMWeight, best.unitType);
    }
  }

  const sex = guessSex(bestKg, sessionCount);
  return { sex, bodyWeightKg: guessBodyWeightKg(bestKg, sex ?? "male") };
}

/**
 * A guessed bodyweight in the athlete's unit, rounded to a number a person
 * would say: the nearest 5.
 */
export function roundGuessedBodyWeight(bodyWeightKg, isMetric) {
  const value = isMetric ? bodyWeightKg : bodyWeightKg * LB_PER_KG;
  return Math.round(value / 5) * 5;
}

function guessSex(bestKg, sessionCount) {
  const bench = bestKg["Bench Press"];
  const squat = bestKg["Back Squat"];
  const deadlift = bestKg["Deadlift"];
  if (!bench || !squat || !deadlift) return null;
  if (!(sessionCount >= FEMALE_SIGNAL.minSessions)) return null;
  const looksFemale =
    bench <= FEMALE_SIGNAL.maxBenchKg &&
    bench / squat <= FEMALE_SIGNAL.maxBenchToSquat &&
    bench / deadlift <= FEMALE_SIGNAL.maxBenchToDeadlift;
  return looksFemale ? "female" : null;
}

function guessBodyWeightKg(bestKg, sex) {
  const ratios = TYPICAL_RATIOS[sex];
  const estimates = Object.entries(bestKg).map(
    ([liftType, kg]) => kg / ratios[liftType],
  );
  if (estimates.length === 0) return null;

  const fromLifts = estimates.reduce((a, b) => a + b, 0) / estimates.length;
  const { typical, min, max } = BODYWEIGHT_KG[sex];
  const guess = typical + STRENGTH_PULL * (fromLifts - typical);
  return Math.min(max, Math.max(min, guess));
}
