/**
 * Scroll-reveal primitives for the Big Four lift pages.
 *
 * The Big Four pages are a long vertical stack of heavy analysis cards. Without
 * any entrance treatment the whole page lands flat and the reader has no sense
 * of where one idea ends and the next begins. These wrappers fade each section
 * up as it enters the viewport so scrolling feels like turning pages.
 *
 * Motion is deliberately cheap: opacity + a small translate, `once: true`, and
 * no layout animation, so scroll performance survives on a page that already
 * renders several Recharts surfaces. `_app.js` wraps the tree in
 * `MotionConfig reducedMotion="user"`, so we do not re-check the media query
 * here — motion is already neutralised for users who ask for that.
 */

import { motion } from "motion/react";

import { cn } from "@/lib/utils";

// Declared once at module scope: motion.create() during render would mint a new
// component type on every pass and reset the reveal state mid-scroll.
const MOTION_TAGS = {
  div: motion.div,
  section: motion.section,
};

/**
 * Fades and lifts its children into view once, when scrolled into the viewport.
 *
 * @param {Object} props
 * @param {number} [props.delay=0] - Seconds to stagger this reveal behind its siblings.
 * @param {string} [props.className] - Extra classes for the wrapper element.
 * @param {string} [props.id] - Anchor id, so section links still land on the wrapper.
 * @param {"div"|"section"} [props.as="div"] - Element to render.
 */
export function SectionReveal({
  delay = 0,
  className,
  id,
  as = "div",
  children,
  ...props
}) {
  const MotionTag = MOTION_TAGS[as] ?? MOTION_TAGS.div;

  return (
    <MotionTag
      id={id}
      className={cn("scroll-mt-24", className)}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px", amount: 0.1 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay }}
      {...props}
    >
      {children}
    </MotionTag>
  );
}
