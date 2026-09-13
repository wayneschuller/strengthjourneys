/**
 * The lift registry: everything we have curated about a lift, one JSON file
 * per lift in src/lib/lifts/. Nothing about a curated lift should live
 * anywhere else. Pages, the nav, the log and the importers all read it here.
 *
 * WHAT A LIFT FILE HOLDS (every block is optional except the first two)
 *  - liftType, slug        Canonical name, and its /progress-guide/ URL slug.
 *  - bigFour               The four lifts with strength standards.
 *  - shortName, icon       Compact label for tight navs, and the lucide icon
 *                          name (see components/lift-icon.js).
 *  - synonyms              Other names for the SAME lift, never a lookalike.
 *                          Front Squat pointed at Back Squat's drawing for
 *                          seven months, showing a bar on the upper back for
 *                          a lift racked at the front.
 *  - homepageDescription   One-liner for someone who has never seen the lift.
 *  - bodyBenefit           Big four only: what the lift gives the body, in the
 *                          invitation voice the dashboard uses when a lifter
 *                          has nothing to compare. Never a count of time away.
 *  - calculatorUrl         Its 1RM calculator page, when one exists.
 *  - artwork               The drawing and the figure's sex. Drawing rules
 *                          live in components/lift-artwork.js.
 *  - videos                Tutorial videos, each { url, title, channel }, any
 *                          number of them. The guide shows them all; the log
 *                          shows one per session, picked by pickLiftVideo.
 *  - coaching              Plain-English summary, three cues, and standardsRef:
 *                          a rough ratio to a big four lift used for first-time
 *                          target weights on the log. Not a published standard.
 *  - guide                 Editorial progress guide copy: SEO titles, intro,
 *                          quote, resources, FAQ.
 *  - strengthLevels        Copy for /strength-levels/[slug], including the
 *                          "what counts as good" interpretation and example
 *                          table. Big four only.
 *
 * ADDING A LIFT: write its JSON file and add one import below. Having artwork
 * is the signal we believe in a lift: it gets a tile in the Lift Explorer, a
 * tile in the log's add-lift picker, and a /progress-guide/ page. The page
 * stays out of search until the lift has a guide block, because a page that
 * is only a drawing and three cues is the thin kind Google demotes.
 *
 * JSON rather than JS so the files stay pure content that scripts and
 * next-sitemap.config.js can read too. Rationale that would have been a code
 * comment goes in a field instead (a video's title, standardsRef.note).
 */

import backSquat from "@/lib/lifts/back-squat.json";
import benchPress from "@/lib/lifts/bench-press.json";
import deadlift from "@/lib/lifts/deadlift.json";
import strictPress from "@/lib/lifts/strict-press.json";
import powerSnatch from "@/lib/lifts/power-snatch.json";
import powerClean from "@/lib/lifts/power-clean.json";
import frontSquat from "@/lib/lifts/front-squat.json";
import overheadSquat from "@/lib/lifts/overhead-squat.json";
import romanianDeadlift from "@/lib/lifts/romanian-deadlift.json";
import hipThrust from "@/lib/lifts/hip-thrust.json";
import barbellRow from "@/lib/lifts/barbell-row.json";
import rackPull from "@/lib/lifts/rack-pull.json";
import closeGripBenchPress from "@/lib/lifts/close-grip-bench-press.json";
import barbellCurl from "@/lib/lifts/barbell-curl.json";

export const SITE_URL = "https://www.strengthjourneys.xyz";

/** Every curated lift: the big four first, then the rest in drawing order. */
export const CURATED_LIFTS = [
  backSquat,
  benchPress,
  deadlift,
  strictPress,
  powerSnatch,
  powerClean,
  frontSquat,
  overheadSquat,
  romanianDeadlift,
  hipThrust,
  barbellRow,
  rackPull,
  closeGripBenchPress,
  barbellCurl,
];

export const BIG_FOUR_LIFTS = CURATED_LIFTS.filter((lift) => lift.bigFour);
export const BIG_FOUR_LIFT_TYPES = BIG_FOUR_LIFTS.map((lift) => lift.liftType);
export const BIG_FOUR_LIFT_TYPE_SET = new Set(BIG_FOUR_LIFT_TYPES);

/** Every lift we have a drawing for, in registry order. */
export const DRAWN_LIFTS = CURATED_LIFTS.filter((lift) => lift.artwork);
export const DRAWN_LIFT_TYPES = DRAWN_LIFTS.map((lift) => lift.liftType);

/** Lifts with coaching notes, the set the log offers technique help for. */
export const COACHED_LIFTS = CURATED_LIFTS.filter((lift) => lift.coaching);

const BY_NAME = new Map();
const BY_SLUG = new Map();
for (const lift of CURATED_LIFTS) {
  BY_NAME.set(lift.liftType, lift);
  BY_SLUG.set(lift.slug, lift);
  for (const synonym of lift.synonyms ?? []) BY_NAME.set(synonym, lift);
}

/**
 * The curated entry for a lift name, following synonyms, or null.
 * @param {string} liftType
 */
export function getCuratedLift(liftType) {
  return (liftType && BY_NAME.get(liftType)) || null;
}

/** The curated entry for a /progress-guide/ slug, or null. */
export function getCuratedLiftBySlug(slug) {
  return (slug && BY_SLUG.get(slug)) || null;
}

/**
 * URL slug for any lift name. Curated lifts use their registry slug (Back
 * Squat is "squat"); anything else a lifter logs is slugified, which is what
 * lets /progress-guide/[lift] show a page for every lift in their data.
 */
export function getLiftSlug(liftType) {
  if (!liftType) return null;
  return getCuratedLift(liftType)?.slug ?? slugifyLiftType(liftType);
}

/** "Dumbbell Pull-Over" -> "dumbbell-pull-over". */
export function slugifyLiftType(liftType) {
  return String(liftType)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The progress guide path for any lift name, e.g. "/progress-guide/squat". */
export function getLiftGuidePath(liftType) {
  const slug = getLiftSlug(liftType);
  return slug ? `/progress-guide/${slug}` : null;
}

/**
 * One of a lift's videos for a given session, or null when it has none. The
 * choice hashes the lift and the seed (the log passes the session date), so it
 * holds still while a lifter is in a session and varies from day to day.
 *
 * @param {string} liftType
 * @param {string} [seed] - e.g. a YYYY-MM-DD session date.
 */
export function pickLiftVideo(liftType, seed = "") {
  const lift = getCuratedLift(liftType);
  const videos = lift?.videos ?? [];
  if (videos.length === 0) return null;
  // djb2, the same small string hash the log's rotating copy uses.
  let hash = 5381;
  const key = `${lift.liftType}:${seed}`;
  for (let i = 0; i < key.length; i += 1) {
    hash = ((hash << 5) + hash + key.charCodeAt(i)) | 0;
  }
  return videos[Math.abs(hash) % videos.length];
}

/**
 * Whether a curated lift's guide page should be indexed. Mirrored in
 * next-sitemap.config.js, which reads the JSON directly; keep them in step.
 */
export function isLiftGuideIndexable(lift) {
  return Boolean(lift?.guide);
}

/**
 * Big four guide paths keyed by lift name. Kept for callers that only ever
 * link the big four (classic lift memories).
 */
export const BIG_FOUR_PROGRESS_GUIDE_PATHS = Object.fromEntries(
  BIG_FOUR_LIFTS.map((lift) => [lift.liftType, `/progress-guide/${lift.slug}`]),
);

/**
 * A big four lift as an invitation: the guide's hub description as tagline, so
 * the dashboard and the guides describe each lift the same way, and what the
 * lift gives the body. Null outside the big four.
 */
export function getBigFourBodyBenefit(liftType) {
  const lift = getCuratedLift(liftType);
  if (!lift?.bigFour || !lift.bodyBenefit) return null;
  return { tagline: lift.guide?.hubDescription ?? null, benefit: lift.bodyBenefit };
}

// ── Strength levels ─────────────────────────────────────────────────────────

export const STRENGTH_STANDARDS_HUB_URL = `${SITE_URL}/strength-levels`;

// Bench leads the strength levels pages: it is the lift people ask about first.
const STRENGTH_LEVELS_ORDER = ["Bench Press", "Back Squat", "Deadlift", "Strict Press"];

/**
 * Flat page records for /strength-levels/[lift], in the shape those pages
 * have always read.
 */
export const STRENGTH_STANDARDS_PAGES = STRENGTH_LEVELS_ORDER.map(getCuratedLift)
  .filter((lift) => lift?.strengthLevels)
  .map((lift) => ({
    slug: lift.slug,
    liftType: lift.liftType,
    ...lift.strengthLevels,
    calculatorUrl: lift.calculatorUrl,
    insightUrl: `/progress-guide/${lift.slug}`,
  }));

export function getStrengthStandardsPageBySlug(slug) {
  return STRENGTH_STANDARDS_PAGES.find((page) => page.slug === slug) ?? null;
}

export function getStrengthStandardsUrl(slug) {
  return `/strength-levels/${slug}`;
}

/** The strength levels path for a lift name, or null outside the big four. */
export function getStrengthLevelsPath(liftType) {
  const lift = getCuratedLift(liftType);
  return lift?.strengthLevels ? getStrengthStandardsUrl(lift.slug) : null;
}
