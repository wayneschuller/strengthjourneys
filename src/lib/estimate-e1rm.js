/** @format */

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
