import {
  LiftingStandardsKG,
  interpolateStandardKG,
} from "@/lib/lifting-standards-kg";

export const KILGORE_LEVELS = [
  "physicallyActive",
  "beginner",
  "intermediate",
  "advanced",
  "elite",
];

export const STRENGTH_CIRCLES_LIFT_TYPES = {
  squat: "Back Squat",
  bench: "Bench Press",
  deadlift: "Deadlift",
  strictPress: "Strict Press",
};

// Reverse map: liftType → percentile key (e.g. "Back Squat" → "squat").
export const LIFT_TYPE_TO_PERCENTILE_KEY = Object.fromEntries(
  Object.entries(STRENGTH_CIRCLES_LIFT_TYPES).map(([key, name]) => [name, key]),
);

// Maps lift types to their dedicated calculator page URLs.
export const LIFT_TYPE_TO_CALCULATOR_URL = {
  "Back Squat": "/calculator/squat-1rm-calculator",
  "Bench Press": "/calculator/bench-press-1rm-calculator",
  "Deadlift": "/calculator/deadlift-1rm-calculator",
  "Strict Press": "/calculator/strict-press-1rm-calculator",
};

// Sensible default E1RM values (in kg) for anonymous/demo renders.
// Based on calculator defaults (5@225lb ≈ 253lb E1RM) scaled per lift.
export const DEFAULT_E1RM_KG = {
  "Back Squat": 115, // ~253lb
  "Bench Press": 90, // ~198lb
  "Deadlift": 135, // ~298lb
  "Strict Press": 60, // ~132lb
};

export function getInterpolatedStandard(age, bodyWeightKg, sex, liftKey) {
  const liftType = STRENGTH_CIRCLES_LIFT_TYPES[liftKey];
  if (!liftType) return null;

  return interpolateStandardKG(
    age,
    bodyWeightKg,
    sex,
    liftType,
    LiftingStandardsKG,
  );
}

export function getKilgorePosition(lift1RmKg, standard) {
  const thresholds = KILGORE_LEVELS.map((level) => standard[level]);

  if (lift1RmKg <= thresholds[0]) {
    if (thresholds[0] === 0) return 0;
    return lift1RmKg / thresholds[0] - 1;
  }

  for (let i = 0; i < thresholds.length - 1; i++) {
    if (lift1RmKg <= thresholds[i + 1]) {
      const t =
        (lift1RmKg - thresholds[i]) / (thresholds[i + 1] - thresholds[i]);
      return i + t;
    }
  }

  const gap = thresholds[4] - thresholds[3];
  if (gap <= 0) return 4;
  return 4 + (lift1RmKg - thresholds[4]) / gap;
}

export function averagePercentiles(percentilesByLift, universe) {
  const values = percentilesByLift
    .map((lift) => lift?.percentiles?.[universe])
    .filter((value) => value != null);

  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function sumStandards(standards) {
  if (!standards?.length) return null;

  return KILGORE_LEVELS.reduce((acc, level) => {
    acc[level] = standards.reduce((sum, standard) => sum + (standard?.[level] ?? 0), 0);
    return acc;
  }, {});
}
