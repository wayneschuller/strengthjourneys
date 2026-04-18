/**
 * Gate for the sign-in education dialog.
 *
 * Returning lifters should never see the dialog — they already know what
 * Strength Journeys does. We take a synchronous localStorage snapshot at
 * module load so first paint never flashes the dialog for returners while
 * React hydrates.
 *
 * "Returning" here means any of:
 *   - We previously marked this browser after a sign-in attempt
 *   - A linked sheet still exists in SHEET_INFO (legacy returners)
 *   - A deprecated ssid key is still present (very old returners)
 */

import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";

function readSignedInBefore() {
  if (typeof window === "undefined") return false;

  try {
    if (localStorage.getItem(LOCAL_STORAGE_KEYS.SIGNED_IN_BEFORE) === "1") {
      return true;
    }

    const sheetInfoRaw = localStorage.getItem(LOCAL_STORAGE_KEYS.SHEET_INFO);
    if (sheetInfoRaw && JSON.parse(sheetInfoRaw)?.ssid) return true;

    if (localStorage.getItem(LOCAL_STORAGE_KEYS.SSID)) return true;
  } catch {
    // localStorage blocked or JSON parse failed — treat as first-time.
  }
  return false;
}

// Snapshot once at import time so the very first render for returners
// skips the dialog without waiting on a mount effect.
const _snapshotAtLoad = readSignedInBefore();

export function isReturningLifter() {
  // Prefer the live read so that marking the flag within the same session
  // (e.g. user clicks "Continue with Google" in the dialog once) also works.
  return _snapshotAtLoad || readSignedInBefore();
}

export function markReturningLifter() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEYS.SIGNED_IN_BEFORE, "1");
  } catch {
    // Ignore — if storage is blocked, we just show the dialog again next time.
  }
}
