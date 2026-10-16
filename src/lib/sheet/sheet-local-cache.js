/**
 * The last read of the lifter's sheet, kept on the phone so the app opens on
 * their own log at once, with or without a connection.
 *
 * One copy per browser, for the linked sheet only, replaced after every read
 * that brought new rows. It is a copy to look at and log against; the log's
 * sync never places a row from it (see log-sync-store.js). A 12-year log is
 * about 1.7M characters, well inside localStorage's ~5M; a sheet too big to
 * save simply goes without, as before. Cleared on sign-out, with the log's
 * unsent changes (clearLocalLogData).
 */

import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { clearAllLogOutboxes } from "@/lib/sheet/log-sync-persistence";

const KEY = LOCAL_STORAGE_KEYS.SHEET_CACHE;
const VERSION = 1;

/** @returns {{values: string[][], name?: string, modifiedTime?: string}|null} */
export function readCachedSheet(ssid) {
  if (!ssid) return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (cached?.v !== VERSION || cached.ssid !== ssid) return null;
    return Array.isArray(cached.data?.values) ? cached.data : null;
  } catch {
    return null;
  }
}

/** Save a read's rows and details. Runs when the browser is idle. */
export function writeCachedSheet(ssid, data) {
  if (!ssid || !Array.isArray(data?.values)) return () => {};
  const run = () => {
    const payload = JSON.stringify({
      v: VERSION,
      ssid,
      savedAt: Date.now(),
      data: {
        values: data.values,
        name: data.name,
        webViewLink: data.webViewLink,
        modifiedTime: data.modifiedTime,
        modifiedByMeTime: data.modifiedByMeTime,
      },
    });
    try {
      localStorage.setItem(KEY, payload);
    } catch {
      // Too big or storage blocked. A stale copy would mislead, so drop it.
      try {
        localStorage.removeItem(KEY);
      } catch {
        // Nothing more to do.
      }
    }
  };
  if (typeof window.requestIdleCallback === "function") {
    const handle = window.requestIdleCallback(run, { timeout: 4000 });
    return () => window.cancelIdleCallback(handle);
  }
  const handle = setTimeout(run, 500);
  return () => clearTimeout(handle);
}

/** Sign-out: the saved log and any unsent changes leave the phone. */
export function clearLocalLogData() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: nothing was saved.
  }
  clearAllLogOutboxes();
}
