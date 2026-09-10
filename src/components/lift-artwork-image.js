import { motion } from "motion/react";

import { getLiftArtwork, warnIfArtworkOffFormat } from "@/lib/lift-artwork";

/**
 * Renders the illustration for a lift, optionally with a spring entrance
 * animation. Returns null when we have no artwork for the lift, so a caller
 * can render it unconditionally and let it collapse.
 *
 * For the path alone, call getLiftArtwork from @/lib/lift-artwork.
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
