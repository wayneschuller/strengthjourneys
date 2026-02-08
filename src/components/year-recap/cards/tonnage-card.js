"use client";

import { useRef, useMemo } from "react";
import { motion } from "motion/react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useLocalStorage } from "usehooks-ts";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { Dumbbell } from "lucide-react";

export function TonnageCard({ year, isDemo, isActive = true }) {
  const equivRef = useRef(null);

  const { parsedData } = useUserLiftingData();
  const [isMetricPreference] = useLocalStorage(
    LOCAL_STORAGE_KEYS.CALC_IS_METRIC,
    false,
    { initializeWithValue: false },
  );
  const preferredUnit = isMetricPreference ? "kg" : "lb";

  const { tonnage, primaryUnit, prevYearTonnage } = useMemo(
    () => computeTonnageForYear(parsedData, year, preferredUnit),
    [parsedData, year, preferredUnit],
  );

  const equiv = pickTonnageEquivalent(tonnage, primaryUnit, equivRef, `tonnage-${year}`);

  const comparisonText = useMemo(() => {
    if (prevYearTonnage == null || prevYearTonnage <= 0) return null;
    const pct = Math.round(((tonnage - prevYearTonnage) / prevYearTonnage) * 100);
    if (pct > 0) return `Up ${pct}% from last year`;
    if (pct < 0) return `${Math.abs(pct)}% less than last year`;
    return "Same as last year";
  }, [tonnage, prevYearTonnage]);

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
        {formatYearTonnage(tonnage)} {primaryUnit}
      </motion.p>
      <motion.p
        className="mt-2 text-xl font-semibold text-chart-2"
        initial={{ opacity: 0, y: 12 }}
        animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
        transition={{ type: "spring", stiffness: 180, damping: 20, delay: isActive ? 0.18 : 0 }}
      >
        moved this year
      </motion.p>
      {comparisonText && (
        <motion.p
          className="mt-2 text-sm text-muted-foreground"
          initial={{ opacity: 0, y: 8 }}
          animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
          transition={{ delay: isActive ? 0.25 : 0 }}
        >
          {comparisonText}
        </motion.p>
      )}
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

// --- Supporting functions ---

function formatYearTonnage(value) {
  if (!value || value <= 0) return "0";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${Math.round(value / 1_000)}k`;
  return value.toLocaleString();
}

const YEARLY_TONNAGE_EQUIVALENTS = {
  kg: [
    { name: "blue whale", weight: 150000, emoji: "🐋" },
    { name: "elephant", weight: 6000, emoji: "🐘" },
    { name: "school bus", weight: 5670, emoji: "🚌" },
    { name: "car", weight: 1500, emoji: "🚗" },
    { name: "cow", weight: 700, emoji: "🐄" },
    { name: "grand piano", weight: 300, emoji: "🎹" },
    { name: "vending machine", weight: 250, emoji: "🥤" },
    { name: "Eddie Hall", weight: 180, emoji: "🦍" },
    { name: "Labrador Retriever", weight: 30, emoji: "🐕" },
    { name: "rotisserie chicken", weight: 1.5, emoji: "🍗" },
  ],
  lb: [
    { name: "blue whale", weight: 330000, emoji: "🐋" },
    { name: "elephant", weight: 13200, emoji: "🐘" },
    { name: "school bus", weight: 12500, emoji: "🚌" },
    { name: "car", weight: 3300, emoji: "🚗" },
    { name: "cow", weight: 1540, emoji: "🐄" },
    { name: "grand piano", weight: 660, emoji: "🎹" },
    { name: "vending machine", weight: 550, emoji: "🥤" },
    { name: "Eddie Hall", weight: 400, emoji: "🦍" },
    { name: "Labrador Retriever", weight: 66, emoji: "🐕" },
    { name: "rotisserie chicken", weight: 3.3, emoji: "🍗" },
  ],
};

function pickTonnageEquivalent(tonnage, unitType, ref, key) {
  const equivalents = YEARLY_TONNAGE_EQUIVALENTS[unitType] ?? YEARLY_TONNAGE_EQUIVALENTS.lb;
  const valid = equivalents.filter((eq) => tonnage / eq.weight >= 0.1);
  const candidates = valid.length > 0 ? valid : equivalents;

  if (ref.current && ref.current[key]) {
    return ref.current[key];
  }

  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  const result = {
    name: chosen.name,
    count: tonnage / chosen.weight,
    emoji: chosen.emoji,
  };
  if (!ref.current) ref.current = {};
  ref.current[key] = result;
  return result;
}

function computeTonnageForYear(parsedData, year, preferredUnit) {
  if (!parsedData || !year) {
    return { tonnage: 0, primaryUnit: preferredUnit || "lb", prevYearTonnage: null };
  }
  const prevYear = String(parseInt(year, 10) - 1);
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const prevYearStart = `${prevYear}-01-01`;
  const prevYearEnd = `${prevYear}-12-31`;
  const tonnageByUnit = {};
  const prevYearTonnageByUnit = {};
  parsedData.forEach((entry) => {
    if (entry.isGoal || !entry.date) return;
    const tonnage = (entry.weight ?? 0) * (entry.reps ?? 0);
    const u = entry.unitType || "lb";
    if (entry.date >= yearStart && entry.date <= yearEnd) {
      tonnageByUnit[u] = (tonnageByUnit[u] ?? 0) + tonnage;
    }
    if (entry.date >= prevYearStart && entry.date <= prevYearEnd) {
      prevYearTonnageByUnit[u] = (prevYearTonnageByUnit[u] ?? 0) + tonnage;
    }
  });
  const unitKeys = Object.keys(tonnageByUnit);
  const primaryUnit =
    preferredUnit && unitKeys.includes(preferredUnit)
      ? preferredUnit
      : unitKeys[0] || "lb";
  const KG_PER_LB = 1 / 2.2046;
  const LB_PER_KG = 2.2046;
  let tonnage = tonnageByUnit[primaryUnit] ?? 0;
  unitKeys.forEach((u) => {
    if (u === primaryUnit) return;
    const v = tonnageByUnit[u] ?? 0;
    if (u === "kg" && primaryUnit === "lb") tonnage += v * LB_PER_KG;
    else if (u === "lb" && primaryUnit === "kg") tonnage += v * KG_PER_LB;
  });
  const prevUnitKeys = Object.keys(prevYearTonnageByUnit);
  let prevYearTonnage = prevYearTonnageByUnit[primaryUnit] ?? 0;
  prevUnitKeys.forEach((u) => {
    if (u === primaryUnit) return;
    const v = prevYearTonnageByUnit[u] ?? 0;
    if (u === "kg" && primaryUnit === "lb") prevYearTonnage += v * LB_PER_KG;
    else if (u === "lb" && primaryUnit === "kg") prevYearTonnage += v * KG_PER_LB;
  });
  return {
    tonnage,
    primaryUnit,
    prevYearTonnage: prevYearTonnage > 0 ? prevYearTonnage : null,
  };
}
