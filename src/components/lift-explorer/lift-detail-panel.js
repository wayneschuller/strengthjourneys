/**
 * Lift-detail panel for Lift Explorer.
 * Mirrors the authenticated layout from /progress-guide/[lift] minus the
 * big-four-only cards (strength standards, strength circles, editorial copy)
 * so any lift the user has logged gets the same set of analytical tools.
 *
 * Switching lifts is a scene change, not a prop update: the whole panel is
 * keyed by lift, the old one blurs out the way it came, and the new one plays
 * in from the stage down, section by section. Direction follows the lifter's
 * move through the lift list so the motion reads as travelling through it.
 */

import { useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";

import { LiftStage } from "@/components/lift-explorer/lift-stage";
import { LiftJourneyCard } from "@/components/visualizer/lift-journey-card";
import { LiftLogCta } from "@/components/lift-explorer/lift-log-cta";
import { LiftTypeRepPRsDisplay } from "@/components/lift-explorer/lift-type-prs-display";
import { StrengthPotentialBarChart } from "@/components/visualizer/strength-potential-bar-chart";
import { MostRecentSessionCard } from "@/components/lift-explorer/most-recent-session-card";
import { VisualizerMini } from "@/components/visualizer/visualizer-mini";
import { TonnageChart } from "@/components/visualizer/visualizer-tonnage";
import { useUserLiftingData } from "@/hooks/use-userlift-data";

/**
 * Detail panel shown when a lift is selected in the lift list.
 * @param {Object} props
 * @param {string|null} props.liftType - The selected lift type to display details for.
 */
export function LiftDetailPanel({ liftType }) {
  const { liftTypes } = useUserLiftingData();

  // Remember the previous lift so the transition knows which way to travel.
  // Adjusting state during render is React's sanctioned way to derive from a
  // changed prop without an effect or a ref read.
  const [transition, setTransition] = useState({ liftType, direction: 1 });
  if (liftType !== transition.liftType) {
    const indexOf = (name) =>
      liftTypes?.findIndex((lift) => lift.liftType === name) ?? -1;
    setTransition({
      liftType,
      direction: indexOf(liftType) >= indexOf(transition.liftType) ? 1 : -1,
    });
  }
  const { direction } = transition;

  if (!liftType) return null;

  return (
    // Honour the OS reduced-motion setting: transforms are dropped and only
    // the fades remain.
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.div
          key={liftType}
          custom={direction}
          variants={panelVariants}
          initial="enter"
          animate="center"
          exit="exit"
          className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 2xl:max-w-[1180px]"
        >
          <Section direction={direction}>
            <LiftStage liftType={liftType} direction={direction} />
          </Section>
          <Section direction={direction}>
            <LiftJourneyCard
              liftType={liftType}
              asCard={false}
              chartDensity="dense"
            />
          </Section>
          <Section direction={direction}>
            <LiftLogCta liftType={liftType} />
          </Section>
          <Section direction={direction}>
            <MostRecentSessionCard
              liftType={liftType}
              defaultVisibleCount={5}
            />
          </Section>
          <Section direction={direction}>
            <VisualizerMini liftType={liftType} />
          </Section>
          <Section direction={direction}>
            <TonnageChart liftType={liftType} />
          </Section>
          <Section direction={direction}>
            <StrengthPotentialBarChart liftType={liftType} />
          </Section>
          <Section direction={direction} id="lift-prs">
            <LiftTypeRepPRsDisplay liftType={liftType} />
          </Section>
        </motion.div>
      </AnimatePresence>
    </MotionConfig>
  );
}

// The panel only orchestrates: it staggers its sections in, and on exit lifts
// the whole scene away in one quick move so the next lift is not kept waiting.
const panelVariants = {
  enter: { opacity: 1 },
  center: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.02 },
  },
  exit: (direction) => ({
    opacity: 0,
    y: -28 * direction,
    scale: 0.985,
    filter: "blur(6px)",
    transition: { duration: 0.2, ease: [0.4, 0, 1, 1] },
  }),
};

// Sections rise with a spring and no blur: several of them hold charts, and
// blurring a chart-sized layer is where a transition starts to stutter.
const sectionVariants = {
  enter: (direction) => ({ opacity: 0, y: 40 * direction }),
  center: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 260, damping: 28 },
  },
};

/**
 * One staggered block in the panel. Wrapping rather than animating the cards
 * themselves keeps every card component unaware of the transition.
 */
function Section({ direction, id, children }) {
  return (
    <motion.div id={id} custom={direction} variants={sectionVariants}>
      {children}
    </motion.div>
  );
}
