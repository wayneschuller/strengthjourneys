/**
 * Keeps a flaky connection from looking like a sign-out.
 *
 * next-auth v4 answers a failed /api/auth/session request with "no session",
 * so one dropped request on patchy gym data reported a signed-in lifter as
 * signed out and every page switched to the demo. It also stops refetching
 * once it holds no session, so the demo stayed until a reload. And a request
 * that simply hangs leaves it "loading" for as long as the connection does.
 *
 * This sits just inside SessionProvider and re-provides next-auth's own
 * SessionContext, so every useSession() below reads through it with no
 * call-site changes. When next-auth says "unauthenticated" in a browser that
 * was signed in, we ask /api/auth/session ourselves, where a dropped request
 * can be told apart from an empty answer:
 *   - an empty answer is a real sign-out or an expired session: pass it on
 *   - a session: use it, and refresh it on refocus since next-auth won't
 *   - no answer: hold the session this page last had and keep asking, with
 *     backoff and whenever the connection returns
 *
 * A page opened with no connection has no session to hold, so the lifter's
 * name, email and picture are kept on the phone while signed in (never a
 * token). That opens the app as them, on the copy of their log saved with it
 * (sheet-local-cache.js), both when the session request fails and when it
 * hangs. Anything that needs Google waits for the real session, since only
 * that carries an access token.
 *
 * A signed-in browser with a working connection makes no extra requests: the
 * check only runs once next-auth has already reported a sign-out.
 */

import { useContext, useEffect, useMemo, useState } from "react";
import { SessionContext } from "next-auth/react";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";

const CHECK_TIMEOUT_MS = 10000;
const MAX_RETRY_DELAY_MS = 30000;
// How long a session request may hang before the saved lifter stands in.
const SLOW_SESSION_MS = 4000;

// The session, null for a definite "signed out", or a throw when no usable
// answer arrived. Same empty-object rule next-auth itself applies.
async function fetchSessionDirectly() {
  const res = await fetch("/api/auth/session", {
    signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Session check failed: ${res.status}`);
  const data = await res.json();
  return data && Object.keys(data).length > 0 ? data : null;
}

// The last signed-in lifter, without tokens: { user, expires }, or null.
function readSavedSession() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(LOCAL_STORAGE_KEYS.SESSION_EXPECTED),
    );
    if (!saved?.user || !saved.expires) return null;
    // Past its expiry the server would not honour it either.
    return Date.parse(saved.expires) > Date.now() ? saved : null;
  } catch {
    return null;
  }
}

function writeSavedSession(session) {
  try {
    if (session?.user) {
      localStorage.setItem(
        LOCAL_STORAGE_KEYS.SESSION_EXPECTED,
        JSON.stringify({ user: session.user, expires: session.expires }),
      );
    } else {
      localStorage.removeItem(LOCAL_STORAGE_KEYS.SESSION_EXPECTED);
    }
  } catch {
    // Storage blocked: the check still covers a drop later in this page.
  }
}

/** Sign-out: forget the saved lifter. */
export function clearSavedSession() {
  writeSavedSession(null);
}

/** Wrap directly inside next-auth's SessionProvider. */
export function ResilientSession({ children }) {
  const raw = useContext(SessionContext);

  // Only consulted once next-auth has answered or stalled, never in the
  // hydration render, where the server and client both say "loading".
  const [saved, setSaved] = useState(() =>
    typeof window === "undefined" ? null : readSavedSession(),
  );
  // The last session we know of: next-auth's, or one we fetched ourselves.
  const [held, setHeld] = useState(null);
  // "idle" until our own check has confirmed a sign-out.
  const [check, setCheck] = useState("idle");
  const [isSlow, setIsSlow] = useState(false);

  // Adjusted during render, not in an effect, so no render ever passes a
  // false sign-out down and lets the demo load for even one frame.
  if (raw?.status === "authenticated" && held !== raw.data) {
    setHeld(raw.data);
    if (check !== "idle") setCheck("idle");
  }

  const expected = saved !== null || held !== null;
  const isDoubting =
    raw?.status === "unauthenticated" && expected && check !== "signedOut";
  const isStalled = raw?.status === "loading" && isSlow && saved !== null;

  useEffect(() => {
    if (raw?.status !== "authenticated") return;
    writeSavedSession(raw.data);
  }, [raw?.status, raw?.data]);

  useEffect(() => {
    if (raw?.status !== "loading") return undefined;
    const timer = setTimeout(() => setIsSlow(true), SLOW_SESSION_MS);
    return () => {
      clearTimeout(timer);
      setIsSlow(false);
    };
  }, [raw?.status]);

  useEffect(() => {
    if (!isDoubting) return;
    let cancelled = false;
    let timer = null;
    let attempt = 0;
    let inFlight = false;

    const run = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;
      clearTimeout(timer);
      try {
        const session = await fetchSessionDirectly();
        if (cancelled) return;
        attempt = 0;
        if (session) {
          setHeld(session);
        } else {
          writeSavedSession(null);
          setSaved(null);
          setHeld(null);
          setCheck("signedOut");
        }
      } catch {
        if (cancelled) return;
        const delay = Math.min(1000 * 2 ** attempt, MAX_RETRY_DELAY_MS);
        attempt += 1;
        timer = setTimeout(run, delay);
      } finally {
        inFlight = false;
      }
    };

    // Coming back to the tab or the network is the likeliest moment it works,
    // and keeps a session we fetched ourselves fresh while next-auth sleeps.
    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };
    run();
    window.addEventListener("online", run);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener("online", run);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isDoubting]);

  const value = useMemo(() => {
    if (isStalled) return { ...raw, data: saved, status: "authenticated" };
    if (!isDoubting) return raw;
    const session = held ?? saved;
    return session
      ? { ...raw, data: session, status: "authenticated" }
      : { ...raw, data: null, status: "loading" };
  }, [isStalled, isDoubting, raw, held, saved]);

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
