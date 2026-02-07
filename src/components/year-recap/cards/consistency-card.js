"use client";

import { useRef } from "react";
import { motion } from "motion/react";
import {
  pickQuirkyPhrase,
  CONSISTENCY_PHRASES,
} from "@/lib/year-recap-phrases";
import { Flame } from "lucide-react";

export function ConsistencyCard({ year, metrics, isDemo, isActive = true }) {
  const phraseRef = useRef(null);
  const phrase = pickQuirkyPhrase(
    CONSISTENCY_PHRASES,
    phraseRef,
    `consistency-${year}`,
  );

  const bestStreak = metrics?.bestStreak ?? 0;
  const grade = metrics?.consistencyGrade?.grade ?? "—";
  const percentage = metrics?.consistencyPercentage ?? 0;

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
          Grade: {grade} ({percentage}%)
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
