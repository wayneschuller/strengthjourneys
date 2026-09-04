/**
 * The gym timer's control deck, shared by the /timer page and the nav bar's
 * MiniTimer panel.
 *
 * Lives here rather than inside pages/timer.js for the same reason
 * components/mini-timer.js does: the nav bar must not have to import a Next page
 * module (and drag its SEO and article-fetching imports) into every route.
 *
 * Two variants, because the same controls have to work at two very different
 * sizes. "page" is the deck under the giant clock, sized to be hit from arm's
 * length at a rack. "compact" is the same set of actions folded into the nav
 * popover, where the width is fixed and the lifter is holding the phone.
 * Everything reads from the shared TimerProvider, so both copies drive one clock.
 */

import {
  Pause,
  Play,
  RotateCcw,
  TimerReset,
  Volume2,
  VolumeX,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTimer } from "@/hooks/use-timer";
import { cn } from "@/lib/utils";

// A repeating ping rather than a one-shot alarm: a lifter who misses one still
// gets the next, and the numbers match how rest between working sets actually
// runs. The clock never stops at any of them.
export const PING_INTERVALS = [
  { label: "Off", shortLabel: "Off", seconds: 0 },
  { label: "2 min", shortLabel: "2m", seconds: 120 },
  { label: "3 min", shortLabel: "3m", seconds: 180 },
  { label: "5 min", shortLabel: "5m", seconds: 300 },
  { label: "7 min", shortLabel: "7m", seconds: 420 },
  { label: "10 min", shortLabel: "10m", seconds: 600 },
];

/**
 * Restart, start/stop and reset-to-zero.
 *
 * Restart leads in both variants because it is the one pressed between every
 * set. In the compact variant it takes the full width left over by the two icon
 * buttons, which also makes it the panel's answer to a lifter who never
 * discovered that the clock itself is tappable.
 *
 * @param {Object} props
 * @param {"page"|"compact"} [props.variant]
 */
export function TimerTransportControls({ variant = "page" }) {
  const { isRunning, handleStartStop, handleReset, handleRestart } = useTimer();

  const isCompact = variant === "compact";
  const startStopLabel = isRunning ? "Stop the clock" : "Start the clock";

  return (
    <div className={cn("flex items-center gap-3", isCompact && "w-full gap-2")}>
      <Button
        className={cn(
          "rounded-full tracking-tight transition-transform active:scale-95 [&_svg]:size-5",
          isCompact
            ? "h-11 flex-1 text-base"
            : "h-14 px-8 text-lg md:h-16 md:px-10 md:text-xl",
        )}
        onClick={handleRestart}
      >
        <RotateCcw />
        Restart
      </Button>
      <Button
        variant="outline"
        size="icon"
        className={cn(
          "rounded-full transition-transform active:scale-95 [&_svg]:size-5",
          isCompact ? "h-11 w-11" : "h-12 w-12",
        )}
        onClick={handleStartStop}
        title={startStopLabel}
      >
        {isRunning ? <Pause /> : <Play />}
        <span className="sr-only">{startStopLabel}</span>
      </Button>
      <Button
        variant="outline"
        size="icon"
        className={cn(
          "rounded-full transition-transform active:scale-95 [&_svg]:size-5",
          isCompact ? "h-11 w-11" : "h-12 w-12",
        )}
        onClick={handleReset}
        title="Reset to zero"
      >
        <TimerReset />
        <span className="sr-only">Reset to zero</span>
      </Button>
    </div>
  );
}

/**
 * Choosing the repeating ping interval, and muting its sound.
 *
 * The mute toggle only appears once an interval is chosen, because with the ping
 * off there is nothing for it to silence.
 *
 * @param {Object} props
 * @param {"page"|"compact"} [props.variant]
 */
export function TimerPingControls({ variant = "page" }) {
  const { pingIntervalSeconds, isMuted, setIsMuted, setPingInterval } =
    useTimer();

  const isCompact = variant === "compact";
  const muteLabel = isMuted
    ? "Turn the ping sound on"
    : "Turn the ping sound off";

  return (
    <div
      className={cn(
        "flex w-full flex-col items-center gap-2",
        !isCompact && "md:w-auto md:flex-row md:gap-3",
        isCompact && "items-stretch",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-1",
          isCompact && "justify-between",
        )}
      >
        <span className="text-muted-foreground text-sm">Ping every</span>
        {pingIntervalSeconds > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={() => setIsMuted(!isMuted)}
            title={muteLabel}
          >
            {isMuted ? <VolumeX /> : <Volume2 />}
            <span className="sr-only">{muteLabel}</span>
          </Button>
        )}
      </div>

      {/* On a phone the intervals become a full-width row of thumb-sized
          targets, because this is a control people press with chalk on their
          hands. On a desktop they collapse back to inline pills. The compact
          variant has a fixed width to work with, so it wraps to two rows of
          three rather than squeezing six into one. */}
      <div
        className={cn(
          "grid w-full gap-1.5",
          isCompact
            ? "grid-cols-3"
            : "grid-cols-6 md:flex md:w-auto md:items-center",
        )}
      >
        {PING_INTERVALS.map((interval) => {
          const isChosen = pingIntervalSeconds === interval.seconds;

          return (
            <Button
              key={interval.seconds}
              variant={isChosen ? "default" : "outline"}
              size="sm"
              aria-pressed={isChosen}
              className={cn(
                "w-full rounded-full tabular-nums",
                isCompact ? "h-10 px-2" : "h-11 px-1 md:h-9 md:w-auto md:px-3",
              )}
              onClick={() => setPingInterval(interval.seconds)}
            >
              {isCompact ? (
                interval.label
              ) : (
                <>
                  <span className="md:hidden">{interval.shortLabel}</span>
                  <span className="hidden md:inline">{interval.label}</span>
                </>
              )}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
