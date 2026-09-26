/**
 * The "What's new" dot. The newest changelog date is baked into the bundle at
 * build (NEXT_PUBLIC_CHANGELOG_LATEST, from next.config.js) and compared with
 * the newest one this browser has seen, so the check costs no request.
 */
import { useEffect } from "react";
import { useLocalStorage } from "usehooks-ts";

import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { cn } from "@/lib/utils";

const LATEST_ENTRY_DATE = process.env.NEXT_PUBLIC_CHANGELOG_LATEST ?? "";

/**
 * True when a changelog entry has shipped since this browser last opened
 * /changelog. A first-time visitor is marked up to date instead, so the dot
 * means "new since you were here" rather than flagging the whole history.
 */
export function useHasUnseenChangelog() {
  const [seenDate, setSeenDate] = useLocalStorage(
    LOCAL_STORAGE_KEYS.CHANGELOG_SEEN,
    LATEST_ENTRY_DATE,
    { initializeWithValue: false },
  );

  useEffect(() => {
    try {
      if (window.localStorage.getItem(LOCAL_STORAGE_KEYS.CHANGELOG_SEEN) === null) {
        setSeenDate(LATEST_ENTRY_DATE);
      }
    } catch {
      // Storage blocked: the dot just stays off.
    }
  }, [setSeenDate]);

  return Boolean(LATEST_ENTRY_DATE) && String(seenDate ?? "") < LATEST_ENTRY_DATE;
}

/**
 * Marks every shipped entry as seen. Call from the changelog page; other dots
 * on the page clear at once because usehooks-ts syncs same-tab listeners.
 */
export function useMarkChangelogSeen() {
  const [, setSeenDate] = useLocalStorage(
    LOCAL_STORAGE_KEYS.CHANGELOG_SEEN,
    LATEST_ENTRY_DATE,
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

/**
 * Small red dot. Pass `floating` to pin it to the corner of a relative parent,
 * such as the avatar or the mobile menu button.
 */
export function WhatsNewDot({ floating = false, className }) {
  return (
    <span
      className={cn(
        "inline-block size-2 shrink-0 rounded-full bg-red-500",
        floating && "ring-background absolute -top-0.5 -right-0.5 ring-2",
        className,
      )}
    >
      <span className="sr-only">New updates</span>
    </span>
  );
}
