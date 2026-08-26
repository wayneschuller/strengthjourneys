/**
 * Consistency grade rings turn processed training consistency windows into the
 * compact animated row shown above the Long Game heatmaps.
 */

import { motion, useReducedMotion } from "motion/react";

import { useId, useMemo } from "react";

import { processConsistency } from "@/lib/consistency";

import {
  getConsistencyRingPalette,
  getGradeAndColor,
} from "@/lib/consistency-grades";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// --- Consistency Grades ---

const SHORT_TERM_LABELS = new Set(["Week", "Month", "3 Month"]);

function getConsistencyLabelAbbrev(label) {
  if (label === "Week") return "W";
  if (label === "Month") return "M";
  if (label === "Half Year") return "6M";
  if (label === "Year") return "Y";
  if (label === "24 Month") return "2Y";
  if (label === "Decade") return "10Y";

  const monthMatch = label.match(/^(\d+) Month$/);
  if (monthMatch) return `${monthMatch[1]}M`;

  const yearMatch = label.match(/^(\d+) Year$/);
  if (yearMatch) return `${yearMatch[1]}Y`;

  return label;
}

function splitIntoBalancedRows(items, maxItemsPerRow = 5) {
  const rowCount = Math.max(1, Math.ceil(items.length / maxItemsPerRow));
  const minItemsPerRow = Math.floor(items.length / rowCount);
  const extraItems = items.length % rowCount;
  const rows = [];
  let startIndex = 0;

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const rowSize = minItemsPerRow + (rowIndex < extraItems ? 1 : 0);
    rows.push(items.slice(startIndex, startIndex + rowSize));
    startIndex += rowSize;
  }

  return rows;
}

// Animated SVG ring showing a consistency grade letter and percentage fill for one time window.
// Short-term rings (W/M/3M) render with a thicker stroke and full opacity to emphasise recent form;
// long-term rings use a thinner stroke and reduced opacity so they recede without disappearing.
// The arc sweeps clockwise from twelve o'clock on first reveal and the letter lands just behind it,
// so a row of rings reads as a wave rather than a static chart. Capture mode and reduced-motion both
// short-circuit to the finished state.
function ConsistencyGradeCircle({
  percentage,
  label,
  tooltip,
  size = 28,
  delay = 0,
  isVisible,
  isShortTerm = true,
  isCaptureMode = false,
}) {
  const gradientId = `grade-arc-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const prefersReducedMotion = useReducedMotion();
  const isStatic = isCaptureMode || !!prefersReducedMotion;

  const { grade, light, dark } = getConsistencyRingPalette(percentage);
  const strokeWidth = isShortTerm ? size * 0.115 : size * 0.075;
  const targetOpacity = isCaptureMode ? 1 : isShortTerm ? 1 : 0.72;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const abbrev = getConsistencyLabelAbbrev(label);
  // The halo is the reward for a filled ring, so only the upper grade bands get one.
  const glowStrength = isShortTerm ? 1 : 0.55;
  const showGlow = percentage >= 50;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            className="flex cursor-default flex-col items-center gap-1"
            style={{
              "--ring-from": light.from,
              "--ring-to": light.to,
              "--ring-ink": light.ink,
              "--ring-glow": light.glow,
              "--ring-from-dark": dark.from,
              "--ring-to-dark": dark.to,
              "--ring-ink-dark": dark.ink,
              "--ring-glow-dark": dark.glow,
            }}
            initial={
              isStatic
                ? { opacity: targetOpacity, y: 0 }
                : { opacity: 0, y: -20 }
            }
            animate={
              isStatic
                ? { opacity: targetOpacity, y: 0 }
                : isVisible
                  ? { opacity: targetOpacity, y: 0 }
                  : { opacity: 0, y: -20 }
            }
            whileHover={isStatic ? undefined : { opacity: 1, scale: 1.06 }}
            transition={
              isStatic
                ? { duration: 0 }
                : {
                    type: "spring",
                    stiffness: 300,
                    damping: 20,
                    delay: isVisible ? delay : 0,
                  }
            }
          >
            <div
              className="relative dark:[--ring-from:var(--ring-from-dark)] dark:[--ring-glow:var(--ring-glow-dark)] dark:[--ring-ink:var(--ring-ink-dark)] dark:[--ring-to:var(--ring-to-dark)]"
              style={{ width: size, height: size }}
            >
              {showGlow && (
                <motion.span
                  aria-hidden="true"
                  className="pointer-events-none absolute rounded-full"
                  style={{
                    inset: -size * 0.18,
                    background:
                      "radial-gradient(circle closest-side, transparent 55%, var(--ring-glow) 74%, transparent 92%)",
                  }}
                  initial={{ opacity: isStatic ? glowStrength : 0 }}
                  animate={{
                    opacity: isStatic || isVisible ? glowStrength : 0,
                  }}
                  transition={
                    isStatic
                      ? { duration: 0 }
                      : { duration: 0.8, delay: delay + 0.5 }
                  }
                />
              )}
              <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                className="relative shrink-0"
              >
                <defs>
                  <linearGradient
                    id={gradientId}
                    x1="0"
                    y1="0"
                    x2="1"
                    y2="1"
                    gradientUnits="objectBoundingBox"
                  >
                    <stop offset="0%" stopColor="var(--ring-from)" />
                    <stop offset="100%" stopColor="var(--ring-to)" />
                  </linearGradient>
                </defs>
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={strokeWidth}
                  className="text-foreground/10"
                />
                {/* Rotation lives on a plain <g> so Motion only ever touches strokeDashoffset. */}
                <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
                  <motion.circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={`url(#${gradientId})`}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    initial={{
                      strokeDashoffset: isStatic ? offset : circumference,
                    }}
                    animate={{
                      strokeDashoffset:
                        isStatic || isVisible ? offset : circumference,
                    }}
                    transition={
                      isStatic
                        ? { duration: 0 }
                        : {
                            duration: 1.1,
                            delay: delay + 0.1,
                            // Fast out of the gate, long settle.
                            ease: [0.16, 1, 0.3, 1],
                          }
                    }
                  />
                </g>
                <motion.text
                  x={size / 2}
                  y={size / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="var(--ring-ink)"
                  fontSize={grade.length > 1 ? size * 0.32 : size * 0.39}
                  fontWeight="700"
                  style={{
                    transformOrigin: "center",
                    transformBox: "fill-box",
                  }}
                  initial={
                    isStatic
                      ? { opacity: 1, scale: 1 }
                      : { opacity: 0, scale: 0.6 }
                  }
                  animate={
                    isStatic || isVisible
                      ? { opacity: 1, scale: 1 }
                      : { opacity: 0, scale: 0.6 }
                  }
                  transition={
                    isStatic
                      ? { duration: 0 }
                      : {
                          type: "spring",
                          stiffness: 420,
                          damping: 18,
                          delay: delay + 0.45,
                        }
                  }
                >
                  {grade}
                </motion.text>
              </svg>
            </div>
            <span className="text-muted-foreground text-[11px] leading-none tracking-wide tabular-nums">
              {abbrev}
            </span>
          </motion.div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs">{tooltip}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Strips trailing consistency items whose grade is "." — meaning insufficient history for that
// window — so the rings row doesn't end in visually meaningless placeholder dots.
function trimTrailingDots(items) {
  let lastReal = items.length - 1;
  while (
    lastReal >= 0 &&
    getGradeAndColor(items[lastReal].percentage).grade === "."
  ) {
    lastReal--;
  }
  return items.slice(0, lastReal + 1);
}

// Renders a horizontal row of ConsistencyGradeCircle rings for every consistency window the user has enough
// data to fill. Trims trailing dot-grade periods before rendering, and spring-animates the rings
// in from above once the card's interval data is ready.
export function ConsistencyGradesRow({
  parsedData,
  isVisible = false,
  isCaptureMode = false,
}) {
  const consistency = useMemo(() => {
    const raw = processConsistency(parsedData);
    return raw ? trimTrailingDots(raw) : null;
  }, [parsedData]);

  if (!consistency || consistency.length === 0) return null;

  const circleSize =
    consistency.length >= 11 ? 48 : consistency.length >= 7 ? 56 : 64;
  const rows = splitIntoBalancedRows(consistency);

  return (
    <div className="flex flex-col items-center gap-3">
      {rows.map((row, rowIndex) => (
        <div
          key={`consistency-row-${rowIndex}`}
          className="flex items-start justify-center gap-x-3 sm:gap-x-4"
        >
          {row.map((item, index) => {
            const sequenceIndex =
              rows
                .slice(0, rowIndex)
                .reduce((count, priorRow) => count + priorRow.length, 0) +
              index;

            return (
              <ConsistencyGradeCircle
                key={item.label}
                percentage={item.percentage}
                label={item.label}
                tooltip={item.tooltip}
                size={circleSize}
                delay={sequenceIndex * 0.07}
                isVisible={isVisible}
                isShortTerm={SHORT_TERM_LABELS.has(item.label)}
                isCaptureMode={isCaptureMode}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
