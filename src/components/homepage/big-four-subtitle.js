/**
 * Muted, delayed subtitle under the Big Four section heading.
 *
 * The delay is the point: the heading lands first, and the pitch arrives a
 * beat later for anyone still looking. Height is reserved up front so the
 * lift cards below never jump when the line appears.
 */

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import {
  getSubtitleRotationKey,
  getBigFourSubtitle,
} from "@/lib/big-four-subtitles";
import { cn } from "@/lib/utils";

const REVEAL_DELAY_MS = 2500;

/**
 * @param {Object} props
 * @param {string} [props.className] - Extra classes for the reserved-height wrapper.
 */
export function BigFourSubtitle({ className }) {
  // Resolved after mount rather than during render: the landing page is
  // statically generated, so picking from a clock at render time would bake
  // build-time copy into the HTML and mismatch on hydration.
  const [subtitle, setSubtitle] = useState(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const line = getBigFourSubtitle(getSubtitleRotationKey());
    // Reduced motion skips the timed reveal, but still goes through the timer
    // so the state update never happens synchronously inside the effect.
    const timer = setTimeout(
      () => setSubtitle(line),
      prefersReducedMotion ? 0 : REVEAL_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [prefersReducedMotion]);

  return (
    // Reserve two lines on small screens, one from sm up, so the cards below
    // hold still whether or not the line has arrived yet.
    <div className={cn("min-h-[2.5rem] sm:min-h-[1.5rem]", className)}>
      {subtitle && (
        <motion.p
          initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: prefersReducedMotion ? 0 : 0.7,
            ease: "easeOut",
          }}
          className="text-muted-foreground max-w-2xl text-sm text-pretty"
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  );
}
