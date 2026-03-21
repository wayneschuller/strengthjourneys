import { kv } from "@vercel/kv";
import { getServerSession } from "next-auth/next";
import { authOptions, promptDeveloper } from "@/pages/api/auth/[...nextauth]";
import {
  getOnboardingEventThrottleKey,
  getOnboardingFlowTokenKey,
  normalizeOnboardingFlowEmail,
  ONBOARDING_EVENT_THROTTLE_SECONDS,
  ONBOARDING_FLOW_TOKEN_TTL_SECONDS,
} from "@/lib/onboarding-flow-events";

const ALLOWED_EVENTS = new Set([
  "onboarding-success",
  "onboarding-aborted",
  "onboarding-failed",
]);

function sanitizeString(value, maxLength = 160) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function sanitizeBoolean(value) {
  return typeof value === "boolean" ? value : null;
}

function sanitizeDurationMs(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(60 * 60 * 1000, Math.round(value)));
}

function sanitizeOnboardingMeta(event, meta, flowRecord) {
  const sanitized = {};
  const safeIntent = sanitizeString(flowRecord?.intent, 40);
  if (safeIntent) sanitized.intent = safeIntent;

  if (event === "onboarding-success") {
    const safeResultAction = sanitizeString(meta?.resultAction, 60);
    const safeReason = sanitizeString(meta?.reason, 80);
    const safeSheetName = sanitizeString(meta?.sheetName, 120);
    const safeHadLocalSheetBefore = sanitizeBoolean(meta?.hadLocalSheetBefore);
    const safeDurationMs = sanitizeDurationMs(meta?.durationMs);

    if (safeResultAction) sanitized.resultAction = safeResultAction;
    if (safeReason) sanitized.reason = safeReason;
    if (meta?.ssid != null) sanitized.ssid = Boolean(meta.ssid);
    if (safeSheetName) sanitized.sheetName = safeSheetName;
    if (safeHadLocalSheetBefore != null) {
      sanitized.hadLocalSheetBefore = safeHadLocalSheetBefore;
    }
    if (safeDurationMs != null) sanitized.durationMs = safeDurationMs;
    return sanitized;
  }

  const safeState = sanitizeString(meta?.state, 80);
  const safeReason = sanitizeString(meta?.reason, 80);
  const safeHadLocalSheetBefore = sanitizeBoolean(meta?.hadLocalSheetBefore);
  const safeDurationMs = sanitizeDurationMs(meta?.durationMs);
  const safeProvisionError = sanitizeString(meta?.provisionError, 200);

  if (safeState) sanitized.state = safeState;
  if (safeReason) sanitized.reason = safeReason;
  if (safeHadLocalSheetBefore != null) {
    sanitized.hadLocalSheetBefore = safeHadLocalSheetBefore;
  }
  if (safeDurationMs != null) sanitized.durationMs = safeDurationMs;
  if (safeProvisionError) sanitized.provisionError = safeProvisionError;
  return sanitized;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    res.status(401).json({ error: "You must be logged in." });
    return;
  }

  const event = typeof req.body?.event === "string" ? req.body.event : "";
  if (!ALLOWED_EVENTS.has(event)) {
    res.status(400).json({ error: "Invalid onboarding event." });
    return;
  }

  const onboardingFlowToken =
    typeof req.body?.onboardingFlowToken === "string"
      ? req.body.onboardingFlowToken.trim()
      : "";
  if (!onboardingFlowToken) {
    res.status(400).json({ error: "Missing onboarding flow token." });
    return;
  }

  const flowTokenKey = getOnboardingFlowTokenKey(onboardingFlowToken);
  const flowRecord = await kv.get(flowTokenKey);
  const sessionEmail = normalizeOnboardingFlowEmail(session.user.email);
  if (!flowRecord || flowRecord.email !== sessionEmail) {
    res.status(403).json({ error: "Invalid onboarding flow token." });
    return;
  }
  if (flowRecord.consumedAt) {
    res.status(409).json({ error: "Onboarding event already reported." });
    return;
  }

  const meta = typeof req.body?.meta === "object" && req.body?.meta ? req.body.meta : {};
  const sanitizedMeta = sanitizeOnboardingMeta(event, meta, flowRecord);
  const throttleKey = getOnboardingEventThrottleKey({
    email: sessionEmail,
    event,
  });

  const throttleLock = await kv.set(throttleKey, Date.now(), {
    ex: ONBOARDING_EVENT_THROTTLE_SECONDS,
    nx: true,
  });
  if (throttleLock === null) {
    res.status(429).json({ error: "Onboarding event already reported recently." });
    return;
  }

  try {
    await promptDeveloper(event, session.user, sanitizedMeta);
    await kv.set(
      flowTokenKey,
      {
        ...flowRecord,
        consumedAt: new Date().toISOString(),
        consumedEvent: event,
      },
      {
        ex: ONBOARDING_FLOW_TOKEN_TTL_SECONDS,
      },
    );
    res.status(200).json({ ok: true });
  } catch (error) {
    await kv.del(throttleKey);
    console.error("[onboarding-event] failed:", error);
    res.status(500).json({ error: error.message || "Failed to send onboarding event" });
  }
}
