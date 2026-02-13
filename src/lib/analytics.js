/** @format */
"use client";

/**
 * Central Google Analytics (GA4) helper: gtag wrapper, UTM persistence, and track* helpers.
 * Supports two event modes:
 * 1) trusted events: production/staging only (default)
 * 2) development-only events: sent only in local development while building new tracking
 */

const UTM_STORAGE_KEY = "ga_utm";
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];

const ANALYTICS_MODE = {
  TRUSTED: "trusted",
  DEVELOPMENT_ONLY: "development-only",
};

function isDevelopmentEnv() {
  return process.env.NEXT_PUBLIC_STRENGTH_JOURNEYS_ENV === "development";
}

function isEnabledForMode(mode = ANALYTICS_MODE.TRUSTED) {
  if (typeof window === "undefined") return false;
  if (typeof window.gtag !== "function") return false;

  const isDev = isDevelopmentEnv();
  if (mode === ANALYTICS_MODE.DEVELOPMENT_ONLY) return isDev;
  if (mode === ANALYTICS_MODE.TRUSTED) return !isDev;

  // Unknown mode: fail closed.
  return false;
}

function sendEvent(name, params = {}, mode = ANALYTICS_MODE.TRUSTED) {
  if (!isEnabledForMode(mode)) return;
  const id = getMeasurementId();
  if (!id) return;

  const prefixed = name.startsWith(GA_EVENT_PREFIX) ? name : `${GA_EVENT_PREFIX}${name}`;
  const baseParams = buildParams(params);
  const merged =
    mode === ANALYTICS_MODE.DEVELOPMENT_ONLY
      ? { ...baseParams, debug_mode: true }
      : baseParams;

  window.gtag("event", prefixed, Object.keys(merged).length ? merged : undefined);
}

/**
 * Trusted GA event helper (production/staging only).
 * Most analytics events should use this path.
 */
export function gaTrustedEvent(name, params = {}) {
  sendEvent(name, params, ANALYTICS_MODE.TRUSTED);
}

/**
 * Development-only GA event helper (local development only).
 * Use this while validating new event schemas before promoting to gaTrustedEvent.
 */
export function gaDevEvent(name, params = {}) {
  sendEvent(name, params, ANALYTICS_MODE.DEVELOPMENT_ONLY);
}

/**
 * Backward-compatible alias for trusted GA events.
 * Existing call sites can keep using gaEvent(...).
 */
export function gaEvent(name, params = {}) {
  gaTrustedEvent(name, params);
}

function isPageViewEnabled() {
  if (typeof window === "undefined") return false;
  if (typeof window.gtag !== "function") return false;
  if (isDevelopmentEnv()) return false;
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
  gaTrustedEvent("funnel_sign_in_click", typeof page === "string" ? { page } : {});
}

export function gaTrackSignInSuccess() {
  gaTrustedEvent("funnel_sign_in_success");
}

export function gaTrackSheetConnectClick(page) {
  gaTrustedEvent("funnel_sheet_connect_click", typeof page === "string" ? { page } : {});
}

export function gaTrackSheetPickerCancelled() {
  gaTrustedEvent("funnel_sheet_picker_cancelled");
}

export function gaTrackSheetSelected() {
  gaTrustedEvent("funnel_sheet_selected");
}

export function gaTrackSheetLinked() {
  gaTrustedEvent("funnel_sheet_linked");
}

/**
 * Track share/copy-to-clipboard actions. Use to compare which features have the most social sharing value.
 * @param {string} feature - Identifier for the feature (e.g. "e1rm_calculator", "1000lb_club", "year_recap", "heatmap")
 * @param {object} [params] - Optional extra params (e.g. { page, slide })
 */
export function gaTrackShareCopy(feature, params = {}) {
  gaTrustedEvent("share_button_click", {
    feature,
    ...params,
  });
}

/**
 * Track feedback sentiment (thumbs up/down) from the floating feedback widget.
 * Development-only while validating schema/volume; promote by switching gaDevEvent -> gaTrustedEvent.
 * @param {"positive"|"negative"} sentiment
 * @param {string} page - Current page pathname
 */
export function gaTrackFeedbackSentiment(sentiment, page) {
  gaDevEvent("feedback_sentiment", { sentiment, page });
}
