"use client";

import { useRef, useMemo } from "react";
import { motion } from "motion/react";
import {
  pickQuirkyPhrase,
  CONSISTENCY_PHRASES,
} from "../phrases";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { getGradeAndColor } from "@/lib/consistency-grades";
import { Flame } from "lucide-react";

export function ConsistencyCard({ year, isDemo, isActive = true }) {
  const phraseRef = useRef(null);
  const phrase = pickQuirkyPhrase(
    CONSISTENCY_PHRASES,
    phraseRef,
    `consistency-${year}`,
  );

  const { parsedData } = useUserLiftingData();
  const stats = useMemo(
    () => computeConsistencyForYear(parsedData, year),
    [parsedData, year],
  );

  const { bestStreak, consistencyGrade, consistencyPercentage } = stats;

  const grade = consistencyGrade?.grade ?? "—";

  return (
    <div className="flex flex-col items-center justify-center text-center">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
        transition={{ type: "spring", stiffness: 240, damping: 20 }}
      >
        <Flame className="mb-4 h-12 w-12 text-chart-4" />
      </motion.div>
      <motion.p
        className="text-5xl font-bold tabular-nums text-foreground md:text-6xl"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={isActive ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
        transition={{ type: "spring", stiffness: 220, damping: 22, delay: isActive ? 0.08 : 0 }}
      >
        {bestStreak} week{bestStreak !== 1 ? "s" : ""}
      </motion.p>
      <motion.p
        className="mt-2 text-xl font-semibold text-chart-2"
        initial={{ opacity: 0, x: -16 }}
        animate={isActive ? { opacity: 1, x: 0 } : { opacity: 0, x: -16 }}
        transition={{ type: "spring", stiffness: 180, damping: 18, delay: isActive ? 0.18 : 0 }}
      >
        in a row (3+ sessions)
      </motion.p>
      {grade !== "—" && (
        <motion.p
          className="mt-2 text-lg font-medium text-chart-3"
          initial={{ opacity: 0, x: 16 }}
          animate={isActive ? { opacity: 1, x: 0 } : { opacity: 0, x: 16 }}
          transition={{ delay: isActive ? 0.28 : 0 }}
        >
          Grade: {grade} ({consistencyPercentage}%)
        </motion.p>
      )}
      <motion.p
        className="mt-4 text-sm italic text-muted-foreground"
        initial={{ opacity: 0, y: 12 }}
        animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
        transition={{ delay: isActive ? 0.4 : 0 }}
      >
        {phrase}
      </motion.p>
      {isDemo && (
        <motion.p
          className="mt-2 text-xs text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={isActive ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: isActive ? 0.55 : 0 }}
        >
          Demo mode
        </motion.p>
      )}
    </div>
  );
}

// --- Supporting functions ---

function getWeekKeyFromDateStr(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  const dow = d.getUTCDay();
  const daysBack = (dow + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysBack);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysInMonth(y, month1Based) {
  if (month1Based === 2) {
    const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    return isLeap ? 29 : 28;
  }
  if ([4, 6, 9, 11].includes(month1Based)) return 30;
  return 31;
}

function addDaysFromStr(dateStr, n) {
  let y = parseInt(dateStr.slice(0, 4), 10);
  let m = parseInt(dateStr.slice(5, 7), 10);
  let d = parseInt(dateStr.slice(8, 10), 10);
  for (let i = 0; i < n; i++) {
    const maxD = daysInMonth(y, m);
    d++;
    if (d > maxD) {
      d = 1;
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }
  }
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function computeBestStreakForYear(sessionDates, year) {
  if (!sessionDates.length) return 0;
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const weekMap = new Map();
  const dateToWeekKey = new Map();
  sessionDates.forEach((dateStr) => {
    if (dateStr < yearStart || dateStr > yearEnd) return;
    let weekKey = dateToWeekKey.get(dateStr);
    if (weekKey === undefined) {
      weekKey = getWeekKeyFromDateStr(dateStr);
      dateToWeekKey.set(dateStr, weekKey);
    }
    if (!weekMap.has(weekKey)) weekMap.set(weekKey, new Set());
    weekMap.get(weekKey).add(dateStr);
  });
  const weekSessionCount = new Map();
  weekMap.forEach((dates, weekKey) => {
    weekSessionCount.set(weekKey, dates.size);
  });
  const firstMonday = getWeekKeyFromDateStr(yearStart);
  const lastMonday = getWeekKeyFromDateStr(yearEnd);
  let bestStreak = 0;
  let tempStreak = 0;
  let weekKey = firstMonday;
  while (weekKey <= lastMonday) {
    const sessionCount = weekSessionCount.get(weekKey) || 0;
    if (sessionCount >= 3) {
      tempStreak++;
      bestStreak = Math.max(bestStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
    weekKey = addDaysFromStr(weekKey, 7);
  }
  return bestStreak;
}

function computeConsistencyForYear(parsedData, year) {
  const empty = {
    bestStreak: 0,
    consistencyGrade: null,
    consistencyPercentage: 0,
  };
  if (!parsedData || !year) return empty;
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const sessionDates = new Set();
  parsedData.forEach((entry) => {
    if (entry.isGoal || !entry.date) return;
    if (entry.date >= yearStart && entry.date <= yearEnd) {
      sessionDates.add(entry.date);
    }
  });
  const sortedDates = Array.from(sessionDates).sort();
  const bestStreak = computeBestStreakForYear(sortedDates, year);
  const sessionCount = sessionDates.size;
  const expectedSessions = Math.round((365 / 7) * 3);
  const consistencyPercentage = Math.min(
    100,
    Math.round((sessionCount / expectedSessions) * 100),
  );
  const consistencyGrade = getGradeAndColor(consistencyPercentage);
  return {
    bestStreak,
    consistencyGrade,
    consistencyPercentage,
  };
}
