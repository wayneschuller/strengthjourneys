"use client";

import { useRef } from "react";
import { motion } from "motion/react";
import { pickQuirkyPhrase, SESSIONS_PHRASES } from "@/lib/year-recap-phrases";
import { Calendar } from "lucide-react";

export function SessionsCard({ year, metrics, isDemo, isActive = true }) {
  const phraseRef = useRef(null);
  const phrase = pickQuirkyPhrase(SESSIONS_PHRASES, phraseRef, `sessions-${year}`);

  const count = metrics?.sessionCount ?? 0;

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
