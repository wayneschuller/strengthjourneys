/**
 * The lift registry: everything we have curated about a lift, one JSON file
 * per lift in this directory. Nothing about a curated lift should live
 * anywhere else. Pages, the nav, the log and the importers all read it here.
 *
 * THE JSON FORMAT. Keys sit in this order, top to bottom. Only liftType and
 * slug are required for a curated lift; a lift simply lacks whatever has not
 * been written yet.
 * Add a new key to this list, in its category, before a page reads it.
 *
 *  Identity
 *   liftType        Canonical name, exactly as lifters log it.
 *   slug            URL segment for /progress-guide/ and /strength-levels/.
 *                   Changing it breaks live URLs.
 *   commonName      What people call it, when that differs: Back Squat is
 *                   "Squat". Defaults to liftType.
 *   shortName       Compact label for tight navs, e.g. "Bench".
 *   synonyms        Other names for the SAME lift, never a lookalike. Front
 *                   Squat once pointed at Back Squat's drawing for months.
 *   bigFour         true for squat, bench, deadlift and press.
 *   icon            Lucide icon name, registered in components/lift-icon.js.
 *   parentLift      { liftType, tonnageRatio, note? }. The big four lift a
 *                   variation counts toward on the Month in Iron card, and
 *                   the share of its tonnage that counts: 1 for a full lift,
 *                   less when the variation moves more weight for less work
 *                   (a rack pull is 0.5). Unrelated to standardsRef.
 *
 *  Short copy
 *   tagline               One line under the name on hubs and dashboard cards.
 *   homepageDescription   Big four: one line for someone new to the lift.
 *   bodyBenefit           Big four: what the lift gives the body, as an
 *                         invitation. Never a count of time away.
 *
 *  Links, media and coaching
 *   calculatorUrl   Its 1RM calculator page, when one exists.
 *   artwork         { src, figure }. Drawing rules: components/lift-artwork.js.
 *   videos          [{ url, title, channel }]. The guide shows them all; the
 *                   FIRST is the log's form check, so lead with the best
 *                   beginner intro.
 *   coaching        { summary, cues: three of them, standardsRef? }.
 *                   standardsRef { liftType, ratio, note? } is a rough ratio
 *                   to a big four lift for first-time target weights on the
 *                   log. Not a published standard.
 *
 *  Page blocks: each page reads only its own block. Both start with the same
 *  four page fields: seoTitle (<title>), pageTitle (H1), description (meta),
 *  keywords.
 *   guide           /progress-guide/[slug], and indexed only once it exists.
 *                   Page fields, ogImage, introduction { title, paragraphs },
 *                   quote { sectionTitle, text, author },
 *                   resources { title, links: [{ title, url, author, note? }] },
 *                   faqItems: [{ question, answer }].
 *   strengthLevels  /strength-levels/[slug], big four only. Page fields,
 *                   intro, supportingCopy, relatedArticlesCategory (Sanity),
 *                   interpretation { title, body, milestones, exampleTable,
 *                   closer }, faqItems. exampleTable { caption, rows } is
 *                   typed by hand and tuned for search: one row per
 *                   bodyweight, each level a [kg, lb] pair.
 *
 * Paragraphs and FAQ answers may use **bold** and [text](/path), rendered by
 * components/inline-markdown.js. Every other string renders as written.
 *
 * ADDING A LIFT: write its JSON file and add one import below. Having artwork
 * is the signal we believe in a lift: it gets a tile in the Lift Explorer, a
 * tile in the log's add-lift picker, and a /progress-guide/ page. The page
 * stays out of search until the lift has a guide block, because a page that
 * is only a drawing and three cues is the thin kind Google demotes.
 *
 * VARIATION LINKS: a file with liftType, synonyms and parentLift but no slug
 * is not a curated lift. It lets a big four row count a variation we have not
 * drawn (Push Press, Pause Squat), and nothing else reads it: no page, no
 * tile, no artwork lookup. Import it into VARIATION_LINKS, never
 * CURATED_LIFTS. Give it a slug and artwork later to promote it.
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
import pushPress from "@/lib/lifts/push-press.json";
import pauseSquat from "@/lib/lifts/pause-squat.json";
import boxSquat from "@/lib/lifts/box-squat.json";
import safetyBarSquat from "@/lib/lifts/safety-bar-squat.json";
import pausedBenchPress from "@/lib/lifts/paused-bench-press.json";
import inclineBenchPress from "@/lib/lifts/incline-bench-press.json";
import sumoDeadlift from "@/lib/lifts/sumo-deadlift.json";
import deficitDeadlift from "@/lib/lifts/deficit-deadlift.json";

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
].map(withDefaults);

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
  // A malformed synonyms value is ignored rather than breaking every page.
  for (const synonym of Array.isArray(lift.synonyms) ? lift.synonyms : []) {
    BY_NAME.set(synonym, lift);
  }
}

/** Uncurated variations that only feed a big four row. See VARIATION LINKS. */
const VARIATION_LINKS = [
  pushPress,
  pauseSquat,
  boxSquat,
  safetyBarSquat,
  pausedBenchPress,
  inclineBenchPress,
  sumoDeadlift,
  deficitDeadlift,
];

const PARENT_BY_NAME = new Map();
for (const lift of [...CURATED_LIFTS, ...VARIATION_LINKS]) {
  const parent = readParentLift(lift);
  if (!parent) continue;
  const synonyms = Array.isArray(lift.synonyms) ? lift.synonyms : [];
  for (const name of [lift.liftType, ...synonyms]) {
    PARENT_BY_NAME.set(name, parent);
  }
}

/**
 * The big four lift a variation counts toward, with the share of its tonnage
 * that counts, following synonyms. Null for the big four themselves and for
 * anything unlinked.
 * @param {string} liftType
 * @returns {{liftType: string, tonnageRatio: number}|null}
 */
export function getBigFourParentLift(liftType) {
  return (liftType && PARENT_BY_NAME.get(liftType)) || null;
}

// A parent outside the big four, or a ratio outside (0, 1], is dropped so a
// typo in a JSON file can never quietly inflate a row.
function readParentLift(lift) {
  const parent = lift?.parentLift;
  if (!BIG_FOUR_LIFT_TYPE_SET.has(parent?.liftType)) return null;
  const tonnageRatio = Number(parent.tonnageRatio ?? 1);
  if (!(tonnageRatio > 0 && tonnageRatio <= 1)) return null;
  return { liftType: parent.liftType, tonnageRatio };
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
 * The one video the log offers as a quick form check: the first in the lift's
 * list, curated to be the best introduction for someone new to the lift.
 *
 * @param {string} liftType
 * @returns {{url: string, title: string, channel: string}|null}
 */
export function getLiftLogVideo(liftType) {
  return getCuratedLift(liftType)?.videos?.[0] ?? null;
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
 * A big four lift as an invitation: its tagline, so the dashboard and the hub
 * pages describe each lift the same way, and what the lift gives the body.
 * Null outside the big four.
 */
export function getBigFourBodyBenefit(liftType) {
  const lift = getCuratedLift(liftType);
  if (!lift?.bigFour || !lift.bodyBenefit) return null;
  return { tagline: lift.tagline ?? null, benefit: lift.bodyBenefit };
}

// ── Strength levels ─────────────────────────────────────────────────────────

export const STRENGTH_STANDARDS_HUB_URL = `${SITE_URL}/strength-levels`;

// Bench leads the strength levels pages: it is the lift people ask about first.
const STRENGTH_LEVELS_ORDER = ["Bench Press", "Back Squat", "Deadlift", "Strict Press"];

/**
 * Flat page records for /strength-levels/[lift]: the lift's strengthLevels
 * block plus the identity and links those pages need.
 */
export const STRENGTH_STANDARDS_PAGES = STRENGTH_LEVELS_ORDER.map(getCuratedLift)
  .filter((lift) => lift?.strengthLevels)
  .map((lift) => ({
    slug: lift.slug,
    liftType: lift.liftType,
    commonName: lift.commonName,
    tagline: lift.tagline,
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

/**
 * Resolve optional fields whose default is another field, once, at load. Null,
 * never undefined, so a lift file missing both names still serialises as page
 * props instead of failing the page.
 */
function withDefaults(lift) {
  return { ...lift, commonName: lift.commonName ?? lift.liftType ?? null };
}
