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
 *    Equipment that is not iron may add its own flat tones. The box squat's
 *    wooden box uses #eec78f #dab17b #ac8256 (top, front, side); reuse them
 *    for any other wood.
 *    #343434 earns its keep: generated plates arrive near #333333, which sits
 *    19 from both #3e3d3f and the hair brown, so without it they quantise
 *    mottled brown.
 *  - Never paint background over the artwork to carve the gaps between limbs.
 *    It cannot be undone once the background comes off.
 *
 * The cleanup that gets a generated render to this standard lives outside the
 * repo with the original renders; AGENTS.md says where.
 *
 * THEMED SVG (the newer route)
 *
 * A drawing generated as SVG takes the app theme's colours. Mark its artwork
 * block "themed": true. The file is prepared by prepare_svg.mjs next to the
 * original renders: the five colours a theme may change (singlet and shoes, the
 * plates) become CSS variables with the house colour as the fallback, and the
 * drawing sits in <symbol id="art">. LiftArtwork then draws it with an
 * SVG <use>, so the file stays a cached static asset (nothing joins the JS
 * bundle) and inherits --lift-kit, --lift-kit-shade, --lift-plate-rim,
 * --lift-plate and --lift-plate-hub from the active theme (globals.css).
 * Layouts that own image sizing use LiftArtworkImage with getLiftArtwork's
 * path. All artwork must use one of these renderers to inherit theme colours.
 * Same canvas rules as above, but 1600x960 is the SVG viewBox to ask for.
 *
 * None of this is enforced. Odd sizes still render, builds never fail over
 * artwork, and development logs one console note per offending file.
 *
 * RENDERING: always pass unoptimized, including when a caller puts the path
 * from getLiftArtwork on its own next/image. The optimiser costs bytes and
 * Vercel CPU on flat indexed PNGs, and it quietly skips SVG, so a missing flag
 * only shows up once a lift has a PNG.
 *
 * ADDING A LIFT: drop the file in public/lifts/default/ and give the lift an
 * artwork block in its JSON file in src/lib/lifts/ (see lib/lifts/lift-registry.js).
 * That is all: the log's add-lift picker, the Lift Explorer and the lift's
 * progress guide all read the registry, so a new drawing shows up everywhere. A SECOND SET:
 * public/lifts/ is laid out to hold one, but no code knows about sets yet.
 * Teach this file when a second set exists.
 */

import Image from "next/image";
import { motion } from "motion/react";

import { useLiftColors } from "@/hooks/use-lift-colors";
import { DRAWN_LIFT_TYPES, getCuratedLift } from "@/lib/lifts/lift-registry";
import { cn } from "@/lib/utils";

const ASPECT_RATIO = 5 / 3;
const IDEAL_WIDTH = 1000;
const IDEAL_HEIGHT = 600;

/** Every lift we have a drawing for, re-exported for the log's pickers. */
export { DRAWN_LIFT_TYPES };

/**
 * Path to the artwork for a lift, or null when we have not drawn it yet.
 * Follows the registry's synonyms, so "Squat" finds the back squat.
 *
 * @param {string} liftType - e.g. "Back Squat".
 * @returns {string|null}
 */
export function getLiftArtwork(liftType) {
  if (!liftType) return null;
  return getCuratedLift(liftType)?.artwork?.src ?? null;
}

// Resolve paths through the registry so callers with a saved artwork URL use
// exactly the same theme behaviour as callers that render by lift name.
const themedSources = new Set(
  DRAWN_LIFT_TYPES.map((liftType) => getCuratedLift(liftType).artwork)
    .filter((artwork) => artwork.themed)
    .map((artwork) => artwork.src),
);

/**
 * Shared artwork image for layouts that own their sizing and animation.
 * Themed SVGs inherit CSS variables through a same-origin reference; other
 * drawings remain unoptimized images. Both honour the caller's image box.
 */
export function LiftArtworkImage({
  src,
  alt = "",
  width = IDEAL_WIDTH,
  height = IDEAL_HEIGHT,
  className = "",
  style,
  loading = "eager",
  unoptimized: _unoptimized,
  onLoad,
  ref,
  ...props
}) {
  if (!src) return null;
  if (themedSources.has(src)) {
    return (
      <svg
        {...props}
        ref={ref}
        viewBox={`0 0 ${IDEAL_WIDTH} ${IDEAL_HEIGHT}`}
        width={width}
        height={height}
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
        // SVGs do not get the img reset that makes height follow a shrinking
        // width. Merge the default so callers can still pin their own height.
        className={cn("h-auto max-w-full object-contain", className)}
        style={{ aspectRatio: `${width} / ${height}`, ...style }}
      >
        <use href={`${src}#art`} width={IDEAL_WIDTH} height={IDEAL_HEIGHT} />
      </svg>
    );
  }
  return (
    <Image
      {...props}
      ref={ref}
      src={src}
      alt={alt}
      width={width}
      height={height}
      unoptimized
      loading={loading}
      className={className}
      style={style}
      onLoad={onLoad}
    />
  );
}

// Forward Motion's ref and animated styles to the actual SVG/image, keeping
// existing hover and entrance animations without adding a layout wrapper.
export const MotionLiftArtworkImage = motion.create(LiftArtworkImage);

/**
 * Renders a lift's illustration, optionally with a spring entrance. Returns
 * null when we have no artwork, so a caller can render it unconditionally and
 * let it collapse. For the path alone, call getLiftArtwork.
 *
 * @param {Object} props
 * @param {string} props.liftType - The lift name, e.g. "Back Squat".
 * @param {string} [props.size] - Size preset: "sm", "tile", "card", "md", or "lg".
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
    card: "h-16 w-auto max-w-full sm:h-20",
    md: "h-24 w-auto max-w-full md:h-32",
    lg: "h-36 w-auto max-w-full md:h-44",
  };

  // The glow, the same for both kinds of drawing. The colour rides as a custom
  // property so the gradient can sit behind a dark: variant, which already
  // covers every dark theme pack.
  const glowStyle = glow
    ? {
        "--lift-glow": `color-mix(in srgb, ${getColor(liftType)} 34%, transparent)`,
      }
    : undefined;
  const glowClass = glow
    ? "dark:[background-image:radial-gradient(closest-side,var(--lift-glow),transparent)]"
    : "";

  const img = (
    <LiftArtworkImage
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
      style={glowStyle}
      className={`object-contain ${glowClass} ${sizeClasses[size]} ${className}`}
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
