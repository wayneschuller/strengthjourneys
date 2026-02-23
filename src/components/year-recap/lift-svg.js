
import { motion } from "motion/react";

export const LIFT_SVG_MAP = {
  "Back Squat": "/back_squat.svg",
  "Bench Press": "/bench_press.svg",
  Deadlift: "/deadlift.svg",
  "Strict Press": "/strict_press.svg",
  // Fallbacks for similar lifts
  "Front Squat": "/back_squat.svg",
  Squat: "/back_squat.svg",
  "Romanian Deadlift": "/deadlift.svg",
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

  const sizeClasses = {
    sm: "h-10 w-10",
    md: "h-24 w-24 md:h-32 md:w-32",
    lg: "h-36 w-36 md:h-44 md:w-44",
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
