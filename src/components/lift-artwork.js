/**
 * Lift artwork: which drawing belongs to which lift, and how to put it on
 * screen. The notes below are hard-won, so change them knowingly.
 *
 * MAKING A NEW DRAWING
 *
 * Canvas
 *  - 5:3, ideally 1000x600, indexed PNG, transparent background.
 *  - The lifter fills about 95% of the height, and the drawing should fill the
 *    width too. Height is the one that matters: containers size by height and
 *    let width follow, so an odd ratio renders one lifter a different size to
 *    all the others.
 *  - Generate large and downsample. That averages away the generator's dither,
 *    so quantising afterwards finds flat regions rather than noise.
 *
 * Content
 *  - Two figures, the start and the finish, same scale, same ground line.
 *  - Only the barbell and whatever the lift genuinely needs. Equipment
 *    competes with the lifter for height.
 *  - Let the bar reach past the lifter. It is what carries a composition out to
 *    the edges, so a lift drawn side-on with the bar pointing at the viewer
 *    comes out narrow: the front squat fills 50% of its width, the overhead
 *    squat 94%.
 *  - Camera is an editorial choice, per lift and per figure.
 *  - Only draw lifts whose equipment the name already implies. A hip thrust is
 *    always a barbell, so one drawing serves everyone who logs it. A curl is
 *    not, so a barbell curl drawing would be wrong for the dumbbells half the
 *    people logging "Curl" actually used.
 *  - So is the sex of the figure. Keep the catalogue near an even split, with
 *    women on some of the heavy compounds, so it reads as mixed to a
 *    first-time visitor who has told us nothing.
 *
 * Style
 *  - Flat fills, hard edges. No gradients, texture or noise. Depth is a
 *    separate darker shape, never a ramp.
 *  - These fifteen colours only:
 *      skin    #fbc398 #eaae83 #de966d     hair    #372a23
 *      singlet #3970c0 #2d609f             whites  #f4f3f3 #b0b0ae
 *      bar     #8e8e8e #656769
 *      plates  #4e4f51 #3e3d3f #343434 #252323 #100f0d
 *    #343434 earns its keep: generated plates arrive near #333333, which sits
 *    19 from both #3e3d3f and the hair brown, so without it they quantise
 *    mottled brown.
 *  - Never paint background over the artwork to carve the gaps between limbs.
 *    It cannot be undone once the background comes off.
 *
 * None of this is enforced. Odd sizes still render, builds never fail over
 * artwork, and development logs one console note per offending file.
 *
 * RENDERING: always pass unoptimized, including when a caller puts the path
 * from getLiftArtwork on its own next/image. The optimiser costs bytes and
 * Vercel CPU on flat indexed PNGs, and it quietly skips SVG, so a missing flag
 * only shows up once a lift has a PNG.
 *
 * ADDING A LIFT: drop the file in public/lifts/default/ and add one line to
 * LIFT_ARTWORK. That is all: the log's add-lift picker reads DRAWN_LIFT_TYPES,
 * so a new drawing shows up there as a tile with no other change. A SECOND SET:
 * public/lifts/ is laid out to hold one, but no code knows about sets yet.
 * Teach this file when a second set exists.
 */

import Image from "next/image";
import { motion } from "motion/react";

import { useLiftColors } from "@/hooks/use-lift-colors";

const ASPECT_RATIO = 5 / 3;
const IDEAL_WIDTH = 1000;
const IDEAL_HEIGHT = 600;

const LIFT_ARTWORK = {
  "Back Squat": "/lifts/default/back-squat.svg", // male
  "Bench Press": "/lifts/default/bench-press.svg", // male
  Deadlift: "/lifts/default/deadlift.svg", // female
  "Strict Press": "/lifts/default/strict-press.svg", // male
  "Power Snatch": "/lifts/default/power-snatch.png", // male
  "Power Clean": "/lifts/default/power-clean.png", // male
  "Front Squat": "/lifts/default/front-squat.png", // female
  "Overhead Squat": "/lifts/default/overhead-squat.png", // female
  "Romanian Deadlift": "/lifts/default/romanian-deadlift.png", // male
  "Hip Thrust": "/lifts/default/hip-thrust.png", // female
  "Barbell Row": "/lifts/default/barbell-row.png", // male
};

/** Every lift we have a drawing for, in the order they were drawn. */
export const DRAWN_LIFT_TYPES = Object.keys(LIFT_ARTWORK);

/**
 * Other names for a lift we have already drawn. Synonyms only: an overhead
 * press IS a strict press. Never point one lift at a different lift's drawing,
 * however alike they look, since the diagram exists to show where the bar sits.
 * Front Squat pointed here at Back Squat for seven months, showing a bar across
 * the upper back for a lift racked at the front. An undrawn lift should render
 * nothing, which is what returning null already does.
 */
const LIFT_ART_SYNONYMS = {
  Squat: "Back Squat",
  "Overhead Press": "Strict Press",
  Press: "Strict Press",
};

/**
 * Path to the artwork for a lift, or null when we have not drawn it yet.
 *
 * @param {string} liftType - e.g. "Back Squat".
 * @returns {string|null}
 */
export function getLiftArtwork(liftType) {
  if (!liftType) return null;
  return LIFT_ARTWORK[LIFT_ART_SYNONYMS[liftType] ?? liftType] ?? null;
}

/**
 * Renders a lift's illustration, optionally with a spring entrance. Returns
 * null when we have no artwork, so a caller can render it unconditionally and
 * let it collapse. For the path alone, call getLiftArtwork.
 *
 * @param {Object} props
 * @param {string} props.liftType - The lift name, e.g. "Back Squat".
 * @param {string} [props.size] - Size preset: "sm", "tile", "md", or "lg".
 * @param {boolean} [props.animate] - Wrap in a motion.div with a spring entrance.
 * @param {boolean} [props.isActive] - Whether that animation plays or reverses.
 * @param {string} [props.className] - Extra classes for the img.
 */
export function LiftArtwork({
  liftType,
  size = "md",
  animate = true,
  isActive = true,
  className = "",
}) {
  const { getColor } = useLiftColors();
  const src = getLiftArtwork(liftType);
  if (!src) return null;

  // Dark themes swallow the black shorts and dark hair, leaving a figure that
  // reads as floating legs, so wash the lift's own colour behind it. sm is left
  // out: at 40px beside a line of text a glow is noise.
  const glow = size !== "sm";

  // md and lg pin the height and let width follow, which is what renders a row
  // of different lifts at a consistent lifter size. sm stays square because it
  // sits inline beside text, where a variable width unsettles the row. tile is
  // for pickers: a grid of many lifts at once, small enough to scan the lot.
  const sizeClasses = {
    sm: "h-10 w-10",
    tile: "h-12 w-auto max-w-full md:h-14",
    md: "h-24 w-auto max-w-full md:h-32",
    lg: "h-36 w-auto max-w-full md:h-44",
  };

  const img = (
    <Image
      src={src}
      alt={`${liftType} diagram`}
      // The same for every drawing, since all are 5:3. Reserves the box before
      // the file lands so width cannot jump under w-auto, and boxes an
      // off-format drawing rather than letting it shove the layout around.
      width={IDEAL_WIDTH}
      height={IDEAL_HEIGHT}
      // Straight from public/, because optimising costs bytes here: the
      // optimiser declines to touch SVG, and flat colour compresses into an
      // indexed palette far better than into WebP (4 KB against 18 KB at 384px).
      unoptimized
      // Against next/image's lazy default. Callers mount this inside a spring
      // starting at scale(0), and a zero-area box never satisfies an
      // intersection check, so a lazy image would wait on the animation.
      loading="eager"
      // The colour rides as a custom property so the gradient can sit behind a
      // dark: variant, which already covers every dark theme pack.
      style={
        glow
          ? {
              "--lift-glow": `color-mix(in srgb, ${getColor(liftType)} 34%, transparent)`,
            }
          : undefined
      }
      className={`object-contain ${
        glow
          ? "dark:[background-image:radial-gradient(closest-side,var(--lift-glow),transparent)]"
          : ""
      } ${sizeClasses[size]} ${className}`}
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
 * Development-only nudge when a drawing is off format. Never throws, never
 * blocks a build, silent in production, speaks once per file. Hangs off onLoad,
 * the only point where the real dimensions are known.
 */
function noteIfOffFormat(img, src) {
  if (process.env.NODE_ENV === "production") return;
  if (!img || noted.has(src)) return;

  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) return;

  const name = src.split("/").pop();
  const ideal = `${IDEAL_WIDTH}x${IDEAL_HEIGHT}`;

  // A wrong ratio makes this lifter a different size to every other, so it
  // warrants a warning. A wrong resolution is only cosmetic.
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
