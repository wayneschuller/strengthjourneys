/**
 * StrengthCirclesChart
 *
 * Concentric ring chart visualizing strength percentiles across four universes.
 * Pure SVG — no Recharts. Animated via motion/react (stroke-dashoffset).
 *
 * Rings (outer → inner):
 *   General Population → Gym-Goers → Barbell Lifters → Powerlifting Culture
 *
 * Props:
 *   percentiles       { [universe]: number }  0–99 per universe
 *   activeUniverse    string
 *   onUniverseChange  (universe: string) => void
 *   size              number  (SVG viewBox square size, default 320)
 */

import { motion, AnimatePresence } from "motion/react";
import { UNIVERSES } from "@/lib/strength-circles/universe-percentiles";

// ─── Ring layout config ───────────────────────────────────────────────────────

const RING_CONFIG = [
  {
    universe: "General Population",
    label: "Gen. Pop.",
    radius: 130,
    strokeWidth: 16,
    color: "hsl(var(--chart-1))",
  },
  {
    universe: "Gym-Goers",
    label: "Gym-Goers",
    radius: 107,
    strokeWidth: 16,
    color: "hsl(var(--chart-2))",
  },
  {
    universe: "Barbell Lifters",
    label: "Barbell",
    radius: 84,
    strokeWidth: 16,
    color: "hsl(var(--chart-3))",
  },
  {
    universe: "Powerlifting Culture",
    label: "Powerlifting",
    radius: 61,
    strokeWidth: 16,
    color: "hsl(var(--chart-4))",
  },
];

const VIEWBOX_SIZE = 320;
const CENTER = VIEWBOX_SIZE / 2;

// Convert a percentile (0–100) to stroke-dashoffset on a circle of given radius.
// The arc starts at the top (−90° rotation applied via transform).
// Full circumference = 2πr. A percentile of 100 = full circle (offset 0).
function percentileToOffset(percentile, radius) {
  const circumference = 2 * Math.PI * radius;
  return circumference * (1 - percentile / 100);
}

// ─── Individual ring ──────────────────────────────────────────────────────────

function Ring({ config, percentile, isActive, onClick }) {
  const { radius, strokeWidth, color } = config;
  const circumference = 2 * Math.PI * radius;
  const offset = percentileToOffset(percentile ?? 0, radius);

  // Active ring gets a slightly larger stroke and full opacity;
  // inactive rings dim slightly.
  const effectiveStroke = isActive ? strokeWidth + 3 : strokeWidth;
  const opacity = isActive ? 1 : 0.65;

  return (
    <g
      style={{ cursor: "pointer" }}
      onClick={onClick}
      role="button"
      aria-label={`${config.universe}: ${percentile ?? 0}th percentile`}
    >
      {/* Track (background full circle) */}
      <circle
        cx={CENTER}
        cy={CENTER}
        r={radius}
        fill="none"
        stroke="hsl(var(--muted))"
        strokeWidth={effectiveStroke}
        opacity={0.35}
      />

      {/* Filled arc */}
      <motion.circle
        cx={CENTER}
        cy={CENTER}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={effectiveStroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        animate={{
          strokeDashoffset: offset,
          opacity,
        }}
        initial={{
          strokeDashoffset: circumference, // start at 0%
          opacity,
        }}
        transition={{
          strokeDashoffset: { duration: 0.8, ease: "easeOut" },
          opacity: { duration: 0.2 },
        }}
        // SVG circles draw clockwise from 3 o'clock; rotate to start at top
        transform={`rotate(-90, ${CENTER}, ${CENTER})`}
      />
    </g>
  );
}

// ─── Center label ─────────────────────────────────────────────────────────────

function CenterLabel({ activeUniverse, percentiles }) {
  const config = RING_CONFIG.find((r) => r.universe === activeUniverse);
  const percentile = percentiles?.[activeUniverse] ?? null;
  const hasData = percentile !== null && percentile !== undefined;

  return (
    <AnimatePresence mode="wait">
      <motion.g
        key={activeUniverse}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2 }}
        style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
      >
        {hasData ? (
          <>
            {/* Large percentile number */}
            <text
              x={CENTER}
              y={CENTER - 10}
              textAnchor="middle"
              dominantBaseline="auto"
              fontSize="42"
              fontWeight="700"
              fill="hsl(var(--foreground))"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {percentile}%
            </text>
            {/* "stronger than" label */}
            <text
              x={CENTER}
              y={CENTER + 12}
              textAnchor="middle"
              dominantBaseline="auto"
              fontSize="11"
              fill="hsl(var(--muted-foreground))"
            >
              stronger than
            </text>
            {/* Universe name */}
            <text
              x={CENTER}
              y={CENTER + 28}
              textAnchor="middle"
              dominantBaseline="auto"
              fontSize="12"
              fontWeight="600"
              fill={config?.color ?? "hsl(var(--foreground))"}
            >
              {config?.label ?? activeUniverse}
            </text>
          </>
        ) : (
          <>
            <text
              x={CENTER}
              y={CENTER - 8}
              textAnchor="middle"
              dominantBaseline="auto"
              fontSize="13"
              fill="hsl(var(--muted-foreground))"
            >
              Enter lifts
            </text>
            <text
              x={CENTER}
              y={CENTER + 12}
              textAnchor="middle"
              dominantBaseline="auto"
              fontSize="13"
              fill="hsl(var(--muted-foreground))"
            >
              to see results
            </text>
          </>
        )}
      </motion.g>
    </AnimatePresence>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend({ percentiles, activeUniverse, onUniverseChange }) {
  return (
    <div className="mt-3 flex flex-col gap-1.5">
      {RING_CONFIG.map((config) => {
        const percentile = percentiles?.[config.universe];
        const isActive = config.universe === activeUniverse;

        return (
          <button
            key={config.universe}
            onClick={() => onUniverseChange(config.universe)}
            className={`flex items-center justify-between rounded-md px-2.5 py-1 text-sm transition-all ${
              isActive
                ? "bg-muted font-semibold"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: config.color }}
              />
              <span>{config.universe}</span>
            </div>
            <span
              className={`tabular-nums ${isActive ? "text-foreground" : ""}`}
            >
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
}) {
  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
        className="w-full max-w-[320px]"
        aria-label="Strength percentile rings"
        role="img"
      >
        {/* Rings: rendered outer → inner so inner rings paint on top */}
        {RING_CONFIG.map((config) => (
          <Ring
            key={config.universe}
            config={config}
            percentile={percentiles?.[config.universe] ?? 0}
            isActive={config.universe === activeUniverse}
            onClick={() => onUniverseChange(config.universe)}
          />
        ))}

        {/* Center label */}
        <CenterLabel
          activeUniverse={activeUniverse}
          percentiles={percentiles}
        />
      </svg>

      <Legend
        percentiles={percentiles}
        activeUniverse={activeUniverse}
        onUniverseChange={onUniverseChange}
      />
    </div>
  );
}
