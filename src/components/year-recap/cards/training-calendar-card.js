import { useMemo } from "react";
import { motion } from "motion/react";
import {
  pickRecapPhrase,
  SEASONAL_PHRASES,
} from "@/components/year-recap/phrases";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { computeTrainingCalendarForYear } from "@/lib/year-recap-stats";
import { MEET_GOLD, MeetMedalGlyph } from "@/components/meet-medal";
import { cn } from "@/lib/utils";

// Cells are plain divs filled from the theme's heatmap ramp, the same colours
// the Long Game heatmaps use, so the card follows every theme and survives
// html2canvas (which cannot always resolve CSS variables inside SVG).
const LEVEL_BACKGROUNDS = [
  "var(--heatmap-0)",
  "var(--heatmap-1)",
  "var(--heatmap-2)",
  "var(--heatmap-3)",
  "var(--heatmap-4)",
];

/**
 * Recap slide showing every training day of the year as twelve small month
 * calendars, shaded by how much work each day held, with the busiest month as
 * the headline. Meet days are gold.
 * @param {Object} props
 * @param {number|string} props.year - The recap year.
 * @param {boolean} props.isDemo - Whether the card is being shown in demo mode.
 * @param {boolean} [props.isActive] - Controls entrance animations; should be true only when this carousel slide is visible.
 */
export function TrainingCalendarCard({ year, isDemo, isActive = true }) {
  const { parsedData, meetDays } = useUserLiftingData();
  const calendar = useMemo(
    () => computeTrainingCalendarForYear(parsedData, year, meetDays),
    [parsedData, year, meetDays],
  );
  const { months, busiestMonthIndex, busiestMonthCount, trainingDays } =
    calendar;
  const busiestMonth =
    busiestMonthIndex != null ? months[busiestMonthIndex].name : null;

  const phrase = busiestMonth
    ? pickRecapPhrase(
        SEASONAL_PHRASES,
        "calendar",
        year,
        parsedData?.length ?? 0,
      ).replace("{month}", busiestMonth)
    : null;

  return (
    <div className="flex w-full flex-col items-center justify-center text-center">
      <motion.p
        className="text-chart-3 text-lg font-semibold"
        initial={{ opacity: 0, y: -10 }}
        animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: -10 }}
        transition={{ type: "spring", stiffness: 220, damping: 22 }}
      >
        Busiest month
      </motion.p>
      <motion.p
        className="text-foreground text-4xl font-bold tracking-tight"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={
          isActive ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }
        }
        transition={{
          type: "spring",
          stiffness: 200,
          damping: 18,
          delay: isActive ? 0.08 : 0,
        }}
      >
        {busiestMonth ?? "Still to come"}
      </motion.p>
      {busiestMonth && (
        <motion.p
          className="text-muted-foreground mt-1 text-sm"
          initial={{ opacity: 0 }}
          animate={isActive ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: isActive ? 0.15 : 0 }}
        >
          {busiestMonthCount} session{busiestMonthCount === 1 ? "" : "s"} in{" "}
          {busiestMonth}, {trainingDays} across the year
        </motion.p>
      )}

      <div className="mt-5 grid w-full grid-cols-3 gap-x-3 gap-y-3">
        {months.map((month, i) => (
          <motion.div
            key={month.name}
            className="flex flex-col gap-1"
            initial={{ opacity: 0, y: 8 }}
            animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
            transition={{
              type: "spring",
              stiffness: 220,
              damping: 22,
              delay: isActive ? 0.2 + i * 0.045 : 0,
            }}
          >
            <span
              className={cn(
                "text-left text-[10px] leading-none font-medium",
                i === busiestMonthIndex
                  ? "text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {month.name.slice(0, 3)}
            </span>
            <div className="grid grid-cols-7 gap-[2px]">
              {Array.from({ length: month.leadingBlanks }).map((_, b) => (
                <div key={`blank-${b}`} className="aspect-square" />
              ))}
              {month.days.map((day) => (
                <div
                  key={day.date}
                  className="aspect-square rounded-[2px]"
                  style={{
                    background: day.isMeet
                      ? MEET_GOLD
                      : LEVEL_BACKGROUNDS[day.level],
                    opacity: day.isFuture ? 0.35 : 1,
                  }}
                />
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        className="text-muted-foreground mt-3 flex items-center gap-3 text-[10px]"
        initial={{ opacity: 0 }}
        animate={isActive ? { opacity: 1 } : { opacity: 0 }}
        transition={{ delay: isActive ? 0.8 : 0 }}
      >
        <span className="flex items-center gap-1">
          Less
          {LEVEL_BACKGROUNDS.slice(1).map((bg) => (
            <span
              key={bg}
              className="inline-block h-2 w-2 rounded-[2px]"
              style={{ background: bg }}
            />
          ))}
          More
        </span>
        {calendar.meetCount > 0 && (
          <span className="flex items-center gap-1">
            <MeetMedalGlyph size={10} color="#f59e0b" />
            Meet day
          </span>
        )}
      </motion.div>

      {phrase && (
        <motion.p
          className="text-muted-foreground mt-4 text-sm italic"
          initial={{ opacity: 0, y: 8 }}
          animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
          transition={{ delay: isActive ? 0.9 : 0 }}
        >
          {phrase}
        </motion.p>
      )}
    </div>
  );
}
