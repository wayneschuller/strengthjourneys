/**
 * Keeps the log's unsent changes on the phone, so closing the tab, a
 * reload, or Chrome discarding a backgrounded tab mid-session loses nothing.
 *
 * Each tab saves its own record (`SJ_logOutbox:<ssid>:<tabId>`) and holds a
 * Web Lock named for its tab id for as long as the record exists. A lock is
 * let go only when its page is gone (closed, reloaded, discarded), never
 * while a tab is merely asleep in the background. So a record whose lock is
 * free belongs to a page that can no longer send it, and is safe to take
 * over; one whose lock is held is still being worked on, and two tabs never
 * send the same change. Taking over happens under a second lock per sheet, so
 * two pages opening at once cannot both take the same record.
 *
 * Without Web Locks (very old browsers) a tab keeps its id in sessionStorage
 * and takes over only its own record after a reload.
 *
 * What is saved is the engine's intents (see getRecoverableIntents): lift,
 * reps, weight, notes and link for the sets still owed, nothing else.
 * clearAllLogOutboxes runs on sign-out.
 */

import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";

const PREFIX = LOCAL_STORAGE_KEYS.LOG_OUTBOX;
const TAB_ID_KEY = "sj-log-tab-id";
const RECORD_VERSION = 1;
// A change left unsent for this long is from another season of training;
// replaying it now would surprise more than help.
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

const locks =
  typeof navigator !== "undefined" && navigator.locks?.request
    ? navigator.locks
    : null;

const tabId = (() => {
  if (typeof window === "undefined") return "server";
  const fresh = () =>
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  if (locks) return fresh();
  try {
    const saved = sessionStorage.getItem(TAB_ID_KEY);
    if (saved) return saved;
    const id = fresh();
    sessionStorage.setItem(TAB_ID_KEY, id);
    return id;
  } catch {
    return fresh();
  }
})();

const recordKey = (ssid, id = tabId) => `${PREFIX}:${ssid}:${id}`;
const tabLockName = (id) => `sj-log-tab:${id}`;

// --- This tab's lock -----------------------------------------------------------

let lockHeld = !locks;
let lockPending = null;
let releaseLock = null;
// Saves that arrived before the lock did; only the latest matters.
let deferred = null;

function acquireTabLock() {
  if (lockHeld || lockPending) return lockPending ?? Promise.resolve();
  lockPending = new Promise((granted) => {
    locks
      .request(
        tabLockName(tabId),
        () =>
          new Promise((release) => {
            lockHeld = true;
            releaseLock = release;
            granted();
          }),
      )
      .catch(() => granted());
  }).then(() => {
    lockPending = null;
    if (deferred) {
      const { ssid, intents } = deferred;
      deferred = null;
      writeRecord(ssid, intents);
    }
  });
  return lockPending;
}

function maybeReleaseTabLock() {
  if (!locks || !lockHeld || !releaseLock) return;
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(`${PREFIX}:`) && key.endsWith(`:${tabId}`)) return;
    }
  } catch {
    return;
  }
  // Let go once nothing of ours is saved, so an idle tab holds no lock and
  // stays eligible for the browser's back/forward cache.
  lockHeld = false;
  releaseLock();
  releaseLock = null;
}

function writeRecord(ssid, intents) {
  try {
    if (!intents.length) {
      localStorage.removeItem(recordKey(ssid));
      maybeReleaseTabLock();
      return true;
    }
    localStorage.setItem(
      recordKey(ssid),
      JSON.stringify({ v: RECORD_VERSION, savedAt: Date.now(), intents }),
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Save what this tab still owes a sheet. Synchronous once the tab's lock is
 * held, which is from the first save on; the very first save of a page
 * waits the moment it takes to get it.
 */
export function persistLogOutbox(ssid, intents) {
  if (typeof window === "undefined") return true;
  if (!lockHeld) {
    if (!intents.length && !deferred) return true;
    deferred = { ssid, intents };
    void acquireTabLock();
    return true;
  }
  return writeRecord(ssid, intents);
}

// --- Taking over what closed tabs left ---------------------------------------

function readRecords(ssid) {
  const found = [];
  try {
    const prefix = `${PREFIX}:${ssid}:`;
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      const owner = key.slice(prefix.length);
      let record = null;
      try {
        record = JSON.parse(localStorage.getItem(key));
      } catch {
        // Unreadable: treat it as empty so it is cleared.
      }
      found.push({ key, owner, record });
    }
  } catch {
    // Storage blocked: nothing to take over.
  }
  return found;
}

/**
 * Hand `take` the intents closed tabs left for this sheet, oldest first,
 * then forget them. `take` saves them as this tab's own (through
 * persistLogOutbox) before returning, so they are never in neither place.
 */
export async function adoptLogOutboxes(ssid, take) {
  if (typeof window === "undefined") return;
  if (!locks) {
    adoptFrom(readRecords(ssid), (owner) => owner === tabId, take);
    return;
  }
  // Ours first, so our own save inside `take` is immediate.
  await acquireTabLock();
  await locks.request(`sj-log-adopt:${ssid}`, async () => {
    const records = readRecords(ssid);
    if (!records.length) return;
    const snapshot = await locks.query();
    const live = new Set(
      (snapshot.held ?? []).map((lock) => lock.name).filter(Boolean),
    );
    adoptFrom(
      records,
      (owner) => owner !== tabId && !live.has(tabLockName(owner)),
      take,
    );
  });
}

function adoptFrom(records, isAdoptable, take) {
  const now = Date.now();
  const adoptable = records.filter(({ owner }) => isAdoptable(owner));
  if (!adoptable.length) return;
  const intents = adoptable
    .filter(
      ({ record }) =>
        record?.v === RECORD_VERSION &&
        Array.isArray(record.intents) &&
        now - (record.savedAt ?? 0) < MAX_AGE_MS,
    )
    .sort((a, b) => a.record.savedAt - b.record.savedAt)
    .flatMap(({ record }) => record.intents);
  if (intents.length) take(intents);
  try {
    for (const { key } of adoptable) {
      // Without locks our own record is the one taken over, and `take` has
      // just written it afresh.
      if (key.endsWith(`:${tabId}`)) continue;
      localStorage.removeItem(key);
    }
  } catch {
    // Left in place: the next page tries again.
  }
}

/** Sign-out: nothing of the log stays on the phone. */
export function clearAllLogOutboxes() {
  try {
    const doomed = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(`${PREFIX}:`)) doomed.push(key);
    }
    doomed.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Storage blocked: there is nothing saved either.
  }
  deferred = null;
  maybeReleaseTabLock();
}
