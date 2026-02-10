/** @format */

"use client";

import React, { useCallback, useMemo } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

// -----------------------------------------------------------------------------
// Starry Night – Large faint SVG sparkles (Lucide Sparkles), rotated in background
// -----------------------------------------------------------------------------

// Lucide Sparkles paths (24×24 viewBox), centered at 12,12
const SPARKLES_MAIN =
  "M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z";
// Two accent couplets (top-right, bottom-left); each pair shown together or not
const SPARKLES_ACCENT_PAIRS = [
  ["M20 3v4", "M22 5h-4"],
  ["M4 17v2", "M5 18H3"],
];

const STAR_PLACEMENTS = [
  { x: 8, y: 15, scale: 1.15 },
  { x: 92, y: 22, scale: 1.05 },
  { x: 50, y: 28, scale: 1.35 },
  { x: 15, y: 58, scale: 1.1 },
  { x: 85, y: 52, scale: 1.2 },
  { x: 28, y: 88, scale: 1.25 },
  { x: 72, y: 82, scale: 1.05 },
  { x: 50, y: 75, scale: 1.15 },
];

// Deterministic pseudo-random in [0, 1) from index + salt (stable for SSR/hydration)
function seeded(index, salt) {
  const n = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function SparkleGroup({ i, x, y, scale, animated }) {
  const rotate = seeded(i, 1) * 60 - 30; // -30° to 30°
  const showPair0 = seeded(i, 2) > 0.5;
  const showPair1 = seeded(i, 3) > 0.5;
  const accentPairsToShow = [
    showPair0 ? SPARKLES_ACCENT_PAIRS[0] : null,
    showPair1 ? SPARKLES_ACCENT_PAIRS[1] : null,
  ].filter(Boolean);

  const content = (
    <>
      <path d={SPARKLES_MAIN} fill="currentColor" stroke="none" />
      {accentPairsToShow.flat().map((d, j) => (
        <path
          key={j}
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      ))}
    </>
  );

  const baseTransform = `translate(${x}, ${y}) scale(${scale}) translate(-12, -12)`;

  if (!animated) {
    return (
      <g
        transform={`${baseTransform} rotate(${rotate})`}
        opacity="0.09"
      >
        {content}
      </g>
    );
  }

  const rotateDuration = 80 + seeded(i, 6) * 50;
  const floatDuration = 15 + seeded(i, 7) * 12;
  const floatX = (seeded(i, 4) - 0.5) * 2.5;
  const floatY = (seeded(i, 5) - 0.5) * 2.5;
  const delay = seeded(i, 8) * 8;

  return (
    <g transform={baseTransform} opacity="0.09">
      <motion.g
        initial={{ rotate, x: 0, y: 0 }}
        animate={{
          rotate: [rotate, rotate + 360],
          x: [0, floatX, 0],
          y: [0, floatY, 0],
        }}
        transition={{
          rotate: {
            duration: rotateDuration,
            repeat: Infinity,
            ease: "linear",
            delay,
          },
          x: {
            duration: floatDuration,
            repeat: Infinity,
            ease: "easeInOut",
            delay,
          },
          y: {
            duration: floatDuration * 1.1,
            repeat: Infinity,
            ease: "easeInOut",
            delay: delay + seeded(i, 9) * 2,
          },
        }}
      >
        {content}
      </motion.g>
    </g>
  );
}

export function StarryNightLayer({ className, animated = false }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      aria-hidden
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      {STAR_PLACEMENTS.map(({ x, y, scale }, i) => (
        <SparkleGroup
          key={i}
          i={i}
          x={x}
          y={y}
          scale={scale}
          animated={animated}
        />
      ))}
    </svg>
  );
}

// -----------------------------------------------------------------------------
// Warp – Retro-arcade 3D warp grid with animated beams
// -----------------------------------------------------------------------------

const Beam = ({ width, x, delay, duration }) => {
  const hue = Math.floor(Math.random() * 360);
  const ar = Math.floor(Math.random() * 10) + 1;

  return (
    <motion.div
      style={{
        "--x": `${x}`,
        "--width": `${width}`,
        "--aspect-ratio": `${ar}`,
        "--background": `linear-gradient(hsl(${hue} 80% 60%), transparent)`,
      }}
      className="absolute top-0 left-[var(--x)] [aspect-ratio:1/var(--aspect-ratio)] [width:var(--width)] [background:var(--background)]"
      initial={{ y: "100cqmax", x: "-50%" }}
      animate={{ y: "-100%", x: "-50%" }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "linear",
      }}
    />
  );
};

export const WarpBackground = ({
  children,
  perspective = 100,
  className,
  beamsPerSide = 3,
  beamSize = 5,
  beamDelayMax = 3,
  beamDelayMin = 0,
  beamDuration = 3,
  gridColor = "var(--border)",
  ...props
}) => {
  const generateBeams = useCallback(() => {
    const beams = [];
    const cellsPerSide = Math.floor(100 / beamSize);
    const step = cellsPerSide / beamsPerSide;

    for (let i = 0; i < beamsPerSide; i++) {
      const x = Math.floor(i * step);
      const delay = Math.random() * (beamDelayMax - beamDelayMin) + beamDelayMin;
      beams.push({ x, delay });
    }
    return beams;
  }, [beamsPerSide, beamSize, beamDelayMax, beamDelayMin]);

  const topBeams = useMemo(() => generateBeams(), [generateBeams]);
  const rightBeams = useMemo(() => generateBeams(), [generateBeams]);
  const bottomBeams = useMemo(() => generateBeams(), [generateBeams]);
  const leftBeams = useMemo(() => generateBeams(), [generateBeams]);

  return (
    <div className={cn("relative rounded border p-20", className)} {...props}>
      <div
        style={{
          "--perspective": `${perspective}px`,
          "--grid-color": gridColor,
          "--beam-size": `${beamSize}%`,
        }}
        className="[container-type:size] pointer-events-none absolute top-0 left-0 size-full overflow-hidden [clipPath:inset(0)] [perspective:var(--perspective)] [transform-style:preserve-3d]"
      >
        {/* top side */}
        <div
          className="[container-type:inline-size] absolute z-20 [height:100cqmax] [width:100cqi] [transform-origin:50%_0%] [transform:rotateX(-90deg)] [background-size:var(--beam-size)_var(--beam-size)] [background:linear-gradient(var(--grid-color)_0_1px,_transparent_1px_var(--beam-size))_50%_-0.5px_/var(--beam-size)_var(--beam-size),linear-gradient(90deg,_var(--grid-color)_0_1px,_transparent_1px_var(--beam-size))_50%_50%_/var(--beam-size)_var(--beam-size)] [transform-style:preserve-3d]"
        >
          {topBeams.map((beam, index) => (
            <Beam
              key={`top-${index}`}
              width={`${beamSize}%`}
              x={`${beam.x * beamSize}%`}
              delay={beam.delay}
              duration={beamDuration}
            />
          ))}
        </div>
        {/* bottom side */}
        <div
          className="[container-type:inline-size] absolute top-full [height:100cqmax] [width:100cqi] [transform-origin:50%_0%] [transform:rotateX(-90deg)] [background-size:var(--beam-size)_var(--beam-size)] [background:linear-gradient(var(--grid-color)_0_1px,_transparent_1px_var(--beam-size))_50%_-0.5px_/var(--beam-size)_var(--beam-size),linear-gradient(90deg,_var(--grid-color)_0_1px,_transparent_1px_var(--beam-size))_50%_50%_/var(--beam-size)_var(--beam-size)] [transform-style:preserve-3d]"
        >
          {bottomBeams.map((beam, index) => (
            <Beam
              key={`bottom-${index}`}
              width={`${beamSize}%`}
              x={`${beam.x * beamSize}%`}
              delay={beam.delay}
              duration={beamDuration}
            />
          ))}
        </div>
        {/* left side */}
        <div
          className="[container-type:inline-size] absolute top-0 left-0 [height:100cqmax] [width:100cqh] [transform-origin:0%_0%] [transform:rotate(90deg)_rotateX(-90deg)] [background-size:var(--beam-size)_var(--beam-size)] [background:linear-gradient(var(--grid-color)_0_1px,_transparent_1px_var(--beam-size))_50%_-0.5px_/var(--beam-size)_var(--beam-size),linear-gradient(90deg,_var(--grid-color)_0_1px,_transparent_1px_var(--beam-size))_50%_50%_/var(--beam-size)_var(--beam-size)] [transform-style:preserve-3d]"
        >
          {leftBeams.map((beam, index) => (
            <Beam
              key={`left-${index}`}
              width={`${beamSize}%`}
              x={`${beam.x * beamSize}%`}
              delay={beam.delay}
              duration={beamDuration}
            />
          ))}
        </div>
        {/* right side */}
        <div
          className="[container-type:inline-size] absolute top-0 right-0 [height:100cqmax] [width:100cqh] [transform-origin:100%_0%] [transform:rotate(-90deg)_rotateX(-90deg)] [background-size:var(--beam-size)_var(--beam-size)] [background:linear-gradient(var(--grid-color)_0_1px,_transparent_1px_var(--beam-size))_50%_-0.5px_/var(--beam-size)_var(--beam-size),linear-gradient(90deg,_var(--grid-color)_0_1px,_transparent_1px_var(--beam-size))_50%_50%_/var(--beam-size)_var(--beam-size)] [transform-style:preserve-3d]"
        >
          {rightBeams.map((beam, index) => (
            <Beam
              key={`right-${index}`}
              width={`${beamSize}%`}
              x={`${beam.x * beamSize}%`}
              delay={beam.delay}
              duration={beamDuration}
            />
          ))}
        </div>
      </div>
      <div className="relative">{children}</div>
    </div>
  );
};
