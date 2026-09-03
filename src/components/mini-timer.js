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
  const { time, isRunning, activeAlarmSeconds, handleRestart } = useTimer();

  if (!isRunning) return null; // Don't show if not running

  // An armed alarm point lights up here too, so the ping still has something
  // visible attached to it when the lifter is on another page.
  const isAlerting = activeAlarmSeconds !== null;

  return (
    <div
      className={cn(
        "cursor-pointer tracking-wide tabular-nums",
        isAlerting && "text-primary animate-pulse font-semibold",
      )}
      onClick={handleRestart}
      title="Gym timer. Click to restart."
    >
      {formatTime(time)}
    </div>
  );
}
