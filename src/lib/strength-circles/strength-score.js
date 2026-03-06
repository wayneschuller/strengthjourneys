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
