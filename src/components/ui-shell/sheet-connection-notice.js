/**
 * Tells a lifter with a linked sheet when the connection, not their sheet, is the problem.
 * Offline: says the log reloads on reconnect (SWR revalidates on the browser's online event).
 * Online but the sheet read keeps failing with a network or 5xx error: counts down to the next
 * retry, backing off, with a button to retry now. Auth and missing-sheet errors are not ours to
 * handle here; the layout toast and the setup dialog's recovery flow own those.
 */

import { useEffect, useState, useSyncExternalStore } from "react";
import { Loader2, RefreshCw, WifiOff } from "lucide-react";

import {
  AppBanner,
  AppBannerActions,
  AppBannerContent,
  AppBannerMessage,
} from "@/components/ui/app-banner";
import { Button } from "@/components/ui/button";
import { useUserLiftingData } from "@/hooks/use-userlift-data";

const RETRY_DELAYS_SECONDS = [10, 20, 40, 60];

function subscribeToOnlineStatus(callback) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/**
 * navigator.onLine is only trustworthy when false: true just means a network
 * interface is up, so a dead Wi-Fi can still read as online. The retry
 * countdown covers that case.
 */
export function useIsOnline() {
  return useSyncExternalStore(
    subscribeToOnlineStatus,
    () => navigator.onLine,
    () => true,
  );
}

/** Network failures carry no status; 5xx means our server or Google hiccuped. */
export function isRetryableSheetError(apiError) {
  const status = apiError?.status;
  return status == null || status >= 500;
}

export function SheetConnectionNotice() {
  const {
    hasLinkedSheet,
    fetchFailed,
    apiError,
    isValidating,
    rawRows,
    hasCachedSheetData,
    mutate,
  } = useUserLiftingData();
  const isOnline = useIsOnline();
  const [attempt, setAttempt] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(null);

  // With data already on screen a failed background refresh is harmless, so
  // only count down when there is nothing loaded yet.
  const needsRetry =
    hasLinkedSheet &&
    isOnline &&
    fetchFailed &&
    isRetryableSheetError(apiError) &&
    rawRows == null &&
    !hasCachedSheetData;

  useEffect(() => {
    if (!needsRetry) {
      setAttempt(0);
      setSecondsLeft(null);
      return undefined;
    }
    if (isValidating) {
      setSecondsLeft(null);
      return undefined;
    }

    const delay =
      RETRY_DELAYS_SECONDS[Math.min(attempt, RETRY_DELAYS_SECONDS.length - 1)];
    const deadline = Date.now() + delay * 1000;
    setSecondsLeft(delay);

    const intervalId = window.setInterval(() => {
      const remaining = Math.ceil((deadline - Date.now()) / 1000);
      if (remaining > 0) {
        setSecondsLeft(remaining);
        return;
      }
      window.clearInterval(intervalId);
      setAttempt((n) => n + 1);
      mutate();
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [needsRetry, isValidating, attempt, mutate]);

  if (!hasLinkedSheet) return null;

  if (!isOnline) {
    return (
      <AppBanner tint="amber" role="status" aria-live="polite">
        <AppBannerContent density="compact">
          <AppBannerMessage className="flex items-center gap-2">
            <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              <strong>You&apos;re offline.</strong> Your lifting log reloads as
              soon as you&apos;re back online.
            </span>
          </AppBannerMessage>
        </AppBannerContent>
      </AppBanner>
    );
  }

  if (!needsRetry) return null;

  const isRetrying = isValidating || secondsLeft == null;

  return (
    <AppBanner tint="amber" role="status" aria-live="polite">
      <AppBannerContent density="compact">
        <AppBannerMessage className="flex items-center gap-2">
          {isRetrying ? (
            <Loader2
              className="h-4 w-4 shrink-0 animate-spin"
              aria-hidden="true"
            />
          ) : (
            <RefreshCw className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span>
            <strong>Google Sheets is taking a breather.</strong>{" "}
            {isRetrying
              ? "Reconnecting to your lifting log..."
              : `Trying again in ${secondsLeft}s. Your sheet is safe.`}
          </span>
        </AppBannerMessage>
        <AppBannerActions className="flex-row flex-nowrap">
          <Button
            size="sm"
            variant="outline"
            disabled={isRetrying}
            onClick={() => {
              setAttempt((n) => n + 1);
              mutate();
            }}
          >
            Retry now
          </Button>
        </AppBannerActions>
      </AppBannerContent>
    </AppBanner>
  );
}
