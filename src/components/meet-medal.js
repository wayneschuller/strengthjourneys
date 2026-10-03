/**
 * The meet medal: one gold and one glyph for every place a powerlifting meet
 * is marked (the strength and tonnage charts, the Long Game heatmaps), plus
 * the small lookups the heatmaps need to find a meet by month or week.
 *
 * Meets come from meetDays in the data provider (lib/meet-detection.js).
 * Anything that marks a meet should link to that day in the log.
 */
import {
  getCalendarYearWeekIndexFromWeekKey,
  getWeekKeyFromDateStr,
} from "@/lib/date-utils";

// Falls back to a literal in case a build ever drops Tailwind's palette
// variable for want of an amber utility.
export const MEET_GOLD = "var(--color-amber-500, #f59e0b)";

/**
 * A medal on a ribbon. Scales with `size`, inherits nothing, safe to drop
 * into a heatmap cell or a tooltip line. `color` lets an image capture pass a
 * literal gold, since canvas renderers cannot always resolve a CSS variable
 * inside SVG attributes.
 */
export function MeetMedalGlyph({
  size = 14,
  className = "",
  color = MEET_GOLD,
}) {
  return (
    <svg
      viewBox="-8 -8 16 16"
      width={size}
      height={size}
      aria-hidden="true"
      className={className}
    >
      <path
        d="M -3.2 -6 L 0 -1.3 L 3.2 -6"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={0} cy={2.4} r={3.6} fill={color} />
    </svg>
  );
}

/**
 * One line for a heatmap tooltip: the medal, the meet's name and its day.
 * `meet` is a meetDays entry plus its date ({ date, name, topSets }).
 */
export function MeetTooltipLine({ meet, showDate = true }) {
  if (!meet) return null;
  const [y, m, d] = meet.date.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  return (
    <p className="flex items-start gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
      <MeetMedalGlyph size={13} className="mt-px shrink-0" />
      <span>
        {meet.name ?? "Meet day"}
        {showDate ? ` · ${day}` : ""}
      </span>
    </p>
  );
}

export function getMeetLogHref(meet) {
  return `/log?date=${meet.date}`;
}

/**
 * The first meet in each month, keyed `${year}-${month}` (month 1 to 12).
 * Two meets in one month is rare enough that the first one stands for both.
 */
export function indexMeetsByMonth(meetDays) {
  const byMonth = new Map();
  for (const [date, meetDay] of meetDays ?? []) {
    const key = `${Number(date.slice(0, 4))}-${Number(date.slice(5, 7))}`;
    if (!byMonth.has(key)) byMonth.set(key, { date, ...meetDay });
  }
  return byMonth;
}

/**
 * The first meet in each calendar-year week, keyed `${year}-${weekNum}` to
 * match the weekly grid's columns.
 */
export function indexMeetsByWeek(meetDays) {
  const byWeek = new Map();
  for (const [date, meetDay] of meetDays ?? []) {
    const year = Number(date.slice(0, 4));
    const weekNum = getCalendarYearWeekIndexFromWeekKey(
      year,
      getWeekKeyFromDateStr(date),
    );
    const key = `${year}-${weekNum}`;
    if (!byWeek.has(key)) byWeek.set(key, { date, ...meetDay });
  }
  return byWeek;
}
