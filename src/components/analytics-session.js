/** @format */

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { gaTrackSignInSuccess } from "@/lib/analytics";

/**
 * Invisible tracking component that fires a Google Analytics sign-in success event
 * once per session whenever the user transitions to the authenticated state.
 *
 * @param {Object} props - No props; reads auth status from the NextAuth session context.
 */
export function AnalyticsSession() {
  const { status } = useSession();
  const prevStatusRef = useRef(null);

  useEffect(() => {
    if (status === "authenticated" && prevStatusRef.current !== "authenticated") {
      gaTrackSignInSuccess();
    }
    prevStatusRef.current = status;
  }, [status]);

  return null;
}
