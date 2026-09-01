/**
 * What each of the big four barbell lifts gives the body, in two short lines.
 *
 * This is invitation copy, not analysis: it is shown when a lifter has no
 * sessions to compare in a window, where the honest options are an empty
 * space or a reason to pick the bar back up. Written so it reads as a
 * reminder of what the lifts are for rather than a comment on time away,
 * which means no counting of missed weeks and no nudge that leans on regret.
 *
 * The taglines echo the hub descriptions in big-four-insight-data.js so the
 * dashboard and the lift guides describe the same four lifts the same way.
 */
export const BIG_FOUR_BODY_BENEFITS = {
  "Back Squat": {
    tagline: "The king of lower-body strength.",
    benefit:
      "Legs, hips and back under one bar. Nothing else asks so much of the whole body at once, which is why it drives bone density, balance and the engine every other lift runs on.",
  },
  "Bench Press": {
    tagline: "The lift everyone asks about first.",
    benefit:
      "Chest, shoulders and triceps pressing as one unit. The most recognised strength test in the world, and the shortest path to upper body pushing power you can feel outside the gym.",
  },
  Deadlift: {
    tagline: "The heaviest bar you will ever move.",
    benefit:
      "Grip, back and hips learning to pick up something heavy and put it down well. That is the most useful thing strength does, and this is the lift that teaches it.",
  },
  "Strict Press": {
    tagline: "The slowest to climb and the most rewarding.",
    benefit:
      "Shoulders and midline holding a bar overhead with nothing but honest strength. It moves the least weight and buys the most: shoulder health, a solid trunk, and real overhead capability.",
  },
};

export function getBigFourBodyBenefit(liftType) {
  return BIG_FOUR_BODY_BENEFITS[liftType] ?? null;
}
