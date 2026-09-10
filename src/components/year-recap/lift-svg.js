import { motion } from "motion/react";

import { getLiftArtwork, warnIfArtworkOffFormat } from "@/lib/lift-artwork";

/**
 * Path to a lift's illustration, or null when we have not drawn it.
 *
 * The registry itself lives in src/lib/lift-artwork.js, which also documents
 * the house format for new drawings. This stays as the name most of the app
 * already imports.
 */
export function getLiftSvgPath(liftType) {
  return getLiftArtwork(liftType);
}

/**
 * Renders the illustration for a known lift type, optionally with a spring
 * entrance animation. Returns null if we have no artwork for the lift, so a
 * caller can render this unconditionally and let it collapse.
 *
 * @param {Object} props
 * @param {string} props.liftType - The lift name used to look up the artwork (e.g. "Back Squat", "Deadlift").
 * @param {string} [props.size] - Size preset: "sm", "md", or "lg".
 * @param {boolean} [props.animate] - When true, wraps the image in a motion.div with a spring animation.
 * @param {boolean} [props.isActive] - Controls whether the animation plays (scale/opacity in) or reverses (scale/opacity out).
 * @param {string} [props.className] - Additional CSS classes applied to the img element.
 * @param {string} [props.set] - Artwork set to draw from; falls back to the default set per lift.
 */
export function LiftSvg({
  liftType,
  size = "md",
  animate = true,
  isActive = true,
  className = "",
  set,
}) {
  const src = getLiftArtwork(liftType, set ? { set } : undefined);
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
      // Development-only nudge if a drawing is off the house format. Silent in
      // production, and never blocks anything either way.
      onLoad={(e) => warnIfArtworkOffFormat(e.currentTarget, src)}
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
