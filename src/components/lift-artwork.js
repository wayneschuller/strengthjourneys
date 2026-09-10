/**
 * Lift artwork: the one place that knows which drawing belongs to which lift,
 * where it lives, and how to put it on screen.
 *
 * ---------------------------------------------------------------------------
 * HOUSE FORMAT for every new drawing, in order of how much it matters:
 *
 *   1. Aspect ratio 5:3. This is the one that genuinely matters.
 *   2. 1000x600 PNG, indexed colour, transparent background.
 *   3. The lifter filling about 95% of the canvas height.
 *
 * The ratio matters because containers across the app size artwork by height
 * and let the width follow. A diagram on a different ratio renders at a
 * different height to its neighbours, and since the lifter fills the frame,
 * the lifters themselves come out visibly different sizes. That is a bug you
 * see rather than read about.
 *
 * 1000x600 is a preference rather than a rule. It covers 3.4x device pixel
 * ratio at the largest slot we render into (about 293 CSS px wide) and lands
 * near 13 KB once indexed, which is roughly parity with the hand-drawn SVGs.
 *
 * Nothing here enforces any of it. Odd sizes still render, and builds never
 * fail over artwork. In development you get a one-off console note naming the
 * file, and that is the whole enforcement story.
 * ---------------------------------------------------------------------------
 *
 * ADDING A LIFT: drop the file in public/lifts/default/ and add one line to
 * LIFT_ARTWORK below. Everywhere that shows lift artwork picks it up.
 *
 * A SECOND ARTWORK SET: public/lifts/ is laid out to hold one, but nothing in
 * the code knows about sets yet, and deliberately so. Teach this file when a
 * second set actually exists. Callers ask for artwork by lift and should not
 * have to learn a new argument in the meantime.
 */

import { motion } from "motion/react";

const ASPECT_RATIO = 5 / 3;
const IDEAL_WIDTH = 1000;
const IDEAL_HEIGHT = 600;

/**
 * Sex of the figure is a deliberate editorial choice per lift rather than a
 * user setting: the catalogue is mixed so that it reads as mixed to everyone,
 * including a first-time visitor who has told us nothing. Keep it near an even
 * split, and keep women on some of the heavy compounds rather than only on the
 * accessory lifts.
 */
const LIFT_ARTWORK = {
  "Back Squat": "/lifts/default/back-squat.svg", // male
  "Bench Press": "/lifts/default/bench-press.svg", // male
  Deadlift: "/lifts/default/deadlift.svg", // female
  "Strict Press": "/lifts/default/strict-press.svg", // male
  "Power Snatch": "/lifts/default/power-snatch.png", // male
};

/** Lifts close enough to borrow another lift's drawing until they get their own. */
const LIFT_ART_ALIASES = {
  "Front Squat": "Back Squat",
  Squat: "Back Squat",
  "Overhead Press": "Strict Press",
  Press: "Strict Press",
};

/**
 * Path to the artwork for a lift, or null when we have not drawn it yet.
 * Callers are expected to handle null by rendering no illustration at all.
 *
 * @param {string} liftType - e.g. "Back Squat".
 * @returns {string|null}
 */
export function getLiftArtwork(liftType) {
  if (!liftType) return null;
  return LIFT_ARTWORK[LIFT_ART_ALIASES[liftType] ?? liftType] ?? null;
}

/**
 * Renders the illustration for a lift, optionally with a spring entrance
 * animation. Returns null when we have no artwork for the lift, so a caller
 * can render it unconditionally and let it collapse.
 *
 * For the path alone, call getLiftArtwork.
 *
 * @param {Object} props
 * @param {string} props.liftType - The lift name, e.g. "Back Squat".
 * @param {string} [props.size] - Size preset: "sm", "md", or "lg".
 * @param {boolean} [props.animate] - When true, wraps the image in a motion.div with a spring animation.
 * @param {boolean} [props.isActive] - Controls whether the animation plays (scale/opacity in) or reverses (scale/opacity out).
 * @param {string} [props.className] - Additional CSS classes applied to the img element.
 */
export function LiftArtwork({
  liftType,
  size = "md",
  animate = true,
  isActive = true,
  className = "",
}) {
  const src = getLiftArtwork(liftType);
  if (!src) return null;

  // Artwork is landscape, so md and lg pin the height and let the width
  // follow. Every drawing shares one aspect ratio, so pinning height is what
  // renders a row of different lifts at a consistent lifter size. sm stays
  // square: it sits inline beside text, where a variable width would unsettle
  // the row.
  const sizeClasses = {
    sm: "h-10 w-10",
    md: "h-24 w-auto max-w-full md:h-32",
    lg: "h-36 w-auto max-w-full md:h-44",
  };

  const img = (
    <img
      src={src}
      alt={`${liftType} diagram`}
      className={`object-contain ${sizeClasses[size]} ${className}`}
      onLoad={(e) => noteIfOffFormat(e.currentTarget, src)}
    />
  );

  if (!animate) return img;

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={isActive ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className="inline-block"
    >
      {img}
    </motion.div>
  );
}

const noted = new Set();

/**
 * Development-only nudge when a drawing is off the house format. Never throws,
 * never blocks a build, is silent in production, and speaks once per file.
 * Hangs off onLoad, the only point where the real dimensions are known.
 */
function noteIfOffFormat(img, src) {
  if (process.env.NODE_ENV === "production") return;
  if (!img || noted.has(src)) return;

  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) return;

  const name = src.split("/").pop();
  const ideal = `${IDEAL_WIDTH}x${IDEAL_HEIGHT}`;

  // A wrong ratio is the one worth interrupting for: it makes this lifter a
  // different size to every other. A wrong resolution is only ever cosmetic,
  // so it gets the gentler channel.
  if (Math.abs(w / h - ASPECT_RATIO) > 0.02) {
    noted.add(src);
    console.warn(`🏋️ ${name} is ${w}x${h}. We prefer 5:3 (${ideal}).`);
    return;
  }

  // Resolution is meaningless for SVG, so only mention it for raster files.
  const isRaster = !src.toLowerCase().endsWith(".svg");
  if (isRaster && (w !== IDEAL_WIDTH || h !== IDEAL_HEIGHT)) {
    noted.add(src);
    console.info(`🏋️ ${name} is ${w}x${h}. We prefer ${ideal}.`);
  }
}
