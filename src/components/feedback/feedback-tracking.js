import { gaTrackFeedbackSentiment } from "@/lib/analytics";

export function readStoredSentiment(storageKey) {
  if (!storageKey) return null;
  try {
    const stored = sessionStorage.getItem(storageKey);
    if (stored === "positive" || stored === "negative") {
      return stored;
    }
  } catch (_) {}
  return null;
}

export function writeStoredSentiment(storageKey, sentiment) {
  if (!storageKey) return;
  if (sentiment !== "positive" && sentiment !== "negative") return;
  try {
    sessionStorage.setItem(storageKey, sentiment);
  } catch (_) {}
}

export function trackFeedbackSentiment({
  sentiment,
  page,
  isLoggedIn = false,
  startedAtMs,
  extra = {},
}) {
  if (sentiment !== "positive" && sentiment !== "negative") return;
  if (typeof page !== "string" || !page) return;

  const params = {
    logged_in: Boolean(isLoggedIn),
    ...extra,
  };

  if (typeof startedAtMs === "number") {
    params.seconds_on_page = Math.round((Date.now() - startedAtMs) / 1000);
  }

  gaTrackFeedbackSentiment(sentiment, page, params);
}
