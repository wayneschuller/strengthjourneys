export const UNIVERSES = [
  "General Population",
  "Gym-Goers",
  "Barbell Lifters",
  "Powerlifting Culture",
];

// Approximate universe calibrations. These remain modeled, but are intentionally
// more conservative as the comparison group becomes more specialised.
//
// anchors = percentile at the Kilgore thresholds:
// [physicallyActive, beginner, intermediate, advanced, elite]
// curveExponent > 1 makes the percentile climb more slowly through the band,
// which makes specialised universes feel tougher without changing the thresholds.
export const MODELED_UNIVERSE_PROFILES = {
  "General Population": {
    anchors: [18, 48, 74, 92, 99],
    curveExponent: 0.95,
  },
  "Gym-Goers": {
    anchors: [9, 30, 58, 82, 96],
    curveExponent: 1.05,
  },
  "Barbell Lifters": {
    anchors: [4, 16, 42, 72, 92],
    curveExponent: 1.15,
  },
  "Powerlifting Culture": {
    anchors: [1, 6, 24, 56, 86],
    curveExponent: 1.25,
  },
};

// Placeholder for v2.1 empirical norms. Keep null until a sourced percentile
// dataset is added so the model layer can fall back to the current calibrated
// mapping without changing the page contract.
export const POWERLIFTING_PERCENTILE_TABLES_V1 = null;
