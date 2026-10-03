/**
 * The dashboard's opening: the greeting, with the athlete's name underlined by
 * a marker stroke that draws itself in, and the story of the day joined to it
 * on a thread, so the story reads as what the greeting goes on to say rather
 * than a separate widget.
 *
 * Desktop puts the two on one row and the thread runs across from the end of
 * the underline into the story. Phones stack them and drop the thread, which
 * has no room to say anything there.
 *
 * Owns layout and entrance only. Which story shows lives in StoryOfTheDay,
 * passed in as children.
 */
import { motion, useReducedMotion } from "motion/react";

export function DashboardGreeting({ quip, firstName, children }) {
  const prefersReducedMotion = useReducedMotion();
  const [before = "", after = ""] = quip.split("{name}");

  return (
    <div className="flex max-w-full flex-col items-center gap-2 lg:flex-row lg:items-center lg:gap-0">
      <motion.p
        className="shrink-0 text-center text-xl leading-snug sm:text-2xl lg:text-left"
        initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <span className="text-muted-foreground">{before}</span>
        {firstName && <MarkedName name={firstName} />}
        {after && <span className="text-muted-foreground">{after}</span>}
      </motion.p>

      {children && (
        <>
          {/* The thread: picks up where the underline ends, a knot, then a
              line that grows across into the story. */}
          <div
            aria-hidden
            className="mx-4 hidden w-12 shrink-0 items-center self-center lg:flex xl:w-16"
          >
            <motion.span
              className="bg-primary h-2 w-2 shrink-0 rounded-full"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                delay: 0.55,
                type: "spring",
                stiffness: 400,
                damping: 18,
              }}
            />
            <motion.span
              className="from-primary/60 to-primary/10 h-px flex-1 origin-left bg-gradient-to-r"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.6, duration: 0.45, ease: "easeOut" }}
            />
          </div>
          <div className="max-w-full min-w-0 lg:max-w-xl">{children}</div>
        </>
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
