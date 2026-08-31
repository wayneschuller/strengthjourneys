
import { useRef, useMemo } from "react";
import { motion } from "motion/react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { Dumbbell } from "lucide-react";
import { computeTonnageForYear } from "@/lib/year-recap-stats";
import { getLiftSvgPath } from "@/components/year-recap/lift-svg";

/**
 * Recap slide displaying total weight moved (tonnage) for the year, a fun real-world equivalent comparison, and per-lift bar chart for the Big Four lifts.
 * Respects the user's preferred unit system (kg/lb) from athlete bio context.
 * @param {Object} props
 * @param {number|string} props.year - The recap year to compute tonnage for.
 * @param {boolean} props.isDemo - Whether the card is being shown in demo mode.
 * @param {boolean} [props.isActive] - Controls entrance animations; should be true only when this carousel slide is visible.
 */
export function TonnageCard({ year, isDemo, isActive = true }) {
  const equivRef = useRef(null);

  const { parsedData } = useUserLiftingData();
  const { isMetric } = useAthleteBio();

  const { tonnage, primaryUnit, prevYearTonnage, tonnageByLift } = useMemo(
    () => computeTonnageForYear(parsedData, year, isMetric ? "kg" : "lb"),
    [parsedData, year, isMetric],
  );

  const equiv = pickTonnageEquivalent(tonnage, primaryUnit, equivRef, `tonnage-${year}`);

  const showPrevYearComparison = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const isDecember = now.getMonth() === 11;
    const yearNum = parseInt(year, 10);
    return yearNum < currentYear || (yearNum === currentYear && isDecember);
  }, [year]);

  const isCurrentYear = Number(year) === new Date().getFullYear();
  const comparisonYearWord = isCurrentYear ? "last" : "previous";

  const comparisonText = useMemo(() => {
    if (!showPrevYearComparison || prevYearTonnage == null || prevYearTonnage <= 0) return null;
    const pct = Math.round(((tonnage - prevYearTonnage) / prevYearTonnage) * 100);
    if (pct > 0) return `Up ${pct}% from ${comparisonYearWord} year`;
    if (pct < 0) return `${Math.abs(pct)}% less than ${comparisonYearWord} year`;
    return `Same as ${comparisonYearWord} year`;
  }, [showPrevYearComparison, tonnage, prevYearTonnage, comparisonYearWord]);

  const yearPhrase = isCurrentYear ? "this year" : `in ${year}`;

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
        className="text-4xl font-bold tabular-nums text-foreground md:text-5xl"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={isActive ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
        transition={{ type: "spring", stiffness: 260, damping: 22, delay: isActive ? 0.08 : 0 }}
      >
        {formatYearTonnageTitle(tonnage)} {primaryUnit}
      </motion.p>
      <motion.p
        className="mt-2 text-xl font-semibold text-chart-2"
        initial={{ opacity: 0, y: 12 }}
        animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
        transition={{ type: "spring", stiffness: 180, damping: 20, delay: isActive ? 0.18 : 0 }}
      >
        moved {yearPhrase}
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
      {tonnageByLift.length > 0 && (
        <div className="mt-6 w-full max-w-xs space-y-2.5">
          {tonnageByLift.map(({ liftType, tonnage: liftTonnage }, i) => {
            const maxTonnage = Math.max(
              ...tonnageByLift.map((r) => r.tonnage),
              1,
            );
            const pct = (liftTonnage / maxTonnage) * 100;
            const svgPath = getLiftSvgPath(liftType);
            return (
              <motion.div
                key={liftType}
                className="flex items-center gap-2"
                initial={{ opacity: 0, x: -12 }}
                animate={
                  isActive ? { opacity: 1, x: 0 } : { opacity: 0, x: -12 }
                }
                transition={{
                  type: "spring",
                  stiffness: 200,
                  damping: 20,
                  delay: isActive ? 0.25 + i * 0.06 : 0,
                }}
              >
                <div className="flex h-20 w-20 shrink-0 items-center justify-center">
                  {svgPath ? (
                    <img
                      src={svgPath}
                      alt={liftType}
                      className="h-20 w-20 object-contain"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {liftType.slice(0, 2)}
                    </span>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 items-center">
                  <div className="flex h-5 min-w-0 flex-1 overflow-hidden rounded-md bg-muted/50">
                    <motion.div
                      className="h-full rounded-md"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: `var(--chart-${(i % 5) + 1})`,
                      }}
                      initial={{ width: 0 }}
                      animate={isActive ? { width: `${pct}%` } : { width: 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 180,
                        damping: 22,
                        delay: isActive ? 0.35 + i * 0.06 : 0,
                      }}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- Supporting functions ---

function formatYearTonnageTitle(value) {
  if (!value || value <= 0) return "0";
  return Math.round(value).toLocaleString();
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
