import { kv } from "@/lib/kv";
import { getRequestClientIp } from "@/lib/playlists/playlist-security";
import { recordLogSuggestion } from "@/lib/log-suggestion-stats";

// Generous for a real session (a set every few seconds would still fit),
// tight enough that a script cannot fill the month's list in one sitting.
const EVENT_LIMIT_PER_WINDOW = 120;
const EVENT_WINDOW_SECONDS = 10 * 60;
const MAX_BODY_BYTES = 8 * 1024;

async function isThrottled(req) {
  const key = `log-suggestion-throttle:${getRequestClientIp(req)}`;
  const count = await kv.incr(key);
  if (count === 1) await kv.expire(key, EVENT_WINDOW_SECONDS);
  return count > EVENT_LIMIT_PER_WINDOW;
}

/**
 * Anonymous set-suggestion telemetry from /log. Reads no session and stores
 * no identity; see lib/log-suggestion-telemetry.js for what a record holds.
 * Always answers 204 for a well-formed request, so the page never waits on
 * or reacts to it.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }

  const body = req.body;
  if (
    !body ||
    typeof body !== "object" ||
    JSON.stringify(body).length > MAX_BODY_BYTES
  ) {
    return res.status(400).end();
  }

  try {
    if (await isThrottled(req)) return res.status(429).end();
    await recordLogSuggestion(body);
  } catch (error) {
    console.error("Log suggestion telemetry failed:", error);
  }
  return res.status(204).end();
}
