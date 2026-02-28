/**
 * StrengthCirclesChart
 *
 * Concentric ring chart visualizing strength percentiles across four universes.
 * Pure SVG — no Recharts. Animated via motion/react (stroke-dashoffset).
 *
 * Rings (outer → inner):
 *   General Population → Gym-Goers → Barbell Lifters → Powerlifting Culture
 */

import { motion, AnimatePresence } from "motion/react";

// CSS vars in this project already include the full hsl() value.
// Use var(--chart-N) directly — never hsl(var(--chart-N)).
const RING_CONFIG = [
  {
    universe: "General Population",
    label: "Gen. Pop.",
    radius: 148,
    strokeWidth: 20,
    color: "var(--chart-1)",
  },
  {
    universe: "Gym-Goers",
    label: "Gym-Goers",
    radius: 120,
    strokeWidth: 20,
    color: "var(--chart-2)",
  },
  {
    universe: "Barbell Lifters",
    label: "Barbell",
    radius: 92,
    strokeWidth: 20,
    color: "var(--chart-3)",
  },
  {
    universe: "Powerlifting Culture",
    label: "Powerlifting",
    radius: 64,
    strokeWidth: 20,
    color: "var(--chart-4)",
  },
];

// Larger viewBox = more room for center text
const VIEWBOX_SIZE = 340;
const CENTER = VIEWBOX_SIZE / 2; // 170

function percentileToOffset(percentile, radius) {
  const circumference = 2 * Math.PI * radius;
  return circumference * (1 - (percentile ?? 0) / 100);
}

// ─── Individual ring ──────────────────────────────────────────────────────────

function Ring({ config, percentile, isActive, onClick }) {
  const { radius, strokeWidth, color } = config;
  const circumference = 2 * Math.PI * radius;
  const offset = percentileToOffset(percentile, radius);
  const effectiveStroke = isActive ? strokeWidth + 4 : strokeWidth;

  return (
    <g
      onClick={onClick}
      style={{ cursor: "pointer" }}
      role="button"
      aria-label={`${config.universe}: ${percentile ?? 0}th percentile`}
    >
      {/* Background track */}
      <circle
        cx={CENTER}
        cy={CENTER}
        r={radius}
        fill="none"
        style={{ stroke: "var(--muted-foreground)", opacity: 0.15 }}
        strokeWidth={effectiveStroke}
      />

      {/* Filled arc — <g> handles the -90° rotation so motion doesn't intercept transform */}
      <g transform={`rotate(-90, ${CENTER}, ${CENTER})`}>
        <motion.circle
          cx={CENTER}
          cy={CENTER}
          r={radius}
          fill="none"
          style={{ stroke: color }}
          strokeWidth={effectiveStroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          animate={{
            strokeDashoffset: offset,
            opacity: isActive ? 1 : 0.55,
          }}
          initial={{
            strokeDashoffset: circumference,
            opacity: isActive ? 1 : 0.55,
          }}
          transition={{
            strokeDashoffset: { duration: 0.75, ease: "easeOut" },
            opacity: { duration: 0.2 },
          }}
        />
      </g>
    </g>
  );
}

// ─── Center label ─────────────────────────────────────────────────────────────
// Inner ring clear radius = 64 - 10 = 54px → 108px diameter for text
// Two-line layout: big % number + colored universe name below

function CenterLabel({ activeUniverse, percentiles }) {
  const config = RING_CONFIG.find((r) => r.universe === activeUniverse);
  const percentile = percentiles?.[activeUniverse] ?? null;
  const hasData = percentile !== null && percentile !== undefined;

  return (
    <AnimatePresence mode="wait">
      <motion.g
        key={`${activeUniverse}-${hasData}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
      >
        {hasData ? (
          <>
            {/* Big percentage — the hero number */}
            <text
              x={CENTER}
              y={CENTER - 10}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="48"
              fontWeight="700"
              fontFamily="inherit"
              style={{ fill: "var(--foreground)", fontVariantNumeric: "tabular-nums" }}
            >
              {percentile}%
            </text>

            {/* Universe name below, in ring color */}
            <text
              x={CENTER}
              y={CENTER + 32}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="13"
              fontWeight="600"
              fontFamily="inherit"
              style={{ fill: config?.color ?? "var(--foreground)" }}
            >
              {config?.label ?? activeUniverse}
            </text>
          </>
        ) : (
          <>
            <text
              x={CENTER}
              y={CENTER - 10}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="13"
              fontFamily="inherit"
              style={{ fill: "var(--muted-foreground)" }}
            >
              Enter a lift
            </text>
            <text
              x={CENTER}
              y={CENTER + 12}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="13"
              fontFamily="inherit"
              style={{ fill: "var(--muted-foreground)" }}
            >
              to see results
            </text>
          </>
        )}
      </motion.g>
    </AnimatePresence>
  );
}

// ─── Legend below the chart ───────────────────────────────────────────────────

function Legend({ percentiles, activeUniverse, onUniverseChange }) {
  return (
    <div className="mt-4 flex flex-col gap-1">
      {RING_CONFIG.map((config) => {
        const percentile = percentiles?.[config.universe];
        const isActive = config.universe === activeUniverse;

        return (
          <button
            key={config.universe}
            onClick={() => onUniverseChange(config.universe)}
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
}) {
  return (
    <div className="flex flex-col">
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
          />
        ))}

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
