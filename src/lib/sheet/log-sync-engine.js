/**
 * Pure state machine behind the log page's Google Sheets sync.
 *
 * The sheet is the only database, it has no row ids, and a row's position
 * moves whenever a row above it is inserted or deleted. Every lost or
 * misplaced edit this page has had came from guessing at that position while
 * something else was in flight. So the model here is deliberately small:
 *
 *   view = the last sheet snapshot + an ordered list of the lifter's changes
 *
 * - `base` is the last snapshot SWR delivered (`parsedData`), stamped with the
 *   moment its read began.
 * - `ops` is the outbox: every accepted add, edit and delete, in the order it
 *   was made. They are sent strictly one at a time, so an op's sheet position
 *   is always worked out from rows we know, never from a row in motion.
 * - A sent op stays in the list as `done` and keeps being drawn over the base
 *   until a snapshot whose read began after it finished arrives. That handoff
 *   is the whole of reconciliation: nothing is matched by guesswork, and a
 *   revalidation landing at any moment cannot make a row flicker or revert.
 * - Rows keep a stable local `_key` across snapshots and index shifts, so an
 *   open input never remounts under the lifter.
 *
 * Priorities, in order: never write to the wrong row (the server re-checks the
 * row's content before every write), never drop an accepted change without
 * saying so, then keep the lifter moving. Nothing here touches React, the
 * network or the clock, which is what lets scripts/validate-log-sync.mjs run
 * it against a simulated sheet with failures injected.
 */

const QUEUED = "queued";
const SENDING = "sending";
const UNCERTAIN = "uncertain";
const DONE = "done";

const SEPARATOR = "\u001f";
const EMPTY_ROWS = Object.freeze([]);
const EDITABLE_FIELDS = ["reps", "weight", "notes", "url"];

// Reps then weight is one thought. A short quiet period lets that pair, or a
// run of spinner clicks, go out as a single write. The change itself is in the
// outbox from the first keystroke; only the send waits.
export const EDIT_HOLD_MS = 300;
// A rejected write means the sheet differs from what we believe. One fresh
// read and a second try covers a row that moved; a third rejection is a row
// we cannot identify, and the change is handed back to the lifter.
const MAX_CONFLICTS = 2;
// A request that failed in transit may still be finishing on Google's side.
// Only a read that begins this long after the failure may conclude "it never
// arrived" and send the change again.
export const SETTLE_MS = 3000;
const MAX_TRACKED_DATES = 30;

export function createEngineState(ssid = null) {
  return {
    ssid,
    // `columns` is where this sheet keeps each value (see getSheetWriteColumns);
    // every request carries it so the write lands in the lifter's own layout.
    base: { rows: null, readAt: null, columns: null },
    ops: [],
    // Sheet rowIndex -> local key, held only for rows whose position has moved
    // since they were first drawn. Every other row's key is its rowIndex.
    keys: new Map(),
    // The sessions the lifter has had on screen. Their rows keep their keys
    // through every snapshot, whichever session is showing when it lands.
    keyDates: new Set(),
    nextId: 1,
    hold: null,
    events: [],
  };
}

/** A different sheet is a different log; nothing queued for one may reach another. */
export function configureSheet(state, ssid) {
  if (state.ssid === ssid) return state;
  return createEngineState(ssid);
}

/** Note a session as seen, so its rows keep their keys from here on. */
export function trackDate(state, date) {
  if (!date || state.keyDates.has(date)) return state;
  const keyDates = new Set(state.keyDates);
  keyDates.add(date);
  // Oldest first out. A tab never shows this many sessions with changes in
  // play, and a dropped session only has its rows re-keyed while off screen.
  while (keyDates.size > MAX_TRACKED_DATES) {
    keyDates.delete(keyDates.values().next().value);
  }
  return { ...state, keyDates };
}

// --- Reading the state -----------------------------------------------------

/**
 * The session as the lifter should see it: the snapshot with every queued,
 * in-flight and not-yet-reflected change drawn over it.
 *
 * @returns {Object<string, object[]>} lift type -> rows, in sheet order.
 */
export function projectSession(state, date) {
  const entries = fold(state, state.ops, { date, includeUnconfirmed: true });
  const lifts = {};
  for (const entry of entries) {
    const row = toViewRow(entry);
    if (!lifts[row.liftType]) lifts[row.liftType] = [];
    lifts[row.liftType].push(row);
  }
  return lifts;
}

/** The op the pump should send next, or null while one is in flight. */
export function getNextOp(state) {
  for (const op of state.ops) {
    if (op.status === DONE) continue;
    return op.status === QUEUED ? op : null;
  }
  return null;
}

export function getSyncSummary(state) {
  let pending = 0;
  let confirmed = 0;
  let stalled = false;
  for (const op of state.ops) {
    if (op.status === DONE) {
      confirmed += 1;
      continue;
    }
    pending += 1;
    if (op.attempts > 1 || op.status === UNCERTAIN) stalled = true;
  }
  return {
    pending,
    // Sent, but not yet in a snapshot. One refresh retires them all.
    awaitingSnapshot: confirmed,
    stalled: pending > 0 && stalled,
    deletingSessionDates: state.ops
      .filter((op) => op.kind === "deleteSession" && op.status !== DONE)
      .map((op) => op.date),
  };
}

// --- Accepting changes -------------------------------------------------------

/**
 * Queue a new set. Where it goes in the sheet is decided when it is sent, from
 * the rows that exist by then, so a set added behind three others still lands
 * after them.
 */
export function enqueueInsert(state, { date, liftType, fields }) {
  const id = state.nextId;
  const key = `n${id}`;
  const op = {
    id,
    kind: "insert",
    date,
    key,
    liftType,
    fields: {
      reps: fields.reps,
      weight: fields.weight,
      unitType: fields.unitType,
      notes: fields.notes ?? "",
      url: fields.url ?? "",
    },
    status: QUEUED,
    attempts: 0,
    conflicts: 0,
  };
  return {
    state: { ...state, nextId: id + 1, ops: [...state.ops, op] },
    key,
    opId: id,
  };
}

/**
 * Queue a field change on a row. Changes to one row collapse into the latest
 * unsent write for it, and a change to a set that has not been sent yet simply
 * rewrites that set.
 */
export function enqueueEdit(state, { date, key, patch, now }) {
  const view = fold(state, state.ops, { date, includeUnconfirmed: true });
  const entry = view.find((candidate) => candidate.key === key);
  if (!entry) return state;

  const clean = {};
  for (const field of EDITABLE_FIELDS) {
    if (!(field in patch)) continue;
    if (patch[field] !== readField(entry.row, field)) {
      clean[field] = patch[field];
    }
  }
  if (!Object.keys(clean).length) return state;

  // The newest unsent write for this row takes the change: a waiting edit, or
  // the row's own insert when that has not gone out yet. Anything already in
  // flight is left alone and a new edit follows it.
  const ops = state.ops.slice();
  for (let i = ops.length - 1; i >= 0; i -= 1) {
    const op = ops[i];
    if (op.key !== key || op.date !== date) continue;
    if (op.status !== QUEUED) break;
    if (op.kind === "edit") {
      ops[i] = {
        ...op,
        patch: { ...op.patch, ...clean },
        holdUntil: now + EDIT_HOLD_MS,
      };
      return { ...state, ops };
    }
    if (op.kind === "insert") {
      ops[i] = { ...op, fields: { ...op.fields, ...clean } };
      return { ...state, ops };
    }
    break;
  }

  ops.push({
    id: state.nextId,
    kind: "edit",
    date,
    key,
    patch: clean,
    status: QUEUED,
    attempts: 0,
    conflicts: 0,
    holdUntil: now + EDIT_HOLD_MS,
  });
  return { ...state, nextId: state.nextId + 1, ops };
}

/** Queue a row delete. A set that never reached the sheet is just forgotten. */
export function enqueueDelete(state, { date, key }) {
  const view = fold(state, state.ops, { date, includeUnconfirmed: true });
  if (!view.some((entry) => entry.key === key)) return state;

  const touchesRow = (op) => op.key === key && op.date === date;
  const insert = state.ops.find((op) => op.kind === "insert" && touchesRow(op));
  if (insert && insert.status === QUEUED) {
    return { ...state, ops: state.ops.filter((op) => !touchesRow(op)) };
  }

  // An edit that has not gone out is moot once the row is going.
  const ops = state.ops.filter(
    (op) => !(touchesRow(op) && op.kind === "edit" && op.status === QUEUED),
  );
  ops.push({
    id: state.nextId,
    kind: "delete",
    date,
    key,
    status: QUEUED,
    attempts: 0,
    conflicts: 0,
  });
  return { ...state, nextId: state.nextId + 1, ops };
}

/**
 * Queue the removal of a whole session. Unlike the row ops this one is not
 * drawn until it has happened: the session stays on screen, locked, so a
 * blocked delete leaves the lifter looking at what is still in the sheet.
 */
export function enqueueDeleteSession(state, { date }) {
  // Asked twice, it is still one delete, and both askers hear the outcome.
  const underway = state.ops.find(
    (op) =>
      op.kind === "deleteSession" && op.date === date && op.status !== DONE,
  );
  if (underway) return { state, opId: underway.id };

  const ops = state.ops.filter(
    (op) => !(op.date === date && op.status === QUEUED),
  );
  const id = state.nextId;
  ops.push({
    id,
    kind: "deleteSession",
    date,
    status: QUEUED,
    attempts: 0,
    conflicts: 0,
  });
  return { state: { ...state, nextId: id + 1, ops }, opId: id };
}

/** Send every held edit now: the page is being hidden or left. */
export function releaseEditHolds(state) {
  if (!state.ops.some((op) => op.holdUntil)) return state;
  return {
    ...state,
    ops: state.ops.map((op) => (op.holdUntil ? { ...op, holdUntil: 0 } : op)),
  };
}

// --- Sending -----------------------------------------------------------------

/**
 * Work out the request for an op from the rows known to be in the sheet right
 * now: the snapshot plus every op already confirmed. Called only when nothing
 * else is in flight, which is what makes the row positions trustworthy.
 *
 * @returns {{kind: "request", url, method, body, meta, expect}
 *   | {kind: "noop"} | {kind: "drop", reason: string, silent?: boolean}}
 */
export function planRequest(state, op) {
  const confirmedOps = state.ops.filter((other) => other.status === DONE);
  const session = fold(state, confirmedOps, { date: op.date });
  const before = sessionSignature(session);
  const expectAfter = (meta) =>
    sessionSignature(
      applyOp(cloneEntries(session), confirmOp(op, meta), op.date, false),
    );

  if (op.kind === "insert") {
    const { reps, weight, unitType, notes, url } = op.fields;
    const weightText = `${weight}${unitType ?? ""}`;
    const sameLift = session.filter(
      (entry) => entry.row.liftType === op.liftType,
    );
    let predecessor = null;
    let verifyAgainst = null;
    let dateCell = "";
    let liftCell = "";
    let newSession = false;
    let sheetDate = op.date;
    let sheetLift = op.liftType;

    if (sameLift.length) {
      // A plain set row: blank date and lift cells, inherited from above.
      predecessor = lastBySheetIndex(sameLift);
      sheetDate = sheetText(predecessor).date;
      sheetLift = sheetText(predecessor).liftType;
    } else if (session.length) {
      // First set of a lift in a session that already exists.
      predecessor = lastBySheetIndex(session);
      liftCell = op.liftType;
      sheetDate = sheetText(predecessor).date;
    } else {
      // A new session. The sheet runs newest first, so it goes below the last
      // row of every newer date, or at the top when there is none.
      const everything = fold(state, confirmedOps, { date: null });
      let top = null;
      for (const entry of everything) {
        if (
          entry.row.date > op.date &&
          (!predecessor || entry.sheetIndex > predecessor.sheetIndex)
        ) {
          predecessor = entry;
        }
        if (!top || entry.sheetIndex < top.sheetIndex) top = entry;
      }
      verifyAgainst = predecessor ?? top;
      dateCell = op.date;
      liftCell = op.liftType;
      newSession = true;
    }

    const insertAfterRowIndex = predecessor ? predecessor.sheetIndex : null;
    const meta = {
      rowIndex: (insertAfterRowIndex ?? 1) + 1,
      sheet: {
        date: sheetDate,
        liftType: sheetLift,
        reps: String(reps),
        weight: weightText,
        notes,
        url,
      },
    };
    const anchor = verifyAgainst ?? predecessor;
    return {
      kind: "request",
      url: "/api/sheet/insert-row",
      method: "POST",
      body: {
        ...columnsOf(state),
        rows: [[dateCell, liftCell, String(reps), weightText, notes, url]],
        insertAfterRowIndex,
        newSession,
        before: anchor ? sheetText(anchor) : null,
        // A resend follows a request whose fate was unknown. The server then
        // checks whether this exact row is already sitting in its slot.
        retry: op.attempts > 0,
      },
      meta,
      expect: { before, after: expectAfter(meta) },
    };
  }

  if (op.kind === "edit") {
    const entry = session.find((candidate) => candidate.key === op.key);
    if (!entry) return { kind: "drop", reason: "missing", silent: true };
    const current = sheetText(entry);
    const next = { ...current };
    if ("reps" in op.patch) next.reps = String(op.patch.reps);
    if ("weight" in op.patch) {
      next.weight = `${op.patch.weight}${entry.row.unitType ?? ""}`;
    }
    if ("notes" in op.patch) next.notes = op.patch.notes ?? "";
    if ("url" in op.patch) next.url = op.patch.url ?? "";
    if (EDITABLE_FIELDS.every((field) => next[field] === current[field])) {
      return { kind: "noop" };
    }
    const meta = { rowIndex: entry.sheetIndex, sheet: next };
    return {
      kind: "request",
      url: "/api/sheet/edit-row",
      method: "POST",
      body: {
        ...columnsOf(state),
        rowIndex: entry.sheetIndex,
        before: current,
        after: next,
      },
      meta,
      expect: { before, after: expectAfter(meta) },
    };
  }

  if (op.kind === "delete") {
    const entry = session.find((candidate) => candidate.key === op.key);
    // Its insert failed, or it is already gone: nothing left to remove.
    if (!entry) return { kind: "drop", reason: "missing", silent: true };
    const meta = { rowIndex: entry.sheetIndex };
    return {
      kind: "request",
      url: "/api/sheet/delete-row",
      method: "POST",
      body: {
        ...columnsOf(state),
        rowIndex: entry.sheetIndex,
        before: sheetText(entry),
      },
      meta,
      expect: { before, after: expectAfter(meta) },
    };
  }

  if (op.kind === "deleteSession") {
    if (!session.length) return { kind: "noop" };
    const first = session.reduce((a, b) =>
      b.sheetIndex < a.sheetIndex ? b : a,
    );
    const last = lastBySheetIndex(session);
    // The session owns everything down to the next session's first row, so
    // blank and note-only rows under its date go with it.
    let nextSessionStart = null;
    for (const entry of fold(state, confirmedOps, { date: null })) {
      if (entry.row.date === op.date) continue;
      if (entry.sheetIndex <= last.sheetIndex) continue;
      if (nextSessionStart === null || entry.sheetIndex < nextSessionStart) {
        nextSessionStart = entry.sheetIndex;
      }
    }
    const end = nextSessionStart ? nextSessionStart - 1 : last.sheetIndex;
    const meta = { start: first.sheetIndex, end };
    return {
      kind: "request",
      url: "/api/sheet/delete-session",
      method: "POST",
      body: {
        ...columnsOf(state),
        startRowIndex: first.sheetIndex,
        endRowIndex: end,
        lastDataRowIndex: last.sheetIndex,
        expectedDate: sheetText(first).date,
        firstBefore: sheetText(first),
        lastBefore: sheetText(last),
      },
      meta,
      expect: { before, after: "" },
    };
  }

  return { kind: "drop", reason: "unknown" };
}

export function markSending(state, opId, plan) {
  return updateOp(state, opId, (op) => ({
    ...op,
    status: SENDING,
    attempts: op.attempts + 1,
    sent: plan.meta,
    expect: plan.expect,
  }));
}

/**
 * Record what came back from a send.
 *
 * - ok: confirmed. The op stays, drawn over the base, until a newer snapshot.
 * - noop: there was nothing to write.
 * - conflict: the server found a different row than we described. Nothing was
 *   written. Read the sheet again before trying once more.
 * - ambiguous: the request may or may not have landed (network drop, timeout,
 *   5xx). Never resend blind; a fresh snapshot settles it.
 * - retry: refused before any write (auth, rate limit). Wait and resend.
 * - fatal: the request itself is wrong. Give the change back.
 */
export function applyOutcome(state, opId, result, now) {
  const op = state.ops.find((candidate) => candidate.id === opId);
  if (!op) return state;

  if (result.kind === "ok") {
    const confirmed = confirmOp(op, {
      ...op.sent,
      rowIndex: Number.isInteger(result.rowIndex)
        ? result.rowIndex
        : op.sent?.rowIndex,
    });
    return settle(
      updateOp(state, opId, () => ({ ...confirmed, doneAt: result.at ?? now })),
      op,
      true,
    );
  }

  if (result.kind === "noop") {
    return settle(
      removeOps(state, (other) => other.id === opId),
      op,
      true,
    );
  }

  if (result.kind === "conflict") {
    const conflicts = op.conflicts + 1;
    const hold = {
      kind: "snapshot",
      since: now,
      after: now,
      reason: "conflict",
    };
    if (conflicts > MAX_CONFLICTS) {
      return { ...failOp(state, op, "conflict"), hold };
    }
    return {
      ...updateOp(state, opId, (current) => ({
        ...current,
        status: QUEUED,
        conflicts,
        holdUntil: 0,
      })),
      hold,
    };
  }

  if (result.kind === "ambiguous") {
    return {
      ...updateOp(state, opId, (current) => ({
        ...current,
        status: UNCERTAIN,
      })),
      hold: {
        kind: "snapshot",
        since: now,
        after: now + SETTLE_MS,
        reason: "uncertain",
      },
    };
  }

  if (result.kind === "retry") {
    return {
      ...updateOp(state, opId, (current) => ({
        ...current,
        status: QUEUED,
        holdUntil: 0,
      })),
      hold: { kind: "backoff", until: now + getBackoffMs(op.attempts) },
    };
  }

  return failOp(state, op, "rejected");
}

/** Give up on an op the planner could not place. */
export function dropOp(state, opId, reason, silent = false) {
  const op = state.ops.find((candidate) => candidate.id === opId);
  if (!op) return state;
  if (silent) {
    return settle(
      removeOps(state, (other) => other.id === opId),
      op,
      false,
    );
  }
  return failOp(state, op, reason);
}

export function releaseBackoff(state, now) {
  if (state.hold?.kind !== "backoff" || state.hold.until > now) return state;
  return { ...state, hold: null };
}

/** Skip the wait: the connection is back, or the lifter asked. */
export function clearBackoff(state) {
  return state.hold?.kind === "backoff" ? { ...state, hold: null } : state;
}

export function takeEvents(state) {
  if (!state.events.length) return { state, events: EMPTY_ROWS };
  return { state: { ...state, events: [] }, events: state.events };
}

// --- Taking a new snapshot -----------------------------------------------------

/**
 * Move the outbox onto a new snapshot.
 *
 * SWR discards any read that overlapped a write (see the store), so a
 * delivered snapshot reflects exactly the ops that finished before its read
 * began. Those retire here; everything else is carried over and drawn on top.
 * Rows keep their keys by position within the session when the content is what
 * we expected, and by content when rows have moved for a reason we did not
 * cause. A pending change whose row can no longer be found is handed back
 * rather than aimed at a neighbour.
 */
export function applySnapshot(state, snapshot, viewDate) {
  const rows = snapshot?.rows ?? null;
  const readAt = snapshot?.readAt ?? null;
  // The same rows with a later stamp are still news: a read that came back
  // identical is how we learn a held change never landed, or that an add and
  // its delete cancelled out.
  if (rows === state.base.rows && readAt === state.base.readAt) return state;
  const events = [];
  let ops = state.ops;
  let hold = state.hold;

  // 1. A held op is settled by a snapshot read after it was held. Seeing the
  // change in the sheet is proof at any point. Not seeing it only counts once
  // the read began after the settle delay (`hold.after`): until then the
  // request may still be on its way, and an early "it is not there" would
  // send the change a second time.
  if (hold?.kind === "snapshot" && readAt !== null && readAt >= hold.since) {
    const conclusive = readAt >= hold.after;
    const head = ops.find((op) => op.status !== DONE);
    let settled = conclusive;
    if (head?.status === UNCERTAIN) {
      const actual = sessionSignature(
        rowsForDate(rows, head.date).map((row) => ({ row })),
      );
      if (actual === head.expect.after) {
        // It landed. Confirm it as of this read so it retires just below.
        ops = ops.map((op) =>
          op.id === head.id
            ? { ...confirmOp(op, op.sent), doneAt: readAt }
            : op,
        );
        events.push({ type: "settled", opId: head.id, ok: true });
        settled = true;
      } else if (!conclusive) {
        settled = false;
      } else if (actual === head.expect.before) {
        ops = ops.map((op) =>
          op.id === head.id ? { ...op, status: QUEUED, holdUntil: 0 } : op,
        );
      } else {
        // Neither the before nor the after we expected, so we cannot tell
        // whether it landed. Resending could double it; the sheet wins.
        const failed = failOp({ ...state, ops, events: [] }, head, "unknown");
        ops = failed.ops;
        events.push(...failed.events);
      }
    }
    if (settled) hold = null;
  }

  // 2. Retire what this snapshot already contains. Sends are serial, so the
  // confirmed ops are a prefix of the list.
  const retired = [];
  const kept = [];
  for (const op of ops) {
    if (op.status === DONE && (readAt === null || op.doneAt <= readAt)) {
      retired.push(op);
    } else {
      kept.push(op);
    }
  }

  // 3. Carry row keys across for the sessions that matter: the one on screen
  // and any with changes in play.
  const keys = new Map();
  const lostKeys = new Set();
  const dates = new Set([...state.keyDates, ...ops.map((op) => op.date)]);
  if (viewDate) dates.add(viewDate);
  for (const date of dates) {
    const expected = fold(state, retired, { date });
    const fresh = rowsForDate(rows, date);
    const matches = matchRows(expected, fresh);
    for (const entry of expected) {
      const row = matches.get(entry);
      if (!row) {
        lostKeys.add(`${date}${SEPARATOR}${entry.key}`);
      } else if (
        row.rowIndex != null &&
        entry.key !== defaultKey(row.rowIndex)
      ) {
        keys.set(row.rowIndex, entry.key);
      }
    }
  }

  // 4. A pending edit aimed at a row that is no longer there goes back. A
  // pending delete of such a row has nothing left to do, and the planner
  // drops it quietly.
  let next = {
    ...state,
    base: { rows, readAt, columns: snapshot?.columns ?? null },
    keys,
    keyDates: dates,
    ops: kept,
    hold,
  };
  next.events = [];
  for (const op of kept) {
    if (op.status === DONE) continue;
    if (op.kind !== "edit") continue;
    if (!lostKeys.has(`${op.date}${SEPARATOR}${op.key}`)) continue;
    if (!next.ops.some((other) => other.id === op.id)) continue;
    next = failOp(next, op, "row-changed");
  }
  return { ...next, events: [...state.events, ...events, ...next.events] };
}

// --- Internals -----------------------------------------------------------------

/**
 * Replay ops over the base rows. With `date`, returns that session's rows in
 * sheet order; with `date: null`, every row. Each entry carries `sheetIndex`,
 * the row's position in the sheet as of the confirmed ops replayed.
 */
function fold(state, ops, { date = null, includeUnconfirmed = false }) {
  const source = date
    ? rowsForDate(state.base.rows, date)
    : (state.base.rows ?? EMPTY_ROWS);
  let entries = source.map((row, position) => ({
    key:
      row.rowIndex != null
        ? (state.keys.get(row.rowIndex) ?? defaultKey(row.rowIndex))
        : // Demo and imported rows never came from a sheet row.
          `p${position}`,
    sheetIndex: row.rowIndex ?? null,
    baseIndex: row.rowIndex ?? null,
    row,
    sheet: null,
    pending: false,
    saving: false,
  }));
  for (const op of ops) {
    if (op.status !== DONE && !includeUnconfirmed) continue;
    entries = applyOp(entries, op, date, includeUnconfirmed);
  }
  return entries;
}

function applyOp(entries, op, date, drawPending) {
  const confirmed = op.status === DONE;
  const inScope = date === null || op.date === date;
  const isTarget = (entry) =>
    entry.key === op.key && entry.row.date === op.date;

  if (op.kind === "insert") {
    if (confirmed) {
      for (const entry of entries) {
        if (entry.sheetIndex !== null && entry.sheetIndex >= op.rowIndex) {
          entry.sheetIndex += 1;
        }
      }
    }
    if (!inScope) return entries;
    const entry = {
      key: op.key,
      sheetIndex: confirmed ? op.rowIndex : null,
      baseIndex: null,
      row: {
        date: op.date,
        liftType: op.liftType,
        reps: op.fields.reps,
        weight: op.fields.weight,
        unitType: op.fields.unitType,
        notes: op.fields.notes,
        URL: op.fields.url,
        rowIndex: null,
        isHistoricalPR: false,
      },
      sheet: confirmed ? op.sheet : null,
      pending: !confirmed,
      saving: false,
    };
    if (entry.sheetIndex === null) {
      entries.push(entry);
      return entries;
    }
    const at = entries.findIndex(
      (other) =>
        other.sheetIndex === null || other.sheetIndex > entry.sheetIndex,
    );
    if (at === -1) entries.push(entry);
    else entries.splice(at, 0, entry);
    return entries;
  }

  if (op.kind === "edit") {
    if (!inScope) return entries;
    const entry = entries.find(isTarget);
    if (!entry) return entries;
    entry.row = { ...entry.row };
    if ("reps" in op.patch) entry.row.reps = op.patch.reps;
    if ("weight" in op.patch) entry.row.weight = op.patch.weight;
    if ("notes" in op.patch) entry.row.notes = op.patch.notes;
    if ("url" in op.patch) entry.row.URL = op.patch.url;
    if (confirmed) entry.sheet = op.sheet;
    else entry.saving = true;
    return entries;
  }

  if (op.kind === "delete") {
    const remaining = inScope
      ? entries.filter((entry) => !isTarget(entry))
      : entries;
    if (confirmed) {
      for (const entry of remaining) {
        if (entry.sheetIndex !== null && entry.sheetIndex > op.rowIndex) {
          entry.sheetIndex -= 1;
        }
      }
    }
    return remaining;
  }

  if (op.kind === "deleteSession") {
    // Drawn only once it has happened; see enqueueDeleteSession.
    if (!confirmed && drawPending) return entries;
    const remaining = inScope
      ? entries.filter((entry) => entry.row.date !== op.date)
      : entries;
    if (confirmed) {
      const removed = op.end - op.start + 1;
      for (const entry of remaining) {
        if (entry.sheetIndex !== null && entry.sheetIndex > op.end) {
          entry.sheetIndex -= removed;
        }
      }
    }
    return remaining;
  }

  return entries;
}

// The sheet's column map, when the page supplied one. A request without it is
// placed by the header names the server finds.
function columnsOf(state) {
  return state.base.columns ? { columns: state.base.columns } : {};
}

function confirmOp(op, meta = {}) {
  return {
    ...op,
    status: DONE,
    rowIndex: meta.rowIndex,
    sheet: meta.sheet,
    start: meta.start,
    end: meta.end,
  };
}

function cloneEntries(entries) {
  return entries.map((entry) => ({ ...entry }));
}

function toViewRow(entry) {
  const row = { ...entry.row, _key: entry.key };
  if (entry.pending) row._pending = true;
  if (entry.saving) row._saving = true;
  return row;
}

function readField(row, field) {
  if (field === "url") return row.URL ?? "";
  if (field === "notes") return row.notes ?? "";
  return row[field];
}

/**
 * The row as the sheet holds it, cell text for cell text, which is what the
 * server compares before it writes. Raw values are kept wherever the parser
 * normalised one ("OHP", "225", "3/8/2026"), so an untouched cell still
 * matches.
 */
function sheetText(entry) {
  if (entry.sheet) return entry.sheet;
  const row = entry.row;
  return {
    date: row.rawDate ?? row.date ?? "",
    liftType: row.rawLiftType ?? row.liftType ?? "",
    reps:
      row.rawReps != null
        ? String(row.rawReps)
        : row.reps != null
          ? String(row.reps)
          : "",
    weight:
      row.rawWeight != null
        ? String(row.rawWeight)
        : row.weight != null
          ? `${row.weight}${row.unitType ?? ""}`
          : "",
    notes: row.notes ?? "",
    url: row.URL ?? "",
  };
}

function lastBySheetIndex(entries) {
  return entries.reduce((a, b) => (b.sheetIndex > a.sheetIndex ? b : a));
}

function defaultKey(rowIndex) {
  return `r${rowIndex}`;
}

/** What a row is, as the parser reads it back: the unit of "same set". */
function rowSignature(row) {
  return [
    row.liftType ?? "",
    Number(row.reps),
    Number(row.weight),
    row.unitType ?? "",
    String(row.notes ?? "").trim(),
    String(row.URL ?? "").trim(),
  ].join(SEPARATOR);
}

function sessionSignature(entries) {
  return entries.map((entry) => rowSignature(entry.row)).join("\n");
}

/**
 * Pair the rows we expected with the rows a snapshot holds.
 *
 * Position first, because identical sets are common (three sets of five at
 * one weight, logged in the same minute) and only position tells them apart.
 * Content second, in order, for rows that moved for a reason we did not cause.
 * Whatever is left and still shares a position is the same row with content
 * the sheet reformatted.
 */
function matchRows(expected, fresh) {
  const matches = new Map();
  if (!expected.length || !fresh.length) return matches;
  const expectedSigs = expected.map((entry) => rowSignature(entry.row));
  const freshSigs = fresh.map(rowSignature);

  if (
    expected.length === fresh.length &&
    expectedSigs.every((sig, i) => sig === freshSigs[i])
  ) {
    expected.forEach((entry, i) => matches.set(entry, fresh[i]));
    return matches;
  }

  const taken = new Set();
  const byIndex = new Map(fresh.map((row, i) => [row.rowIndex, i]));
  expected.forEach((entry, i) => {
    const at = byIndex.get(entry.sheetIndex);
    if (at === undefined || freshSigs[at] !== expectedSigs[i]) return;
    matches.set(entry, fresh[at]);
    taken.add(at);
  });

  let cursor = 0;
  expected.forEach((entry, i) => {
    if (matches.has(entry)) return;
    for (let at = cursor; at < fresh.length; at += 1) {
      if (taken.has(at) || freshSigs[at] !== expectedSigs[i]) continue;
      matches.set(entry, fresh[at]);
      taken.add(at);
      cursor = at + 1;
      return;
    }
  });

  expected.forEach((entry) => {
    if (matches.has(entry)) return;
    const at = byIndex.get(entry.sheetIndex);
    if (at === undefined || taken.has(at)) return;
    matches.set(entry, fresh[at]);
    taken.add(at);
  });
  return matches;
}

const dateIndexCache = new WeakMap();

function rowsForDate(rows, date) {
  if (!Array.isArray(rows)) return EMPTY_ROWS;
  let index = dateIndexCache.get(rows);
  if (!index) {
    index = new Map();
    for (const row of rows) {
      const list = index.get(row.date);
      if (list) list.push(row);
      else index.set(row.date, [row]);
    }
    dateIndexCache.set(rows, index);
  }
  return index.get(date) ?? EMPTY_ROWS;
}

function updateOp(state, opId, update) {
  return {
    ...state,
    ops: state.ops.map((op) => (op.id === opId ? update(op) : op)),
  };
}

function removeOps(state, shouldRemove) {
  return { ...state, ops: state.ops.filter((op) => !shouldRemove(op)) };
}

function settle(state, op, ok) {
  return {
    ...state,
    events: [...state.events, { type: "settled", opId: op.id, ok }],
  };
}

/**
 * Hand a change back: remove it, and with a set that never landed, every later
 * change to that set.
 */
function failOp(state, op, reason) {
  const dependents =
    op.kind === "insert"
      ? (other) =>
          other.id !== op.id && other.key === op.key && other.date === op.date
      : () => false;
  const removed = state.ops.filter(
    (other) => other.id === op.id || dependents(other),
  );
  return {
    ...state,
    ops: state.ops.filter((other) => !removed.includes(other)),
    events: [
      ...state.events,
      ...removed.map((other) => ({
        type: "settled",
        opId: other.id,
        ok: false,
      })),
      {
        type: "failed",
        reason,
        op: { kind: op.kind, date: op.date, liftType: op.liftType ?? null },
      },
    ],
  };
}

function getBackoffMs(attempts) {
  return Math.min(30000, 1000 * 2 ** Math.max(0, attempts - 1));
}
