/**
 * The trail of pings the clock has already sounded, drawn as a decorated line
 * under the gym timer, with a rotating nudge back to the bar.
 *
 * Desktop only. On a phone the giant clock is the whole point and there is no
 * room to spare; on a laptop propped up in a home gym there is plenty.
 *
 * Phrases are chosen by hashing a per-session seed with the ping number rather
 * than at random, so a given ping keeps its wording across every re-render (the
 * clock re-renders four times a second) while a new session gets a new run of
 * jokes.
 */

import { formatAlarmLabel } from "@/hooks/use-timer";
import { cn } from "@/lib/utils";

// Enough markers to show the shape of a long rest without the line running off
// the side of the card.
const MAX_VISIBLE_PINGS = 8;

export function TimerPingHistory({
  pingIntervalSeconds,
  pingCount,
  seed,
  isAlerting,
}) {
  if (!pingIntervalSeconds || pingCount < 1) return null;

  const allPings = Array.from(
    { length: pingCount },
    (_, index) => (index + 1) * pingIntervalSeconds,
  );
  const visiblePings = allPings.slice(-MAX_VISIBLE_PINGS);
  const hiddenCount = allPings.length - visiblePings.length;

  const nudge = pickNudge(`${seed}-${pingCount}`);

  return (
    <div className="hidden w-full flex-col items-center md:flex">
      <div className="flex items-end justify-center">
        {hiddenCount > 0 && (
          <span className="text-muted-foreground mr-1 mb-4 text-xs">
            +{hiddenCount}
          </span>
        )}
        {visiblePings.map((seconds, index) => {
          const isNewest = index === visiblePings.length - 1;

          return (
            <div key={seconds} className="flex items-end">
              <span
                className={cn(
                  "bg-border mb-[0.3rem] h-px w-8",
                  index === 0 && hiddenCount === 0 && "w-4",
                )}
              />
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "bg-muted-foreground/50 h-2 w-2 rounded-full",
                    isNewest && "bg-primary h-2.5 w-2.5",
                    isNewest && isAlerting && "animate-pulse",
                  )}
                />
                <span
                  className={cn(
                    "text-muted-foreground mt-1 text-xs tabular-nums",
                    isNewest && "text-foreground font-semibold",
                  )}
                >
                  {formatAlarmLabel(seconds)}
                </span>
              </div>
            </div>
          );
        })}
        <span className="bg-border mb-[0.3rem] ml-0 h-px w-8" />
        <span className="text-muted-foreground mb-3 text-xs">
          next {formatAlarmLabel((pingCount + 1) * pingIntervalSeconds)}
        </span>
      </div>

      <p className="text-muted-foreground mt-3 text-center text-sm italic">
        {nudge}
      </p>
    </div>
  );
}

// Warm and a bit daft. Never scolding: a lifter taking a long rest is resting,
// not failing, so nothing in here implies they have wasted anything.
const NUDGES = [
  "The bar has had a lovely sit down. Its turn is over.",
  "Somewhere in this room a plate is waiting to be picked up.",
  "Chalk is dry. Hands are ready. You know what happens next.",
  "That was a professional rest. Now go and lift professionally.",
  "The bench has cooled off. You have not.",
  "Deep breath in. Big pull out.",
  "The plates have started gossiping about you.",
  "Fresh legs, fresh set, same barbell.",
  "Your grip has fully recovered. Apologies.",
  "One set closer to the good kind of sore.",
  "The rack is enjoying your company but would prefer your effort.",
  "Nothing on that phone is heavier than the bar.",
  "This is the part where you stand up and look determined.",
  "The iron has been extremely patient with you.",
  "Belt on. Story time later.",
  "Your heart rate has voted yes.",
  "The barbell would like to file a complaint about the wait.",
  "Rested, watered, and out of excuses in the nicest possible way.",
  "Go and make the bar bend a little.",
  "The next set is the one you will be proud of.",
];

function hashString(value = "") {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function pickNudge(seedKey) {
  return NUDGES[hashString(String(seedKey)) % NUDGES.length];
}
