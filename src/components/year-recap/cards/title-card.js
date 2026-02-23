
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

const wordVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 200,
      damping: 22,
      delay: 0.4 + i * 0.12,
    },
  }),
};

const yearVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 180,
      damping: 16,
      delay: 0.75,
    },
  },
};

const ICON_BG_COLORS = [
  "bg-chart-1/20 ring-1 ring-chart-1/50",
  "bg-chart-2/20 ring-1 ring-chart-2/50",
  "bg-chart-3/20 ring-1 ring-chart-3/50",
  "bg-chart-4/20 ring-1 ring-chart-4/50",
];

// Animated corner icon that displays a lift SVG image in a colored rounded box.
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
      <motion.div
        initial={{ scale: 0.92 }}
        animate={isActive ? { scale: 1 } : { scale: 0.92 }}
        transition={{
          type: "spring",
          stiffness: 140,
          damping: 14,
          delay: isActive ? 0.35 + index * 0.05 : 0,
        }}
      >
        <img
          src={LIFT_SVG_MAP[liftType]}
          alt=""
          aria-hidden
          className="h-24 w-24 [filter:opacity(0.9)] md:h-28 md:w-28"
        />
      </motion.div>
    </motion.div>
  );
}

/**
 * Opening recap slide displaying the "Strength Unwrapped" title and recap year, flanked by four animated lift icons.
 * Each lift icon springs in from its corner when the slide becomes active.
 * @param {Object} props
 * @param {number|string} props.year - The recap year shown in large type below the title.
 * @param {boolean} props.isDemo - Whether the card is being shown in demo mode.
 * @param {boolean} [props.isActive] - Controls entrance animations; should be true only when this carousel slide is visible.
 */
export function TitleCard({ year, isDemo, isActive = true }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <div className="mb-8 flex justify-center gap-10 md:gap-14">
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
      <h2 className="text-3xl leading-tight font-bold tracking-tight [filter:drop-shadow(0_1px_2px_rgba(0,0,0,0.06))] md:text-5xl">
        <span className="block">
          <motion.span
            variants={wordVariants}
            initial="hidden"
            animate={isActive ? "visible" : "hidden"}
            custom={0}
            className="block"
          >
            Strength
          </motion.span>
          <motion.span
            variants={wordVariants}
            initial="hidden"
            animate={isActive ? "visible" : "hidden"}
            custom={1}
            className="block"
          >
            Unwrapped
          </motion.span>
          <motion.span
            variants={yearVariants}
            initial="hidden"
            animate={isActive ? "visible" : "hidden"}
            className="text-chart-4 mt-1 block text-4xl font-extrabold tracking-tight drop-shadow-sm md:text-7xl"
          >
            {year}
          </motion.span>
        </span>
      </h2>
      <div className="mt-8 flex justify-center gap-10 md:gap-14">
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
    </div>
  );
}
