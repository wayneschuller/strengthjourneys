/**
 * The meet medal for a single set: a small gold medal beside any PR set that
 * was lifted at a powerlifting meet, naming the meet in its tooltip.
 *
 * Reads meetDays from the data provider, so a caller only passes the set's
 * date. Renders nothing on a training day. The gold and the glyph are the
 * shared ones from meet-medal.js.
 */
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { MeetMedalGlyph } from "@/components/meet-medal";
import { cn } from "@/lib/utils";

export function getMeetSetLabel(meetDay) {
  return meetDay?.name ? `Set at ${meetDay.name}` : "Set at a meet";
}

export function MeetSetMedal({ date, size = 13, className = "" }) {
  const meetDays = useUserLiftingData()?.meetDays;
  const meetDay = date ? meetDays?.get(date) : null;
  if (!meetDay) return null;

  const label = getMeetSetLabel(meetDay);
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn("inline-flex shrink-0 items-center align-middle", className)}
    >
      <MeetMedalGlyph size={size} />
    </span>
  );
}
