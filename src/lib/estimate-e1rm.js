/**
 * Shared one-rep-max estimate helpers.
 *
 * Most lifts use the logged weight as the full load. Bodyweight-loaded movements
 * use logged weight as external load, so current bodyweight is added for formula
 * math and subtracted again before displaying external-load projections.
 */
import {
  isBodyweightLoadLiftName,
  STANDARD_BODYWEIGHT_LOAD_LIFT_TYPES,
} from "@/lib/data-sources/parser-utilities";

// FIXME: add more formulae from the Wikipedia article?
export const e1rmFormulae = [
  "Brzycki",
  "Epley",
  "McGlothin",
  "Lombardi",
  "Mayhew",
  "OConner",
  "Wathan",
];

export const BODYWEIGHT_LOAD_LIFT_TYPES = STANDARD_BODYWEIGHT_LOAD_LIFT_TYPES;

const LB_PER_KG = 2.2046;

function normalizeUnitType(unitType) {
  return unitType === "kg" ? "kg" : "lb";
}

function convertWeightUnit(weight, fromUnitType, toUnitType) {
  const numericWeight = Number(weight);
  if (!Number.isFinite(numericWeight)) return null;

  const from = normalizeUnitType(fromUnitType);
  const to = normalizeUnitType(toUnitType);
  if (from === to) return numericWeight;
  return from === "kg" ? numericWeight * LB_PER_KG : numericWeight / LB_PER_KG;
}

export function isBodyweightLoadLift(liftType) {
  return isBodyweightLoadLiftName(liftType);
}

export function getBodyWeightForLiftUnit({
  bodyWeight,
  bodyWeightUnitType = "lb",
  liftUnitType = "lb",
}) {
  if (!bodyWeight) return null;
  return convertWeightUnit(bodyWeight, bodyWeightUnitType, liftUnitType);
}

export function estimateLiftE1RM({
  reps,
  weight,
  equation,
  liftType,
  bodyWeight,
  bodyWeightUnitType = "lb",
  liftUnitType = "lb",
}) {
  const numericWeight = Number(weight);
  if (!Number.isFinite(numericWeight)) return 0;

  if (!isBodyweightLoadLift(liftType)) {
    return estimateE1RM(reps, numericWeight, equation);
  }

  const bodyWeightForLift = getBodyWeightForLiftUnit({
    bodyWeight,
    bodyWeightUnitType,
    liftUnitType,
  });

  if (!bodyWeightForLift || bodyWeightForLift <= 0) {
    return estimateE1RM(reps, numericWeight, equation);
  }

  return Math.round(
    estimateE1RM(reps, numericWeight + bodyWeightForLift, equation) -
      bodyWeightForLift,
  );
}

export function estimateLiftWeightForReps({
  e1rm,
  reps,
  equation,
  liftType,
  bodyWeight,
  bodyWeightUnitType = "lb",
  liftUnitType = "lb",
}) {
  const numericE1RM = Number(e1rm);
  if (!Number.isFinite(numericE1RM)) return 0;

  if (!isBodyweightLoadLift(liftType)) {
    return estimateWeightForReps(numericE1RM, reps, equation);
  }

  const bodyWeightForLift = getBodyWeightForLiftUnit({
    bodyWeight,
    bodyWeightUnitType,
    liftUnitType,
  });

  if (!bodyWeightForLift || bodyWeightForLift <= 0) {
    return estimateWeightForReps(numericE1RM, reps, equation);
  }

  return Math.round(
    estimateWeightForReps(numericE1RM + bodyWeightForLift, reps, equation) -
      bodyWeightForLift,
  );
}

// Return a rounded 1 rep max
// For theory see: https://en.wikipedia.org/wiki/One-repetition_maximum
export function estimateE1RM(reps, weight, equation) {
  if (reps === 0) return 0; // A failure predicts nothing. :(
  if (reps === 1) return weight; // Heavy single requires no estimate!

  // Cap the repetitions at 20 for calculating estimated 1RM
  reps = Math.min(reps, 20);

  switch (equation) {
    case "Epley":
      return Math.round(weight * (1 + reps / 30));
    case "McGlothin":
      return Math.round((100 * weight) / (101.3 - 2.67123 * reps));
    case "Lombardi":
      return Math.round(weight * Math.pow(reps, 0.1));
    case "Mayhew":
      return Math.round(
        (100 * weight) / (52.2 + 41.9 * Math.pow(Math.E, -0.055 * reps)),
      );
    case "OConner":
      return Math.round(weight * (1 + reps / 40));
    case "Wathen":
      return Math.round(
        (100 * weight) / (48.8 + 53.8 * Math.pow(Math.E, -0.075 * reps)),
      );
    case "Brzycki":
      return Math.round(weight / (1.0278 - 0.0278 * reps));
    default: // Repeat Brzycki formula as a default here
      return Math.round(weight / (1.0278 - 0.0278 * reps));
  }
}

// Reverse e1RM to estimate weight for a given rep count based on a known 1RM
export function estimateWeightForReps(e1rm, reps, equation) {
  if (reps === 0) return 0; // No reps, no weight
  if (reps === 1) return e1rm; // 1RM is the e1rm itself
  reps = Math.min(reps, 20); // Cap at 20, consistent with estimateE1RM

  switch (equation) {
    case "Epley":
      return Math.round(e1rm / (1 + reps / 30));
    case "McGlothin":
      return Math.round((e1rm * (101.3 - 2.67123 * reps)) / 100);
    case "Lombardi":
      return Math.round(e1rm / Math.pow(reps, 0.1));
    case "Mayhew":
      return Math.round(
        (e1rm * (52.2 + 41.9 * Math.pow(Math.E, -0.055 * reps))) / 100,
      );
    case "OConner":
      return Math.round(e1rm / (1 + reps / 40));
    case "Wathen":
      return Math.round(
        (e1rm * (48.8 + 53.8 * Math.pow(Math.E, -0.075 * reps))) / 100,
      );
    case "Brzycki":
      return Math.round(e1rm * (1.0278 - 0.0278 * reps));
    default: // Default to Brzycki
      return Math.round(e1rm * (1.0278 - 0.0278 * reps));
  }
}
