/**
 * Small entrance animation for PR and ranking markers in the log.
 */

import { motion, useReducedMotion } from "motion/react";

/**
 * Every visible PR marker gets a small entrance burst and shimmer. This is the
 * baseline celebration treatment; stronger milestones add border, confetti, and
 * shake on top.
 */
export function CelebrationReveal({ animationKey, className, children }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      key={animationKey}
      initial={
        prefersReducedMotion
          ? false
          : {
              opacity: 0,
              y: 8,
              scale: 0.88,
              filter: "brightness(0.9)",
            }
      }
      animate={
        prefersReducedMotion
          ? undefined
          : {
              opacity: [0, 1, 1],
              y: [8, -2, 0],
              scale: [0.88, 1.12, 1],
              filter: ["brightness(0.9)", "brightness(1.34)", "brightness(1)"],
            }
      }
      transition={
        prefersReducedMotion
          ? undefined
          : {
              duration: 0.62,
              delay: 0.12,
              ease: [0.2, 0.9, 0.25, 1],
            }
      }
      className={className}
    >
      {children}
    </motion.div>
  );
}
