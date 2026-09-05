/** @format */

/**
 * Reddit Ads pixel helper for Strength Journeys.
 *
 * How it works:
 * - The base pixel (window.rdt) is loaded in _app.js via next/script. That
 *   snippet also fires the first PageVisit, for the landing page.
 * - Client-side route changes fire their own PageVisit from _app.js, the same
 *   way GA4 re-sends page_view (see lib/analytics.js). Next.js only emits
 *   routeChangeComplete for real navigations, so the landing page is not
 *   counted twice.
 * - SignUp is the conversion Reddit campaigns optimise against. It fires when a
 *   lifter first becomes authenticated (see ui-shell/analytics-session.js).
 *
 * Why the pixel ID is a constant and not an env var:
 * - It is a public identifier that ships in the page source, there is one Reddit
 *   Ads account behind it, and it does not vary by environment. Keeping it here
 *   means the pixel cannot silently go missing because a Vercel variable was
 *   never added.
 *
 * Deliberately not enabled: Reddit's advanced matching, which hashes and sends
 * the signed-in lifter's email address to Reddit. That is a real widening of
 * what leaves the browser, so it stays off unless it is asked for.
 *
 * Events are skipped in development so local browsing stays out of Reddit's
 * attribution data. In development the base script is not loaded at all.
 */

export const REDDIT_PIXEL_ID = "t2_sgy9pwjx";

/**
 * Reddit standard event names (single source of truth).
 *
 * These are Reddit's own vocabulary, not ours — the Events Manager and campaign
 * optimisation only understand the standard names, so they must be spelled
 * exactly as Reddit defines them.
 */
export const RDT_EVENT_TAGS = Object.freeze({
  PAGE_VISIT: "PageVisit", // ~Sep 2026: Any page view, including client-side route changes.
  SIGN_UP: "SignUp", // ~Sep 2026: Lifter completed Google sign-in for the first time this browser session.
});

function isDevelopmentEnv() {
  return process.env.NEXT_PUBLIC_STRENGTH_JOURNEYS_ENV === "development";
}

/**
 * Whether the base pixel should be loaded and events sent at all.
 * Used by _app.js to skip rendering the script in development.
 */
export function isRedditPixelEnabled() {
  return !isDevelopmentEnv();
}

/**
 * Send a Reddit pixel event using the exact event name provided.
 * No-ops safely before the pixel script has loaded.
 */
export function rdtEvent(name, params = {}) {
  if (typeof window === "undefined") return;
  if (typeof window.rdt !== "function") return;
  if (!isRedditPixelEnabled()) return;

  // Passing an explicit undefined third argument would land in the pixel's
  // pre-load call queue as a real argument, so only send params when there are some.
  if (Object.keys(params).length) window.rdt("track", name, params);
  else window.rdt("track", name);
}

// --- Reddit track* helpers ---

export function rdtTrackPageVisit() {
  rdtEvent(RDT_EVENT_TAGS.PAGE_VISIT);
}

export function rdtTrackSignUp() {
  rdtEvent(RDT_EVENT_TAGS.SIGN_UP);
}
