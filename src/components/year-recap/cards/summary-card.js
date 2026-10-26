import { useMemo } from "react";
import { motion } from "motion/react";
import { useSession } from "next-auth/react";
import {
  pickRecapPhrase,
  SUMMARY_PHRASES,
} from "@/components/year-recap/phrases";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import {
  computeLifterTypeForYear,
  computeMostTrainedLiftForYear,
  computeSessionStatsForYear,
  computeTonnageForYear,
  computeTrainingCalendarForYear,
} from "@/lib/year-recap-stats";
import { getLifetimePRsAchievedInYear } from "@/lib/processing-utils";
import { LiftArtwork } from "@/components/lift-artwork";
import { getRecapFirstName } from "@/components/year-recap/cards/title-card";

const compactNumber = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/**
 * Recap slide that puts the whole year on one card: lifter type, sessions,
 * tonnage, lifetime PRs, best streak, busiest month and the most trained lift.
 * Built to be the single image someone posts when they post only one.
 * @param {Object} props
 * @param {number|string} props.year - The recap year.
 * @param {boolean} props.isDemo - Whether the card is being shown in demo mode.
 * @param {boolean} [props.isActive] - Controls entrance animations; should be true only when this carousel slide is visible.
 */
export function SummaryCard({ year, isDemo, isActive = true }) {
  const { data: session } = useSession();
  const { parsedData, meetDays } = useUserLiftingData();
  const { isMetric } = useAthleteBio();

  const summary = useMemo(() => {
    const sessions = computeSessionStatsForYear(parsedData, year);
    const tonnage = computeTonnageForYear(
      parsedData,
      year,
      isMetric ? "kg" : "lb",
    );
    const { mostTrainedLift } = computeMostTrainedLiftForYear(parsedData, year);
    const calendar = computeTrainingCalendarForYear(parsedData, year, meetDays);
    return {
      sessions,
      tonnage,
      mostTrainedLift,
      prCount: getLifetimePRsAchievedInYear(parsedData, year).length,
      lifterType: computeLifterTypeForYear(parsedData, year, meetDays),
      busiestMonth:
        calendar.busiestMonthIndex != null
          ? calendar.months[calendar.busiestMonthIndex].name
          : null,
    };
  }, [parsedData, year, isMetric, meetDays]);

  const firstName = isDemo ? null : getRecapFirstName(session);
  const phrase = pickRecapPhrase(
    SUMMARY_PHRASES,
    "summary",
    year,
    parsedData?.length ?? 0,
  );
  const grade = summary.sessions.consistencyGrade?.grade;

  const tiles = [
    {
      label: "Sessions",
      value: summary.sessions.count.toLocaleString(),
    },
    {
      label: `${summary.tonnage.primaryUnit} lifted`,
      value: compactNumber.format(Math.round(summary.tonnage.tonnage)),
    },
    { label: "Lifetime PRs", value: summary.prCount },
    {
      label: "Best streak",
      value: `${summary.sessions.bestStreak} wk${summary.sessions.bestStreak === 1 ? "" : "s"}`,
    },
    { label: "Busiest month", value: summary.busiestMonth?.slice(0, 3) },
    { label: "Consistency", value: grade && grade !== "." ? grade : null },
  ].filter((tile) => tile.value != null && tile.value !== "");

  return (
    <div className="flex w-full flex-col items-center justify-center text-center">
      <motion.p
        className="text-muted-foreground text-sm"
        initial={{ opacity: 0 }}
        animate={isActive ? { opacity: 1 } : { opacity: 0 }}
      >
        {firstName ? `${firstName}'s` : "My"} Strength Unwrapped
      </motion.p>
      <motion.p
        className="text-chart-4 text-5xl leading-none font-extrabold tracking-tight"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={
          isActive ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }
        }
        transition={{ type: "spring", stiffness: 200, damping: 16 }}
      >
        {year}
      </motion.p>

      {summary.mostTrainedLift && (
        <motion.div
          className="mt-3"
          initial={{ opacity: 0, y: 10 }}
          animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ delay: isActive ? 0.1 : 0 }}
        >
          <LiftArtwork
            liftType={summary.mostTrainedLift}
            size="md"
            animate
            isActive={isActive}
          />
        </motion.div>
      )}

      {summary.lifterType && (
        <motion.div
          className="mt-2"
          initial={{ opacity: 0, y: 10 }}
          animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ delay: isActive ? 0.2 : 0 }}
        >
          <p className="text-foreground text-2xl leading-tight font-bold tracking-tight">
            {summary.lifterType.title}
          </p>
          {summary.mostTrainedLift && (
            <p className="text-muted-foreground text-xs">
              Most trained: {summary.mostTrainedLift}
            </p>
          )}
        </motion.div>
      )}

      <div className="mt-4 grid w-full grid-cols-3 gap-2">
        {tiles.map((tile, i) => (
          <motion.div
            key={tile.label}
            className="bg-background/60 rounded-lg border px-1 py-2"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={
              isActive ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.85 }
            }
            transition={{
              type: "spring",
              stiffness: 260,
              damping: 20,
              delay: isActive ? 0.3 + i * 0.06 : 0,
            }}
          >
            <p
              className="text-xl leading-tight font-bold tabular-nums"
              style={{ color: `var(--chart-${(i % 5) + 1})` }}
            >
              {tile.value}
            </p>
            <p className="text-muted-foreground text-[10px] leading-tight">
              {tile.label}
            </p>
          </motion.div>
        ))}
      </div>

      <motion.p
        className="text-muted-foreground mt-4 text-sm italic"
        initial={{ opacity: 0, y: 8 }}
        animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
        transition={{ delay: isActive ? 0.75 : 0 }}
      >
        {phrase}
      </motion.p>
    </div>
  );
}
