/**
 * Compact timer readout for the nav bar.
 *
 * Lives here rather than inside pages/timer.js so the nav does not have to
 * import a Next page module (and drag its SEO and article-fetching imports)
 * into every route in the app.
 *
 * Renders only while the timer is running, so it stays out of the way for the
 * majority of visitors who never touch the gym timer.
 */

import { formatTime, useTimer } from "@/hooks/use-timer";
import { cn } from "@/lib/utils";

export function MiniTimer() {
  const {
    time,
    isRunning,
    hasRestTarget,
    remainingSeconds,
    isOvertime,
    handleRestart,
  } = useTimer();

  if (!isRunning) return null; // Don't show if not running

  // Mid-rest the useful number is the time left. Once the target is behind us we
  // count the overtime instead, because "how far over am I" is the next question.
  let display = formatTime(time);
  if (hasRestTarget) {
    display = isOvertime
      ? `+${formatTime(-remainingSeconds)}`
      : formatTime(remainingSeconds);
  }

  return (
    <div
      className={cn(
        "cursor-pointer tracking-wide tabular-nums",
        isOvertime && "text-primary",
      )}
      onClick={handleRestart}
      title="Gym timer. Click to restart."
    >
      {display}
    </div>
  );
}
