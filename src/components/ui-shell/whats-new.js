/**
 * The "What's new" dot. The newest changelog date is baked into the bundle at
 * build (NEXT_PUBLIC_CHANGELOG_LATEST, from next.config.js) and compared with
 * the newest one this browser has seen, so the check costs no request.
 */
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useIsClient, useLocalStorage } from "usehooks-ts";

import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { cn } from "@/lib/utils";

const LATEST_ENTRY_DATE = process.env.NEXT_PUBLIC_CHANGELOG_LATEST ?? "";

// A signed-out browser with no stored date is most likely a first visit, so
// its dot waits while the landing sinks in, then waits again before pinging.
const FIRST_VISIT_SHOW_DELAY_MS = 10000;
const FIRST_VISIT_PING_DELAY_MS = 20000;

/**
 * How the "What's new" dot should look right now: null (none), "still" or
 * "ping". It is due when this browser has not opened /changelog since the
 * newest entry shipped, and no stored date counts as not opened.
 *
 * - A stored date older than the newest entry: ping straight away.
 * - No stored date and signed in: a returning lifter from before the dot, so
 *   ping straight away.
 * - No stored date and signed out: likely a first visit, so nothing for 10
 *   seconds, then a still dot, then the ping 10 seconds later.
 */
export function useChangelogDot() {
  // Null until storage has been read, and when nothing is stored.
  const seenDate = useReadStoredSeenDate();
  // Server render and the first client render cannot see storage, so the dot
  // waits for the client rather than flashing on for lifters who are up to date.
  const isClient = useIsClient();
  const { status: authStatus } = useSession();
  const [firstVisitStage, setFirstVisitStage] = useState("waiting");

  const hasStoredDate = typeof seenDate === "string";
  const isDue =
    isClient &&
    Boolean(LATEST_ENTRY_DATE) &&
    (!hasStoredDate || seenDate < LATEST_ENTRY_DATE);
  const isFirstVisit = isDue && !hasStoredDate && authStatus === "unauthenticated";

  useEffect(() => {
    if (!isFirstVisit) return undefined;
    const showTimer = setTimeout(
      () => setFirstVisitStage("still"),
      FIRST_VISIT_SHOW_DELAY_MS,
    );
    const pingTimer = setTimeout(
      () => setFirstVisitStage("ping"),
      FIRST_VISIT_PING_DELAY_MS,
    );
    return () => {
      clearTimeout(showTimer);
      clearTimeout(pingTimer);
    };
  }, [isFirstVisit]);

  if (!isDue) return null;
  // No stored date: who is looking decides, so wait until the session is known.
  if (!hasStoredDate && authStatus === "loading") return null;
  if (!isFirstVisit) return "ping";
  return firstVisitStage === "waiting" ? null : firstVisitStage;
}

/**
 * Marks every shipped entry as seen. Call from the changelog page; other dots
 * on the page clear at once because usehooks-ts syncs same-tab listeners.
 */
export function useMarkChangelogSeen() {
  const [, setSeenDate] = useLocalStorage(
    LOCAL_STORAGE_KEYS.CHANGELOG_SEEN,
    null,
    { initializeWithValue: false },
  );

  useEffect(() => {
    try {
      setSeenDate(LATEST_ENTRY_DATE);
    } catch {
      // Storage blocked: nothing to remember.
    }
  }, [setSeenDate]);
}

function useReadStoredSeenDate() {
  const [seenDate] = useLocalStorage(LOCAL_STORAGE_KEYS.CHANGELOG_SEEN, null, {
    initializeWithValue: false,
  });
  return seenDate;
}

/**
 * Red dot, pinging unless `ping` is false. `corner` pins it to the top-right of
 * a relative label, so it reads as belonging to "What's New"; `floating` pins
 * it to the corner of a relative icon, such as the avatar or the mobile menu
 * button.
 */
export function WhatsNewDot({
  ping = true,
  corner = false,
  floating = false,
  className,
}) {
  return (
    <span
      className={cn(
        "relative inline-flex size-2 shrink-0",
        corner && "absolute -top-1 -right-2.5",
        floating && "absolute -top-0.5 -right-0.5",
        className,
      )}
    >
      {ping && (
        <span className="absolute inline-flex size-full rounded-full bg-red-500 opacity-75 motion-safe:animate-ping" />
      )}
      <span
        className={cn(
          "relative inline-flex size-2 rounded-full bg-red-500",
          floating && "ring-background ring-2",
        )}
      />
      <span className="sr-only">New updates</span>
    </span>
  );
}
