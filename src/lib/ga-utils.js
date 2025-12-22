/**
 * Google Analytics utility functions
 * Handles UTM parameter tracking, custom events, and user journey tracking
 */

const UTM_STORAGE_KEY = "ga_utm_params";
// 30 days matches Google Analytics default attribution window
// This means: if a user clicks your Reddit ad, closes their browser, and returns 25 days later,
// you'll still know they originally came from that Reddit ad campaign
// Adjust this if you want a shorter/longer attribution window
const UTM_EXPIRY_DAYS = 30;

/**
 * Extract UTM parameters from URL
 */
export function extractUTMParams() {
  if (typeof window === "undefined") return {};

  const urlParams = new URLSearchParams(window.location.search);
  const utmParams = {};

  // Standard UTM parameters
  const utmKeys = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
  ];

  utmKeys.forEach((key) => {
    const value = urlParams.get(key);
    if (value) {
      utmParams[key] = value;
    }
  });

  return utmParams;
}

/**
 * Store UTM parameters in localStorage (persists across browser sessions)
 * This enables first-touch attribution: if a user clicks a Reddit ad, closes their browser,
 * and returns days later, we still know they originally came from that Reddit ad.
 * 
 * 30-day expiry matches Google Analytics default attribution window.
 */
export function storeUTMParams(utmParams) {
  if (typeof window === "undefined" || !utmParams || Object.keys(utmParams).length === 0) {
    return;
  }

  try {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + UTM_EXPIRY_DAYS);

    const data = {
      params: utmParams,
      expiry: expiryDate.getTime(),
    };

    localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Error storing UTM parameters:", error);
  }
}

/**
 * Get stored UTM parameters (if not expired)
 * Returns empty object if expired or not found
 */
export function getStoredUTMParams() {
  if (typeof window === "undefined") return {};

  try {
    const stored = localStorage.getItem(UTM_STORAGE_KEY);
    if (!stored) return {};

    const data = JSON.parse(stored);
    const now = Date.now();

    // Check if expired
    if (now > data.expiry) {
      localStorage.removeItem(UTM_STORAGE_KEY);
      return {};
    }

    return data.params || {};
  } catch (error) {
    console.error("Error retrieving UTM parameters:", error);
    return {};
  }
}

/**
 * Initialize UTM tracking - call on page load
 */
export function initializeUTMTracking() {
  if (typeof window === "undefined") return;

  const urlParams = extractUTMParams();

  // If we have UTM params in URL, store them
  if (Object.keys(urlParams).length > 0) {
    storeUTMParams(urlParams);
  }

  // Return combined params (URL params take precedence over stored)
  const storedParams = getStoredUTMParams();
  return { ...storedParams, ...urlParams };
}

/**
 * Get UTM parameters for GA tracking
 */
export function getUTMParamsForGA() {
  const urlParams = extractUTMParams();
  const storedParams = getStoredUTMParams();

  // URL params take precedence, but fall back to stored
  return { ...storedParams, ...urlParams };
}

/**
 * Check if gtag is available
 */
export function isGtagAvailable() {
  return typeof window !== "undefined" && typeof window.gtag === "function";
}

/**
 * Track a page view with UTM parameters
 */
export function trackPageView(url, title = null) {
  if (!isGtagAvailable()) return;

  const utmParams = getUTMParamsForGA();
  const config = {
    page_location: url,
    ...(title && { page_title: title }),
    ...utmParams,
  };

  window.gtag("config", process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS, config);
}

/**
 * Track a custom event
 * @param {string} eventName - Name of the event
 * @param {object} eventParams - Additional event parameters
 */
export function trackEvent(eventName, eventParams = {}) {
  if (!isGtagAvailable()) return;

  const utmParams = getUTMParamsForGA();
  const params = {
    ...utmParams,
    ...eventParams,
  };

  window.gtag("event", eventName, params);
}

/**
 * Track user sign-in
 */
export function trackSignIn(method = "google") {
  trackEvent("sign_in", {
    method: method,
  });
}

/**
 * Track feature page visit
 */
export function trackFeatureVisit(featureName, featurePath) {
  trackEvent("feature_visit", {
    feature_name: featureName,
    feature_path: featurePath,
  });
}

/**
 * Track Google Sheet connection
 */
export function trackSheetConnection(sheetId, sheetName) {
  trackEvent("sheet_connected", {
    sheet_id: sheetId,
    sheet_name: sheetName,
  });
}

/**
 * Track user engagement actions
 */
export function trackEngagement(action, details = {}) {
  trackEvent("user_engagement", {
    engagement_action: action,
    ...details,
  });
}

/**
 * Track conversion events
 */
export function trackConversion(conversionType, value = null) {
  const params = {
    conversion_type: conversionType,
  };

  if (value !== null) {
    params.value = value;
    params.currency = "USD";
  }

  trackEvent("conversion", params);
}

/**
 * Track errors
 */
export function trackError(errorType, errorMessage, errorLocation) {
  trackEvent("exception", {
    description: `${errorType}: ${errorMessage}`,
    fatal: false,
    error_location: errorLocation,
  });
}

/**
 * Set user properties (user_id, etc.)
 */
export function setUserProperties(properties) {
  if (!isGtagAvailable()) return;

  window.gtag("set", "user_properties", properties);
}

