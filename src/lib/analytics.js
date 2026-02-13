/** @format */
"use client";

/**
 * Central Google Analytics (GA4) helper for Strength Journeys.
 *
 * How it works:
 * - The gtag script is loaded in _app.js via next/script.
 * - All custom events are prefixed with "SJ_" to distinguish them from
 *   GA4 built-in events (page_view, session_start, etc.).
 * - UTM params (?utm_source=...) are captured on first page load and
 *   merged into every event so GA4 keeps campaign attribution across
 *   client-side navigations.
 * - Page views use gtag("config", ...) and are skipped in dev to avoid
 *   polluting production data.
 *
 * debug_mode (GA4 DebugView):
 * - Any event sent with { debug_mode: true } in its params is routed to
 *   GA4 DebugView (Admin > DebugView) instead of regular reports.
 * - This is GA4's built-in mechanism for testing new events without
 *   polluting production analytics data.
 * - Use it when adding new tracking: pass debug_mode: true, verify in
 *   DebugView, then remove the flag to promote to production.
 * - See gaTrackFeedbackSentiment() at the bottom for an example.
 *
 * Adding a new tracked event:
 * 1. Create a gaTrack*() helper function at the bottom of this file.
 * 2. Call gaEvent("your_event_name", { ...params, debug_mode: true }).
 * 3. Verify the event appears in GA4 DebugView.
 * 4. Remove debug_mode: true when you're happy with the data.
 */

const UTM_STORAGE_KEY = "ga_utm";
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];

/**
 * Send a custom GA4 event. All events are auto-prefixed with "SJ_".
 * Pass { debug_mode: true } in params to route to GA4 DebugView only.
 */
export function gaEvent(name, params = {}) {
  if (typeof window === "undefined") return;
  if (typeof window.gtag !== "function") return;
  if (!getMeasurementId()) return;

  const prefixed = name.startsWith(GA_EVENT_PREFIX) ? name : `${GA_EVENT_PREFIX}${name}`;
  const merged = buildParams(params);
  window.gtag("event", prefixed, Object.keys(merged).length ? merged : undefined);
}

function isDevelopmentEnv() {
  return process.env.NEXT_PUBLIC_STRENGTH_JOURNEYS_ENV === "development";
}

function isPageViewEnabled() {
  if (typeof window === "undefined") return false;
  if (typeof window.gtag !== "function") return false;
  if (isDevelopmentEnv()) return false; // skip page_view in dev to avoid polluting production GA data
  return true;
}

function getMeasurementId() {
  return process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS || "";
}

/**
 * Read UTM params from URL and store in sessionStorage for Google Analytics attribution across client-side nav.
 * Call once on app mount so first-touch UTM is stored for the session.
 */
export function captureUtmFromUrl() {
  if (typeof window === "undefined") return;
  const q = new URLSearchParams(window.location.search);
  const utm = {};
  let hasAny = false;
  for (const key of UTM_KEYS) {
    const v = q.get(key);
    if (v) {
      utm[key] = v;
      hasAny = true;
    }
  }
  if (hasAny) {
    try {
      sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utm));
    } catch (_) {}
  }
}

/**
 * Get stored UTM from sessionStorage (from first touch in this session) for Google Analytics attribution.
 */
function getStoredUtm() {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(UTM_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return {};
}

/**
 * Merge stored UTM + optional page into a params object for Google Analytics gtag.
 */
function buildParams(extra = {}) {
  const stored = getStoredUtm();
  return { ...stored, ...extra };
}

/**
 * Send Google Analytics page_view with full URL and stored UTM so GA4 keeps landing page and campaign attribution.
 */
export function pageView(fullURL) {
  if (!isPageViewEnabled()) return;
  const id = getMeasurementId();
  if (!id) return;
  captureUtmFromUrl();
  const params = buildParams({
    page_location: fullURL || (typeof window !== "undefined" ? window.location.href : ""),
  });
  window.gtag("config", id, params);
}

/** Prefix for Strength Journeys custom events (distinguishes from GA default events like page_view, session_start). */
const GA_EVENT_PREFIX = "SJ_";

// --- Google Analytics track* helpers (send funnel events to GA4; add page when provided) ---

export function gaTrackSignInClick(page) {
  gaEvent("funnel_sign_in_click", typeof page === "string" ? { page } : {});
}

export function gaTrackSignInSuccess() {
  gaEvent("funnel_sign_in_success");
}

export function gaTrackSheetConnectClick(page) {
  gaEvent("funnel_sheet_connect_click", typeof page === "string" ? { page } : {});
}

export function gaTrackSheetPickerCancelled() {
  gaEvent("funnel_sheet_picker_cancelled");
}

export function gaTrackSheetSelected() {
  gaEvent("funnel_sheet_selected");
}

export function gaTrackSheetLinked() {
  gaEvent("funnel_sheet_linked");
}

/**
 * Track share/copy-to-clipboard actions. Use to compare which features have the most social sharing value.
 * @param {string} feature - Identifier for the feature (e.g. "e1rm_calculator", "1000lb_club", "year_recap", "heatmap")
 * @param {object} [params] - Optional extra params (e.g. { page, slide })
 */
export function gaTrackShareCopy(feature, params = {}) {
  gaEvent("share_button_click", {
    feature,
    ...params,
  });
}

/**
 * Track feedback sentiment (thumbs up/down).
 * @param {"positive"|"negative"} sentiment
 * @param {string} page - Current page pathname
 * @param {object} [extra] - Optional extra params (e.g. { logged_in, seconds_on_page })
 */
export function gaTrackFeedbackSentiment(sentiment, page, extra = {}) {
  gaEvent("feedback_sentiment", { sentiment, page, ...extra });
}
