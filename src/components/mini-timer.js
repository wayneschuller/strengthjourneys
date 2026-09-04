/**
 * Compact timer readout for the nav bar.
 *
 * Lives here rather than inside pages/timer.js so the nav does not have to
 * import a Next page module (and drag its SEO and article-fetching imports)
 * into every route in the app.
 *
 * The pill carries two separate hit areas. The digits keep the original
 * behaviour, one tap to restart, because that is the action taken between every
 * single set, often with chalk on the hands, and it should never cost more than
 * one press. The caret beside them opens a panel holding everything else the
 * timer can do, which is otherwise unreachable the moment a lifter leaves
 * /timer: pausing, resetting, and changing or muting the ping.
 *
 * Renders only once the clock has actually been used, so it stays out of the way
 * for the majority of visitors who never touch the gym timer.
 */

import { useState } from "react";

import Link from "next/link";

import { ChevronDown } from "lucide-react";

import { TimerDigits } from "@/components/timer-digits";
import {
  TimerPingControls,
  TimerTransportControls,
} from "@/components/timer-controls";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { formatTime, useTimer } from "@/hooks/use-timer";
import { gaEvent, GA_EVENT_TAGS } from "@/lib/analytics";
import { cn } from "@/lib/utils";

export function MiniTimer() {
  const { time, isRunning, activePingSeconds } = useTimer();
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // Stay in the nav while paused rather than only while running. Pausing from
  // inside the panel would otherwise unmount the very thing being used, and a
  // paused clock with time banked on it is still worth a glance. Reset to zero
  // is the gesture that puts the timer away.
  if (!isRunning && time === 0) return null;

  // A ping lights up here too, so it still has something visible attached to it
  // when the lifter is on another page.
  const isAlerting = activePingSeconds !== null;
  const display = formatTime(time);

  const handleOpenChange = (nextOpen) => {
    setIsPanelOpen(nextOpen);
    if (nextOpen) gaEvent(GA_EVENT_TAGS.TIMER_MINI_PANEL_OPENED);
  };

  return (
    <div
      className={cn(
        "border-input flex h-9 shrink-0 items-center rounded-full border transition-colors",
        isAlerting && "border-primary bg-primary/10",
      )}
    >
      <MiniTimerRestartButton
        display={display}
        isAlerting={isAlerting}
        isRunning={isRunning}
      />

      <Popover open={isPanelOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring flex h-9 w-7 items-center justify-center rounded-r-full pr-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
            title="Timer controls"
          >
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                isPanelOpen && "rotate-180",
              )}
            />
            <span className="sr-only">Open the timer controls</span>
          </button>
        </PopoverTrigger>

        {/* Anchored to the right edge because the pill sits in the nav's
            right-hand cluster, with collision padding so a narrow phone screen
            keeps the whole panel on screen. */}
        <PopoverContent
          align="end"
          collisionPadding={12}
          className="flex w-72 flex-col gap-4"
        >
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-semibold tracking-wide tabular-nums">
              {display}
            </span>
            <span className="text-muted-foreground text-xs">
              {isRunning ? "Gym timer" : "Paused"}
            </span>
          </div>

          <TimerTransportControls variant="compact" />

          <Separator />

          <TimerPingControls variant="compact" />

          <Separator />

          <Link
            href="/timer"
            prefetch={false}
            className="text-muted-foreground hover:text-foreground text-center text-sm transition-colors"
            onClick={() => setIsPanelOpen(false)}
          >
            Open the full timer
          </Link>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/**
 * The digits half of the pill: one tap restarts the set.
 *
 * Dimmed while paused so a clock that is standing still never reads as a broken
 * one.
 */
function MiniTimerRestartButton({ display, isAlerting, isRunning }) {
  const { handleRestart } = useTimer();

  return (
    <button
      type="button"
      onClick={handleRestart}
      title="Gym timer. Click to restart."
      // The digits render as one span per character, which a screen reader would
      // otherwise spell out letter by letter. The clock itself is announced
      // properly on /timer; here the action is the thing worth naming.
      aria-label="Restart the set timer"
      className={cn(
        "focus-visible:ring-ring h-9 rounded-l-full pr-1.5 pl-3 tracking-wide tabular-nums transition-colors focus-visible:ring-2 focus-visible:outline-none",
        isAlerting && "text-primary animate-pulse font-semibold",
        !isRunning && "text-muted-foreground",
      )}
    >
      <TimerDigits value={display} />
    </button>
  );
}
