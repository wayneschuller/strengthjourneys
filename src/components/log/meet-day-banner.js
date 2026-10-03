/**
 * The log's look back at a past meet: a gold card above the session with the
 * meet's name, how long ago it was, the attempts that counted and the total.
 *
 * Only ever shown for a meet day in the past. On the day itself the log stays
 * exactly as it always is, because a lifter logging between attempts needs
 * the app they know, not a new layout. The caller enforces that by passing
 * the meet only when the session date is before today.
 */
import { motion, useReducedMotion } from "motion/react";

import { getDisplayWeight } from "@/lib/processing-utils";
import { toKg } from "@/lib/weight-units";
import { MEET_GOLD, MeetMedalGlyph } from "@/components/meet-medal";

const LB_PER_KG = 2.20462;

// The order a meet runs in, with the names lifters say.
const MEET_LIFTS = [
  { liftType: "Back Squat", name: "Squat" },
  { liftType: "Bench Press", name: "Bench" },
  { liftType: "Deadlift", name: "Deadlift" },
];

/**
 * @param {Object} props
 * @param {{name: string|null, topSets: Object}} props.meetDay - From meetDays.
 * @param {string} props.sessionDate - YYYY-MM-DD, always before today.
 * @param {string} props.todayIso - YYYY-MM-DD.
 * @param {boolean} props.isMetric - Display unit for weights and the total.
 */
export function MeetDayBanner({ meetDay, sessionDate, todayIso, isMetric }) {
  const prefersReducedMotion = useReducedMotion();
  const attempts = MEET_LIFTS.map(({ liftType, name }) => ({
    name,
    set: meetDay.topSets[liftType],
  })).filter(({ set }) => set);
  const total = getMeetTotal(meetDay.topSets, isMetric);
  const ago = getTimeAgo(sessionDate, todayIso);

  return (
    <motion.section
      aria-label="Meet day"
      className="relative mb-5 overflow-hidden rounded-2xl border px-4 py-3.5 sm:px-5"
      style={{
        borderColor: `color-mix(in srgb, ${MEET_GOLD} 55%, transparent)`,
        background: `linear-gradient(135deg, color-mix(in srgb, ${MEET_GOLD} 14%, var(--card)) 0%, var(--card) 60%)`,
      }}
      initial={prefersReducedMotion ? false : { opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <div className="flex items-center gap-3.5">
        <motion.span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2"
          style={{ borderColor: MEET_GOLD, background: "var(--background)" }}
          initial={prefersReducedMotion ? false : { scale: 0.4, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{
            type: "spring",
            stiffness: 260,
            damping: 12,
            delay: 0.15,
          }}
        >
          <MeetMedalGlyph size={24} />
        </motion.span>
        <div className="min-w-0 flex-1">
          <p className="text-base leading-snug font-semibold sm:text-lg">
            {meetDay.name ?? "Meet day"}
          </p>
          <p className="text-muted-foreground text-sm">
            {meetDay.name ? `Meet day, ${ago}` : capitalize(ago)}
          </p>
        </div>
      </div>

      {attempts.length > 0 && (
        <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-2">
          {attempts.map(({ name, set }) => {
            const { value, unit } = getDisplayWeight(set, isMetric);
            return (
              <div key={name} className="min-w-0">
                <p className="text-muted-foreground text-xs">{name}</p>
                <p className="font-semibold tabular-nums">
                  {value}
                  {unit}
                  {set.reps > 1 ? (
                    <span className="text-muted-foreground font-normal">
                      {` × ${set.reps}`}
                    </span>
                  ) : null}
                </p>
              </div>
            );
          })}
          {total && (
            <div className="ml-auto text-right">
              <p className="text-muted-foreground text-xs">Total</p>
              <p
                className="text-lg font-bold tabular-nums"
                style={{ color: MEET_GOLD }}
              >
                {total}
              </p>
            </div>
          )}
        </div>
      )}
    </motion.section>
  );
}

// A powerlifting total needs a single at each of squat, bench and deadlift;
// anything less is not a total, so nothing is shown.
function getMeetTotal(topSets, isMetric) {
  const singles = MEET_LIFTS.map(({ liftType }) => topSets[liftType]);
  if (singles.some((set) => !set || set.reps !== 1)) return null;
  const totalKg = singles.reduce(
    (sum, set) => sum + toKg(set.weight, set.unitType),
    0,
  );
  return isMetric
    ? `${Math.round(totalKg * 2) / 2}kg`
    : `${Math.round(totalKg * LB_PER_KG)}lb`;
}

function getTimeAgo(sessionDate, todayIso) {
  const [sy, sm, sd] = sessionDate.split("-").map(Number);
  const [ty, tm, td] = todayIso.split("-").map(Number);
  const months = (ty - sy) * 12 + (tm - sm) - (td < sd ? 1 : 0);
  if (months >= 12) {
    const years = Math.floor(months / 12);
    return `${years} year${years === 1 ? "" : "s"} ago`;
  }
  if (months >= 1) return `${months} month${months === 1 ? "" : "s"} ago`;
  const days = Math.round(
    (Date.UTC(ty, tm - 1, td) - Date.UTC(sy, sm - 1, sd)) / 86400000,
  );
  if (days <= 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  return `${Math.floor(days / 7)} weeks ago`;
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
