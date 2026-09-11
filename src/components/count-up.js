/**
 * Shared count-up number. Ticks a figure in from zero with a fast ease-out
 * that lands softly, the way the estimated 1RM arrives on Lift Explorer, so a
 * headline number feels earned rather than printed.
 *
 * The text is written through a motion value, so the host component never
 * re-renders per frame. That matters here: these numbers sit above Recharts
 * charts and busy dashboard cards where a 60fps setState would be felt.
 */
import { useEffect, useRef } from "react";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";

// Expo-style ease-out: most of the distance goes by in the first third, then
// the last few digits settle slowly, which is what reads as "ticking in".
const COUNT_UP_EASE = [0.16, 1, 0.3, 1];

/**
 * Counts a number up to `value` once it scrolls into view. A card below the
 * fold still gets its moment rather than finishing the count off screen. Later
 * changes (switching lift or month) tick from the old figure to the new one.
 *
 * @param {Object} props
 * @param {number} props.value - Target number. Null or undefined counts to 0.
 * @param {(n: number) => string} [props.format] - Formats each in-between
 *   frame. Defaults to one decimal, dropped when the figure is whole.
 * @param {number} [props.duration] - Seconds for the count.
 * @param {number} [props.delay] - Seconds to wait before counting.
 * @param {string} [props.className]
 */
export function CountUp({
  value,
  format = formatCountUpDecimal,
  duration = 1.1,
  delay = 0,
  className,
}) {
  const target = value ?? 0;
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const prefersReducedMotion = useReducedMotion();
  const motionValue = useMotionValue(prefersReducedMotion ? target : 0);
  const text = useTransform(motionValue, (latest) => format(latest));

  useEffect(() => {
    if (prefersReducedMotion) {
      motionValue.set(target);
      return;
    }
    if (!isInView) return;
    const controls = animate(motionValue, target, {
      duration,
      delay,
      ease: COUNT_UP_EASE,
    });
    return () => controls.stop();
  }, [target, motionValue, prefersReducedMotion, isInView, duration, delay]);

  return (
    <motion.span ref={ref} className={className}>
      {text}
    </motion.span>
  );
}

/** One decimal place, dropped when the rounded figure is whole. */
export function formatCountUpDecimal(value) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded)
    ? rounded.toLocaleString()
    : rounded.toFixed(1);
}

/** Whole numbers with thousands separators, for counts like sessions and sets. */
export function formatCountUpInteger(value) {
  return Math.round(value).toLocaleString();
}
