/**
 * Persists a tiny interrupted-save intent across the Google OAuth round-trip.
 * This is a recovery rail for a rare scope mismatch, not durable workflow
 * state for normal app usage.
 */

import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";

// Long enough to sign in again at Google and come back. An older record is a
// save the lifter walked away from, and must not start setup weeks later.
const PENDING_SHEET_ACTION_MAX_AGE_MS = 30 * 60 * 1000;

export const PENDING_SHEET_ACTIONS = {
  BOOTSTRAP_PROVISION: "bootstrap_provision",
  CREATE_SHEET_FROM_IMPORT: "create_sheet_from_import",
};

function getStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function persistPendingSheetAction(action) {
  const storage = getStorage();
  if (!storage || !action?.type) return;

  storage.setItem(
    LOCAL_STORAGE_KEYS.PENDING_SHEET_ACTION,
    JSON.stringify({
      ...action,
      storedAt: Date.now(),
      version: 1,
    }),
  );
}

export function readPendingSheetAction() {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(LOCAL_STORAGE_KEYS.PENDING_SHEET_ACTION);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.type) return null;
    const age = Date.now() - Number(parsed.storedAt);
    if (!(age >= 0 && age < PENDING_SHEET_ACTION_MAX_AGE_MS)) {
      storage.removeItem(LOCAL_STORAGE_KEYS.PENDING_SHEET_ACTION);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingSheetAction() {
  const storage = getStorage();
  storage?.removeItem(LOCAL_STORAGE_KEYS.PENDING_SHEET_ACTION);
}
