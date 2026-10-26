import { useMemo } from "react";
import { motion } from "motion/react";
import { useLocalStorage } from "usehooks-ts";
import { TrendingUp } from "lucide-react";
import {
  pickRecapPhrase,
  STRENGTH_GAINS_PHRASES,
  STRENGTH_BESTS_PHRASES,
} from "@/components/year-recap/phrases";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { computeStrengthGainsForYear } from "@/lib/year-recap-stats";
import { getDisplayWeight } from "@/lib/processing-utils";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { LiftArtwork } from "@/components/lift-artwork";
import { useCountUp } from "@/components/year-recap/use-count-up";

/**
 * Recap slide comparing this year's best estimated max on each Big Four lift
 * with last year's. Gains get a badge; a lift that did not climb simply shows
 * its best, so the card only ever celebrates.
 * @param {Object} props
 * @param {number|string} props.year - The recap year.
 * @param {boolean} props.isDemo - Whether the card is being shown in demo mode.
 * @param {boolean} [props.isActive] - Controls entrance animations; should be true only when this carousel slide is visible.
 */
export function StrengthGainsCard({ year, isDemo, isActive = true }) {
  const { parsedData } = useUserLiftingData();
  const { isMetric } = useAthleteBio();
  const [e1rmFormula] = useLocalStorage(LOCAL_STORAGE_KEYS.FORMULA, "Brzycki", {
    initializeWithValue: false,
  });

  const { rows, gainedCount, comparableCount } = useMemo(
    () => computeStrengthGainsForYear(parsedData, year, e1rmFormula),
    [parsedData, year, e1rmFormula],
  );

  const displayRows = rows.map((row) => {
    const best = getDisplayWeight(row.best, isMetric);
    const prev = row.prevBest ? getDisplayWeight(row.prevBest, isMetric) : null;
    const gain = prev ? Math.round(best.value - prev.value) : null;
    return {
      liftType: row.liftType,
      value: Math.round(best.value),
      unit: best.unit,
      gain: gain != null && gain > 0 ? gain : null,
      isNew: !prev,
    };
  });

  const prevYear = parseInt(year, 10) - 1;
  const hasGain = gainedCount > 0;
  // Only claim "stronger than last year" when most lifts say so; otherwise
  // name what did climb.
  const heading =
    hasGain && gainedCount * 2 >= comparableCount
      ? `Stronger than ${prevYear}`
      : hasGain
        ? `${gainedCount === 1 ? "One lift" : `${gainedCount} lifts`} climbed in ${year}`
        : `Your best in ${year}`;
  const phrase = pickRecapPhrase(
    hasGain ? STRENGTH_GAINS_PHRASES : STRENGTH_BESTS_PHRASES,
    "strength-gains",
    year,
    parsedData?.length ?? 0,
  );

  return (
    <div className="flex w-full flex-col items-center justify-center text-center">
      <motion.div
        initial={{ opacity: 0, y: 16, rotate: -8 }}
        animate={
          isActive
            ? { opacity: 1, y: 0, rotate: 0 }
            : { opacity: 0, y: 16, rotate: -8 }
        }
        transition={{ type: "spring", stiffness: 220, damping: 16 }}
      >
        <TrendingUp className="text-chart-2 mb-3 h-12 w-12" />
      </motion.div>
      <motion.p
        className="text-foreground text-3xl leading-tight font-bold tracking-tight"
        initial={{ opacity: 0, y: 12 }}
        animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
        transition={{
          type: "spring",
          stiffness: 200,
          damping: 20,
          delay: isActive ? 0.08 : 0,
        }}
      >
        {heading}
      </motion.p>
      <motion.p
        className="text-muted-foreground mt-1 text-sm"
        initial={{ opacity: 0 }}
        animate={isActive ? { opacity: 1 } : { opacity: 0 }}
        transition={{ delay: isActive ? 0.15 : 0 }}
      >
        Estimated one rep max from your best set
      </motion.p>

      {displayRows.length > 0 ? (
        <ul className="mt-5 w-full space-y-2.5">
          {displayRows.map((row, i) => (
            <GainRow
              key={row.liftType}
              row={row}
              index={i}
              isActive={isActive}
            />
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground mt-6">
          Squat, bench, deadlift or press sets will show up here.
        </p>
      )}

      <motion.p
        className="text-muted-foreground mt-5 text-sm italic"
        initial={{ opacity: 0, y: 8 }}
        animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
        transition={{ delay: isActive ? 0.7 : 0 }}
      >
        {phrase}
      </motion.p>
    </div>
  );
}

function GainRow({ row, index, isActive }) {
  const value = useCountUp(row.value, isActive, {
    delay: 0.25 + index * 0.1,
  });
  return (
    <motion.li
      className="bg-background/60 flex items-center gap-3 rounded-lg border px-2 py-1.5 text-left"
      initial={{ opacity: 0, x: -16 }}
      animate={isActive ? { opacity: 1, x: 0 } : { opacity: 0, x: -16 }}
      transition={{
        type: "spring",
        stiffness: 220,
        damping: 22,
        delay: isActive ? 0.2 + index * 0.1 : 0,
      }}
    >
      <LiftArtwork liftType={row.liftType} size="sm" animate={false} />
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground truncate text-xs">{row.liftType}</p>
        <p className="text-foreground text-xl leading-tight font-bold tabular-nums">
          {value.toLocaleString()} {row.unit}
        </p>
      </div>
      {row.gain != null && (
        <motion.span
          className="bg-chart-2/15 text-chart-2 ring-chart-2/40 shrink-0 rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums ring-1"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={
            isActive ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.6 }
          }
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 14,
            delay: isActive ? 0.9 + index * 0.1 : 0,
          }}
        >
          +{row.gain.toLocaleString()} {row.unit}
        </motion.span>
      )}
      {row.isNew && (
        <span className="text-muted-foreground shrink-0 text-xs">
          New this year
        </span>
      )}
    </motion.li>
  );
}
