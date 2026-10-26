import { useEffect, useState } from "react";
import { animate, useReducedMotion } from "motion/react";

/**
 * Counts a number up from zero while a recap card is on screen, the way the
 * big numbers roll in on a Wrapped story. Lands exactly on `target`, so an
 * image captured after the roll shows the real figure.
 *
 * @param {number} target - The number to land on.
 * @param {boolean} isActive - Rolls when true; resets to zero when the card leaves.
 * @param {Object} [options]
 * @param {number} [options.duration=1.2] - Seconds.
 * @param {number} [options.delay=0.1] - Seconds before the roll starts.
 * @returns {number} The current value, rounded.
 */
export function useCountUp(
  target,
  isActive,
  { duration = 1.2, delay = 0.1 } = {},
) {
  const prefersReducedMotion = useReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion || !isActive) return;
    const controls = animate(0, target, {
      duration,
      delay,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setValue(Math.round(v)),
    });
    return () => {
      controls.stop();
      // Back to zero so the next visit rolls up again instead of flashing the
      // final number for the length of the delay.
      setValue(0);
    };
  }, [target, isActive, duration, delay, prefersReducedMotion]);

  if (prefersReducedMotion) return target;
  return isActive ? value : 0;
}
