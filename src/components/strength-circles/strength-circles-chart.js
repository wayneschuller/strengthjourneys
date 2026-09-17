/**
 * StrengthCirclesChart
 *
 * Concentric ring chart visualizing strength percentiles across four universes.
 * Rings are pure SVG; center label is an HTML overlay (enables text wrapping +
 * proper font rendering). Animated via motion/react. Geometry fills the viewBox
 * without clipping: outer radius + half stroke (+ active boost) stays inside.
 */

import { motion, AnimatePresence } from "motion/react";

import { CountUp, formatCountUpInteger } from "@/components/count-up";

// Ring definitions — outer → inner.
// strokeWidth increases slightly inward so inner rings don't feel secondary.
// "ofLabel" is used in the center text: "Stronger than X% of the General Population"
const RING_CONFIG = [
  {
    universe: "General Population",
    label:    "Gen. Pop.",
    ofLabel:  "of the General Population",
    radius:   162,
    strokeWidth: 21,
    color: "var(--chart-1)",
  },
  {
    universe: "Gym-Goers",
    label:    "Gym-Goers",
    ofLabel:  "of Gym-Goers",
    radius:   136,
    strokeWidth: 22,
    color: "var(--chart-2)",
  },
  {
    universe: "Barbell Lifters",
    label:    "Barbell",
    ofLabel:  "of Barbell Lifters",
    radius:   110,
    strokeWidth: 23,
    color: "var(--chart-3)",
  },
  {
    universe: "Powerlifting Culture",
    label:    "Powerlifting",
    ofLabel:  "of Powerlifting Culture",
    radius:   84,
    strokeWidth: 24,
    color: "var(--chart-4)",
  },
];

const VIEWBOX_SIZE = 360;
const CENTER = VIEWBOX_SIZE / 2; // 180

// Outer edge when active ≈ 162 + (21+3)/2 = 174 — a few units of viewBox padding.
// Inner clear radius ≈ 84 − 12 = 72 → room for the CountUp center label.

function percentileToOffset(percentile, radius) {
  const circumference = 2 * Math.PI * radius;
  return circumference * (1 - (percentile ?? 0) / 100);
}

// ─── Single ring ──────────────────────────────────────────────────────────────

function Ring({ config, percentile, isActive, onClick, onHoverChange }) {
  const { radius, strokeWidth, color } = config;
  const circumference = 2 * Math.PI * radius;
  const offset = percentileToOffset(percentile, radius);

  return (
    <g
      onClick={onClick}
      onMouseEnter={() => onHoverChange(config.universe)}
      onMouseLeave={() => onHoverChange(null)}
      style={{ cursor: "pointer" }}
      role="button"
      aria-label={`${config.universe}: ${percentile ?? 0}th percentile`}
    >
      {/* Background track — always full circle, base stroke width */}
      <circle
        cx={CENTER}
        cy={CENTER}
        r={radius}
        fill="none"
        style={{ stroke: "var(--muted-foreground)", opacity: 0.15 }}
        strokeWidth={strokeWidth}
      />

      {/* Filled arc — <g> rotates −90° so motion doesn't intercept the transform */}
      <g transform={`rotate(-90, ${CENTER}, ${CENTER})`}>
        <motion.circle
          cx={CENTER}
          cy={CENTER}
          r={radius}
          fill="none"
          style={{ stroke: color }}
          strokeLinecap="round"
          strokeDasharray={circumference}
          animate={{
            strokeDashoffset: offset,
            opacity:     isActive ? 1    : 0.45,
            strokeWidth: isActive ? strokeWidth + 3 : strokeWidth,
          }}
          initial={{
            strokeDashoffset: circumference,
            opacity:     isActive ? 1    : 0.45,
            strokeWidth: isActive ? strokeWidth + 3 : strokeWidth,
          }}
          transition={{
            strokeDashoffset: { duration: 0.55, ease: "easeOut" },
            opacity:          { duration: 0.25 },
            strokeWidth:      { duration: 0.25 },
          }}
        />
      </g>
    </g>
  );
}

// ─── Center label (HTML overlay) ─────────────────────────────────────────────
// Absolutely positioned over the SVG so text wraps naturally and inherits page font.
// max-w-[40%] keeps the big percentage inside the inner ring's clear area.

function CenterLabel({ activeUniverse, percentiles }) {
  const config = RING_CONFIG.find((r) => r.universe === activeUniverse);
  const percentile = percentiles?.[activeUniverse] ?? null;
  const hasData = percentile !== null && percentile !== undefined;

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <AnimatePresence mode="wait">
        <motion.div
          key={`${activeUniverse}-${String(hasData)}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="flex max-w-[40%] flex-col items-center text-center"
        >
          {hasData ? (
            <>
              <span className="text-xs font-medium tracking-wide text-muted-foreground">
                Stronger than
              </span>
              <span className="mt-0.5 flex items-baseline justify-center leading-none tracking-tighter text-foreground">
                <CountUp
                  value={percentile}
                  format={formatCountUpInteger}
                  duration={0.85}
                  className="text-5xl font-extrabold tabular-nums sm:text-6xl"
                />
                <span className="text-2xl font-bold tabular-nums sm:text-3xl">
                  %
                </span>
              </span>
              <span
                className="mt-1 text-xs font-semibold leading-snug sm:text-[13px]"
                style={{ color: config?.color }}
              >
                {config?.ofLabel ?? activeUniverse}
              </span>
            </>
          ) : (
            <>
              <span className="text-xs text-muted-foreground">Enter a lift</span>
              <span className="text-xs text-muted-foreground">to see results</span>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend({
  percentiles,
  activeUniverse,
  onUniverseChange,
  onUniverseHoverChange,
}) {
  return (
    <div className="mt-1 flex flex-col gap-0.5">
      {RING_CONFIG.map((config) => {
        const percentile = percentiles?.[config.universe];
        const isActive   = config.universe === activeUniverse;

        return (
          <button
            key={config.universe}
            onClick={() => onUniverseChange(config.universe)}
            onMouseEnter={() => onUniverseHoverChange(config.universe)}
            onMouseLeave={() => onUniverseHoverChange(null)}
            className={`flex items-center justify-between rounded-md px-3 py-1.5 text-sm transition-all ${
              isActive
                ? "bg-muted font-semibold"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
                style={{ backgroundColor: config.color }}
              />
              <span>{config.universe}</span>
            </div>
            <span className="tabular-nums">
              {percentile !== null && percentile !== undefined
                ? `${percentile}th`
                : "—"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function StrengthCirclesChart({
  percentiles,
  activeUniverse,
  onUniverseChange,
  onUniverseHoverChange = () => {},
  showLegend = true,
  showTrustLine = true,
}) {
  return (
    <div className="flex flex-col">
      {/* Rings SVG + HTML center overlay */}
      <div className="relative">
        <svg
          viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
          className="w-full"
          aria-label="Strength percentile rings"
          role="img"
        >
          {RING_CONFIG.map((config) => (
            <Ring
              key={config.universe}
              config={config}
              percentile={percentiles?.[config.universe] ?? 0}
              isActive={config.universe === activeUniverse}
              onClick={() => onUniverseChange(config.universe)}
              onHoverChange={onUniverseHoverChange}
            />
          ))}
        </svg>

        <CenterLabel activeUniverse={activeUniverse} percentiles={percentiles} />
      </div>

      {/* Legend — tight mt-1 so it feels attached to the chart */}
      {showLegend && (
        <Legend
          percentiles={percentiles}
          activeUniverse={activeUniverse}
          onUniverseChange={onUniverseChange}
          onUniverseHoverChange={onUniverseHoverChange}
        />
      )}

      {showTrustLine && (
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          As the groups become more specialised, the comparison becomes tougher.
        </p>
      )}
    </div>
  );
}
