/**
 * Consistency grade rings turn processed training consistency windows into the
 * compact animated row shown above the Long Game heatmaps.
 */

import { motion } from "motion/react";

import { useMemo } from "react";

import { processConsistency } from "@/lib/consistency";

import { getGradeAndColor } from "@/lib/consistency-grades";

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
// long-term rings use a thinner stroke and 60% opacity so they recede without disappearing.
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
  const { grade, color } = getGradeAndColor(percentage);
  const strokeWidth = isShortTerm ? 3.5 : 2.5;
  const targetOpacity = isCaptureMode ? 1 : isShortTerm ? 1 : 0.6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const abbrev = getConsistencyLabelAbbrev(label);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            className="flex flex-col items-center gap-1"
            initial={
              isCaptureMode
                ? { opacity: targetOpacity, y: 0 }
                : { opacity: 0, y: -20 }
            }
            animate={
              isCaptureMode
                ? { opacity: targetOpacity, y: 0 }
                : isVisible
                  ? { opacity: targetOpacity, y: 0 }
                  : { opacity: 0, y: -20 }
            }
            transition={
              isCaptureMode
                ? { duration: 0 }
                : {
                    type: "spring",
                    stiffness: 300,
                    damping: 20,
                    delay: isVisible ? delay : 0,
                  }
            }
          >
            <svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              className="shrink-0"
            >
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                className="text-muted/40"
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
              <text
                x={size / 2}
                y={size / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fill={color}
                fontSize={grade.length > 1 ? size * 0.32 : size * 0.39}
                fontWeight="600"
              >
                {grade}
              </text>
            </svg>
            <span className="text-muted-foreground text-[11px] leading-none">
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
                delay={sequenceIndex * 0.05}
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
