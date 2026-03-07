import { kv } from "@vercel/kv";

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
    const record = await kv.get(`sj:user:${email.trim().toLowerCase()}`);
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

/**
 * Checks text against OpenAI's moderation endpoint.
 * Returns true if the content is flagged, false if clean.
 * Fails open (returns false) if the API call fails, so a flaky network
 * doesn't silently block legitimate submissions.
 */
export async function isContentFlaggedByAI(text) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return false;

  try {
    const res = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ input: text }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return false;

    const data = await res.json();
    return data.results?.[0]?.flagged === true;
  } catch {
    return false;
  }
}
