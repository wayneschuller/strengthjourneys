import { kv } from "@vercel/kv";
import { randomUUID } from "crypto";

export const ONBOARDING_FLOW_TOKEN_TTL_SECONDS = 30 * 60;
export const ONBOARDING_EVENT_THROTTLE_SECONDS = 60 * 60;

const ONBOARDING_FLOW_KEY_PREFIX = "onboarding-flow:";
const ONBOARDING_EVENT_THROTTLE_KEY_PREFIX = "onboarding-event-throttle:";

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

export function getOnboardingFlowTokenKey(token) {
  return `${ONBOARDING_FLOW_KEY_PREFIX}${token}`;
}

export function getOnboardingEventThrottleKey({ email, event }) {
  return `${ONBOARDING_EVENT_THROTTLE_KEY_PREFIX}${normalizeEmail(email)}:${event}`;
}

export async function issueOnboardingFlowToken({ email, intent }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const token = randomUUID();
  await kv.set(
    getOnboardingFlowTokenKey(token),
    {
      email: normalizedEmail,
      intent,
      createdAt: new Date().toISOString(),
      consumedAt: null,
      consumedEvent: null,
    },
    {
      ex: ONBOARDING_FLOW_TOKEN_TTL_SECONDS,
    },
  );
  return token;
}

export function normalizeOnboardingFlowEmail(email) {
  return normalizeEmail(email);
}
