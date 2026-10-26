import { useMemo } from "react";
import { motion } from "motion/react";
import {
  Activity,
  Compass,
  Gem,
  Hammer,
  Layers,
  Medal,
  Rocket,
  Sun,
  Timer,
  Trophy,
} from "lucide-react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import {
  computeLifterTypeForYear,
  WEEKDAY_NAMES,
} from "@/lib/year-recap-stats";
import { cn } from "@/lib/utils";

const TYPE_ICONS = {
  competitor: Medal,
  metronome: Timer,
  momentum: Rocket,
  heavy: Hammer,
  volume: Layers,
  specialist: Gem,
  explorer: Compass,
  weekend: Sun,
  "all-rounder": Trophy,
  builder: Activity,
};

/**
 * Recap slide naming the lifter's type for the year (The Metronome, The Heavy
 * Hitter and so on), with the habits behind it: favourite training day, most
 * common set, and how many different lifts they trained.
 * @param {Object} props
 * @param {number|string} props.year - The recap year.
 * @param {boolean} props.isDemo - Whether the card is being shown in demo mode.
 * @param {boolean} [props.isActive] - Controls entrance animations; should be true only when this carousel slide is visible.
 */
export function LifterTypeCard({ year, isDemo, isActive = true }) {
  const { parsedData, meetDays } = useUserLiftingData();
  const lifterType = useMemo(
    () => computeLifterTypeForYear(parsedData, year, meetDays),
    [parsedData, year, meetDays],
  );

  if (!lifterType) {
    return (
      <div className="text-muted-foreground flex flex-col items-center text-center">
        <Activity className="text-chart-1 mb-4 h-12 w-12" />
        <p>A few more sessions and your lifter type will appear here.</p>
      </div>
    );
  }

  const Icon = TYPE_ICONS[lifterType.id] ?? Activity;
  const maxWeekday = Math.max(...lifterType.weekdayCounts, 1);
  const favouriteIndex = WEEKDAY_NAMES.indexOf(lifterType.favouriteWeekday);

  return (
    <div className="flex w-full flex-col items-center justify-center text-center">
      <motion.p
        className="text-chart-1 text-lg font-semibold"
        initial={{ opacity: 0 }}
        animate={isActive ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.4 }}
      >
        Your {year} lifter type
      </motion.p>

      <motion.div
        className="bg-chart-1/15 ring-chart-1/40 mt-4 flex h-24 w-24 items-center justify-center rounded-full ring-2"
        initial={{ opacity: 0, scale: 0.3, rotate: -90 }}
        animate={
          isActive
            ? { opacity: 1, scale: 1, rotate: 0 }
            : { opacity: 0, scale: 0.3, rotate: -90 }
        }
        transition={{
          type: "spring",
          stiffness: 180,
          damping: 12,
          delay: isActive ? 0.2 : 0,
        }}
      >
        <Icon className="text-chart-1 h-12 w-12" strokeWidth={1.75} />
      </motion.div>

      <motion.p
        className="text-foreground mt-4 text-4xl leading-none font-extrabold tracking-tight"
        initial={{ opacity: 0, y: 20, scale: 0.9 }}
        animate={
          isActive
            ? { opacity: 1, y: 0, scale: 1 }
            : { opacity: 0, y: 20, scale: 0.9 }
        }
        transition={{
          type: "spring",
          stiffness: 200,
          damping: 16,
          delay: isActive ? 0.55 : 0,
        }}
      >
        {lifterType.title}
      </motion.p>
      <motion.p
        className="text-muted-foreground mt-3 max-w-[16rem] text-sm"
        initial={{ opacity: 0, y: 8 }}
        animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
        transition={{ delay: isActive ? 0.75 : 0 }}
      >
        {lifterType.description}
      </motion.p>

      <motion.div
        className="mt-6 w-full"
        initial={{ opacity: 0 }}
        animate={isActive ? { opacity: 1 } : { opacity: 0 }}
        transition={{ delay: isActive ? 0.9 : 0 }}
      >
        <div className="flex h-16 items-end justify-center gap-2">
          {lifterType.weekdayCounts.map((count, i) => (
            <div
              key={WEEKDAY_NAMES[i]}
              className="flex h-full w-7 flex-col items-center justify-end gap-1"
            >
              <motion.div
                className={cn(
                  "w-full rounded-t-sm",
                  i === favouriteIndex
                    ? "bg-chart-1"
                    : "bg-muted-foreground/25",
                )}
                style={{
                  height: `${Math.max(6, (count / maxWeekday) * 100)}%`,
                  transformOrigin: "bottom",
                }}
                initial={{ scaleY: 0 }}
                animate={isActive ? { scaleY: 1 } : { scaleY: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 220,
                  damping: 20,
                  delay: isActive ? 0.95 + i * 0.05 : 0,
                }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-center gap-2">
          {WEEKDAY_NAMES.map((day, i) => (
            <span
              key={day}
              className={cn(
                "w-7 text-[10px]",
                i === favouriteIndex
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground",
              )}
            >
              {day.slice(0, 3)}
            </span>
          ))}
        </div>
      </motion.div>

      <motion.dl
        className="mt-5 grid w-full grid-cols-3 gap-2"
        initial={{ opacity: 0, y: 10 }}
        animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
        transition={{ delay: isActive ? 1.2 : 0 }}
      >
        <Trait label="Favourite day" value={lifterType.favouriteWeekday} />
        <Trait
          label="Go-to set"
          value={
            lifterType.favouriteReps
              ? `${lifterType.favouriteReps} rep${lifterType.favouriteReps === 1 ? "" : "s"}`
              : null
          }
        />
        <Trait label="Lifts trained" value={lifterType.distinctLifts} />
      </motion.dl>
    </div>
  );
}

function Trait({ label, value }) {
  if (value == null) return <div />;
  return (
    <div className="bg-background/60 rounded-lg border px-1 py-2">
      <dt className="text-muted-foreground text-[10px] leading-tight">
        {label}
      </dt>
      <dd className="text-foreground mt-0.5 text-sm font-semibold">{value}</dd>
    </div>
  );
}
