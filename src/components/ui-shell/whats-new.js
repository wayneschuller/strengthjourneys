/**
 * The "What's new" dot. The newest changelog date is baked into the bundle at
 * build (NEXT_PUBLIC_CHANGELOG_LATEST, from next.config.js) and compared with
 * the newest one this browser has seen, so the check costs no request.
 */
import { useEffect } from "react";
import { useIsClient, useLocalStorage } from "usehooks-ts";

import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { cn } from "@/lib/utils";

const LATEST_ENTRY_DATE = process.env.NEXT_PUBLIC_CHANGELOG_LATEST ?? "";

/**
 * True when this browser has not opened /changelog since the newest entry
 * shipped. No stored date counts as unseen, so new visitors and lifters who
 * predate the dot both get it until they visit the page once.
 */
export function useHasUnseenChangelog() {
  // Null until storage has been read, and when nothing is stored.
  const seenDate = useReadStoredSeenDate();
  // Server render and the first client render cannot see storage, so the dot
  // waits for the client rather than flashing on for lifters who are up to date.
  const isClient = useIsClient();

  if (!isClient || !LATEST_ENTRY_DATE) return false;
  return typeof seenDate !== "string" || seenDate < LATEST_ENTRY_DATE;
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
 * Pinging red dot. `corner` pins it to the top-right of a relative label, so
 * it reads as belonging to "What's New"; `floating` pins it to the corner of a
 * relative icon, such as the avatar or the mobile menu button.
 */
export function WhatsNewDot({ corner = false, floating = false, className }) {
  return (
    <span
      className={cn(
        "relative inline-flex size-2 shrink-0",
        corner && "absolute -top-1 -right-2.5",
        floating && "absolute -top-0.5 -right-0.5",
        className,
      )}
    >
      <span className="absolute inline-flex size-full rounded-full bg-red-500 opacity-75 motion-safe:animate-ping" />
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
