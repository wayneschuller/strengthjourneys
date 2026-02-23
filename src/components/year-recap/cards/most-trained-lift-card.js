
import { useRef, useMemo } from "react";
import { motion } from "motion/react";
import {
  pickQuirkyPhrase,
  MOST_TRAINED_LIFT_PHRASES,
  MOST_TRAINED_LIFT_LABELS,
} from "../phrases";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { getLiftVolumeMultiplier } from "@/lib/processing-utils";
import { Trophy } from "lucide-react";
import { LiftSvg } from "../lift-svg";

/**
 * Recap slide highlighting the lift the user trained most frequently during the given year, with set/rep counts and a session frequency sentence.
 * Displays the lift's SVG illustration with a spring animation when active.
 * @param {Object} props
 * @param {number|string} props.year - The recap year to compute the most-trained lift for.
 * @param {boolean} props.isDemo - Whether the card is being shown in demo mode.
 * @param {boolean} [props.isActive] - Controls entrance animations; should be true only when this carousel slide is visible.
 */
export function MostTrainedLiftCard({ year, isDemo, isActive = true }) {
  const phraseRef = useRef(null);
  const label = pickQuirkyPhrase(
    MOST_TRAINED_LIFT_LABELS,
    phraseRef,
    `most-trained-label-${year}`,
  );
  const phrase = pickQuirkyPhrase(
    MOST_TRAINED_LIFT_PHRASES,
    phraseRef,
    `most-trained-${year}`,
  );

  const { parsedData } = useUserLiftingData();
  const stats = useMemo(
    () => computeMostTrainedLiftForYear(parsedData, year),
    [parsedData, year],
  );

  const {
    mostTrainedLift: lift,
    mostTrainedLiftSets: sets,
    mostTrainedLiftReps: reps,
    mostTrainedLiftSessions: sessionsWithLift,
    sessionCount,
  } = stats;

  const sessionsLine =
    lift &&
    sessionCount > 0 &&
    sessionsWithLift > 0 &&
    (() => {
      const ratio = sessionCount / sessionsWithLift;
      if (ratio <= 1.5) return `Every gym session had ${lift}`;
      const n = Math.round(ratio);
      return `On average every ${ordinal(n)} gym session had ${lift}`;
    })();

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
        <span className="block">{label}</span>
        <span className="block">in {year}</span>
      </motion.p>
      <motion.p
        className="mt-2 text-4xl font-bold text-foreground md:text-5xl"
        initial={{ opacity: 0, x: -24 }}
        animate={isActive ? { opacity: 1, x: 0 } : { opacity: 0, x: -24 }}
        transition={{ type: "spring", stiffness: 180, damping: 18, delay: isActive ? 0.35 : 0 }}
      >
        {lift ?? "—"}
      </motion.p>
      {lift && (sets > 0 || reps > 0) && (
        <motion.p
          className="mt-2 text-sm text-muted-foreground"
          initial={{ opacity: 0, y: 8 }}
          animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
          transition={{ delay: isActive ? 0.4 : 0 }}
        >
          {sets.toLocaleString()} sets, {reps.toLocaleString()} reps
        </motion.p>
      )}
      {sessionsLine && (
        <motion.p
          className="mt-2 text-sm text-muted-foreground"
          initial={{ opacity: 0, y: 8 }}
          animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
          transition={{ delay: isActive ? 0.45 : 0 }}
        >
          {sessionsLine}
        </motion.p>
      )}
      <motion.p
        className="mt-3 text-sm italic text-muted-foreground"
        initial={{ opacity: 0, x: 20 }}
        animate={isActive ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
        transition={{ delay: isActive ? 0.5 : 0 }}
      >
        {phrase}
      </motion.p>
    </div>
  );
}

// --- Supporting functions ---

function ordinal(n) {
  if (n <= 0) return String(n);
  const s = String(n);
  const last = s.slice(-1);
  const lastTwo = s.slice(-2);
  if (lastTwo === "11" || lastTwo === "12" || lastTwo === "13") return `${n}th`;
  if (last === "1") return `${n}st`;
  if (last === "2") return `${n}nd`;
  if (last === "3") return `${n}rd`;
  return `${n}th`;
}

function computeMostTrainedLiftForYear(parsedData, year) {
  const empty = {
    mostTrainedLift: null,
    mostTrainedLiftSets: 0,
    mostTrainedLiftReps: 0,
    mostTrainedLiftSessions: 0,
    sessionCount: 0,
  };
  if (!parsedData || !year) return empty;
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const sessionDates = new Set();
  const liftTypeSets = {};
  const liftTypeReps = {};
  const liftTypeSessionDates = {};
  parsedData.forEach((entry) => {
    if (entry.isGoal || !entry.date) return;
    if (entry.date < yearStart || entry.date > yearEnd) return;
    sessionDates.add(entry.date);
    const lt = entry.liftType;
    liftTypeSets[lt] = (liftTypeSets[lt] ?? 0) + 1;
    liftTypeReps[lt] = (liftTypeReps[lt] ?? 0) + (entry.reps ?? 0);
    if (!liftTypeSessionDates[lt]) liftTypeSessionDates[lt] = new Set();
    liftTypeSessionDates[lt].add(entry.date);
  });
  const sessionCount = sessionDates.size;
  const mostTrainedEntry =
    Object.keys(liftTypeSets).length > 0
      ? Object.entries(liftTypeSets)
          .sort(
            (a, b) =>
              b[1] * getLiftVolumeMultiplier(b[0]) -
              a[1] * getLiftVolumeMultiplier(a[0]),
          )[0]
      : null;
  const mostTrainedLift = mostTrainedEntry ? mostTrainedEntry[0] : null;
  const mostTrainedLiftSets = mostTrainedLift ? liftTypeSets[mostTrainedLift] : 0;
  const mostTrainedLiftReps = mostTrainedLift ? liftTypeReps[mostTrainedLift] : 0;
  const mostTrainedLiftSessions =
    mostTrainedLift && liftTypeSessionDates[mostTrainedLift]
      ? liftTypeSessionDates[mostTrainedLift].size
      : 0;
  return {
    mostTrainedLift,
    mostTrainedLiftSets,
    mostTrainedLiftReps,
    mostTrainedLiftSessions,
    sessionCount,
  };
}
