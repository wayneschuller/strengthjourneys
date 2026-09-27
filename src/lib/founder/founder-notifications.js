/**
 * Central feature gates for founder-facing notifications.
 * Keep these checks in one place so event-specific emails can be disabled
 * later without touching the route logic that produces the metadata.
 */

const DISABLED_FLAG = "false";

// Outcome-driven onboarding support is handled separately. These legacy event
// emails describe intermediate steps and can produce several messages for one
// successful user journey, so they stay quiet by default.
const DEFAULT_DISABLED_EVENTS = new Set([
  "import-merged",
  "onboarding-aborted",
  "onboarding-failed",
  "reprovisioned",
  "returning",
]);

const EVENT_ENV_FLAGS = {
  "import-merged": process.env.ENABLE_FOUNDER_IMPORT_MERGED_EMAIL,
};

export function shouldSendFounderNotification(event) {
  const flagValue = EVENT_ENV_FLAGS[event];
  if (typeof flagValue === "string") {
    return flagValue.trim().toLowerCase() !== DISABLED_FLAG;
  }
  return !DEFAULT_DISABLED_EVENTS.has(event);
}
