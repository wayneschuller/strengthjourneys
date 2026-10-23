/**
 * A light buzz under the lifter's thumb. Only Android Chrome and a few others
 * vibrate; iPhone Safari has no Vibration API, and there this does nothing.
 * Never throws, so callers need no guard.
 */

export const HAPTIC = {
  // A set is in the sheet.
  saved: 10,
  // Turned to another session.
  page: 6,
};

// A PR buzz grows with its celebration tier (see CELEBRATION_TIERS).
const PR_PATTERNS = {
  border: 18,
  confettiSmall: [20, 50, 20],
  confettiLarge: [30, 50, 30, 50, 60],
  confettiLargeShake: [40, 60, 40, 60, 140],
};

export function buzz(pattern) {
  try {
    if (typeof navigator === "undefined" || !navigator.vibrate) return;
    navigator.vibrate(pattern);
  } catch {
    // Blocked by the browser, or no user gesture yet: stay silent.
  }
}

export function buzzForCelebration(tier) {
  const pattern = PR_PATTERNS[tier];
  if (pattern) buzz(pattern);
}
