/**
 * The dashboard's opening: the greeting, with the athlete's name underlined by
 * a marker stroke that draws itself in, and the story of the day joined to it
 * on a thread, so the story reads as what the greeting goes on to say rather
 * than a separate widget.
 *
 * Desktop puts the two on one row and the thread runs across from the end of
 * the underline into the story. Both wait until the three headline cards are
 * on screen, then thirty seconds more before fading in, so the cards have
 * the stage first. Development builds log the countdown to the console. Phones stack them and drop the thread, which has no room to
 * say anything there.
 *
 * Owns layout and entrance only. Which story shows lives in StoryOfTheDay,
 * passed in as children.
 */
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import { devLog } from "@/lib/processing-utils";

// Long enough to take in the three headline cards, which spend their first
// several seconds counting up and revealing rows, before anything else moves.
// Ten seconds felt like no wait at all once the cards' own entrance had run.
export const STORY_REVEAL_DELAY_SECONDS = 30;

/*
 * Why the reveal is driven by state, not by motion's `initial` plus a delay:
 * the home page wraps the dashboard in <AnimatePresence initial={false}>,
 * which tells every motion element inside it to skip its initial values and
 * render straight at `animate`. A delayed fade written as initial/animate
 * therefore showed the story at once. Animating towards a value that only
 * changes when a timer fires works whatever wraps the dashboard.
 */

/**
 * @param {Object} props
 * @param {boolean} [props.isStoryReady=false] - True once the headline cards
 *   are on screen. The reveal delay counts from here, not from page load, so
 *   a slow sheet load cannot eat into the cards' time alone.
 */
export function DashboardGreeting({
  quip,
  firstName,
  isStoryReady = false,
  children,
}) {
  const prefersReducedMotion = useReducedMotion();
  const [before = "", after = ""] = quip.split("{name}");
  const hasStory = !!children;
  const [isRevealed, setIsRevealed] = useState(false);

  // One timer drives the reveal and the development log, so the console says
  // exactly when the story appears.
  useEffect(() => {
    if (!isStoryReady || !hasStory) return;
    const startedAt = performance.now();
    devLog(
      `Story of the day: cards are on screen, story in ${STORY_REVEAL_DELAY_SECONDS}s`,
    );
    const timer = setTimeout(() => {
      setIsRevealed(true);
      devLog(
        `Story of the day: revealed after ${((performance.now() - startedAt) / 1000).toFixed(1)}s`,
      );
    }, STORY_REVEAL_DELAY_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, [isStoryReady, hasStory]);

  return (
    <div className="flex max-w-full min-w-0 flex-col items-center gap-2 lg:flex-row lg:items-center lg:gap-0">
      {/* No name (anonymous import, or the session still loading): no
          greeting, but the story below keeps its delayed reveal. */}
      {firstName && (
        <motion.p
          className="shrink-0 text-center text-xl leading-snug sm:text-2xl lg:text-left"
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <span className="text-muted-foreground">{before}</span>
          <MarkedName name={firstName} />
          {after && <span className="text-muted-foreground">{after}</span>}
        </motion.p>
      )}

      {isStoryReady && children && (
        // Hidden (display) until a story line actually renders inside it, so a
        // day with no story never shows a thread leading to nothing; then
        // invisible and unclickable until the reveal timer fires.
        <motion.div
          className={`hidden max-w-full min-w-0 items-center has-[[data-story-line]]:flex ${isRevealed ? "" : "pointer-events-none"}`}
          aria-hidden={isRevealed ? undefined : true}
          initial={false}
          animate={{ opacity: isRevealed ? 1 : 0 }}
          transition={{ duration: 0.8 }}
        >
          {/* The thread: picks up where the underline ends, a knot, then a
              line that grows across into the story. Only with a greeting to
              hang from. */}
          <div
            aria-hidden
            className={`mx-4 hidden w-12 shrink-0 items-center self-center xl:w-16 ${firstName ? "lg:flex" : ""}`}
          >
            <motion.span
              className="bg-primary h-2 w-2 shrink-0 rounded-full"
              initial={false}
              animate={{ scale: isRevealed ? 1 : 0 }}
              transition={{
                delay: 0.1,
                type: "spring",
                stiffness: 400,
                damping: 18,
              }}
            />
            <motion.span
              className="from-primary/60 to-primary/10 h-px flex-1 origin-left bg-gradient-to-r"
              initial={false}
              animate={{ scaleX: isRevealed ? 1 : 0 }}
              transition={{ delay: 0.15, duration: 0.45, ease: "easeOut" }}
            />
          </div>
          {/* No width cap: the line uses whatever the row has spare and only
              truncates when it truly runs out. */}
          <motion.div
            className="max-w-full min-w-0"
            initial={false}
            animate={{ x: isRevealed || prefersReducedMotion ? 0 : -8 }}
            transition={{ delay: 0.4, duration: 0.5, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

// A loose, slightly uphill marker stroke under the name, drawn left to right
// once the greeting has landed.
function MarkedName({ name }) {
  // Set after mount for the same reason as the story's reveal: the page's
  // AnimatePresence would otherwise skip the stroke straight to drawn.
  const [isDrawn, setIsDrawn] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setIsDrawn(true), 0);
    return () => clearTimeout(timer);
  }, []);

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
          initial={false}
          animate={{ pathLength: isDrawn ? 1 : 0 }}
          transition={{ delay: 0.45, duration: 0.7, ease: [0.65, 0, 0.35, 1] }}
        />
      </svg>
    </span>
  );
}
