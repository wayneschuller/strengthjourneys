"use client";

import { motion } from "motion/react";
import { LIFT_SVG_MAP } from "../lift-svg";

const TOP_LIFTS = ["Back Squat", "Bench Press"];
const BOTTOM_LIFTS = ["Deadlift", "Strict Press"];

// Corners: top-left, top-right, bottom-left, bottom-right
const CORNER_OFFSET = 64;
const cornerVariants = {
  hidden: (i) => {
    const corners = [
      { x: -CORNER_OFFSET, y: -CORNER_OFFSET },
      { x: CORNER_OFFSET, y: -CORNER_OFFSET },
      { x: -CORNER_OFFSET, y: CORNER_OFFSET },
      { x: CORNER_OFFSET, y: CORNER_OFFSET },
    ];
    const c = corners[i];
    return { x: c.x, y: c.y, opacity: 0, scale: 0.6 };
  },
  visible: (i) => ({
    x: 0,
    y: 0,
    opacity: 0.7,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 220,
      damping: 20,
      delay: i * 0.08,
    },
  }),
};

const ICON_BG_COLORS = [
  "bg-chart-1/20 ring-1 ring-chart-1/50",
  "bg-chart-2/20 ring-1 ring-chart-2/50",
  "bg-chart-3/20 ring-1 ring-chart-3/50",
  "bg-chart-4/20 ring-1 ring-chart-4/50",
];

function CornerIcon({ liftType, index, isActive, variants }) {
  return (
    <motion.div
      key={liftType}
      initial="hidden"
      animate={isActive ? "visible" : "hidden"}
      variants={variants}
      custom={index}
      className={`flex items-center justify-center rounded-lg p-2 ${ICON_BG_COLORS[index]}`}
    >
      <img
        src={LIFT_SVG_MAP[liftType]}
        alt=""
        aria-hidden
        className="h-24 w-24 md:h-28 md:w-28 [filter:opacity(0.9)]"
      />
    </motion.div>
  );
}

export function TitleCard({ year, isDemo, isActive = true }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <div className="mb-4 flex justify-center gap-10 md:gap-14">
        {TOP_LIFTS.map((liftType, i) => (
          <CornerIcon
            key={liftType}
            liftType={liftType}
            index={i}
            isActive={isActive}
            variants={cornerVariants}
          />
        ))}
      </div>
      <motion.h2
        className="text-3xl font-bold tracking-tight md:text-5xl"
        initial={{ opacity: 0, y: 24 }}
        animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
        transition={{ type: "spring", stiffness: 180, damping: 20, delay: isActive ? 0.4 : 0 }}
      >
        Strength Unwrapped {year}
      </motion.h2>
      <div className="mt-4 flex justify-center gap-10 md:gap-14">
        {BOTTOM_LIFTS.map((liftType, i) => (
          <CornerIcon
            key={liftType}
            liftType={liftType}
            index={i + 2}
            isActive={isActive}
            variants={cornerVariants}
          />
        ))}
      </div>
      {isDemo && (
        <motion.p
          className="mt-4 text-sm text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={isActive ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: isActive ? 0.7 : 0 }}
        >
          Demo mode
        </motion.p>
      )}
    </div>
  );
}
