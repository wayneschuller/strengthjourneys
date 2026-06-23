/**
 * Server-side quota tracking for the public AI lifting assistant chat.
 *
 * Anonymous visitors get a limited daily allowance keyed by an HttpOnly cookie;
 * signed-in users get a higher daily cap keyed by email. Counts live in KV so
 * limits cannot be bypassed by trimming the client message array.
 */

import { createHash, randomUUID } from "crypto";
import { kv } from "@vercel/kv";
import { devLog } from "@/lib/processing-utils";

export const AI_CHAT_ANON_COOKIE = "sj_ai_anon";
export const AI_CHAT_ANON_LIMIT = 50;
export const AI_CHAT_ANON_IP_LIMIT = 150;
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

function getForwardedIp(req) {
  const forwardedFor =
    req.headers["x-vercel-forwarded-for"] || req.headers["x-forwarded-for"];
  const firstForwardedIp = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor?.split(",")[0];

  return firstForwardedIp?.trim() || req.socket?.remoteAddress || "unknown";
}

function hashRateLimitIdentity(value) {
  const salt =
    process.env.AI_RATE_LIMIT_SALT || process.env.NEXTAUTH_SECRET || "";
  return createHash("sha256")
    .update(`${salt}:${value}`)
    .digest("hex")
    .slice(0, 32);
}

function mergeAnonymousQuota(cookieQuota, ipUsed) {
  const ipRemaining = Math.max(0, AI_CHAT_ANON_IP_LIMIT - (Number(ipUsed) || 0));
  const remaining = Math.min(cookieQuota.remaining, ipRemaining);
  const used = Math.max(cookieQuota.used, AI_CHAT_ANON_LIMIT - remaining);

  return {
    ...cookieQuota,
    used,
    remaining,
    warn: remaining > 0 && remaining <= AI_CHAT_ANON_WARN_AT_REMAINING,
    blocked: remaining <= 0,
    code: remaining <= 0 ? "SIGN_IN_REQUIRED" : null,
  };
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

    const dateKey = getUtcDateKey();
    const kvKey = `sj:ai:anon:${anonId}:${dateKey}`;
    const ipHash = hashRateLimitIdentity(getForwardedIp(req));
    const ipKvKey = `sj:ai:anon-ip:${ipHash}:${dateKey}`;
    const current = await readUsage(kvKey);
    const currentIp = await readUsage(ipKvKey);
    const cookieQuota = buildAiChatQuota({
      tier: "anonymous",
      limit: AI_CHAT_ANON_LIMIT,
      used: current,
    });

    if (increment) {
      if (current >= AI_CHAT_ANON_LIMIT || currentIp >= AI_CHAT_ANON_IP_LIMIT) {
        return mergeAnonymousQuota(cookieQuota, currentIp);
      }

      const [used, usedIp] = await Promise.all([
        incrementUsage(kvKey, ANON_USAGE_TTL_SECONDS),
        incrementUsage(ipKvKey, ANON_USAGE_TTL_SECONDS),
      ]);

      return mergeAnonymousQuota(
        buildAiChatQuota({
          tier: "anonymous",
          limit: AI_CHAT_ANON_LIMIT,
          used,
        }),
        usedIp,
      );
    }

    return mergeAnonymousQuota(cookieQuota, currentIp);
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
