/**
 * Server-side quota tracking for the public AI lifting assistant chat.
 *
 * Anonymous visitors get a limited daily allowance keyed by an HttpOnly cookie;
 * signed-in users get a higher daily cap keyed by email. Counts live in KV so
 * limits cannot be bypassed by trimming the client message array.
 */

import { randomUUID } from "crypto";
import { kv } from "@vercel/kv";
import { devLog } from "@/lib/processing-utils";

export const AI_CHAT_ANON_COOKIE = "sj_ai_anon";
export const AI_CHAT_ANON_LIMIT = 50;
export const AI_CHAT_ANON_WARN_AT_REMAINING = 10;
export const AI_CHAT_AUTH_DAILY_LIMIT = 100;
export const AI_CHAT_AUTH_WARN_AT_REMAINING = 15;

const ANON_COOKIE_TTL_SECONDS = 60 * 60 * 24 * 365;
const ANON_USAGE_TTL_SECONDS = 60 * 60 * 48;
const AUTH_TTL_SECONDS = 60 * 60 * 48;

export function getUtcDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

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

export function appendAiChatQuotaHeaders(res, quota) {
  res.setHeader("X-AI-Chat-Tier", quota.tier);
  res.setHeader("X-AI-Chat-Limit", String(quota.limit));
  res.setHeader("X-AI-Chat-Used", String(quota.used));
  res.setHeader("X-AI-Chat-Remaining", String(quota.remaining));
}

function appendAnonCookie(res, anonId) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${AI_CHAT_ANON_COOKIE}=${anonId}; Path=/; Max-Age=${ANON_COOKIE_TTL_SECONDS}; HttpOnly; SameSite=Lax${secure}`,
  );
}

function getAnonIdFromRequest(req) {
  return req.cookies?.[AI_CHAT_ANON_COOKIE] || null;
}

async function readUsage(kvKey) {
  const existing = await kv.get(kvKey);
  return typeof existing === "number" ? existing : Number(existing) || 0;
}

async function incrementUsage(kvKey, ttlSeconds) {
  const used = await kv.incr(kvKey);
  if (used === 1) {
    await kv.expire(kvKey, ttlSeconds);
  }
  return used;
}

/**
 * Reads or reserves one chat turn against the caller's quota bucket.
 * @param {{ req: import("http").IncomingMessage, res: import("http").ServerResponse, session: object|null, increment?: boolean }} params
 */
export async function resolveAiChatQuota({
  req,
  res,
  session,
  increment = false,
}) {
  try {
    if (session?.user?.email) {
      const email = session.user.email.trim().toLowerCase();
      const kvKey = `sj:ai:auth:${email}:${getUtcDateKey()}`;
      const current = await readUsage(kvKey);

      if (increment) {
        if (current >= AI_CHAT_AUTH_DAILY_LIMIT) {
          return buildAiChatQuota({
            tier: "authenticated",
            limit: AI_CHAT_AUTH_DAILY_LIMIT,
            used: current,
          });
        }

        const used = await incrementUsage(kvKey, AUTH_TTL_SECONDS);
        return buildAiChatQuota({
          tier: "authenticated",
          limit: AI_CHAT_AUTH_DAILY_LIMIT,
          used,
        });
      }

      return buildAiChatQuota({
        tier: "authenticated",
        limit: AI_CHAT_AUTH_DAILY_LIMIT,
        used: current,
      });
    }

    let anonId = getAnonIdFromRequest(req);
    if (!anonId) {
      anonId = randomUUID();
      appendAnonCookie(res, anonId);
    }

    const kvKey = `sj:ai:anon:${anonId}:${getUtcDateKey()}`;
    const current = await readUsage(kvKey);

    if (increment) {
      if (current >= AI_CHAT_ANON_LIMIT) {
        return buildAiChatQuota({
          tier: "anonymous",
          limit: AI_CHAT_ANON_LIMIT,
          used: current,
        });
      }

      const used = await incrementUsage(kvKey, ANON_USAGE_TTL_SECONDS);
      return buildAiChatQuota({
        tier: "anonymous",
        limit: AI_CHAT_ANON_LIMIT,
        used,
      });
    }

    return buildAiChatQuota({
      tier: "anonymous",
      limit: AI_CHAT_ANON_LIMIT,
      used: current,
    });
  } catch (error) {
    devLog("AI chat quota KV error:", error);

    if (process.env.NODE_ENV !== "production") {
      return buildAiChatQuota({
        tier: session?.user?.email ? "authenticated" : "anonymous",
        limit: session?.user?.email
          ? AI_CHAT_AUTH_DAILY_LIMIT
          : AI_CHAT_ANON_LIMIT,
        used: 0,
      });
    }

    throw error;
  }
}
