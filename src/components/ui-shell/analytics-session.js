/** @format */

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { gaTrackSignInSuccess } from "@/lib/analytics";

// sessionStorage key used to ensure funnel_sign_in_success fires at most once
// per browser session. sessionStorage persists across same-tab page loads
// (including the OAuth redirect back from Google) but clears when the tab or
// browser is closed — which is exactly the right scope for a sign-in event.
const SIGN_IN_TRACKED_KEY = "sj_sign_in_success_tracked";

/**
 * Invisible tracking component that fires a Google Analytics sign-in success event
 * exactly once per browser session when the user first becomes authenticated.
 *
 * Why sessionStorage instead of just prevStatusRef:
 *   prevStatusRef resets to null on every page load, so without the sessionStorage
 *   guard this event fired on every page load for authenticated users (~24x per user
 *   over 30 days in practice). sessionStorage survives the OAuth redirect back from
 *   Google (same browser session) but clears on tab/browser close, so it fires once
 *   per sign-in as intended.
 *
 * @param {Object} props - No props; reads auth status from the NextAuth session context.
 */
export function AnalyticsSession() {
  const { status } = useSession();
  const prevStatusRef = useRef(null);

  useEffect(() => {
    if (status === "authenticated" && prevStatusRef.current !== "authenticated") {
      // Guard: only fire once per browser session. Without this, the event fires
      // on every page load because prevStatusRef resets to null on every mount.
      const alreadyTracked = sessionStorage.getItem(SIGN_IN_TRACKED_KEY);
      if (!alreadyTracked) {
        gaTrackSignInSuccess();
        sessionStorage.setItem(SIGN_IN_TRACKED_KEY, "1");
      }
    }
    prevStatusRef.current = status;
  }, [status]);

  return null;
}
