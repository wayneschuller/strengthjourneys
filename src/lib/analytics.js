/** @format */
"use client";

/**
 * Central Google Analytics (GA4) helper: gtag wrapper, UTM persistence, and track* helpers.
 * Events with debug_mode: true appear in GA4 DebugView only (not regular reports).
 */

const UTM_STORAGE_KEY = "ga_utm";
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];

/**
 * Send a custom GA4 event. Pass debug_mode: true in params to route to DebugView only.
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
 * Track feedback sentiment (thumbs up/down) from the floating feedback widget.
 * Uses debug_mode so events go to GA4 DebugView only while validating.
 * Remove debug_mode to promote to production tracking.
 * @param {"positive"|"negative"} sentiment
 * @param {string} page - Current page pathname
 */
export function gaTrackFeedbackSentiment(sentiment, page) {
  gaEvent("feedback_sentiment", { sentiment, page, debug_mode: true });
}
