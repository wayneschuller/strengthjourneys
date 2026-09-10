/**
 * Canonical lightweight metadata for the four core barbell lifts.
 * Keep SEO-heavy progress-guide copy in big-four-insight-data.js; this file is
 * safe to import from log, parsers, API routes, and shared data processors.
 * Artwork deliberately lives elsewhere: ask getLiftArtwork in lib/lift-artwork
 * for a lift's illustration rather than carrying a derived path in here.
 */

export const BIG_FOUR_LIFT_META = [
  {
    liftType: "Back Squat",
    slug: "squat",
    progressGuidePath: "/progress-guide/squat",
    homepageDescription:
      "A barbell squat to full depth, resting across the upper back.",
  },
  {
    liftType: "Bench Press",
    slug: "bench-press",
    progressGuidePath: "/progress-guide/bench-press",
    homepageDescription:
      "A horizontal press from the chest while lying on a bench.",
  },
  {
    liftType: "Deadlift",
    slug: "deadlift",
    progressGuidePath: "/progress-guide/deadlift",
    homepageDescription:
      "Lifting a barbell from the floor to a standing lockout.",
  },
  {
    liftType: "Strict Press",
    slug: "strict-press",
    progressGuidePath: "/progress-guide/strict-press",
    homepageDescription: "A standing overhead press with no leg drive.",
  },
];

export const BIG_FOUR_LIFT_TYPES = BIG_FOUR_LIFT_META.map(
  ({ liftType }) => liftType,
);

export const BIG_FOUR_LIFT_TYPE_SET = new Set(BIG_FOUR_LIFT_TYPES);

export const BIG_FOUR_PROGRESS_GUIDE_PATHS = Object.fromEntries(
  BIG_FOUR_LIFT_META.map(({ liftType, progressGuidePath }) => [
    liftType,
    progressGuidePath,
  ]),
);

export function getBigFourProgressGuidePath(liftType) {
  return BIG_FOUR_PROGRESS_GUIDE_PATHS[liftType] ?? null;
}
