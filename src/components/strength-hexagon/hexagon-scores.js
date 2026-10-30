// Turns an athlete's numbers into the strength shape's percentiles with the
// same engine as How Strong Am I, so the two pages always agree. Each big four
// lift is placed on the Kilgore standards for the athlete's age, sex and
// bodyweight, and that position becomes a percentile for the chosen
// comparison group. Pull-ups go through the same position scale using the
// provisional rep thresholds below.

import { getStrengthRatingForE1RM } from "@/lib/lifting-standards-kg";
import { getUniversePercentile } from "@/lib/strength-circles/strength-percentile-models";
import {
  getInterpolatedStandard,
  getKilgorePosition,
} from "@/lib/strength-circles/strength-score";
import { HEXAGON_AXES } from "@/components/strength-hexagon/hexagon-model";

const STANDARD_KEY_BY_AXIS = {
  squat: "squat",
  bench: "bench",
  deadlift: "deadlift",
  press: "strictPress",
};

// PROVISIONAL. There are no sourced pull-up norms in the app yet. These strict
// pull-up rep counts are a placeholder shaped like the Kilgore levels, so the
// axis can be drawn while the norms are researched (the USMC fitness test
// tables are the leading candidate). Replace before this leaves the lab.
const PROVISIONAL_PULLUP_REPS = {
  male: {
    physicallyActive: 1,
    beginner: 4,
    intermediate: 9,
    advanced: 15,
    elite: 22,
  },
  female: {
    physicallyActive: 0.5,
    beginner: 2,
    intermediate: 5,
    advanced: 9,
    elite: 14,
  },
};

// Also provisional: thresholds ease off about 1% a year after 30.
function provisionalPullupStandard(age, sex) {
  const factor =
    age < 20 ? 0.95 : age <= 30 ? 1 : Math.max(0.4, 1 - (age - 30) * 0.011);
  const base = PROVISIONAL_PULLUP_REPS[sex];
  return Object.fromEntries(
    Object.entries(base).map(([level, reps]) => [level, reps * factor]),
  );
}

/**
 * @param {Object} input
 * @param {number} input.age
 * @param {"male"|"female"} input.sex
 * @param {number} input.bodyWeightKg
 * @param {{ squat?: number, bench?: number, deadlift?: number, press?: number }} input.liftKgs
 *   One-rep maxes in kg; 0 or missing means untested.
 * @param {number} input.pullupReps - Best strict set; 0 means untested.
 * @param {string} input.universe - A How Strong Am I universe.
 * @returns {Array<{ percentile: number|null, rating: string|null }>} In HEXAGON_AXES order.
 */
export function computeHexagonScores({
  age,
  sex,
  bodyWeightKg,
  liftKgs,
  pullupReps,
  universe,
}) {
  const gender = sex === "female" ? "female" : "male";
  return HEXAGON_AXES.map((axis) => {
    const isPullups = axis.key === "pullups";
    const amount = isPullups ? pullupReps : liftKgs[axis.key];
    if (!amount || amount <= 0) return { percentile: null, rating: null };

    const standard = isPullups
      ? provisionalPullupStandard(age, gender)
      : getInterpolatedStandard(
          age,
          bodyWeightKg,
          gender,
          STANDARD_KEY_BY_AXIS[axis.key],
        );
    if (!standard) return { percentile: null, rating: null };

    const position = getKilgorePosition(amount, standard);
    return {
      percentile: getUniversePercentile({ universe, position }),
      rating: getStrengthRatingForE1RM(amount, standard),
    };
  });
}
