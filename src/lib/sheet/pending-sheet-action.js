/**
 * Persists a tiny interrupted-save intent across the Google OAuth round-trip.
 * This is a recovery rail for a rare scope mismatch, not durable workflow
 * state for normal app usage.
 */

import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";

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
    return parsed?.type ? parsed : null;
  } catch {
    return null;
  }
}

export function clearPendingSheetAction() {
  const storage = getStorage();
  storage?.removeItem(LOCAL_STORAGE_KEYS.PENDING_SHEET_ACTION);
}
