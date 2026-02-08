"use client";

import { useRef, useMemo } from "react";
import { motion } from "motion/react";
import { pickQuirkyPhrase, SESSIONS_PHRASES } from "../phrases";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { Calendar } from "lucide-react";

export function SessionsCard({ year, isDemo, isActive = true }) {
  const phraseRef = useRef(null);
  const phrase = pickQuirkyPhrase(SESSIONS_PHRASES, phraseRef, `sessions-${year}`);

  const { parsedData } = useUserLiftingData();
  const { count, prevYearCount } = useMemo(
    () => computeSessionCountForYear(parsedData, year),
    [parsedData, year],
  );

  const showPrevYearComparison = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const isDecember = now.getMonth() === 11;
    const yearNum = parseInt(year, 10);
    return yearNum < currentYear || (yearNum === currentYear && isDecember);
  }, [year]);

  const comparisonText = useMemo(() => {
    if (!showPrevYearComparison || prevYearCount == null || prevYearCount === 0) return null;
    const diff = count - prevYearCount;
    if (diff > 0) return `Up ${diff} from last year`;
    if (diff < 0) return `${Math.abs(diff)} fewer than last year`;
    return "Same as last year";
  }, [showPrevYearComparison, count, prevYearCount]);

  return (
    <div className="flex flex-col items-center justify-center text-center">
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: -30 }}
        transition={{ type: "spring", stiffness: 220, damping: 22 }}
      >
        <Calendar className="mb-4 h-12 w-12 text-chart-1" />
      </motion.div>
      <motion.p
        className="text-5xl font-bold tabular-nums text-foreground md:text-6xl"
        initial={{ opacity: 0, y: 20 }}
        animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ type: "spring", stiffness: 200, damping: 20, delay: isActive ? 0.1 : 0 }}
      >
        {count}
      </motion.p>
      <motion.p
        className="mt-2 text-xl font-semibold text-chart-2"
        initial={{ opacity: 0, x: -16 }}
        animate={isActive ? { opacity: 1, x: 0 } : { opacity: 0, x: -16 }}
        transition={{ type: "spring", stiffness: 180, damping: 18, delay: isActive ? 0.2 : 0 }}
      >
        training sessions
      </motion.p>
      {comparisonText && (
        <motion.p
          className="mt-2 text-sm text-muted-foreground"
          initial={{ opacity: 0, y: 8 }}
          animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
          transition={{ delay: isActive ? 0.28 : 0 }}
        >
          {comparisonText}
        </motion.p>
      )}
      <motion.p
        className="mt-4 text-sm italic text-muted-foreground"
        initial={{ opacity: 0, x: 24 }}
        animate={isActive ? { opacity: 1, x: 0 } : { opacity: 0, x: 24 }}
        transition={{ delay: isActive ? 0.35 : 0 }}
      >
        {phrase}
      </motion.p>
      {isDemo && (
        <motion.p
          className="mt-2 text-xs text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={isActive ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: isActive ? 0.5 : 0 }}
        >
          Demo mode
        </motion.p>
      )}
    </div>
  );
}

// --- Supporting functions ---

function computeSessionCountForYear(parsedData, year) {
  if (!parsedData || !year) return { count: 0, prevYearCount: null };
  const prevYear = String(parseInt(year, 10) - 1);
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const prevYearStart = `${prevYear}-01-01`;
  const prevYearEnd = `${prevYear}-12-31`;
  const sessionDates = new Set();
  const prevYearDates = new Set();
  parsedData.forEach((entry) => {
    if (entry.isGoal || !entry.date) return;
    if (entry.date >= yearStart && entry.date <= yearEnd) {
      sessionDates.add(entry.date);
    }
    if (entry.date >= prevYearStart && entry.date <= prevYearEnd) {
      prevYearDates.add(entry.date);
    }
  });
  const prevCount = prevYearDates.size;
  return {
    count: sessionDates.size,
    prevYearCount: prevCount > 0 ? prevCount : null,
  };
}
