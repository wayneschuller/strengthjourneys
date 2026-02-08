"use client";

import { useRef, useMemo } from "react";
import { motion } from "motion/react";
import {
  pickQuirkyPhrase,
  SEASONAL_PHRASES,
} from "../phrases";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { BarChart3 } from "lucide-react";

export function SeasonalPatternCard({ year, isDemo, isActive = true }) {
  const phraseRef = useRef(null);
  const phrase = pickQuirkyPhrase(
    SEASONAL_PHRASES,
    phraseRef,
    `seasonal-${year}`,
  );

  const { parsedData } = useUserLiftingData();
  const { busiestMonth, monthlySessions } = useMemo(
    () => computeSeasonalPatternForYear(parsedData, year),
    [parsedData, year],
  );

  const maxCount = Math.max(...monthlySessions.map((m) => m.sessionCount), 1);

  return (
    <div className="flex flex-col items-center justify-center text-center">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
        transition={{ type: "spring", stiffness: 220, damping: 22 }}
      >
        <BarChart3 className="mb-4 h-12 w-12 text-chart-2" />
      </motion.div>
      <motion.p
        className="text-xl font-semibold text-chart-3"
        initial={{ opacity: 0, x: -16 }}
        animate={isActive ? { opacity: 1, x: 0 } : { opacity: 0, x: -16 }}
        transition={{ type: "spring", stiffness: 200, damping: 20, delay: isActive ? 0.08 : 0 }}
      >
        Busiest month
      </motion.p>
      <motion.p
        className="mt-2 text-4xl font-bold text-foreground"
        initial={{ opacity: 0, y: 16 }}
        animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
        transition={{ type: "spring", stiffness: 200, damping: 20, delay: isActive ? 0.18 : 0 }}
      >
        {busiestMonth ?? "—"}
      </motion.p>
      {monthlySessions.length > 0 && (
        <div className="mt-6 flex h-24 items-stretch justify-center gap-1">
          {monthlySessions.map((m, i) => (
            <div
              key={m.month}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1"
              title={`${m.month}: ${m.sessionCount} sessions`}
            >
              <motion.div
                className="w-full min-w-[4px] rounded-t"
                style={{
                  backgroundColor: `var(--chart-${(i % 5) + 1})`,
                  height: `${Math.max(4, (m.sessionCount / maxCount) * 80)}%`,
                  transformOrigin: "bottom",
                }}
                initial={{ scaleY: 0 }}
                animate={isActive ? { scaleY: 1 } : { scaleY: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 200,
                  damping: 22,
                  delay: isActive ? 0.25 + i * 0.04 : 0,
                }}
              />
              <span className="text-[10px] text-muted-foreground">
                {m.month.slice(0, 3)}
              </span>
            </div>
          ))}
        </div>
      )}
      <motion.p
        className="mt-4 text-sm italic text-muted-foreground"
        initial={{ opacity: 0, y: 8 }}
        animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
        transition={{ delay: isActive ? 0.5 : 0 }}
      >
        {phrase}
      </motion.p>
      {isDemo && (
        <motion.p
          className="mt-2 text-xs text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={isActive ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: isActive ? 0.65 : 0 }}
        >
          Demo mode
        </motion.p>
      )}
    </div>
  );
}

// --- Supporting functions ---

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function computeSeasonalPatternForYear(parsedData, year) {
  const empty = { busiestMonth: null, monthlySessions: [] };
  if (!parsedData || !year) return empty;
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const sessionDatesByMonth = Array.from({ length: 12 }, () => new Set());
  parsedData.forEach((entry) => {
    if (entry.isGoal || !entry.date) return;
    if (entry.date < yearStart || entry.date > yearEnd) return;
    const month = parseInt(entry.date.slice(5, 7), 10) - 1;
    sessionDatesByMonth[month].add(entry.date);
  });
  const monthSessionCounts = sessionDatesByMonth.map((s) => s.size);
  const monthlySessions = monthSessionCounts.map((count, i) => ({
    month: MONTH_NAMES[i],
    monthIndex: i,
    sessionCount: count,
  }));
  const maxMonthCount = Math.max(...monthSessionCounts);
  const busiestMonthIndex = monthSessionCounts.indexOf(maxMonthCount);
  const busiestMonth = busiestMonthIndex >= 0 ? MONTH_NAMES[busiestMonthIndex] : null;
  return { busiestMonth, monthlySessions };
}
