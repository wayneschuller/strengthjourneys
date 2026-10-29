/**
 * Counts the AI coach's opening suggestions: which chips a blank chat page
 * showed, and which one started the chat (or that the athlete typed their
 * own). The page sends it with navigator.sendBeacon, so it arrives as text.
 *
 * Only counts reach KV, under prompt templates the server recognises; see
 * lib/ai/opening-suggestion-stats.js. Rate limited per hashed IP so the
 * counts cannot be inflated in bulk.
 */

import { isAllowedOrigin } from "@/lib/ai/chat-origin";
import {
  getForwardedIp,
  getUtcDateKey,
  hashRateLimitIdentity,
  incrementUsage,
} from "@/lib/ai/chat-quota";
import { recordOpeningSuggestions } from "@/lib/ai/opening-suggestion-stats";
import { devLog } from "@/lib/processing-utils";

const DAILY_LIMIT = 200;
const RATE_LIMIT_TTL_SECONDS = 60 * 60 * 48;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  if (
    process.env.NODE_ENV === "production" &&
    !isAllowedOrigin(req.headers.origin)
  ) {
    return res.status(403).json({ error: "Forbidden" });
  }

  let report = req.body;
  if (typeof report === "string") {
    try {
      report = JSON.parse(report);
    } catch {
      return res.status(400).json({ error: "Invalid report" });
    }
  }
  if (!report || typeof report !== "object") {
    return res.status(400).json({ error: "Invalid report" });
  }

  // The dev server shares production KV, so local testing would skew the
  // counts.
  if (process.env.NEXT_PUBLIC_STRENGTH_JOURNEYS_ENV === "development") {
    devLog("Skipped counting opening suggestions in dev", report);
    return res.status(204).end();
  }

  const ipHash = hashRateLimitIdentity(getForwardedIp(req));
  const used = await incrementUsage(
    `sj:ai:openers-ip:${ipHash}:${getUtcDateKey()}`,
    RATE_LIMIT_TTL_SECONDS,
  );
  if (used > DAILY_LIMIT) return res.status(429).end();

  try {
    await recordOpeningSuggestions(report);
  } catch (error) {
    devLog("Failed to count opening suggestions", error);
  }
  return res.status(204).end();
}
