"use client";

import { useRef } from "react";
import { motion } from "motion/react";
import {
  pickQuirkyPhrase,
  MOST_TRAINED_LIFT_PHRASES,
} from "@/lib/year-recap-phrases";
import { Trophy } from "lucide-react";
import { LiftSvg } from "../lift-svg";

export function MostTrainedLiftCard({ year, metrics, isDemo, isActive = true }) {
  const phraseRef = useRef(null);
  const phrase = pickQuirkyPhrase(
    MOST_TRAINED_LIFT_PHRASES,
    phraseRef,
    `most-trained-${year}`,
  );

  const lift = metrics?.mostTrainedLift ?? null;

  return (
    <div className="flex flex-col items-center justify-center text-center">
      <div className="mb-4 rounded-xl bg-accent/40 p-4">
        {lift ? (
          <LiftSvg liftType={lift} size="lg" animate isActive={isActive} />
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={isActive ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
          >
            <Trophy className="h-12 w-12 text-chart-5" />
          </motion.div>
        )}
      </div>
      <motion.p
        className="text-2xl font-semibold text-chart-1"
        initial={{ opacity: 0, y: 16 }}
        animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
        transition={{ type: "spring", stiffness: 200, damping: 20, delay: isActive ? 0.25 : 0 }}
      >
        Your lift
      </motion.p>
      <motion.p
        className="mt-2 text-4xl font-bold text-foreground md:text-5xl"
        initial={{ opacity: 0, x: -24 }}
        animate={isActive ? { opacity: 1, x: 0 } : { opacity: 0, x: -24 }}
        transition={{ type: "spring", stiffness: 180, damping: 18, delay: isActive ? 0.35 : 0 }}
      >
        {lift ?? "—"}
      </motion.p>
      <motion.p
        className="mt-4 text-sm italic text-muted-foreground"
        initial={{ opacity: 0, x: 20 }}
        animate={isActive ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
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
