/**
 * Strength Circles — Universe Percentile Model
 *
 * Computes strength percentiles across four nested "universes":
 *   General Population → Gym-Goers → Barbell Lifters → Powerlifting Culture
 *
 * Strategy: Kilgore-anchored interpolation.
 *   The Kilgore standards (physicallyActive → elite) are used as percentile
 *   reference points within each universe. We interpolate the user's lift
 *   onto the Kilgore scale (producing a fractional "Kilgore position"), then
 *   map that position to a percentile via each universe's anchor table.
 *
 * This means no separate lookup tables per universe — the Kilgore data we
 * already have handles age, sex, and bodyweight automatically.
 *
 * TABLE VERSION: 1.0.0
 * TODO: Refine anchor percentile values using published distribution data
 *       (e.g., NHANES, OpenPowerlifting, NSCA population studies).
 */

import {
  LiftingStandardsKG,
  interpolateStandardKG,
} from "@/lib/lifting-standards-kg";

// ─── Universe definitions ────────────────────────────────────────────────────

export const UNIVERSES = [
  "General Population",
  "Gym-Goers",
  "Barbell Lifters",
  "Powerlifting Culture",
];

/**
 * For each universe, what percentile does each Kilgore level represent?
 *
 * Reading: "In the General Population, someone at the Kilgore 'beginner'
 * threshold beats about 60% of that population."
 *
 * Ordered: [physicallyActive, beginner, intermediate, advanced, elite]
 *
 * TABLE VERSION: 1.0.0
 * TODO: Replace with empirically derived values.
 */
export const UNIVERSE_ANCHORS = {
  "General Population": [20, 58, 80, 93, 99],
  "Gym-Goers":          [10, 38, 66, 85, 97],
  "Barbell Lifters":    [ 5, 20, 50, 76, 93],
  "Powerlifting Culture": [2, 12, 35, 65, 88],
};

// Kilgore level names, in ascending order (mirrors the anchor arrays above)
const KILGORE_LEVELS = [
  "physicallyActive",
  "beginner",
  "intermediate",
  "advanced",
  "elite",
];

// Lift type names as used by the Kilgore dataset
export const STRENGTH_CIRCLES_LIFT_TYPES = {
  squat: "Back Squat",
  bench: "Bench Press",
  deadlift: "Deadlift",
};

// ─── Core math ───────────────────────────────────────────────────────────────

/**
 * Given a user's lift in kg and a Kilgore standard object, compute a
 * fractional "Kilgore position":
 *   0   = at the physicallyActive threshold
 *   1   = at beginner
 *   2   = at intermediate
 *   3   = at advanced
 *   4   = at elite
 *   <0  = below physicallyActive (extrapolated)
 *   >4  = above elite (extrapolated)
 *
 * @param {number} lift1RmKg
 * @param {{ physicallyActive, beginner, intermediate, advanced, elite }} standard
 * @returns {number}
 */
function getKilgorePosition(lift1RmKg, standard) {
  const thresholds = KILGORE_LEVELS.map((level) => standard[level]);

  // Below the lowest threshold
  if (lift1RmKg <= thresholds[0]) {
    if (thresholds[0] === 0) return 0;
    // Linear extrapolation: lift=0 → position=-1, lift=threshold[0] → position=0
    return lift1RmKg / thresholds[0] - 1;
  }

  // Between two thresholds
  for (let i = 0; i < thresholds.length - 1; i++) {
    if (lift1RmKg <= thresholds[i + 1]) {
      const t =
        (lift1RmKg - thresholds[i]) / (thresholds[i + 1] - thresholds[i]);
      return i + t;
    }
  }

  // Above elite: extrapolate using the gap between advanced and elite
  const gap = thresholds[4] - thresholds[3];
  if (gap <= 0) return 4;
  return 4 + (lift1RmKg - thresholds[4]) / gap;
}

/**
 * Map a Kilgore position (fractional) to a percentile within a specific universe.
 *
 * @param {number} position - fractional Kilgore position (see getKilgorePosition)
 * @param {number[]} anchors - the 5-element anchor array for this universe
 * @returns {number} percentile 0–99.9
 */
function kilgorePositionToPercentile(position, anchors) {
  // Below physicallyActive: linearly extrapolate down to 0
  if (position <= 0) {
    // At position=0: anchors[0]; at position=-1: 0
    return Math.max(0, anchors[0] + position * anchors[0]);
  }

  // Above elite: linearly extrapolate, cap at 99.9
  if (position >= 4) {
    const extrapolated =
      anchors[4] + (position - 4) * (99.9 - anchors[4]);
    return Math.min(99.9, extrapolated);
  }

  // Between two anchor points: linear interpolation
  const lo = Math.floor(position);
  const hi = Math.ceil(position);
  if (lo === hi) return anchors[lo];
  const t = position - lo;
  return anchors[lo] + t * (anchors[hi] - anchors[lo]);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Compute percentiles for a single lift across all four universes.
 *
 * @param {number} age
 * @param {number} bodyWeightKg
 * @param {"male"|"female"} sex  (matches Kilgore dataset gender field)
 * @param {"squat"|"bench"|"deadlift"} liftKey
 * @param {number} lift1RmKg
 * @returns {{ [universe: string]: number } | null}  null if Kilgore data unavailable
 */
export function getLiftPercentiles(age, bodyWeightKg, sex, liftKey, lift1RmKg) {
  const liftType = STRENGTH_CIRCLES_LIFT_TYPES[liftKey];
  if (!liftType) return null;

  const standard = interpolateStandardKG(
    age,
    bodyWeightKg,
    sex,
    liftType,
    LiftingStandardsKG,
  );
  if (!standard) return null;

  const position = getKilgorePosition(lift1RmKg, standard);

  const result = {};
  for (const universe of UNIVERSES) {
    const anchors = UNIVERSE_ANCHORS[universe];
    result[universe] = Math.round(kilgorePositionToPercentile(position, anchors));
  }
  return result;
}

/**
 * Compute the full results object used by the page.
 *
 * @param {{ age: number, sex: string, bodyWeightKg: number }} bio
 * @param {{ squat: number|null, bench: number|null, deadlift: number|null }} liftKgs
 *   Pass null for any lift not yet entered.
 * @returns {StrengthResults}
 */
export function computeStrengthResults(bio, liftKgs) {
  const { age, sex, bodyWeightKg } = bio;
  // Kilgore uses "male"/"female" — sex from bio provider already matches
  const gender = sex === "female" ? "female" : "male";

  const lifts = {};
  const enteredKeys = [];

  for (const key of ["squat", "bench", "deadlift"]) {
    const kg = liftKgs[key];
    if (kg == null || isNaN(kg) || kg <= 0) {
      lifts[key] = null;
      continue;
    }

    const percentiles = getLiftPercentiles(age, bodyWeightKg, gender, key, kg);
    const liftType = STRENGTH_CIRCLES_LIFT_TYPES[key];
    const standard = interpolateStandardKG(
      age,
      bodyWeightKg,
      gender,
      liftType,
      LiftingStandardsKG,
    );

    lifts[key] = {
      e1rmKg: kg,
      percentiles,
      standard, // { physicallyActive, beginner, intermediate, advanced, elite } in kg
    };
    enteredKeys.push(key);
  }

  // Total: only if all three lifts are present
  let total = null;
  if (enteredKeys.length === 3) {
    const totalKg =
      liftKgs.squat + liftKgs.bench + liftKgs.deadlift;

    // Total percentile = simple average of per-lift percentiles per universe
    const totalPercentiles = {};
    for (const universe of UNIVERSES) {
      const avg =
        (lifts.squat.percentiles[universe] +
          lifts.bench.percentiles[universe] +
          lifts.deadlift.percentiles[universe]) /
        3;
      totalPercentiles[universe] = Math.round(avg);
    }

    total = {
      kg: totalKg,
      percentiles: totalPercentiles,
    };
  }

  return {
    lifts,          // { squat, bench, deadlift } — each null or { e1rmKg, percentiles, standard }
    total,          // null if fewer than 3 lifts, else { kg, percentiles }
    enteredCount: enteredKeys.length,
    hasAllThree: enteredKeys.length === 3,
  };
}
