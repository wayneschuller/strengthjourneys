import { kv } from "@/lib/kv";
import { getUserKvKey } from "@/lib/user-kv-keys";

const LEADERBOARD_ADMIN_ENV = "STRENGTH_JOURNEYS_LEADERBOARD_ADMINS";

export function getLeaderboardAdminEmails() {
  return (process.env[LEADERBOARD_ADMIN_ENV] || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isLeaderboardAdminEmail(email) {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) return false;
  return getLeaderboardAdminEmails().includes(normalizedEmail);
}

export function getRequestClientIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (Array.isArray(forwardedFor)) {
    return forwardedFor[0]?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
  }

  if (typeof forwardedFor === "string" && forwardedFor.length > 0) {
    return forwardedFor.split(",")[0].trim();
  }

  return req.socket.remoteAddress || "unknown";
}

/**
 * Returns a vote weight (1–11) based on the user's app tenure from KV.
 *   Anonymous              → 1
 *   Signed in, no sheet    → 3
 *   Sheet linked < 30 days → 5
 *   Sheet linked 30-180d   → 8
 *   Sheet linked 180d+     → 11
 */
export async function getVoteWeight(email) {
  if (!email) return 1;

  try {
    const record = await kv.get(getUserKvKey(email));
    if (!record?.connectedAt) return 3;

    const daysSinceConnected =
      (Date.now() - new Date(record.connectedAt).getTime()) /
      (1000 * 60 * 60 * 24);

    if (daysSinceConnected < 30) return 5;
    if (daysSinceConnected < 180) return 8;
    return 11;
  } catch {
    return 3; // fail safe: treat as signed-in but no sheet
  }
}

export function isValidPlaylistId(id) {
  return typeof id === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(id);
}

// The omni model is the one that accepts images as well as text. Both checks go through it so
// there is a single moderation path to reason about.
const MODERATION_MODEL = "omni-moderation-latest";

// The classifier's own `flagged` threshold is tuned for unambiguous violations. Cover art trends
// "suggestive" long before it trips that, so images get a tighter bar on the sexual categories.
//
// Calibrated 2026-08-27 against the live library and reference imagery. The model scores intent
// rather than skin, which leaves a lot of room under the bar:
//   0.0002 - 0.019  every cover currently in the KV store (highest: "Powerlifting Rage Music")
//   0.010           a bodybuilding photo, the realistic false-positive risk for a gym site
//   0.0008          an encyclopedic bikini photo
//   0.289           a pole dancing photo, which OpenAI's own `flagged` still returns false for
//
// 0.1 sits five times above anything real in the library and still catches the suggestive band
// the built-in threshold waves through. False positives are cheap now that flagged art is held
// for review rather than discarded: it costs one approve click and an email.
const SUGGESTIVE_SCORE_LIMIT = 0.1;

/**
 * Single call into OpenAI's moderation endpoint.
 * @param {Array} input - Moderation input array (text and/or image_url parts).
 * @returns {Promise<Object|null>} The first result object, or null when the check could not be completed.
 */
async function callModeration(input) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: MODERATION_MODEL, input }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.error("Moderation request failed with status", res.status);
      return null;
    }

    const data = await res.json();
    return data.results?.[0] || null;
  } catch (error) {
    console.error("Moderation request errored:", error.message);
    return null;
  }
}

/**
 * Checks text against OpenAI's moderation endpoint.
 * Returns true if the content is flagged, false if clean.
 * Fails open (returns false) if the API call fails, so a flaky network
 * doesn't silently block legitimate submissions.
 */
export async function isContentFlaggedByAI(text) {
  const result = await callModeration([{ type: "text", text }]);
  return result?.flagged === true;
}

/**
 * Maps a moderation verdict onto the stored thumbnail status.
 *   approved - checked and clean, safe to serve publicly
 *   rejected - the classifier objected; held for an admin to overturn
 *   pending  - no verdict available; withheld until a human looks
 * @param {{flagged: boolean, checked: boolean}} verdict - Result from moderateThumbnail().
 * @returns {"approved"|"rejected"|"pending"}
 */
export function thumbnailStatusFromVerdict(verdict) {
  if (verdict.flagged) return "rejected";
  return verdict.checked ? "approved" : "pending";
}

/**
 * Checks a playlist thumbnail against OpenAI's image moderation.
 *
 * Unlike the text check this fails CLOSED: if we can't get a verdict we report the image as
 * unchecked and the caller drops the thumbnail rather than publishing an image nobody has looked
 * at. The playlist itself still goes live, just with the music-note placeholder.
 *
 * @param {string|null} imageUrl - Thumbnail URL returned by oEmbed.
 * @returns {Promise<{flagged: boolean, checked: boolean, reason: string|null}>}
 */
export async function moderateThumbnail(imageUrl) {
  if (!imageUrl) return { flagged: false, checked: true, reason: null };

  const result = await callModeration([
    { type: "image_url", image_url: { url: imageUrl } },
  ]);

  if (!result) return { flagged: false, checked: false, reason: null };

  if (result.flagged === true) {
    const reason =
      Object.entries(result.categories || {})
        .filter(([, isFlagged]) => isFlagged)
        .map(([category]) => category)
        .join(", ") || "flagged";
    return { flagged: true, checked: true, reason };
  }

  const scores = result.category_scores || {};
  const suggestiveScore = Math.max(
    scores.sexual || 0,
    scores["sexual/minors"] || 0,
  );

  if (suggestiveScore > SUGGESTIVE_SCORE_LIMIT) {
    return {
      flagged: true,
      checked: true,
      reason: `suggestive (sexual score ${suggestiveScore.toFixed(2)})`,
    };
  }

  return { flagged: false, checked: true, reason: null };
}
