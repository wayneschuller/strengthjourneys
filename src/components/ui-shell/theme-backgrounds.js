/**
 * Theme-specific decorative backgrounds used by the global application shell.
 * Keep these layers deterministic and non-interactive so they remain safe
 * behind every page and do not compete with application content.
 *
 * @format
 */

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
// Neo Brutalism – Training-log editorial background (deterministic SVG)
// -----------------------------------------------------------------------------

const BRUTALIST_TEXT_STYLE = {
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

/**
 * Full-bleed neo-brutalist training-log layer. The composition keeps its
 * strongest marks around the viewport edges so dense pages remain readable.
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

  // The background should add texture without showing through cards as copy.
  const baseOpacity = isDark ? 0.14 : 0.18;

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
        animate: { x: [0, 4, 0], y: [0, -3, 0] },
        transition: { duration: 32, repeat: Infinity, ease: "easeInOut" },
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
            <pattern
              id="nb-grid"
              width="48"
              height="48"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 48 0 L 0 0 0 48"
                fill="none"
                stroke={stroke}
                strokeWidth="1"
              />
            </pattern>
            <pattern
              id="nb-hatch"
              width="16"
              height="16"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="16"
                stroke={stroke}
                strokeWidth="5"
              />
            </pattern>
          </defs>
          <rect x="0" y="0" width="1600" height="900" fill="url(#nb-wash)" />
          <rect
            x="0"
            y="0"
            width="1600"
            height="900"
            fill="url(#nb-grid)"
            opacity={isDark ? 0.14 : 0.1}
          />

          {/* Cropped calibrated plate: bold at the edge, quiet through the center. */}
          <FloatingGroup
            enabled={enableAnimation}
            animate={{ rotate: [0, -1.5, 0], x: [0, 8, 0] }}
            transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
          >
            <circle cx="-20" cy="655" r="242" fill={shadowFill} />
            <circle
              cx="-34"
              cy="641"
              r="242"
              fill="var(--primary)"
              stroke={stroke}
              strokeWidth="8"
            />
            <circle
              cx="-34"
              cy="641"
              r="126"
              fill="none"
              stroke={stroke}
              strokeWidth="7"
            />
            <circle
              cx="-34"
              cy="641"
              r="46"
              fill={isDark ? "hsl(0 0% 8%)" : "hsl(0 0% 100%)"}
              stroke={stroke}
              strokeWidth="7"
            />
            <text
              x="72"
              y="538"
              fill="var(--primary-foreground)"
              fontSize="58"
              style={BRUTALIST_TEXT_STYLE}
              transform="rotate(18 72 538)"
            >
              20
            </text>
            <text
              x="100"
              y="588"
              fill="var(--primary-foreground)"
              fontSize="20"
              style={BRUTALIST_TEXT_STYLE}
              transform="rotate(18 100 588)"
            >
              KG
            </text>
          </FloatingGroup>

          {/* A compact log card replaces the old motivational-poster copy. */}
          <FloatingGroup
            enabled={enableAnimation}
            animate={{ x: [0, 10, 0], y: [0, -7, 0], rotate: [0, -0.8, 0] }}
            transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
          >
            <g transform="rotate(-5 190 160)">
              <rect x="38" y="70" width="382" height="182" fill={shadowFill} />
              <rect
                x="26"
                y="58"
                width="382"
                height="182"
                fill={isDark ? "hsl(0 0% 8%)" : "hsl(0 0% 100%)"}
                stroke={stroke}
                strokeWidth="6"
              />
              <rect
                x="26"
                y="58"
                width="382"
                height="38"
                fill={stroke}
              />
              <text
                x="44"
                y="84"
                fill={isDark ? "hsl(0 0% 0%)" : "hsl(0 0% 100%)"}
                fontSize="16"
                style={BRUTALIST_TEXT_STYLE}
              >
                SESSION / 042
              </text>
              <text
                x="44"
                y="151"
                fill={stroke}
                fontSize="44"
                style={BRUTALIST_TEXT_STYLE}
              >
                167.5 KG
              </text>
              <line x1="44" y1="172" x2="388" y2="172" stroke={stroke} strokeWidth="3" />
              <text x="44" y="211" fill={stroke} fontSize="18" style={BRUTALIST_TEXT_STYLE}>
                SET 05
              </text>
              <text x="238" y="211" fill={stroke} fontSize="18" style={BRUTALIST_TEXT_STYLE}>
                RPE 8.5
              </text>
            </g>
          </FloatingGroup>

          {/* Right-side blocks use the theme palette without becoming slogans. */}
          <FloatingGroup
            enabled={enableAnimation}
            animate={{ x: [0, -8, 0], y: [0, 10, 0] }}
            transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
          >
            <rect x="1390" y="86" width="260" height="468" fill={shadowFill} />
            <rect
              x="1374"
              y="70"
              width="260"
              height="468"
              fill="var(--secondary)"
              stroke={stroke}
              strokeWidth="7"
            />
            <rect x="1374" y="70" width="260" height="116" fill="url(#nb-hatch)" />
            <text
              x="1503"
              y="280"
              fill="hsl(0 0% 0%)"
              fontSize="92"
              textAnchor="middle"
              style={BRUTALIST_TEXT_STYLE}
            >
              05
            </text>
            <text
              x="1503"
              y="326"
              fill="hsl(0 0% 0%)"
              fontSize="18"
              textAnchor="middle"
              style={BRUTALIST_TEXT_STYLE}
            >
              WORK SETS
            </text>
            <line x1="1402" y1="362" x2="1606" y2="362" stroke="hsl(0 0% 0%)" strokeWidth="5" />
            <text
              x="1503"
              y="422"
              fill="hsl(0 0% 0%)"
              fontSize="26"
              textAnchor="middle"
              style={BRUTALIST_TEXT_STYLE}
            >
              03 / 08
            </text>
          </FloatingGroup>

          {/* Bottom-right registration slab anchors long pages. */}
          <FloatingGroup
            enabled={enableAnimation}
            animate={{ x: [0, -6, 0], rotate: [0, 0.8, 0] }}
            transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          >
            <g transform="rotate(4 1370 770)">
              <rect x="1226" y="690" width="430" height="148" fill={shadowFill} />
              <rect
                x="1212"
                y="676"
                width="430"
                height="148"
                fill="var(--accent)"
                stroke={stroke}
                strokeWidth="7"
              />
              <text
                x="1240"
                y="770"
                fill="var(--accent-foreground)"
                fontSize="68"
                style={BRUTALIST_TEXT_STYLE}
              >
                +2.5
              </text>
              <text
                x="1470"
                y="770"
                fill="var(--accent-foreground)"
                fontSize="20"
                style={BRUTALIST_TEXT_STYLE}
              >
                Δ KG
              </text>
            </g>
          </FloatingGroup>

          {/* Registration marks lend a print/editorial feel without adding copy. */}
          <g stroke={stroke} strokeWidth="4" opacity="0.72">
            <path d="M 480 92 h 48 M 504 68 v 48" />
            <circle cx="504" cy="92" r="12" fill="none" />
            <path d="M 1082 754 h 48 M 1106 730 v 48" />
            <circle cx="1106" cy="754" r="12" fill="none" />
            <path d="M 1030 126 h 150" />
            <path d="M 1030 136 h 92" />
            <path d="M 470 790 h 230" />
            <path d="M 470 800 h 138" />
          </g>
        </Svg>
      </Wrapper>
    </div>
  );
}
