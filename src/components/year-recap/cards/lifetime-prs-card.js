"use client";

import { useRef, useMemo } from "react";
import {
  pickQuirkyPhrase,
  PR_HIGHLIGHTS_PHRASES,
} from "../phrases";
import { getReadableDateString, getLifetimePRsAchievedInYear } from "@/lib/processing-utils";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { Trophy } from "lucide-react";
import { motion } from "motion/react";
import { LiftSvg, getLiftSvgPath } from "../lift-svg";

export function LifetimePRsCard({ year, isDemo, isActive = true }) {
  const phraseRef = useRef(null);
  const phrase = pickQuirkyPhrase(
    PR_HIGHLIGHTS_PHRASES,
    phraseRef,
    `lifetime-prs-${year}`,
  );

  const { topLiftsByTypeAndReps } = useUserLiftingData();
  const prs = useMemo(
    () => getLifetimePRsAchievedInYear(year, topLiftsByTypeAndReps),
    [year, topLiftsByTypeAndReps],
  );

  return (
    <div className="flex flex-col items-center justify-center text-center">
      <motion.div
        initial={{ opacity: 0, y: -24 }}
        animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: -24 }}
        transition={{ type: "spring", stiffness: 220, damping: 22 }}
      >
        <Trophy className="mb-4 h-12 w-12 text-chart-1" />
      </motion.div>
      <motion.p
        className="text-xl font-semibold text-chart-2"
        initial={{ opacity: 0, x: -12 }}
        animate={isActive ? { opacity: 1, x: 0 } : { opacity: 0, x: -12 }}
        transition={{ type: "spring", stiffness: 200, damping: 20, delay: isActive ? 0.1 : 0 }}
      >
        Lifetime PRs achieved
      </motion.p>
      {prs.length > 0 ? (
        <ul className="mt-4 space-y-2 text-left">
          {prs.map((pr, i) => {
            const barColors = ["border-l-chart-1", "border-l-chart-2", "border-l-chart-3", "border-l-chart-4", "border-l-chart-5"];
            return (
            <motion.li
              key={`${pr.date}-${pr.liftType}-${pr.reps}-${i}`}
              initial={{ opacity: 0, x: -12 }}
              animate={isActive ? { opacity: 1, x: 0 } : { opacity: 0, x: -12 }}
              transition={{ delay: isActive ? i * 0.08 : 0, duration: 0.25 }}
              className={`flex items-center gap-2 border-l-4 pl-2 ${barColors[i % 5]}`}
            >
              {getLiftSvgPath(pr.liftType) ? (
                <span className="shrink-0">
                  <LiftSvg liftType={pr.liftType} size="sm" animate={false} />
                </span>
              ) : null}
              <span>
                {pr.liftType} {pr.reps}@{pr.weight}
                {pr.unitType} — {getReadableDateString(pr.date)}
              </span>
            </motion.li>
            );
          })}
        </ul>
      ) : (
        <motion.p
          className="mt-4 text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={isActive ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: isActive ? 0.2 : 0 }}
        >
          No lifetime PRs this year
        </motion.p>
      )}
      <motion.p
        className="mt-4 text-sm italic text-muted-foreground"
        initial={{ opacity: 0, y: 8 }}
        animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
        transition={{ delay: isActive ? (prs.length > 0 ? 0.5 : 0.35) : 0 }}
      >
        {phrase}
      </motion.p>
      {isDemo && (
        <motion.p
          className="mt-2 text-xs text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={isActive ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: isActive ? 0.6 : 0 }}
        >
          Demo mode
        </motion.p>
      )}
    </div>
  );
}
