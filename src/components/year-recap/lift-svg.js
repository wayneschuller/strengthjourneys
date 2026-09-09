import { motion } from "motion/react";

// Artwork for lifts we have drawn. Any lift missing from here simply renders
// without an illustration, so entries can be added one at a time as the set
// grows. Values are image paths, not necessarily SVG: every diagram sits on
// the same 5:3 canvas, so the format is free to vary per lift.
export const LIFT_SVG_MAP = {
  "Back Squat": "/back_squat.svg",
  "Bench Press": "/bench_press.svg",
  Deadlift: "/deadlift.svg",
  "Strict Press": "/strict_press.svg",
  "Power Snatch": "/power_snatch.png",
  // Fallbacks for similar lifts
  "Front Squat": "/back_squat.svg",
  Squat: "/back_squat.svg",
  "Overhead Press": "/strict_press.svg",
  Press: "/strict_press.svg",
};

export function getLiftSvgPath(liftType) {
  if (!liftType) return null;
  return LIFT_SVG_MAP[liftType] ?? null;
}

/**
 * Renders the SVG illustration for a known lift type, optionally with a spring entrance animation.
 * Returns null if no SVG mapping exists for the given liftType.
 * @param {Object} props
 * @param {string} props.liftType - The lift name used to look up the SVG path (e.g. "Back Squat", "Deadlift").
 * @param {string} [props.size] - Size preset: "sm", "md", or "lg".
 * @param {boolean} [props.animate] - When true, wraps the image in a motion.div with a spring animation.
 * @param {boolean} [props.isActive] - Controls whether the animation plays (scale/opacity in) or reverses (scale/opacity out).
 * @param {string} [props.className] - Additional CSS classes applied to the img element.
 */
export function LiftSvg({
  liftType,
  size = "md",
  animate = true,
  isActive = true,
  className = "",
}) {
  const src = getLiftSvgPath(liftType);
  if (!src) return null;

  // The artwork is landscape and each lift has its own aspect ratio, so md and
  // lg pin the height and let the width follow. That is what makes a row of
  // different lifts render at a consistent lifter size. sm stays square: it
  // sits inline beside text, where a variable width would unsettle the row.
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
