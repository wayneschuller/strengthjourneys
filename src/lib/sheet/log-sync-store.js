/**
 * The working half of the log sync: holds the outbox outside React, sends one
 * change at a time, and decides when the sheet needs reading again.
 *
 * It lives outside the component tree on purpose. A set added a moment before
 * the lifter changes date, opens another page or lets the phone sleep still
 * has to reach the sheet, so nothing here depends on a mounted component.
 *
 * All timing, network and clock access comes in through `io`, which is what
 * lets scripts/validate-log-sync.mjs drive this exact code against a
 * simulated sheet. The decisions themselves are in log-sync-engine.js.
 */

import {
  applyOutcome,
  applySnapshot,
  clearBackoff,
  configureSheet,
  createEngineState,
  dropOp,
  enqueueDelete,
  enqueueDeleteSession,
  enqueueEdit,
  enqueueInsert,
  getNextOp,
  getSyncSummary,
  markSending,
  planRequest,
  releaseBackoff,
  releaseEditHolds,
  takeEvents,
  trackDate,
} from "@/lib/sheet/log-sync-engine";

// One read after the last change of a burst, not one per change.
const TRAILING_REFRESH_MS = 1500;
// Time for a finished read to travel through SWR and the page into here
// before we consider asking for another.
const REFRESH_GRACE_MS = 2500;
const REQUEST_TIMEOUT_MS = 25000;

/**
 * @param {object} io
 * @param {() => number} io.now Monotonic clock shared with the snapshot stamp.
 * @param {(plan: object) => Promise<object>} io.send Sends one request and
 *   resolves (never rejects) with `{kind, rowIndex?}`.
 * @param {(needRows: boolean) => Promise<object|null>} io.refresh Reads the
 *   sheet again. Resolves `{readAt, rows?}`; `rows` only when asked.
 * @param {Function} io.setTimer
 * @param {Function} io.clearTimer
 * @param {() => boolean} io.isReady
 * @param {(event: object) => void} io.onFailure A change was handed back.
 */
export function createLogSyncStore(io) {
  let state = createEngineState();
  let busy = false;
  let timer = null;
  let timerDue = Infinity;
  let trailingAt = null;
  let viewDate = null;
  let attached = 0;
  const refresh = { inFlight: false, nextAt: 0, attempt: 0 };
  const listeners = new Set();
  const waiters = new Map();

  function setState(next) {
    if (next === state) return;
    const drained = takeEvents(next);
    state = drained.state;
    for (const event of drained.events) {
      if (event.type === "settled") {
        waiters.get(event.opId)?.forEach((resolve) => resolve(event.ok));
        waiters.delete(event.opId);
      } else if (event.type === "failed") {
        io.onFailure?.(event);
      }
    }
    listeners.forEach((listener) => listener());
  }

  function wake(delay) {
    const wait = Math.max(0, delay);
    const due = io.now() + wait;
    if (timer !== null && due >= timerDue) return;
    if (timer !== null) io.clearTimer(timer);
    timerDue = due;
    timer = io.setTimer(() => {
      timer = null;
      timerDue = Infinity;
      void pump();
    }, wait);
  }

  function startRefresh() {
    if (refresh.inFlight) return;
    refresh.inFlight = true;
    const startedAt = io.now();
    // With the log page open, its own effect hands the new snapshot over.
    // With it closed nobody will, so take the rows from this read directly.
    const needRows = attached === 0;
    Promise.resolve()
      .then(() => io.refresh(needRows))
      .then(
        (snapshot) => {
          const fresh = Boolean(snapshot) && snapshot.readAt >= startedAt;
          if (fresh && needRows && attached === 0 && snapshot.rows) {
            setState(applySnapshot(state, snapshot, viewDate));
          }
          return fresh;
        },
        () => false,
      )
      .then((fresh) => {
        refresh.inFlight = false;
        refresh.attempt = fresh ? 0 : refresh.attempt + 1;
        const wait = fresh
          ? REFRESH_GRACE_MS
          : Math.min(30000, 2000 * 2 ** (refresh.attempt - 1));
        refresh.nextAt = io.now() + wait;
        wake(wait);
      });
  }

  function requestRefresh() {
    // Never before the hold allows a conclusive answer, however eager a
    // retry is.
    const due = Math.max(refresh.nextAt, state.hold?.after ?? 0);
    const wait = due - io.now();
    if (wait > 0) wake(wait);
    else startRefresh();
  }

  // The single writer. Everything that changes the sheet goes through this
  // loop, one request at a time, in the order the lifter made the changes.
  async function pump() {
    if (busy) return;
    busy = true;
    try {
      for (;;) {
        if (!state.ssid || !io.isReady()) return;
        const now = io.now();

        if (state.hold?.kind === "backoff") {
          if (state.hold.until > now) {
            wake(state.hold.until - now);
            return;
          }
          setState(releaseBackoff(state, now));
          continue;
        }
        if (state.hold?.kind === "snapshot") {
          requestRefresh();
          return;
        }

        const op = getNextOp(state);
        if (!op) {
          // Everything is sent. Once the burst goes quiet, read the sheet so
          // the confirmed changes become the snapshot and the rest of the app
          // sees them.
          const summary = getSyncSummary(state);
          if (summary.pending || !summary.awaitingSnapshot) return;
          if (trailingAt === null) trailingAt = now + TRAILING_REFRESH_MS;
          const due = Math.max(trailingAt, refresh.nextAt);
          if (now < due) {
            wake(due - now);
            return;
          }
          trailingAt = null;
          startRefresh();
          return;
        }
        trailingAt = null;

        const wait = (op.holdUntil ?? 0) - now;
        if (wait > 0) {
          wake(wait);
          return;
        }

        const plan = planRequest(state, op);
        if (plan.kind === "drop") {
          setState(dropOp(state, op.id, plan.reason, plan.silent));
          continue;
        }
        if (plan.kind === "noop") {
          setState(applyOutcome(state, op.id, { kind: "noop" }, now));
          continue;
        }

        setState(markSending(state, op.id, plan));
        const result = await io.send({
          ...plan,
          body: { ssid: state.ssid, ...plan.body },
        });
        const finishedAt = io.now();
        const holdBefore = state.hold;
        setState(
          applyOutcome(state, op.id, { ...result, at: finishedAt }, finishedAt),
        );
        if (state.hold !== holdBefore && state.hold?.kind === "snapshot") {
          refresh.attempt = 0;
          refresh.nextAt = 0;
        }
      }
    } finally {
      busy = false;
    }
  }

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /** Count the mounted log pages; with none, reads are taken in directly. */
    attach() {
      attached += 1;
      return () => {
        attached -= 1;
      };
    },

    configure(ssid) {
      const next = configureSheet(state, ssid ?? null);
      if (next !== state) {
        waiters.forEach((resolvers) =>
          resolvers.forEach((resolve) => resolve(false)),
        );
        waiters.clear();
        trailingAt = null;
      }
      setState(next);
      void pump();
    },

    snapshot(snapshot, date) {
      viewDate = date ?? viewDate;
      setState(trackDate(applySnapshot(state, snapshot, viewDate), viewDate));
      void pump();
    },

    /** The session now on screen. */
    view(date) {
      viewDate = date ?? viewDate;
      setState(trackDate(state, viewDate));
    },

    addSet({ date, liftType, fields }) {
      const result = enqueueInsert(state, { date, liftType, fields });
      setState(result.state);
      void pump();
      return result.key;
    },

    editSet({ date, key, patch }) {
      setState(enqueueEdit(state, { date, key, patch, now: io.now() }));
      void pump();
    },

    deleteSet({ date, key }) {
      setState(enqueueDelete(state, { date, key }));
      void pump();
    },

    /** Resolves true once the session is gone from the sheet. */
    deleteSession({ date }) {
      const result = enqueueDeleteSession(state, { date });
      const settled = new Promise((resolve) => {
        const resolvers = waiters.get(result.opId) ?? [];
        resolvers.push(resolve);
        waiters.set(result.opId, resolvers);
      });
      setState(result.state);
      void pump();
      return settled;
    },

    /** The page is being hidden or left: send held edits without waiting. */
    flush() {
      setState(releaseEditHolds(state));
      void pump();
    },

    /** The connection or the lifter is back: stop waiting and try now. */
    retryNow() {
      setState(clearBackoff(state));
      refresh.nextAt = Math.min(refresh.nextAt, io.now());
      void pump();
    },

    hasUnsentChanges: () => getSyncSummary(state).pending > 0,
  };
}

/**
 * Send one sheet request and classify what came back. Never rejects: a thrown
 * fetch is an answer too, and the least certain one.
 */
export async function sendSheetRequest({ url, method, body }, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
      // Lets a request already on its way finish if the page is closed.
      keepalive: true,
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      return { kind: "ok", rowIndex: data?.firstRowIndex };
    }
    if (response.status === 409 && data?.code === "PRECONDITION_FAILED") {
      return { kind: "conflict", message: data?.error, actual: data?.actual };
    }
    // Refused before anything was written: sign-in lapsed or rate limited.
    if ([401, 403, 429].includes(response.status)) {
      return { kind: "retry", status: response.status };
    }
    // A server error can arrive after the write went through.
    if (response.status >= 500 || response.status === 408) {
      return { kind: "ambiguous", status: response.status };
    }
    return { kind: "fatal", status: response.status, message: data?.error };
  } catch (error) {
    return { kind: "ambiguous", message: error?.message };
  } finally {
    clearTimeout(timeout);
  }
}
