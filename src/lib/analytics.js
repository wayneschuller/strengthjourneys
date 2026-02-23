/** @format */

/**
 * Central Google Analytics (GA4) helper for Strength Journeys.
 *
 * How it works:
 * - The gtag script is loaded in _app.js via next/script.
 * - Event names are sent exactly as provided to gaEvent(...).
 * - Historical events must keep their original names to preserve GA continuity.
 * - New events should use an explicit "SJ_" prefix (do not rely on auto-prefixing).
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

/**
 * GA custom event tags (single source of truth).
 *
 * IMPORTANT:
 * - Do not rename existing tags: historical GA reporting depends on stable names.
 * - For new events, add a new constant (prefer explicit "SJ_" prefix for new taxonomy).
 * - If a rename is truly required, add a brand-new tag instead of mutating an old one.
 */
export const GA_EVENT_TAGS = Object.freeze({
  FUNNEL_SIGN_IN_CLICK: "funnel_sign_in_click", // ~Feb 2026: User clicked a Google sign-in CTA.
  FUNNEL_SIGN_IN_SUCCESS: "funnel_sign_in_success", // ~Feb 2026: Session transitioned to authenticated.
  FUNNEL_SHEET_CONNECT_CLICK: "funnel_sheet_connect_click", // ~Feb 2026: User clicked connect/select sheet.
  FUNNEL_SHEET_PICKER_CANCELLED: "funnel_sheet_picker_cancelled", // ~Feb 2026: User closed Drive picker without selecting.
  FUNNEL_SHEET_SELECTED: "funnel_sheet_selected", // ~Feb 2026: User selected a spreadsheet in Drive picker.
  FUNNEL_SHEET_LINKED: "funnel_sheet_linked", // ~Feb 2026: App linked selected sheet into local app state.
  SHARE_BUTTON_CLICK: "share_button_click", // ~Feb 2026: Generic share/copy action with feature metadata.
  THEME_CHANGED: "theme_changed", // ~Apr 2024: Theme toggle changed between light/dark variants.
  TIMER_START_STOP_TOGGLE: "timer_start_stop_toggle", // ~May 2024: Timer play/pause toggled.
  TIMER_RESET: "timer_reset", // ~May 2024: Timer reset to zero and stopped.
  TIMER_RESTARTED: "timer_restarted", // ~Apr 2024: Timer restarted from zero and running.
  GSHEET_API_ERROR: "gSheetAPIError", // ~Apr 2024: Google Sheets API request failed.
  GSHEET_DATA_UPDATED: "gSheetDataUpdated", // ~Dec 2023: Sheet data loaded and parsed successfully.
  GSHEET_READ_REJECTED: "gSheetReadRejected", // ~Mar 2024: Sheet read/parse rejected as invalid.
  GDRIVE_PICKER_OPENED: "gdrive_picker_opened", // ~Apr 2024: Drive picker returned a selected document.
  CALC_SHARE_CLIPBOARD: "calc_share_clipboard", // ~Apr 2024: E1RM calculator result copied to clipboard.
  HEATMAP_SHARE_CLIPBOARD: "heatmap_share_clipboard", // ~Apr 2024: Analyzer heatmap image copied to clipboard.
  FEEDBACK_SENTIMENT: "SJ_feedback_sentiment", // ~Feb 2026: Feedback thumbs sentiment (explicit SJ-prefixed new tag).
});

const UTM_STORAGE_KEY = "ga_utm";
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];

/**
 * Send a custom GA4 event using the exact event name provided.
 * Pass { debug_mode: true } in params to route to GA4 DebugView only.
 */
export function gaEvent(name, params = {}) {
  if (typeof window === "undefined") return;
  if (typeof window.gtag !== "function") return;
  if (isDevelopmentEnv()) return; // skip all custom events in dev to avoid polluting production GA data
  if (!getMeasurementId()) return;

  const merged = buildParams(params);
  window.gtag("event", name, Object.keys(merged).length ? merged : undefined);
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

// --- Google Analytics track* helpers (send funnel events to GA4; add page when provided) ---

export function gaTrackSignInClick(page) {
  gaEvent(GA_EVENT_TAGS.FUNNEL_SIGN_IN_CLICK, typeof page === "string" ? { page } : {});
}

export function gaTrackSignInSuccess() {
  gaEvent(GA_EVENT_TAGS.FUNNEL_SIGN_IN_SUCCESS);
}

export function gaTrackSheetConnectClick(page) {
  gaEvent(GA_EVENT_TAGS.FUNNEL_SHEET_CONNECT_CLICK, typeof page === "string" ? { page } : {});
}

export function gaTrackSheetPickerCancelled() {
  gaEvent(GA_EVENT_TAGS.FUNNEL_SHEET_PICKER_CANCELLED);
}

export function gaTrackSheetSelected() {
  gaEvent(GA_EVENT_TAGS.FUNNEL_SHEET_SELECTED);
}

export function gaTrackSheetLinked() {
  gaEvent(GA_EVENT_TAGS.FUNNEL_SHEET_LINKED);
}

/**
 * Track share/copy-to-clipboard actions. Use to compare which features have the most social sharing value.
 * @param {string} feature - Identifier for the feature (e.g. "e1rm_calculator", "1000lb_club", "year_recap", "heatmap")
 * @param {object} [params] - Optional extra params (e.g. { page, slide })
 */
export function gaTrackShareCopy(feature, params = {}) {
  gaEvent(GA_EVENT_TAGS.SHARE_BUTTON_CLICK, {
    feature,
    ...params,
  });
}

/**
 * Track calculator copy-to-clipboard actions. Preserves the historical CALC_SHARE_CLIPBOARD
 * event name for GA4 continuity while following the newer helper-function pattern.
 * @param {string} type - Copy type (e.g. "text", "image", "lift_bar")
 * @param {object} [params] - Optional extra params (e.g. { page, liftType })
 */
export function gaTrackCalcShareCopy(type, params = {}) {
  gaEvent(GA_EVENT_TAGS.CALC_SHARE_CLIPBOARD, { type, ...params });
}

/**
 * Track feedback sentiment (thumbs up/down).
 * @param {"positive"|"negative"} sentiment
 * @param {string} page - Current page pathname
 * @param {object} [extra] - Optional extra params (e.g. { logged_in, seconds_on_page })
 */
export function gaTrackFeedbackSentiment(sentiment, page, extra = {}) {
  gaEvent(GA_EVENT_TAGS.FEEDBACK_SENTIMENT, { sentiment, page, ...extra });
}
