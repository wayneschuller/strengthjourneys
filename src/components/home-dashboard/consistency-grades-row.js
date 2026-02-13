"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { processConsistency } from "@/components/analyzer/consistency-card";
import { getGradeAndColor } from "@/lib/consistency-grades";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const LABEL_ABBREV = {
  Week: "W",
  Month: "M",
  "3 Month": "3M",
  "Half Year": "6M",
  Year: "Y",
  "24 Month": "2Y",
  "5 Year": "5Y",
  Decade: "10Y",
};

function GradeCircle({ percentage, label, tooltip, size = 28, delay = 0, isVisible }) {
  const { grade, color } = getGradeAndColor(percentage);
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const abbrev = LABEL_ABBREV[label] ?? label;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            className="flex flex-col items-center gap-0.5"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={
              isVisible ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }
            }
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 20,
              delay: isVisible ? delay : 0,
            }}
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
            <span className="text-muted-foreground text-[9px] leading-none">
              {abbrev}
            </span>
          </motion.div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="w-40">
            <div className="text-center text-lg">{label}: {percentage}%</div>
            <div>{tooltip}</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Trim trailing "." grades (percentage < 30) from the end.
// Keeps interior dots so only the "not in the game yet" tail is hidden.
function trimTrailingDots(items) {
  let lastReal = items.length - 1;
  while (lastReal >= 0 && getGradeAndColor(items[lastReal].percentage).grade === ".") {
    lastReal--;
  }
  return items.slice(0, lastReal + 1);
}

export function ConsistencyGradesRow({ parsedData, isVisible = false }) {
  const consistency = useMemo(() => {
    const raw = processConsistency(parsedData);
    return raw ? trimTrailingDots(raw) : null;
  }, [parsedData]);

  if (!consistency || consistency.length === 0) return null;

  return (
    <Link href="/analyzer" className="flex items-start justify-center gap-3">
      {consistency.map((item, index) => (
        <GradeCircle
          key={item.label}
          percentage={item.percentage}
          label={item.label}
          tooltip={item.tooltip}
          size={36}
          delay={index * 0.05}
          isVisible={isVisible}
        />
      ))}
    </Link>
  );
}
