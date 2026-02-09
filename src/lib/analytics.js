/** @format */
"use client";

/**
 * Central Google Analytics (GA4) helper: gtag wrapper, UTM persistence, and track* helpers.
 * No-op when gtag missing or in development. Safe to call from any component.
 */

const UTM_STORAGE_KEY = "ga_utm";
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];

function isEnabled() {
  if (typeof window === "undefined") return false;
  if (process.env.NEXT_PUBLIC_STRENGTH_JOURNEYS_ENV === "development") return false;
  return typeof window.gtag === "function";
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
  if (!isEnabled()) return;
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

/**
 * Send a Google Analytics event with optional params. Merges stored UTM and optional page.
 * All custom events are prefixed with SJ_ to distinguish from generic GA defaults.
 */
export function event(name, params = {}) {
  if (!isEnabled()) return;
  const id = getMeasurementId();
  if (!id) return;
  const prefixed = name.startsWith(GA_EVENT_PREFIX) ? name : `${GA_EVENT_PREFIX}${name}`;
  const merged = buildParams(params);
  window.gtag("event", prefixed, Object.keys(merged).length ? merged : undefined);
}

// --- Google Analytics track* helpers (send funnel events to GA4; add page when provided) ---

export function trackSignInClick(page) {
  event("funnel_sign_in_click", typeof page === "string" ? { page } : {});
}

export function trackSignInSuccess() {
  event("funnel_sign_in_success");
}

export function trackSheetConnectClick(page) {
  event("funnel_sheet_connect_click", typeof page === "string" ? { page } : {});
}

export function trackSheetPickerCancelled() {
  event("funnel_sheet_picker_cancelled");
}

export function trackSheetSelected() {
  event("funnel_sheet_selected");
}

export function trackSheetLinked() {
  event("funnel_sheet_linked");
}

/**
 * Track share/copy-to-clipboard actions. Use to compare which features have the most social sharing value.
 * @param {string} feature - Identifier for the feature (e.g. "e1rm_calculator", "1000lb_club", "year_recap", "heatmap")
 * @param {object} [params] - Optional extra params (e.g. { page, slide })
 */
export function trackShareCopy(feature, params = {}) {
  event("share_button_click", {
    feature,
    ...params,
  });
}
