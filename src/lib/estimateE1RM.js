/** @format */

// Return a rounded 1 rep max
// For theory see: https://en.wikipedia.org/wiki/One-repetition_maximum
export function estimateE1RM(reps, weight, equation) {
  if (reps === 1) return weight; // Heavy single requires no estimate!

  switch (equation) {
    case "Epley":
      return Math.round(weight * (1 + reps / 30));
    case "McGlothin":
      return Math.round((100 * weight) / (101.3 - 2.67123 * reps));
    case "Lombardi":
      return Math.round(weight * Math.pow(reps, 0.1));
    case "Mayhew":
      return Math.round((100 * weight) / (52.2 + 41.9 * Math.pow(Math.E, -0.055 * reps)));
    case "OConner":
      return Math.round(weight * (1 + reps / 40));
    case "Wathen":
      return Math.round((100 * weight) / (48.8 + 53.8 * Math.pow(Math.E, -0.075 * reps)));
    case "Brzycki":
      return Math.round(weight / (1.0278 - 0.0278 * reps));
    default: // Repeat Brzycki formula as a default here
      return Math.round(weight / (1.0278 - 0.0278 * reps));
  }
}

export const e1rmFormulae = ["Epley", "McGlothin", "Lombardi", "Mayhew", "OConner", "Wathan", "Brzycki"];
