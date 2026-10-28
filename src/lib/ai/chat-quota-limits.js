/**
 * The AI chat quota numbers and the quota object, safe to import anywhere.
 *
 * The browser half of the quota: the assistant page reads the quota the server
 * sends back in the X-AI-Chat-* response headers and decides when to warn. The
 * counting itself lives in chat-quota.js, which re-exports everything here so
 * the API routes keep one import.
 *
 * Keep this file free of imports. chat-quota.js imports Node's crypto and the
 * KV client, and a page that imported it shipped crypto-browserify, buffer,
 * stream and the Upstash client to the browser (155 KB gzipped), where
 * `new Redis()` ran with no credentials and warned in the console. Anything a
 * page or component needs from the quota belongs here instead.
 */

export const AI_CHAT_ANON_LIMIT = 50;
export const AI_CHAT_ANON_IP_LIMIT = 150;
export const AI_CHAT_ANON_WARN_AT_REMAINING = 10;
export const AI_CHAT_AUTH_DAILY_LIMIT = 100;
export const AI_CHAT_AUTH_WARN_AT_REMAINING = 15;

export function buildAiChatQuota({ tier, limit, used }) {
  const safeUsed = Math.max(0, Number(used) || 0);
  const safeLimit = Math.max(1, Number(limit) || 1);
  const remaining = Math.max(0, safeLimit - safeUsed);
  const warnThreshold =
    tier === "anonymous"
      ? AI_CHAT_ANON_WARN_AT_REMAINING
      : AI_CHAT_AUTH_WARN_AT_REMAINING;

  return {
    tier,
    limit: safeLimit,
    used: safeUsed,
    remaining,
    warn: remaining > 0 && remaining <= warnThreshold,
    blocked: remaining <= 0,
    code:
      remaining <= 0
        ? tier === "anonymous"
          ? "SIGN_IN_REQUIRED"
          : "DAILY_LIMIT_REACHED"
        : null,
  };
}

export function parseAiChatQuotaFromHeaders(headers) {
  const tier = headers.get("X-AI-Chat-Tier");
  if (!tier) return null;

  return buildAiChatQuota({
    tier,
    limit: headers.get("X-AI-Chat-Limit"),
    used: headers.get("X-AI-Chat-Used"),
  });
}
