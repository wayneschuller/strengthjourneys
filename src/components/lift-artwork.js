/**
 * Lift artwork: the one place that knows which drawing belongs to which lift,
 * where it lives, and how to put it on screen.
 *
 * ===========================================================================
 * MAKING A NEW DRAWING
 *
 * These are hard-won rather than arbitrary. Each one is here because getting
 * it wrong produced something visibly broken, and the note says which.
 * ---------------------------------------------------------------------------
 *
 * THE CANVAS
 *
 *  1. Aspect ratio 5:3. The one that genuinely matters. Containers across the
 *     app size artwork by height and let the width follow, so a drawing on a
 *     different ratio renders at a different height to its neighbours. Since
 *     the lifter fills the frame, the lifters themselves then come out
 *     different sizes, which reads as a bug rather than as variety.
 *
 *  2. 1000x600. A preference, not a rule. Covers 3.4x device pixel ratio at
 *     the largest slot we render into (about 293 CSS px wide) and lands near
 *     13 KB once indexed, roughly parity with the hand-drawn SVGs.
 *
 *  3. The lifter fills about 95% of the canvas height, with only a thin
 *     margin. Padding baked into a drawing can never be removed by a
 *     container, whereas CSS padding can be tuned per slot.
 *
 *  4. The two figures sit close together, so the drawing's own bounding box is
 *     no wider than 5:3 either. Miss this and rule 3 becomes unreachable: the
 *     power clean came back with its figures spread to a 1.985 ratio, so even
 *     cropped perfectly tight the lifter could only reach 82% of the height,
 *     because the width ran out first.
 *
 * WHAT IS IN FRAME
 *
 *  5. Two figures, the start of the lift and the finish, sharing one camera,
 *     one scale and one ground line.
 *
 *  6. Only the barbell, plus whatever equipment the lift strictly requires.
 *     Equipment competes with the lifter for canvas height, which is why the
 *     bench press reads smaller than the rest of the set.
 *
 *  7. Camera chosen per lift, from a small fixed set, so that the whole
 *     catalogue uses three or four angles rather than twenty. Pick the one
 *     that makes the lift legible and never one where the working joints
 *     overlap into a single mass: side profile for hinges and vertical bar
 *     paths, three-quarter for squats and racked positions, front on for
 *     symmetric overhead work, three-quarter from above for lifts done lying
 *     down.
 *
 * HOW IT IS DRAWN
 *
 *  8. Flat fills only. No gradients, no soft shading, no drop shadows, no
 *     outlines or strokes. Depth comes from placing a separate flat shape in a
 *     darker tint of the same colour, with a crisp edge against it.
 *
 *  9. No texture, grain, noise or mottling, on the plates above all. This is
 *     the rule generators break most often, and it is expensive: a drawing
 *     with speckled plates arrived carrying 13,213 distinct colours and
 *     weighed 429 KB, against 23 KB for the same picture snapped flat.
 *
 * 10. These fifteen colours and no others:
 *
 *       skin      #fbc398  #eaae83  #de966d
 *       hair      #372a23
 *       singlet   #3970c0  #2d609f
 *       whites    #f4f3f3  #b0b0ae
 *       bar       #8e8e8e  #656769
 *       plates    #4e4f51  #3e3d3f  #343434  #252323  #100f0d
 *
 *     #343434 earns its place the hard way. A generated plate grey of
 *     #333333 sits 19 away from both #3e3d3f and the hair brown #372a23, so
 *     quantising flipped between them pixel by pixel and mottled the plates
 *     brown. #343434 is 2 away, and restoring it both fixed the plates and
 *     made the file smaller, since clean boundaries compress better.
 *
 * 11. Transparent background, asked for plainly. Generators manage it: the
 *     power snatch came back three quarters transparent. So an opaque
 *     background means regenerate, not reach for a chroma key and a flood
 *     fill. Relatedly, never let a generator paint background colour over the
 *     artwork to carve out the gaps between limbs. That only looks right while
 *     the background stays opaque and it cannot be undone afterwards, which is
 *     how one attempt ended up with figures fused into skin-coloured blobs the
 *     moment its background was removed.
 *
 * THE FILE ITSELF
 *
 * 12. Indexed PNG, quantised to those fifteen colours. Flat colour art
 *     compresses into an indexed palette far better than into a photographic
 *     codec: at 384px the same drawing is 4 KB indexed, 10 KB as AVIF and
 *     18 KB as WebP, which is why this component asks next/image not to
 *     optimise.
 *
 * 13. Format follows the source. Hand-drawn vectors stay SVG, generated raster
 *     stays PNG, and neither gets converted. Tracing a raster to SVG is lossy
 *     and was measured to be both larger and worse: legible traces cost 31 KB
 *     against 13 KB for the PNG, and cheaper ones shredded the hair and face.
 *
 * 14. Sex of the figure is a deliberate editorial choice per lift, not a user
 *     setting. The catalogue is mixed so it reads as mixed to everyone,
 *     including a first-time visitor who has told us nothing. Keep it near an
 *     even split, and keep women on some of the heavy compounds rather than
 *     only on the accessory lifts.
 *
 * Nothing here is enforced. Odd sizes still render and builds never fail over
 * artwork. In development you get a one-off console note naming the file, and
 * that is the whole enforcement story.
 * ===========================================================================
 *
 * ADDING A LIFT: drop the file in public/lifts/default/ and add one line to
 * LIFT_ARTWORK below. Everywhere that shows lift artwork picks it up.
 *
 * A SECOND ARTWORK SET: public/lifts/ is laid out to hold one, but nothing in
 * the code knows about sets yet, and deliberately so. Teach this file when a
 * second set actually exists. Callers ask for artwork by lift and should not
 * have to learn a new argument in the meantime.
 */

import Image from "next/image";
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
  "Power Clean": "/lifts/default/power-clean.png", // male
};

/**
 * Other names for a lift we have already drawn. Synonyms only: an overhead
 * press IS a strict press, and an unqualified squat is a back squat.
 *
 * Never point one lift at a different lift's drawing, however alike the two
 * look. The diagram is here to show where the bar sits, so a stand-in teaches
 * the wrong thing rather than nothing. Front Squat pointed at Back Squat here
 * for seven months, showing a bar across the upper back for a lift racked at
 * the front. A lift we have not drawn should render no illustration at all,
 * which is what returning null already does.
 */
const LIFT_ART_SYNONYMS = {
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
  return LIFT_ARTWORK[LIFT_ART_SYNONYMS[liftType] ?? liftType] ?? null;
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
    <Image
      src={src}
      alt={`${liftType} diagram`}
      // Every drawing is 5:3, so these are the same for all of them. They
      // reserve the right box before the file lands, which stops the width
      // jumping under w-auto, and they keep an off-format drawing boxed to
      // 5:3 rather than letting it push the layout around.
      width={IDEAL_WIDTH}
      height={IDEAL_HEIGHT}
      // Served straight from public/ rather than through the optimiser. Some
      // drawings are SVG, which the optimiser declines to touch anyway, and
      // the rest are indexed PNG: flat colour art compresses into an indexed
      // palette far better than into the WebP or AVIF the optimiser would
      // re-encode it as, so optimising here would cost bytes rather than save
      // them.
      unoptimized
      // Eager, against next/image's lazy default. Several callers mount this
      // inside a spring that starts at scale(0), which has no area for an
      // intersection check, so a lazy image would wait for the animation
      // before it even began fetching. The whole catalogue is a handful of
      // files of 9 to 23 KB, shared across every page and cached after the
      // first, so there is nothing worth deferring here.
      loading="eager"
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
