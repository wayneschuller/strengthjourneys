/**
 * Strength Circles — Universe Percentile Model
 *
 * v2.1 scaffolding:
 * - score layer: Kilgore/bodyweight/age interpolation
 * - model layer: universe-specific percentile mapping
 * - data layer: modeled anchors plus future empirical datasets
 *
 * Current behaviour is intentionally preserved while the powerlifting-specific
 * empirical dataset is prepared. Once added, only the model/data layer should
 * need to change for the page to start using it.
 */

import { UNIVERSES } from "@/lib/strength-circles/strength-percentile-data";
import { getUniversePercentile } from "@/lib/strength-circles/strength-percentile-models";
import {
  getInterpolatedStandard,
  getKilgorePosition,
  sumStandards,
} from "@/lib/strength-circles/strength-score";

export { UNIVERSES };

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
  const standard = getInterpolatedStandard(age, bodyWeightKg, sex, liftKey);
  if (!standard) return null;

  const position = getKilgorePosition(lift1RmKg, standard);

  const result = {};
  for (const universe of UNIVERSES) {
    result[universe] = getUniversePercentile({
      universe,
      position,
      age,
      bodyWeightKg,
      sex,
      liftKey,
      lift1RmKg,
    });
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
    const standard = getInterpolatedStandard(age, bodyWeightKg, gender, key);

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
    const totalStandard = sumStandards([
      lifts.squat.standard,
      lifts.bench.standard,
      lifts.deadlift.standard,
    ]);
    const totalPosition = getKilgorePosition(totalKg, totalStandard);

    const totalPercentiles = {};
    for (const universe of UNIVERSES) {
      totalPercentiles[universe] = getUniversePercentile({
        universe,
        position: totalPosition,
        age,
        bodyWeightKg,
        sex: gender,
        liftKey: "total",
        lift1RmKg: totalKg,
      });
    }

    total = {
      kg: totalKg,
      standard: totalStandard,
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
