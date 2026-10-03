/**
 * The dashboard's opening: the greeting, with the athlete's name underlined by
 * a marker stroke that draws itself in, and the story of the day hanging off
 * it on a thin thread, so the story reads as the next line of the greeting
 * rather than a separate widget.
 *
 * Owns layout and entrance only. The story itself (ranking, paging) lives in
 * HomeInspirationCards, passed in as children.
 */
import { motion, useReducedMotion } from "motion/react";

export function DashboardGreeting({ quip, firstName, children }) {
  const prefersReducedMotion = useReducedMotion();
  const [before = "", after = ""] = quip.split("{name}");

  return (
    <div className="flex w-fit max-w-full flex-col">
      <motion.p
        className="text-xl leading-snug sm:text-2xl"
        initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <span className="text-muted-foreground">{before}</span>
        {firstName && <MarkedName name={firstName} />}
        {after && <span className="text-muted-foreground">{after}</span>}
      </motion.p>

      {children && (
        <div className="relative mt-2 pl-5">
          {/* The thread: a knot under the greeting and a line that grows down
              into the story. */}
          <motion.span
            aria-hidden
            className="bg-primary absolute top-1 left-[3px] h-2 w-2 rounded-full"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{
              delay: 0.5,
              type: "spring",
              stiffness: 400,
              damping: 18,
            }}
          />
          <motion.span
            aria-hidden
            className="from-primary/50 absolute top-3 bottom-1 left-[6.5px] w-px origin-top bg-gradient-to-b to-transparent"
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ delay: 0.6, duration: 0.7, ease: "easeOut" }}
          />
          {children}
        </div>
      )}
    </div>
  );
}

// A loose, slightly uphill marker stroke under the name, drawn left to right
// once the greeting has landed.
function MarkedName({ name }) {
  return (
    <span className="relative inline-block font-bold">
      {name}
      <svg
        aria-hidden
        viewBox="0 0 100 12"
        preserveAspectRatio="none"
        className="text-primary/70 pointer-events-none absolute -bottom-1.5 left-[-4%] h-2.5 w-[108%] overflow-visible"
      >
        <motion.path
          d="M2 8.5 C 20 5.5, 45 4, 62 5.2 S 90 6.5, 98 3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.45, duration: 0.7, ease: [0.65, 0, 0.35, 1] }}
        />
      </svg>
    </span>
  );
}
