/** @format */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

// -----------------------------------------------------------------------------
// Starry Night – Single giant swirl canvas with gentle drift
// -----------------------------------------------------------------------------

const SWIRL_IMAGE_HREF = "/swirls-medium.png";
const NARROW_VIEWPORT_MAX_WIDTH = 1300;

/**
 * Full-bleed background layer that displays the starry night swirl image.
 * When `animated` is true, the image gently orbits in a clockwise loop using Framer Motion.
 *
 * @param {Object} props
 * @param {string} [props.className] - Additional CSS classes applied to the outer wrapper.
 * @param {boolean} [props.animated=false] - When true, enables the slow orbital drift animation.
 */
export function StarryNightLayer({ className, animated = false }) {
  const [narrowViewport, setNarrowViewport] = useState(true);

  useEffect(() => {
    const check = () =>
      setNarrowViewport(window.innerWidth < NARROW_VIEWPORT_MAX_WIDTH);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const baseClassName = cn("relative h-full w-full overflow-hidden", className);
  const imageLayerClassName =
    "pointer-events-none absolute inset-0 select-none opacity-[0.03] dark:opacity-[0.055]";

  if (!animated) {
    return (
      <div className={baseClassName} aria-hidden>
        <div
          className={imageLayerClassName}
          style={{
            backgroundImage: `url(${SWIRL_IMAGE_HREF})`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "50% 50%",
            backgroundSize: "cover",
          }}
        />
      </div>
    );
  }

  // On narrow viewports (e.g. mobile), use cover so the layer fills the screen
  // vertically. On wide viewports use the larger size for the orbit animation.
  const backgroundSize = narrowViewport ? "cover" : "111.12% auto";

  return (
    <div className={baseClassName} aria-hidden>
      <motion.div
        className={imageLayerClassName}
        initial={{ backgroundPosition: "50% 50%" }}
        animate={{
          // Show about 90% of the image and orbit clockwise over hidden edges.
          backgroundPosition: [
            "50% 41%",
            "59% 50%",
            "50% 59%",
            "41% 50%",
            "50% 41%",
          ],
        }}
        transition={{
          duration: 40,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{
          backgroundImage: `url(${SWIRL_IMAGE_HREF})`,
          backgroundRepeat: "no-repeat",
          backgroundSize,
        }}
      />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Warp – Retro-arcade 3D warp grid with animated beams
// -----------------------------------------------------------------------------

// Internal animated beam strip used by WarpBackground to simulate warp-speed light streaks.
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

/**
 * Retro-arcade 3D warp-grid background that wraps any content with animated light beams shooting from all four sides.
 * Uses CSS 3D perspective transforms and Framer Motion to create a sci-fi tunnel effect.
 *
 * @param {Object} props
 * @param {React.ReactNode} [props.children] - Content rendered on top of the warp grid.
 * @param {number} [props.perspective=100] - CSS perspective depth in pixels.
 * @param {string} [props.className] - Additional CSS classes for the outer wrapper.
 * @param {number} [props.beamsPerSide=3] - Number of animated beams emitted per side of the grid.
 * @param {number} [props.beamSize=5] - Width of each beam as a percentage of the container.
 * @param {number} [props.beamDelayMax=3] - Maximum random delay (seconds) before a beam starts.
 * @param {number} [props.beamDelayMin=0] - Minimum random delay (seconds) before a beam starts.
 * @param {number} [props.beamDuration=3] - Duration in seconds for each beam traversal.
 * @param {string} [props.gridColor="var(--border)"] - CSS color value used for the grid lines.
 */
export const WarpBackground = ({
  children,
  perspective = 100,
  className,
  beamsPerSide = 3,
  showBeams = true,
  beamSize = 5,
  beamDelayMax = 3,
  beamDelayMin = 0,
  beamDuration = 3,
  gridColor = "var(--border)",
  ...props
}) => {
  const generateBeams = useCallback(() => {
    if (!showBeams || beamsPerSide <= 0) return [];
    const beams = [];
    const cellsPerSide = Math.floor(100 / beamSize);
    const step = cellsPerSide / beamsPerSide;

    for (let i = 0; i < beamsPerSide; i++) {
      const x = Math.floor(i * step);
      const delay =
        Math.random() * (beamDelayMax - beamDelayMin) + beamDelayMin;
      beams.push({ x, delay });
    }
    return beams;
  }, [showBeams, beamsPerSide, beamSize, beamDelayMax, beamDelayMin]);

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
        <div className="[container-type:inline-size] absolute z-20 [height:100cqmax] [width:100cqi] [transform-origin:50%_0%] [transform:rotateX(-90deg)] [background-size:var(--beam-size)_var(--beam-size)] [background:linear-gradient(var(--grid-color)_0_1px,_transparent_1px_var(--beam-size))_50%_-0.5px_/var(--beam-size)_var(--beam-size),linear-gradient(90deg,_var(--grid-color)_0_1px,_transparent_1px_var(--beam-size))_50%_50%_/var(--beam-size)_var(--beam-size)] [transform-style:preserve-3d]">
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
        <div className="[container-type:inline-size] absolute top-full [height:100cqmax] [width:100cqi] [transform-origin:50%_0%] [transform:rotateX(-90deg)] [background-size:var(--beam-size)_var(--beam-size)] [background:linear-gradient(var(--grid-color)_0_1px,_transparent_1px_var(--beam-size))_50%_-0.5px_/var(--beam-size)_var(--beam-size),linear-gradient(90deg,_var(--grid-color)_0_1px,_transparent_1px_var(--beam-size))_50%_50%_/var(--beam-size)_var(--beam-size)] [transform-style:preserve-3d]">
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
        <div className="[container-type:inline-size] absolute top-0 left-0 [height:100cqmax] [width:100cqh] [transform-origin:0%_0%] [transform:rotate(90deg)_rotateX(-90deg)] [background-size:var(--beam-size)_var(--beam-size)] [background:linear-gradient(var(--grid-color)_0_1px,_transparent_1px_var(--beam-size))_50%_-0.5px_/var(--beam-size)_var(--beam-size),linear-gradient(90deg,_var(--grid-color)_0_1px,_transparent_1px_var(--beam-size))_50%_50%_/var(--beam-size)_var(--beam-size)] [transform-style:preserve-3d]">
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
        <div className="[container-type:inline-size] absolute top-0 right-0 [height:100cqmax] [width:100cqh] [transform-origin:100%_0%] [transform:rotate(-90deg)_rotateX(-90deg)] [background-size:var(--beam-size)_var(--beam-size)] [background:linear-gradient(var(--grid-color)_0_1px,_transparent_1px_var(--beam-size))_50%_-0.5px_/var(--beam-size)_var(--beam-size),linear-gradient(90deg,_var(--grid-color)_0_1px,_transparent_1px_var(--beam-size))_50%_50%_/var(--beam-size)_var(--beam-size)] [transform-style:preserve-3d]">
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

// -----------------------------------------------------------------------------
// Neo Brutalism – Sticker bomb background (deterministic SVG)
// -----------------------------------------------------------------------------

const STICKER_TEXT_STYLE = {
  fontFamily: "var(--font-mono)",
  fontWeight: 700,
  letterSpacing: "0.02em",
};

function FloatingGroup({ enabled, children, animate, transition }) {
  if (!enabled) return <g>{children}</g>;

  return (
    <motion.g
      style={{ transformBox: "fill-box", transformOrigin: "center" }}
      animate={animate}
      transition={transition}
    >
      {children}
    </motion.g>
  );
}

function Sticker({
  x,
  y,
  w,
  h,
  r = 0,
  fill,
  stroke,
  shadowFill,
  shadowDx = 10,
  shadowDy = 10,
  radius = 18,
  children,
}) {
  const transform = r ? `rotate(${r} ${x + w / 2} ${y + h / 2})` : undefined;

  return (
    <g transform={transform}>
      <rect
        x={x + shadowDx}
        y={y + shadowDy}
        width={w}
        height={h}
        rx={radius}
        ry={radius}
        fill={shadowFill}
        opacity="0.85"
      />
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={radius}
        ry={radius}
        fill={fill}
        stroke={stroke}
        strokeWidth="6"
      />
      {children}
    </g>
  );
}

function Barcode({ x, y, w, h, color }) {
  // Deterministic (no randomness) barcode-ish stripes.
  const stripes = [6, 3, 2, 6, 2, 4, 3, 2, 7, 3, 2, 5, 2, 3, 6, 2, 4, 3, 2, 6];

  const total = stripes.reduce((sum, n) => sum + n, 0);
  const scale = w / total;
  let cursor = 0;

  return (
    <g>
      {stripes.map((n, i) => {
        const stripeW = n * scale;
        const rect = (
          <rect
            key={i}
            x={x + cursor}
            y={y}
            width={Math.max(1, stripeW * (i % 2 === 0 ? 0.65 : 0.35))}
            height={h}
            fill={color}
            opacity={i % 3 === 0 ? 0.95 : 0.75}
          />
        );
        cursor += stripeW;
        return rect;
      })}
    </g>
  );
}

/**
 * Full-bleed neo-brutalist sticker bomb layer.
 * Deterministic SVG so it renders consistently.
 *
 * @param {Object} props
 * @param {string} [props.className]
 * @param {boolean} [props.animated=false] - Subtle drift on a couple stickers.
 * @param {"light"|"dark"} [props.variant="light"]
 */
export function NeoBrutalistStickerBombLayer({
  className,
  animated = false,
  variant = "light",
}) {
  const shouldReduceMotion = useReducedMotion();
  const enableAnimation = animated && !shouldReduceMotion;
  const isDark = variant === "dark";

  const stroke = isDark ? "hsl(0 0% 100%)" : "hsl(0 0% 0%)";
  const shadowFill = isDark ? "hsl(0 0% 100% / 0.22)" : "hsl(0 0% 0%)";

  // A touch quieter on dark so content stays crisp.
  const baseOpacity = isDark ? 0.16 : 0.22;

  const Svg = enableAnimation ? motion.svg : "svg";
  const motionProps = enableAnimation
    ? {
        initial: { opacity: 0 },
        animate: { opacity: baseOpacity },
        transition: { duration: 0.5, ease: "easeOut" },
      }
    : { style: { opacity: baseOpacity } };

  const Wrapper = enableAnimation ? motion.div : "div";
  const wrapperProps = enableAnimation
    ? {
        animate: { x: [0, 6, 0], y: [0, -4, 0], rotate: [0, 0.35, 0] },
        transition: { duration: 28, repeat: Infinity, ease: "easeInOut" },
      }
    : {};

  return (
    <div
      className={cn("absolute inset-0 overflow-hidden", className)}
      aria-hidden
    >
      <Wrapper
        {...wrapperProps}
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        <Svg
          {...motionProps}
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 1600 900"
          preserveAspectRatio="xMidYMid slice"
        >
          {/* Atmospheric paper wash */}
          <defs>
            <radialGradient id="nb-wash" cx="30%" cy="22%" r="80%">
              <stop
                offset="0%"
                stopColor={
                  isDark ? "hsl(0 0% 100% / 0.08)" : "hsl(0 100% 60% / 0.10)"
                }
              />
              <stop offset="55%" stopColor="transparent" />
              <stop
                offset="100%"
                stopColor={
                  isDark
                    ? "hsl(60 100% 60% / 0.06)"
                    : "hsl(216 100% 50% / 0.08)"
                }
              />
            </radialGradient>
          </defs>
          <rect x="0" y="0" width="1600" height="900" fill="url(#nb-wash)" />

          {/* Desktop-first composition: hero stickers on the sides; center stays mostly clean. */}

          {/* Left hero sticker */}
          <FloatingGroup
            enabled={enableAnimation}
            animate={{ x: [0, 12, 0], y: [0, -18, 0], rotate: [0, -1.2, 0] }}
            transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
          >
            <Sticker
              x={40}
              y={120}
              w={200}
              h={640}
              r={-2}
              fill={isDark ? "hsl(0 0% 8%)" : "hsl(0 0% 100%)"}
              stroke={stroke}
              shadowFill={shadowFill}
              shadowDx={14}
              shadowDy={14}
              radius={22}
            >
              <text
                x={145}
                y={440}
                fill={stroke}
                fontSize="48"
                style={STICKER_TEXT_STYLE}
                transform="rotate(-90 145 440)"
              >
                ONE REP
              </text>
              <text
                x={185}
                y={440}
                fill={stroke}
                fontSize="48"
                style={STICKER_TEXT_STYLE}
                transform="rotate(-90 185 440)"
              >
                MAX
              </text>
              <text
                x={62}
                y={165}
                fill={stroke}
                fontSize="16"
                opacity="0.78"
                style={{ ...STICKER_TEXT_STYLE, fontWeight: 600 }}
              >
                E1RM / RPE / PR
              </text>
              <Barcode x={60} y={720} w={160} h={32} color={stroke} />
            </Sticker>
          </FloatingGroup>

          {/* Right hero sticker */}
          <FloatingGroup
            enabled={enableAnimation}
            animate={{ x: [0, -12, 0], y: [0, 14, 0], rotate: [0, 1.3, 0] }}
            transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
          >
            <Sticker
              x={1360}
              y={120}
              w={200}
              h={640}
              r={3}
              fill={"var(--secondary)"}
              stroke={stroke}
              shadowFill={shadowFill}
              shadowDx={14}
              shadowDy={14}
              radius={22}
            >
              <text
                x={1460}
                y={440}
                fill={isDark ? "hsl(0 0% 0%)" : "hsl(0 0% 0%)"}
                fontSize="44"
                style={STICKER_TEXT_STYLE}
                transform="rotate(90 1460 440)"
              >
                NO EXCUSES
              </text>
              <text
                x={1378}
                y={165}
                fill={isDark ? "hsl(0 0% 0%)" : "hsl(0 0% 0%)"}
                fontSize="16"
                opacity="0.85"
                style={{ ...STICKER_TEXT_STYLE, fontWeight: 700 }}
              >
                TRACK THE WORK
              </text>
              <Barcode
                x={1380}
                y={720}
                w={170}
                h={32}
                color={isDark ? "hsl(0 0% 0%)" : "hsl(0 0% 0%)"}
              />
            </Sticker>
          </FloatingGroup>

          {/* Center: only a couple stickers */}
          <FloatingGroup
            enabled={enableAnimation}
            animate={{ x: [0, 10, 0], y: [0, 8, 0], rotate: [0, 0.9, 0] }}
            transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          >
            <Sticker
              x={610}
              y={140}
              w={380}
              h={140}
              r={-6}
              fill={isDark ? "hsl(0 0% 10%)" : "hsl(0 0% 100%)"}
              stroke={stroke}
              shadowFill={shadowFill}
              shadowDx={12}
              shadowDy={12}
            >
              <text
                x={640}
                y={225}
                fill={stroke}
                fontSize="46"
                style={STICKER_TEXT_STYLE}
              >
                HEAVY
              </text>
              <text
                x={640}
                y={260}
                fill={stroke}
                fontSize="18"
                opacity="0.78"
                style={{ ...STICKER_TEXT_STYLE, fontWeight: 600 }}
              >
                LOG IT
              </text>
            </Sticker>
          </FloatingGroup>

          <FloatingGroup
            enabled={enableAnimation}
            animate={{ x: [0, -8, 0], y: [0, -10, 0], rotate: [0, -2.2, 0] }}
            transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          >
            <Sticker
              x={700}
              y={625}
              w={200}
              h={100}
              r={8}
              fill={"var(--primary)"}
              stroke={stroke}
              shadowFill={shadowFill}
              shadowDx={12}
              shadowDy={12}
              radius={999}
            >
              <text
                x={760}
                y={690}
                fill={"var(--primary-foreground)"}
                fontSize="38"
                style={STICKER_TEXT_STYLE}
              >
                PR
              </text>
            </Sticker>
          </FloatingGroup>

          {/* Micro speckle dots (cheap grit) */}
          <g opacity={isDark ? 0.24 : 0.22}>
            <circle cx="820" cy="330" r="2" fill={stroke} />
            <circle cx="870" cy="350" r="1.5" fill={stroke} />
            <circle cx="790" cy="370" r="1" fill={stroke} />
            <circle cx="840" cy="395" r="1.6" fill={stroke} />
            <circle cx="880" cy="410" r="1.2" fill={stroke} />
            <circle cx="815" cy="420" r="1" fill={stroke} />
            <circle cx="855" cy="435" r="1.8" fill={stroke} />
            <circle cx="895" cy="450" r="1.3" fill={stroke} />
          </g>
        </Svg>
      </Wrapper>
    </div>
  );
}
