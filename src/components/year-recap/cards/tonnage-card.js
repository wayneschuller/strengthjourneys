"use client";

import { useRef } from "react";
import { motion } from "motion/react";
import {
  formatYearTonnage,
  pickTonnageEquivalent,
} from "@/lib/year-recap-processing";
import { Dumbbell } from "lucide-react";

export function TonnageCard({ year, metrics, isDemo, isActive = true }) {
  const equivRef = useRef(null);
  const tonnage = metrics?.tonnage ?? 0;
  const unit = metrics?.primaryUnit ?? "lb";

  const equiv = pickTonnageEquivalent(tonnage, unit, equivRef, `tonnage-${year}`);

  const formattedCount =
    equiv && equiv.count >= 100
      ? Math.round(equiv.count).toLocaleString()
      : equiv
        ? equiv.count.toLocaleString("en-US", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })
        : "";

  return (
    <div className="flex flex-col items-center justify-center text-center">
      <motion.div
        initial={{ opacity: 0, rotate: -12 }}
        animate={isActive ? { opacity: 1, rotate: 0 } : { opacity: 0, rotate: -12 }}
        transition={{ type: "spring", stiffness: 200, damping: 18 }}
      >
        <Dumbbell className="mb-4 h-12 w-12 text-chart-3" />
      </motion.div>
      <motion.p
        className="text-5xl font-bold tabular-nums text-foreground md:text-6xl"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={isActive ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
        transition={{ type: "spring", stiffness: 260, damping: 22, delay: isActive ? 0.08 : 0 }}
      >
        {formatYearTonnage(tonnage)} {unit}
      </motion.p>
      <motion.p
        className="mt-2 text-xl font-semibold text-chart-2"
        initial={{ opacity: 0, y: 12 }}
        animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
        transition={{ type: "spring", stiffness: 180, damping: 20, delay: isActive ? 0.18 : 0 }}
      >
        moved this year
      </motion.p>
      {equiv && (
        <motion.p
          className="mt-4 text-sm text-chart-4"
          initial={{ opacity: 0, x: -20 }}
          animate={isActive ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
          transition={{ delay: isActive ? 0.35 : 0 }}
        >
          About {formattedCount} {equiv.name}{equiv.count !== 1 ? "s" : ""} {equiv.emoji}
        </motion.p>
      )}
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
