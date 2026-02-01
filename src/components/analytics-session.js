/** @format */
"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { trackSignInSuccess } from "@/lib/analytics";

/**
 * Calls trackSignInSuccess() to send Google Analytics funnel_sign_in_success when the user becomes authenticated (client-side only).
 * Mount inside SessionProvider. Fires once per transition to authenticated.
 */
export function AnalyticsSession() {
  const { status } = useSession();
  const prevStatusRef = useRef(null);

  useEffect(() => {
    if (status === "authenticated" && prevStatusRef.current !== "authenticated") {
      trackSignInSuccess();
    }
    prevStatusRef.current = status;
  }, [status]);

  return null;
}
