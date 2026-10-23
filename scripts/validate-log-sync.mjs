/**
 * Log sync checks: the real sync engine and store, driven against a simulated
 * Google Sheet on a virtual clock.
 *
 * The repository has no test runner, so like the other validate scripts this
 * one runs under plain Node while keeping the application's `@/` imports.
 * Everything below the store is faked: the sheet (with the write routes'
 * verify-then-write rules), the network (latency, lost requests, lost
 * responses, late arrivals, rate limits) and SWR (which read wins, and which
 * reads are thrown away for overlapping a write).
 *
 * The property being defended, checked after every event of every run: what
 * the lifter sees is exactly what they asked for, and once the queue drains
 * the sheet holds exactly that too. Each row keeps one key for its whole life.
 *
 * The same holds across a tab that dies mid-session: a successor page, opened
 * on the copy saved on the phone and handed what the dead tab saved, ends with
 * the sheet holding exactly what the lifter asked for, with nothing doubled,
 * even when the dead tab's last request was still landing.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const sourceRoot = path.join(repositoryRoot, "src");

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) {
      return nextResolve(specifier, context);
    }
    const target = path.join(sourceRoot, specifier.slice(2));
    return {
      shortCircuit: true,
      url: pathToFileURL(path.extname(target) ? target : `${target}.js`).href,
    };
  },
  load(url, context, nextLoad) {
    if (
      url.startsWith(pathToFileURL(sourceRoot).href) &&
      url.endsWith(".json")
    ) {
      return {
        shortCircuit: true,
        format: "module",
        source: `export default ${readFileSync(fileURLToPath(url), "utf8")};`,
      };
    }
    const loaded = nextLoad(url, context);
    if (url.startsWith(pathToFileURL(sourceRoot).href) && url.endsWith(".js")) {
      return { ...loaded, format: "module" };
    }
    return loaded;
  },
});

const { projectSession, getSyncSummary } =
  await import("../src/lib/sheet/log-sync-engine.js");
const { createLogSyncStore, sendSheetRequest } =
  await import("../src/lib/sheet/log-sync-store.js");
const {
  diffEditableSnapshot,
  getChangedEditableFields,
  isInsertedRowPresent,
  placeRowValues,
  planAnchorPromotion,
  resolveWriteColumns,
  toLogicalRows,
  toRawRow,
} = await import("../src/lib/sheet/sheet-row-ops.js");
const { parseStrengthJourneysData, getSheetLayout, getSheetWriteColumns } =
  await import("../src/lib/import/parsers/strength-journeys-parser.js");

// The parser reports its repairs on the console; keep the run quiet.
console.info = () => {};

// LOG_SYNC_TRACE=1 LOG_SYNC_SEED=7 prints every action and request of one run.
const TRACE = process.env.LOG_SYNC_TRACE === "1";
const trace = (...parts) => {
  if (TRACE) console.log(...parts);
};

const HEADER = ["Date", "Lift Type", "Reps", "Weight", "Notes", "URL"];

// --- Virtual time --------------------------------------------------------------

const drainMicrotasks = () => new Promise((resolve) => setImmediate(resolve));

function createClock() {
  let now = 0;
  let sequence = 0;
  const timers = [];
  const clock = {
    now: () => now,
    setTimer(fn, ms) {
      const timer = { at: now + Math.max(0, ms), order: sequence++, fn };
      timers.push(timer);
      return timer;
    },
    clearTimer(timer) {
      const at = timers.indexOf(timer);
      if (at !== -1) timers.splice(at, 1);
    },
    sleep: (ms) => new Promise((resolve) => clock.setTimer(resolve, ms)),
    /** Run timers in order until none remain or the deadline passes. */
    async run({ until = Infinity, afterEach } = {}) {
      for (;;) {
        await drainMicrotasks();
        if (!timers.length) return;
        timers.sort((a, b) => a.at - b.at || a.order - b.order);
        const next = timers[0];
        if (next.at > until) {
          now = until;
          return;
        }
        timers.shift();
        now = Math.max(now, next.at);
        next.fn();
        await drainMicrotasks();
        afterEach?.();
      }
    },
  };
  return clock;
}

function createRandom(seed) {
  let state = seed >>> 0 || 1;
  const next = () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x100000000;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (list) => list[Math.floor(next() * list.length)],
    chance: (probability) => next() < probability,
  };
}

// --- The simulated sheet, with the write routes' rules ---------------------------

// Fixtures give each row as six logical values (date, lift, reps, weight,
// notes, url). The sheet lays them out under whatever header it was built
// with, so the same scenarios run on a lifter's own column order.
class FakeSheet {
  constructor(rows, header = HEADER) {
    this.values = [header.slice()];
    this.values.push(...rows.map((row) => this.physical(row)));
    this.requests = [];
  }

  /** The column map as the header row states it. */
  get columns() {
    return resolveWriteColumns(null, this.values[0]).columns;
  }

  /** Six logical values as one full-width physical row. */
  physical(row, columns = this.columns) {
    const placed = placeRowValues(row, columns);
    return this.values[0].map((_, column) => String(placed[column] ?? ""));
  }

  snapshot() {
    return this.values.map((row) => row.slice());
  }

  cells(rowIndex) {
    return this.values[rowIndex - 1] ?? null;
  }

  rawRow(rowIndex, columns) {
    const cells = this.cells(rowIndex);
    if (!cells || cells.every((cell) => cell === "")) return null;
    return toRawRow(cells, columns, rowIndex);
  }

  logicalRow(rowIndex, columns) {
    return toLogicalRows(this.values.slice(1, rowIndex), columns, 2)[
      rowIndex - 2
    ];
  }

  verify(rowIndex, before, columns) {
    const actual = this.logicalRow(rowIndex, columns);
    return { ok: !diffEditableSnapshot(actual, before).length, actual };
  }

  handle({ url, body }) {
    this.requests.push({ url, body });
    const ok = (data) => ({ status: 200, data });
    const conflict = (verification) => ({
      status: 409,
      data: { code: "PRECONDITION_FAILED", actual: verification?.actual },
    });
    const bad = { status: 400, data: { error: "Bad request" } };

    // Every route checks the write's column map against row 1 first.
    const layout = resolveWriteColumns(body.columns ?? null, this.values[0]);
    if (!layout.ok) return conflict(null);
    const { columns } = layout;

    if (url === "/api/sheet/insert-row") {
      const { rows, insertAfterRowIndex, before, retry } = body;
      const insertAfter =
        typeof insertAfterRowIndex === "number" ? insertAfterRowIndex : 1;
      if (
        retry === true &&
        rows.length === 1 &&
        isInsertedRowPresent(
          this.rawRow(insertAfter + 1, columns),
          rows[0],
          columns,
        )
      ) {
        return ok({ firstRowIndex: insertAfter + 1, alreadyApplied: true });
      }
      let verification = { ok: true };
      if (insertAfter === 1) {
        if (this.rawRow(2, columns)) {
          if (!before) return bad;
          verification = this.verify(2, before, columns);
        }
      } else {
        if (!before) return bad;
        verification = this.verify(insertAfter, before, columns);
      }
      if (!verification.ok) return conflict(verification);
      this.values.splice(
        insertAfter,
        0,
        ...rows.map((row) => this.physical(row, columns)),
      );
      return ok({ firstRowIndex: insertAfter + 1 });
    }

    if (url === "/api/sheet/edit-row") {
      const { rowIndex, before, after } = body;
      const changed = getChangedEditableFields(before, after);
      if (!changed.length) return ok({ updated: false });
      const verification = this.verify(rowIndex, before, columns);
      if (!verification.ok) {
        if (!diffEditableSnapshot(verification.actual, after).length) {
          return ok({ alreadyApplied: true });
        }
        return conflict(verification);
      }
      for (const field of changed) {
        if (columns[field] === null) continue;
        this.cells(rowIndex)[columns[field]] = String(after[field] ?? "");
      }
      return ok({ updated: true });
    }

    if (url === "/api/sheet/delete-row") {
      const { rowIndex, before } = body;
      const verification = this.verify(rowIndex, before, columns);
      if (!verification.ok) return conflict(verification);
      const promotion = planAnchorPromotion(
        verification.actual,
        this.values.slice(rowIndex),
        columns,
      );
      if (promotion) {
        // The route copies the deleted row's own cells onto the heir.
        const heir = this.cells(rowIndex + 1 + promotion.offset);
        const source = this.cells(rowIndex);
        if (promotion.date !== null) heir[columns.date] = source[columns.date];
        if (promotion.liftType !== null) {
          heir[columns.liftType] = source[columns.liftType];
        }
      }
      this.values.splice(rowIndex - 1, 1);
      return ok({ deleted: true });
    }

    if (url === "/api/sheet/delete-session") {
      const {
        startRowIndex,
        endRowIndex,
        lastDataRowIndex,
        expectedDate,
        firstBefore,
        lastBefore,
      } = body;
      if (startRowIndex < 2) return bad;
      const first = this.logicalRow(startRowIndex, columns);
      const last = this.logicalRow(lastDataRowIndex, columns);
      const explicitDates = [];
      for (let i = startRowIndex; i <= endRowIndex; i += 1) {
        const rawDate = this.cells(i)?.[columns.date];
        if (rawDate) explicitDates.push(rawDate);
      }
      const next = this.cells(endRowIndex + 1)
        ? this.logicalRow(endRowIndex + 1, columns)
        : null;
      if (
        first.rawDate !== expectedDate ||
        diffEditableSnapshot(first, firstBefore).length ||
        diffEditableSnapshot(last, lastBefore).length ||
        explicitDates.some((date) => date !== expectedDate) ||
        (next && (!next.rawDate || next.rawDate === expectedDate))
      ) {
        return conflict({ actual: { first, last } });
      }
      this.values.splice(startRowIndex - 1, endRowIndex - startRowIndex + 1);
      return ok({ deleted: true });
    }

    return bad;
  }
}

// --- A world: sheet + network + SWR + the real store -----------------------------

function createWorld({
  rows,
  header = HEADER,
  seed = 1,
  faults = {},
  // A successor page shares the dead tab's sheet and clock.
  clock = createClock(),
  random = createRandom(seed),
  sheet = new FakeSheet(rows, header),
  inherited = null,
}) {
  const failures = [];
  const scripted = [];
  const world = {
    clock,
    random,
    sheet,
    failures,
    viewDate: null,
    attached: true,
    offline: false,
    dead: false,
    // What this page last saved on the phone (io.persist).
    saved: [],
    /** Force the next sends to behave a given way, in order. */
    script: (...modes) => scripted.push(...modes),
  };

  const latency = () => random.int(40, 400);
  const nextMode = () => {
    if (scripted.length) return scripted.shift();
    const roll = random.next();
    let edge = 0;
    for (const [mode, probability] of Object.entries(faults.rates ?? {})) {
      edge += probability;
      if (roll < edge) return mode;
    }
    return "ok";
  };

  // What the browser's fetch would do, on the virtual clock.
  async function fakeFetch(url, init) {
    const plan = { url, body: JSON.parse(init.body) };
    const mode = world.offline ? "lost-request" : nextMode();
    trace(clock.now(), "send", mode, url, JSON.stringify(plan.body));
    await clock.sleep(latency());
    if (mode === "lost-request") throw new TypeError("Failed to fetch");
    if (mode === "rate-limit") return respond({ status: 429, data: {} });
    if (mode === "forbidden") return respond({ status: 403, data: {} });
    if (mode === "server-error") return respond({ status: 502, data: {} });
    if (mode === "late") {
      // The request is still on its way when the client gives up on it.
      clock.setTimer(() => sheet.handle(plan), faults.lateBy ?? 600);
      throw new TypeError("Failed to fetch");
    }
    const result = sheet.handle(plan);
    if (mode === "lost-response") throw new TypeError("Failed to fetch");
    await clock.sleep(latency());
    return respond(result);
  }
  const respond = ({ status, data }) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  });

  // SWR's own race rules: the latest read wins, and a read that overlapped a
  // write is thrown away.
  const swr = { cache: null, latest: 0, tick: 0, mutation: null };
  const readLog = [];
  async function revalidate() {
    readLog.push(clock.now());
    const id = ++swr.latest;
    const startTick = ++swr.tick;
    const readAt = clock.now();
    await clock.sleep(latency());
    if (world.offline) return swr.cache;
    const values = sheet.snapshot();
    await clock.sleep(latency());
    if (swr.latest !== id) return swr.cache;
    const mutation = swr.mutation;
    if (
      mutation &&
      (startTick <= mutation.start ||
        startTick <= mutation.end ||
        mutation.end === 0)
    ) {
      return swr.cache;
    }
    // An identical read keeps the object SWR already holds, and so the rows
    // parsed from it; only the stamp moves on.
    const fingerprint = JSON.stringify(values);
    const rows =
      swr.cache && swr.fingerprint === fingerprint
        ? swr.cache.rows
        : parseStrengthJourneysData(values);
    swr.fingerprint = fingerprint;
    // The page works the write columns out from the parse, as log.js does.
    const columns = getSheetWriteColumns(getSheetLayout(rows));
    const data = { rows, readAt, columns };
    swr.cache = data;
    trace(clock.now(), "read delivered, started", readAt);
    // The page hands the snapshot on a moment later, as an effect would.
    clock.setTimer(
      () => {
        if (world.attached && !world.dead && swr.cache === data) {
          store.snapshot(data, world.viewDate);
        }
      },
      random.int(0, 30),
    );
    return data;
  }
  async function runMutation(promise) {
    const mutation = { start: ++swr.tick, end: 0 };
    swr.mutation = mutation;
    try {
      return await promise;
    } finally {
      mutation.end = ++swr.tick;
    }
  }

  const store = createLogSyncStore({
    now: clock.now,
    wallNow: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    isReady: () => !world.dead,
    persist: (ssid, intents) => {
      // A closed page saves nothing more. Round-trip through JSON, as
      // localStorage would.
      if (!world.dead) world.saved = JSON.parse(JSON.stringify(intents));
      return true;
    },
    adopt: async (ssid, take) => {
      if (inherited?.length) take(inherited);
      inherited = null;
    },
    send: (plan) => runMutation(sendSheetRequest(plan, fakeFetch)),
    refresh: async (needRows) => {
      const data = await revalidate();
      if (!data) return null;
      return { readAt: data.readAt, rows: needRows ? data.rows : null };
    },
    onFailure: (event) => {
      trace(clock.now(), "handed back", JSON.stringify(event));
      failures.push(event);
    },
  });
  let detach = store.attach();

  world.store = store;
  world.revalidate = revalidate;
  world.reads = () => readLog.length;
  world.readsAt = (time) => readLog.filter((at) => at <= time).length;
  world.view = (date) => projectSession(store.getState(), date);
  world.setAttached = (attached) => {
    if (attached === world.attached) return;
    world.attached = attached;
    if (attached) {
      detach = store.attach();
      if (swr.cache) store.snapshot(swr.cache, world.viewDate);
    } else {
      detach();
    }
  };
  world.sheetSession = (date) =>
    parseStrengthJourneysData(sheet.snapshot()).filter(
      (row) => row.date === date,
    );
  world.start = async (
    viewDate,
    { savedCopy = null, offline = false } = {},
  ) => {
    world.viewDate = viewDate;
    world.offline = offline;
    store.configure("sheet-1");
    // The copy saved on the phone paints first, before any read.
    if (savedCopy) {
      store.snapshot(
        {
          rows: savedCopy.rows,
          readAt: null,
          columns: savedCopy.columns,
        },
        viewDate,
      );
    }
    void revalidate();
    await clock.run({ until: offline ? clock.now() + 5000 : Infinity });
  };
  world.lastRead = () => swr.cache;
  return world;
}

/**
 * The tab dies: no more saves, sends or snapshots, though a request it had
 * already sent still lands. A new page opens on the same sheet, painted from
 * the copy saved at the dead tab's last read, and takes over what it saved.
 */
function restart(world, options = {}) {
  world.dead = true;
  trace(world.clock.now(), "tab closed, saved", JSON.stringify(world.saved));
  const successor = createWorld({
    clock: world.clock,
    random: world.random,
    sheet: world.sheet,
    inherited: world.saved,
    faults: options.faults ?? {},
  });
  // The phone keeps the copy from the last page that managed a read.
  successor.savedCopy = world.lastRead() ?? world.savedCopy ?? null;
  return successor;
}

// --- The lifter, and what they expect to see -------------------------------------

const describeRow = (row) =>
  [
    row.liftType,
    Number(row.reps),
    Number(row.weight),
    row.unitType ?? "",
    String(row.notes ?? "").trim(),
    String(row.URL ?? "").trim(),
  ].join("|");

function createLifter(world) {
  // date -> ordered list of { key, liftType, reps, weight, unitType, notes, URL }
  const expected = new Map();
  const seed = (date) => {
    if (expected.has(date)) return;
    world.store.view(date);
    expected.set(
      date,
      Object.values(world.view(date))
        .flat()
        .map((row) => ({ ...row, key: row._key })),
    );
  };
  const rowsOf = (date) => {
    seed(date);
    return expected.get(date);
  };
  const timestamp = () => {
    const minutes = Math.floor(world.clock.now() / 60000);
    const hh = String(14 + Math.floor(minutes / 60)).padStart(2, "0");
    return `${hh}:${String(minutes % 60).padStart(2, "0")} `;
  };

  return {
    expected,
    seed,
    add(date, liftType, fields = {}) {
      const rows = rowsOf(date);
      const full = {
        reps: fields.reps ?? 5,
        weight: fields.weight ?? 100,
        unitType: fields.unitType ?? "kg",
        notes: fields.notes ?? timestamp(),
        url: fields.url ?? "",
      };
      const key = world.store.addSet({ date, liftType, fields: full });
      trace(
        world.clock.now(),
        "add",
        date,
        liftType,
        key,
        JSON.stringify(full),
      );
      rows.push({
        key,
        date,
        liftType,
        reps: full.reps,
        weight: full.weight,
        unitType: full.unitType,
        notes: full.notes,
        URL: full.url,
      });
      return key;
    },
    edit(date, key, patch) {
      const row = rowsOf(date).find((candidate) => candidate.key === key);
      if (!row) return;
      trace(world.clock.now(), "edit", date, key, JSON.stringify(patch));
      world.store.editSet({ date, key, patch });
      if ("reps" in patch) row.reps = patch.reps;
      if ("weight" in patch) row.weight = patch.weight;
      if ("notes" in patch) row.notes = patch.notes;
      if ("url" in patch) row.URL = patch.url;
    },
    remove(date, key) {
      const rows = rowsOf(date);
      const at = rows.findIndex((candidate) => candidate.key === key);
      if (at === -1) return;
      trace(world.clock.now(), "delete", date, key);
      world.store.deleteSet({ date, key });
      rows.splice(at, 1);
    },
    /** What is on screen is what was asked for, row for row and key for key. */
    checkView(label) {
      for (const [date, rows] of expected) {
        const view = world.view(date);
        const seen = Object.values(view).flat();
        const keys = seen.map((row) => row._key);
        assert.equal(
          new Set(keys).size,
          keys.length,
          `${label}: duplicate row keys on ${date}`,
        );
        const lifts = [...new Set(rows.map((row) => row.liftType))];
        assert.deepEqual(
          Object.keys(view).sort(),
          lifts.slice().sort(),
          `${label}: lift blocks on ${date}`,
        );
        for (const liftType of lifts) {
          assert.deepEqual(
            view[liftType].map((row) => `${row._key} ${describeRow(row)}`),
            rows
              .filter((row) => row.liftType === liftType)
              .map((row) => `${row.key} ${describeRow(row)}`),
            `${label}: ${liftType} on ${date}`,
          );
        }
      }
    },
    /**
     * A new page gives rows new keys. Take them from its view, checking that
     * it shows the same rows in the same order.
     */
    rekey(nextWorld, label) {
      world = nextWorld;
      for (const [date, rows] of expected) {
        nextWorld.store.view(date);
        const view = nextWorld.view(date);
        for (const liftType of new Set(rows.map((row) => row.liftType))) {
          const want = rows.filter((row) => row.liftType === liftType);
          const seen = view[liftType] ?? [];
          assert.deepEqual(
            seen.map(describeRow),
            want.map(describeRow),
            `${label}: ${liftType} on ${date} after reopening`,
          );
          want.forEach((row, i) => {
            row.key = seen[i]._key;
          });
        }
        assert.deepEqual(
          Object.keys(view).sort(),
          [...new Set(rows.map((row) => row.liftType))].sort(),
          `${label}: lift blocks on ${date} after reopening`,
        );
      }
    },
    /** The sheet holds what is on screen. */
    checkSheet(label) {
      for (const [date] of expected) {
        const view = world.view(date);
        const inSheet = world.sheetSession(date);
        for (const liftType of new Set([
          ...Object.keys(view),
          ...inSheet.map((row) => row.liftType),
        ])) {
          assert.deepEqual(
            inSheet.filter((row) => row.liftType === liftType).map(describeRow),
            (view[liftType] ?? []).map(describeRow),
            `${label}: sheet vs screen for ${liftType} on ${date}`,
          );
        }
      }
    },
  };
}

/** Let everything finish, then read the sheet once more, as a refocus would. */
async function settle(world, lifter, label) {
  const afterEach = lifter ? () => lifter.checkView(label) : undefined;
  await world.clock.run({ afterEach });
  void world.revalidate();
  await world.clock.run({ afterEach });
  const summary = getSyncSummary(world.store.getState());
  assert.equal(summary.pending, 0, `${label}: changes still waiting`);
  assert.equal(
    summary.awaitingSnapshot,
    0,
    `${label}: confirmed changes never became the snapshot`,
  );
}

// --- Fixtures ----------------------------------------------------------------------

// Synthetic rows in the sheet's sparse shape: newest session first, identical
// sets, a unitless weight, a lift label that is a synonym, a repeated date
// cell, a blank row and a note-only row.
const TODAY = "2026-03-10";
const YESTERDAY = "2026-03-08";
const baseRows = () => [
  [TODAY, "Back Squat", "5", "60kg", "14:01 ", ""],
  ["", "", "5", "100kg", "14:05 ", ""],
  ["", "", "5", "100kg", "14:05 ", ""],
  ["", "", "5", "100kg", "14:05 ", ""],
  ["", "Bench Press", "5", "60kg", "14:20 ", ""],
  ["", "", "3", "80kg", "14:24 felt good", "https://youtu.be/abc"],
  ["", "", "", "", "", ""],
  [YESTERDAY, "OHP", "5", "40", "", ""],
  [YESTERDAY, "", "5", "45kg", "", ""],
  ["", "", "", "", "session note only", ""],
  ["", "Deadlift", "1", "180kg", "09:15 ", ""],
  ["2026-03-01", "Back Squat", "5", "95kg", "", ""],
];

// A layout of the lifter's own: columns in another order, with one of theirs
// (RPE) in among ours.
const OWN_ORDER = [
  "Lift Type",
  "Notes",
  "Date",
  "RPE",
  "Weight",
  "Reps",
  "URL",
];

const keyAt = (world, date, liftType, position) =>
  world.view(date)[liftType][position]._key;

// --- Scenarios: the failures this page has actually had ---------------------------

const scenarios = {
  async "an edit made straight after adding a set is kept"() {
    const world = createWorld({ rows: baseRows() });
    await world.start(TODAY);
    const lifter = createLifter(world);
    lifter.seed(TODAY);
    const key = lifter.add(TODAY, "Back Squat", { reps: 5, weight: 100 });
    lifter.edit(TODAY, key, { weight: 105 });
    lifter.edit(TODAY, key, { reps: 3 });
    lifter.checkView("before send");
    await settle(world, lifter, "add then edit");
    lifter.checkSheet("add then edit");
    // One insert, then both edits as a single write.
    assert.equal(world.sheet.requests.length, 2);
    assert.equal(world.failures.length, 0);
  },

  async "edits to a set still waiting its turn ride in on its insert"() {
    const world = createWorld({ rows: baseRows() });
    await world.start(TODAY);
    const lifter = createLifter(world);
    lifter.add(TODAY, "Back Squat");
    const key = lifter.add(TODAY, "Back Squat", { reps: 5, weight: 100 });
    lifter.edit(TODAY, key, { weight: 105 });
    lifter.edit(TODAY, key, { reps: 3 });
    await settle(world, lifter, "edit a queued add");
    lifter.checkSheet("edit a queued add");
    assert.equal(world.sheet.requests.length, 2);
    assert.equal(world.failures.length, 0);
  },

  async "an edit made while the add is in flight lands on the new row"() {
    const world = createWorld({ rows: baseRows() });
    await world.start(TODAY);
    const lifter = createLifter(world);
    const key = lifter.add(TODAY, "Back Squat", { reps: 5, weight: 100 });
    await world.clock.run({ until: world.clock.now() + 20 });
    lifter.edit(TODAY, key, { weight: 110 });
    await settle(world, lifter, "edit in flight");
    lifter.checkSheet("edit in flight");
    assert.equal(world.failures.length, 0);
  },

  async "reps then weight on one row go out as one write"() {
    const world = createWorld({ rows: baseRows() });
    await world.start(TODAY);
    const lifter = createLifter(world);
    const key = keyAt(world, TODAY, "Bench Press", 1);
    lifter.edit(TODAY, key, { reps: 4 });
    await world.clock.run({ until: world.clock.now() + 150 });
    lifter.edit(TODAY, key, { weight: 82.5 });
    await settle(world, lifter, "reps then weight");
    lifter.checkSheet("reps then weight");
    assert.equal(world.sheet.requests.length, 1);
    // The untouched cells keep their own text.
    const [request] = world.sheet.requests;
    assert.deepEqual(
      getChangedEditableFields(request.body.before, request.body.after),
      ["reps", "weight"],
    );
    assert.equal(world.failures.length, 0);
  },

  async "an edit below a new set still reaches its own row"() {
    const world = createWorld({ rows: baseRows() });
    await world.start(TODAY);
    const lifter = createLifter(world);
    lifter.add(TODAY, "Back Squat", { reps: 5, weight: 100 });
    lifter.edit(TODAY, keyAt(world, TODAY, "Bench Press", 0), { reps: 8 });
    lifter.edit(YESTERDAY, keyAt(world, YESTERDAY, "Deadlift", 0), {
      reps: 2,
    });
    await settle(world, lifter, "edit below insert");
    lifter.checkSheet("edit below insert");
    assert.equal(world.failures.length, 0);
  },

  async "a delete above does not misdirect the edit below"() {
    const world = createWorld({ rows: baseRows() });
    await world.start(TODAY);
    const lifter = createLifter(world);
    lifter.remove(TODAY, keyAt(world, TODAY, "Back Squat", 0));
    lifter.edit(TODAY, keyAt(world, TODAY, "Bench Press", 1), { reps: 2 });
    await settle(world, lifter, "delete then edit");
    lifter.checkSheet("delete then edit");
    assert.equal(world.failures.length, 0);
  },

  async "deleting a session's first row keeps the next lift's label"() {
    const world = createWorld({
      rows: [
        [TODAY, "Bench Press", "5", "60kg", "", ""],
        ["", "Back Squat", "5", "100kg", "", ""],
        ["", "", "5", "100kg", "", ""],
        [YESTERDAY, "Deadlift", "1", "180kg", "", ""],
      ],
    });
    await world.start(TODAY);
    const lifter = createLifter(world);
    lifter.remove(TODAY, keyAt(world, TODAY, "Bench Press", 0));
    await settle(world, lifter, "anchor delete");
    lifter.checkSheet("anchor delete");
    assert.deepEqual(world.sheet.cells(2).slice(0, 2), [TODAY, "Back Squat"]);
  },

  async "a refresh landing mid-save changes nothing on screen"() {
    const world = createWorld({ rows: baseRows() });
    await world.start(TODAY);
    const lifter = createLifter(world);
    lifter.add(TODAY, "Back Squat");
    void world.revalidate();
    await world.clock.run({ until: world.clock.now() + 60 });
    lifter.edit(TODAY, keyAt(world, TODAY, "Back Squat", 1), { reps: 6 });
    void world.revalidate();
    lifter.add(TODAY, "Bench Press");
    await world.clock.run({ until: world.clock.now() + 500 });
    void world.revalidate();
    await settle(world, lifter, "refresh mid-save");
    lifter.checkSheet("refresh mid-save");
    assert.equal(world.failures.length, 0);
  },

  async "a lost response to an add does not add the set twice"() {
    const world = createWorld({ rows: baseRows() });
    await world.start(TODAY);
    const lifter = createLifter(world);
    world.script("lost-response");
    lifter.add(TODAY, "Back Squat", { reps: 5, weight: 100, notes: "14:05 " });
    await settle(world, lifter, "lost response");
    lifter.checkSheet("lost response");
    assert.equal(world.sheetSession(TODAY).length, 7);
    assert.equal(world.failures.length, 0);
  },

  async "a lost request for an add is sent again"() {
    const world = createWorld({ rows: baseRows() });
    await world.start(TODAY);
    const lifter = createLifter(world);
    world.script("lost-request", "server-error", "rate-limit");
    lifter.add(TODAY, "Bench Press");
    await settle(world, lifter, "lost request");
    lifter.checkSheet("lost request");
    assert.equal(world.sheetSession(TODAY).length, 7);
    assert.equal(world.failures.length, 0);
  },

  async "one refused write is a blip and the set still lands"() {
    const world = createWorld({ rows: baseRows() });
    await world.start(TODAY);
    const lifter = createLifter(world);
    world.script("forbidden");
    lifter.add(TODAY, "Bench Press");
    await settle(world, lifter, "one 403");
    lifter.checkSheet("one 403");
    assert.equal(world.sheetSession(TODAY).length, 7);
    assert.equal(world.failures.length, 0);
  },

  async "a sheet that keeps refusing writes hands the set back"() {
    const world = createWorld({ rows: baseRows() });
    await world.start(TODAY);
    world.script("forbidden", "forbidden", "forbidden", "forbidden");
    world.store.addSet({
      date: TODAY,
      liftType: "Bench Press",
      fields: { reps: 5, weight: 60, unitType: "kg", notes: "", url: "" },
    });
    await world.clock.run();
    assert.equal(getSyncSummary(world.store.getState()).pending, 0);
    assert.equal(world.failures.length, 1);
    assert.equal(world.failures[0].reason, "forbidden");
    assert.equal(world.sheetSession(TODAY).length, 6);
  },

  async "an add that arrives late is still only one row"() {
    const world = createWorld({ rows: baseRows(), faults: { lateBy: 900 } });
    await world.start(TODAY);
    const lifter = createLifter(world);
    world.script("late");
    lifter.add(TODAY, "Back Squat");
    await settle(world, lifter, "late arrival");
    lifter.checkSheet("late arrival");
    assert.equal(world.sheetSession(TODAY).length, 7);
    assert.equal(world.failures.length, 0);
  },

  async "one of three identical sets is deleted exactly once"() {
    const world = createWorld({ rows: baseRows() });
    await world.start(TODAY);
    const lifter = createLifter(world);
    world.script("lost-response");
    lifter.remove(TODAY, keyAt(world, TODAY, "Back Squat", 2));
    await settle(world, lifter, "identical delete");
    lifter.checkSheet("identical delete");
    assert.equal(
      world.sheetSession(TODAY).filter((row) => row.weight === 100).length,
      2,
    );
    assert.equal(world.failures.length, 0);
  },

  async "an add and its delete cancel out without polling forever"() {
    const world = createWorld({ rows: baseRows() });
    await world.start(TODAY);
    const lifter = createLifter(world);
    const key = lifter.add(TODAY, "Back Squat");
    await world.clock.run({ until: world.clock.now() + 900 });
    lifter.remove(TODAY, key);
    await settle(world, lifter, "add then delete");
    lifter.checkSheet("add then delete");
    assert.equal(world.sheetSession(TODAY).length, 6);
    // The sheet reads back identical to the snapshot we started from, which
    // is still enough to retire both changes and stop asking.
    const idleSince = world.clock.now();
    await world.clock.run({ until: idleSince + 60000 });
    assert.equal(world.reads(), world.readsAt(idleSince));
    assert.equal(world.failures.length, 0);
  },

  async "changing date mid-save keeps every change"() {
    const world = createWorld({ rows: baseRows() });
    await world.start(TODAY);
    const lifter = createLifter(world);
    const key = lifter.add(TODAY, "Back Squat");
    lifter.edit(TODAY, key, { reps: 2 });
    world.viewDate = YESTERDAY;
    lifter.seed(YESTERDAY);
    lifter.add(YESTERDAY, "Deadlift", { reps: 1, weight: 190 });
    lifter.edit(YESTERDAY, keyAt(world, YESTERDAY, "Strict Press", 0), {
      reps: 6,
    });
    await settle(world, lifter, "date change");
    lifter.checkSheet("date change");
    assert.equal(world.failures.length, 0);
  },

  async "leaving the log page does not strand a change"() {
    const world = createWorld({ rows: baseRows() });
    await world.start(TODAY);
    const lifter = createLifter(world);
    world.script("lost-response");
    lifter.add(TODAY, "Bench Press");
    world.setAttached(false);
    await world.clock.run();
    assert.equal(getSyncSummary(world.store.getState()).pending, 0);
    world.setAttached(true);
    await settle(world, lifter, "left the page");
    lifter.checkSheet("left the page");
    assert.equal(world.failures.length, 0);
  },

  async "new sessions land in date order"() {
    const world = createWorld({ rows: baseRows() });
    await world.start("2026-03-12");
    const lifter = createLifter(world);
    lifter.add("2026-03-12", "Back Squat");
    lifter.add("2026-03-12", "Back Squat");
    lifter.add("2026-03-12", "Bench Press");
    lifter.add("2026-03-05", "Deadlift");
    lifter.add("2026-02-01", "Back Squat");
    await settle(world, lifter, "new sessions");
    lifter.checkSheet("new sessions");
    const dates = world.sheet.values
      .slice(1)
      .map((row) => row[0])
      .filter(Boolean);
    assert.deepEqual(dates, [
      "2026-03-12",
      TODAY,
      YESTERDAY,
      YESTERDAY,
      "2026-03-05",
      "2026-03-01",
      "2026-02-01",
    ]);
    assert.equal(world.failures.length, 0);
  },

  async "deleting a session removes it and nothing else"() {
    const world = createWorld({ rows: baseRows() });
    await world.start(YESTERDAY);
    const lifter = createLifter(world);
    lifter.seed(TODAY);
    lifter.add(TODAY, "Back Squat");
    const deleted = world.store.deleteSession({ date: YESTERDAY });
    await settle(world, null, "session delete");
    assert.equal(await deleted, true);
    assert.equal(world.sheetSession(YESTERDAY).length, 0);
    assert.equal(world.sheetSession("2026-03-01").length, 1);
    lifter.checkView("session delete");
    lifter.checkSheet("session delete");
  },

  async "rows added to the sheet elsewhere do not misdirect a change"() {
    const world = createWorld({ rows: baseRows() });
    await world.start(TODAY);
    const lifter = createLifter(world);
    // Another device starts tomorrow's session above everything.
    world.sheet.values.splice(
      1,
      0,
      world.sheet.physical(["2026-03-11", "Deadlift", "5", "150kg", "", ""]),
      world.sheet.physical(["", "", "5", "150kg", "", ""]),
    );
    lifter.edit(TODAY, keyAt(world, TODAY, "Bench Press", 1), { reps: 1 });
    lifter.add(TODAY, "Back Squat");
    await settle(world, lifter, "external rows");
    lifter.checkSheet("external rows");
    assert.equal(world.sheetSession("2026-03-11").length, 2);
    assert.equal(world.failures.length, 0);
  },

  async "an edit to a row that vanished is handed back, not misplaced"() {
    const world = createWorld({ rows: baseRows() });
    await world.start(TODAY);
    const key = keyAt(world, TODAY, "Bench Press", 1);
    // The row is removed in the sheet itself before the edit is sent.
    world.sheet.values.splice(6, 1);
    world.store.editSet({ date: TODAY, key, patch: { reps: 9 } });
    await world.clock.run();
    void world.revalidate();
    await world.clock.run();
    assert.equal(getSyncSummary(world.store.getState()).pending, 0);
    assert.equal(world.failures.length, 1);
    assert.ok(
      !world.sheetSession(TODAY).some((row) => row.reps === 9),
      "no other row took the edit",
    );
    assert.equal(world.view(TODAY)["Bench Press"].length, 1);
  },

  async "a sheet in the lifter's own column order is written in that order"() {
    const world = createWorld({ rows: baseRows(), header: OWN_ORDER });
    await world.start(TODAY);
    const lifter = createLifter(world);
    lifter.seed(YESTERDAY);
    lifter.add(TODAY, "Back Squat", { reps: 5, weight: 100 });
    lifter.add(TODAY, "Deadlift");
    lifter.add("2026-03-12", "Bench Press");
    lifter.edit(TODAY, keyAt(world, TODAY, "Bench Press", 1), {
      reps: 4,
      weight: 82.5,
      notes: "paused",
    });
    // The session's first row: its date and lift pass to the row below, in
    // the columns this sheet keeps them in.
    lifter.remove(TODAY, keyAt(world, TODAY, "Back Squat", 0));
    lifter.edit(YESTERDAY, keyAt(world, YESTERDAY, "Deadlift", 0), {
      url: "https://youtu.be/xyz",
    });
    await settle(world, lifter, "own column order");
    lifter.checkSheet("own column order");
    assert.deepEqual(world.sheet.values[0], OWN_ORDER);
    const rpe = OWN_ORDER.indexOf("RPE");
    assert.ok(
      world.sheet.values.slice(1).every((row) => row[rpe] === ""),
      "a column the app does not own is never written to",
    );
    assert.equal(world.failures.length, 0);

    const deleted = world.store.deleteSession({ date: YESTERDAY });
    await settle(world, null, "own column order, session delete");
    assert.equal(await deleted, true);
    assert.equal(world.sheetSession(YESTERDAY).length, 0);
    lifter.expected.delete(YESTERDAY);
    lifter.checkSheet("own column order, session delete");
  },

  async "columns moved in the sheet are picked up, not written through"() {
    const world = createWorld({ rows: baseRows() });
    await world.start(TODAY);
    const lifter = createLifter(world);
    // The lifter swaps the Reps and Weight columns in Google Sheets while the
    // log still holds the old layout.
    for (const row of world.sheet.values) {
      [row[2], row[3]] = [row[3], row[2]];
    }
    lifter.edit(TODAY, keyAt(world, TODAY, "Bench Press", 0), { reps: 8 });
    lifter.add(TODAY, "Back Squat", { reps: 3, weight: 110 });
    await settle(world, lifter, "columns moved");
    lifter.checkSheet("columns moved");
    assert.deepEqual(world.sheet.values[0].slice(2, 4), ["Weight", "Reps"]);
    assert.equal(world.failures.length, 0);
  },

  async "a sheet with no header row is never written to"() {
    const world = createWorld({ rows: baseRows() });
    world.sheet.values.shift();
    const before = JSON.stringify(world.sheet.values);
    await world.start(TODAY);
    // The page would not offer the controls; the routes refuse regardless.
    world.store.addSet({
      date: TODAY,
      liftType: "Back Squat",
      fields: { reps: 5, weight: 100, unitType: "kg", notes: "", url: "" },
    });
    await world.clock.run();
    void world.revalidate();
    await world.clock.run();
    assert.equal(JSON.stringify(world.sheet.values), before);
    assert.equal(getSyncSummary(world.store.getState()).pending, 0);
    assert.equal(world.failures.length, 1);
  },

  async "changes made offline are sent when the connection returns"() {
    const world = createWorld({ rows: baseRows() });
    await world.start(TODAY);
    const lifter = createLifter(world);
    world.offline = true;
    const key = lifter.add(TODAY, "Back Squat");
    lifter.add(TODAY, "Back Squat");
    lifter.edit(TODAY, keyAt(world, TODAY, "Bench Press", 0), { reps: 7 });
    await world.clock.run({
      until: world.clock.now() + 20000,
      afterEach: () => lifter.checkView("offline"),
    });
    assert.ok(getSyncSummary(world.store.getState()).pending > 0);
    lifter.edit(TODAY, key, { weight: 102.5 });
    world.offline = false;
    world.store.retryNow();
    await settle(world, lifter, "back online");
    lifter.checkSheet("back online");
    assert.equal(world.failures.length, 0);
  },

  // --- A tab that dies mid-session ---

  async "sets logged offline survive the tab closing, and more can follow"() {
    const world = createWorld({ rows: baseRows() });
    await world.start(TODAY);
    const lifter = createLifter(world);
    lifter.seed(TODAY);
    world.offline = true;
    const first = lifter.add(TODAY, "Back Squat", { weight: 110 });
    lifter.edit(TODAY, first, { weight: 112.5 });
    lifter.add(TODAY, "Deadlift", { reps: 3, weight: 180 });
    await world.clock.run({ until: world.clock.now() + 10000 });
    assert.equal(world.sheet.requests.length, 0);

    // Chrome discards the tab. The lifter reopens the log, still offline.
    const next = restart(world);
    await next.start(TODAY, { savedCopy: next.savedCopy, offline: true });
    lifter.rekey(next, "reopened offline");
    lifter.add(TODAY, "Deadlift", { reps: 3, weight: 190 });
    lifter.checkView("reopened offline");

    next.offline = false;
    next.store.retryNow();
    await settle(next, lifter, "reopened online");
    lifter.checkSheet("reopened online");
    assert.equal(next.failures.length, 0);
  },

  async "a set whose answer was lost as the tab closed is not doubled"() {
    const world = createWorld({ rows: baseRows() });
    await world.start(TODAY);
    const lifter = createLifter(world);
    lifter.seed(TODAY);
    world.script("lost-response");
    lifter.add(TODAY, "Back Squat", { weight: 107.5 });
    // Long enough for the send to go out and its answer to be lost.
    await world.clock.run({ until: world.clock.now() + 1000 });

    const next = restart(world);
    await next.start(TODAY, { savedCopy: next.savedCopy });
    lifter.rekey(next, "reopened");
    await settle(next, lifter, "lost answer");
    lifter.checkSheet("lost answer");
    assert.equal(next.failures.length, 0);
  },

  async "a set still on its way when the tab closed is not doubled"() {
    const world = createWorld({
      rows: baseRows(),
      faults: { lateBy: 20000 },
    });
    await world.start(TODAY);
    const lifter = createLifter(world);
    lifter.seed(TODAY);
    world.script("late");
    lifter.add(TODAY, "Back Squat", { weight: 107.5 });
    await world.clock.run({ until: world.clock.now() + 600 });

    // The request lands 20s from now, after the new page's first read.
    const next = restart(world);
    await next.start(TODAY, { savedCopy: next.savedCopy });
    lifter.rekey(next, "reopened");
    await settle(next, lifter, "late arrival");
    lifter.checkSheet("late arrival");
    assert.equal(next.failures.length, 0);
  },

  async "a set that landed just before the tab closed keeps its later edit"() {
    const world = createWorld({ rows: baseRows() });
    await world.start(TODAY);
    const lifter = createLifter(world);
    lifter.seed(TODAY);
    const key = lifter.add(TODAY, "Bench Press", { reps: 5, weight: 70 });
    // Sent and confirmed, but the read that would retire it never comes.
    await world.clock.run({ until: world.clock.now() + 900 });
    world.offline = true;
    lifter.edit(TODAY, key, { reps: 4 });
    await world.clock.run({ until: world.clock.now() + 3000 });

    const next = restart(world);
    await next.start(TODAY, { savedCopy: next.savedCopy });
    lifter.rekey(next, "reopened");
    await settle(next, lifter, "landed then edited");
    lifter.checkSheet("landed then edited");
    assert.equal(next.failures.length, 0);
  },

  async "edits and deletes to older sets made offline survive the tab closing"() {
    const world = createWorld({ rows: baseRows() });
    await world.start(TODAY);
    const lifter = createLifter(world);
    lifter.seed(TODAY);
    world.offline = true;
    // The third of three identical sets, so position among equals matters.
    lifter.edit(TODAY, keyAt(world, TODAY, "Back Squat", 3), { reps: 4 });
    lifter.remove(TODAY, keyAt(world, TODAY, "Back Squat", 1));
    lifter.edit(TODAY, keyAt(world, TODAY, "Bench Press", 1), {
      notes: "14:24 easy",
    });
    await world.clock.run({ until: world.clock.now() + 5000 });

    const next = restart(world);
    await next.start(TODAY, { savedCopy: next.savedCopy, offline: true });
    lifter.rekey(next, "reopened offline");
    next.offline = false;
    next.store.retryNow();
    await settle(next, lifter, "older sets");
    lifter.checkSheet("older sets");
    assert.equal(next.failures.length, 0);
  },
};

// --- Fuzz: a lifter tapping at random through an unreliable network ----------------

function dumpState(world) {
  const state = world.store.getState();
  trace(
    "ops",
    JSON.stringify(
      state.ops.map((op) => ({
        id: op.id,
        kind: op.kind,
        date: op.date,
        key: op.key,
        status: op.status,
        rowIndex: op.rowIndex,
        doneAt: op.doneAt,
        sent: op.sent?.rowIndex,
      })),
    ),
  );
  trace("hold", JSON.stringify(state.hold), "readAt", state.base.readAt);
  trace("keys", JSON.stringify([...state.keys]));
}

async function fuzz(seed) {
  const world = createWorld({
    rows: baseRows(),
    // Every other run is on a sheet laid out the lifter's own way.
    header: seed % 2 ? HEADER : OWN_ORDER,
    seed,
    faults: {
      rates: {
        "lost-request": 0.08,
        "lost-response": 0.08,
        "rate-limit": 0.04,
        "server-error": 0.04,
        late: 0.04,
      },
      lateBy: 700,
    },
  });
  const { random, clock } = world;
  const dates = [TODAY, YESTERDAY, "2026-03-12"];
  const liftTypes = ["Back Squat", "Bench Press", "Deadlift", "Strict Press"];
  await world.start(TODAY);
  const lifter = createLifter(world);
  dates.forEach((date) => lifter.seed(date));
  const label = `fuzz seed ${seed}`;

  for (let step = 0; step < 60; step += 1) {
    const date = world.viewDate;
    const rows = lifter.expected.get(date);
    const roll = random.next();
    if (roll < 0.3) {
      lifter.add(date, random.pick(liftTypes), {
        reps: random.int(1, 8),
        weight: random.pick([60, 80, 100, 102.5]),
      });
    } else if (roll < 0.62 && rows.length) {
      const field = random.pick(["reps", "weight", "notes", "url"]);
      const value =
        field === "reps"
          ? random.int(1, 12)
          : field === "weight"
            ? random.pick([60, 62.5, 100, 140])
            : field === "notes"
              ? random.pick(["", "felt heavy", "14:30 paused"])
              : random.pick(["", "https://youtu.be/xyz"]);
      lifter.edit(date, random.pick(rows).key, { [field]: value });
    } else if (roll < 0.74 && rows.length) {
      lifter.remove(date, random.pick(rows).key);
    } else if (roll < 0.84) {
      void world.revalidate();
    } else if (roll < 0.9) {
      world.viewDate = random.pick(dates);
    } else if (roll < 0.94) {
      world.store.flush();
    } else if (roll < 0.97) {
      world.setAttached(!world.attached);
    }
    const check = () => {
      try {
        lifter.checkView(label);
      } catch (error) {
        dumpState(world);
        throw error;
      }
    };
    check();
    await clock.run({
      until: clock.now() + random.pick([0, 0, 30, 120, 400, 1500, 4000]),
      afterEach: check,
    });
  }

  world.setAttached(true);
  await settle(world, lifter, label);
  lifter.checkSheet(label);
  assert.deepEqual(world.failures, [], `${label}: a change was handed back`);
}

// --- Fuzz: the same, with the tab dying at random moments -------------------------

async function fuzzRestarts(seed) {
  const faults = {
    rates: {
      "lost-request": 0.1,
      "lost-response": 0.08,
      "server-error": 0.04,
      late: 0.06,
    },
    lateBy: 900,
  };
  let world = createWorld({
    rows: baseRows(),
    header: seed % 2 ? HEADER : OWN_ORDER,
    seed: seed + 10000,
    faults,
  });
  const { random, clock } = world;
  const liftTypes = ["Back Squat", "Bench Press", "Deadlift"];
  await world.start(TODAY);
  const lifter = createLifter(world);
  lifter.seed(TODAY);
  const label = `restart fuzz seed ${seed}`;

  for (let step = 0; step < 40; step += 1) {
    const rows = lifter.expected.get(TODAY);
    const roll = random.next();
    if (roll < 0.35) {
      lifter.add(TODAY, random.pick(liftTypes), {
        reps: random.int(1, 6),
        weight: random.pick([60, 100, 102.5]),
      });
    } else if (roll < 0.6 && rows.length) {
      lifter.edit(
        TODAY,
        random.pick(rows).key,
        random.chance(0.5)
          ? { reps: random.pick([3, 5, 8]) }
          : { weight: random.pick([62.5, 100, 140]) },
      );
    } else if (roll < 0.7 && rows.length) {
      lifter.remove(TODAY, random.pick(rows).key);
    } else if (roll < 0.8) {
      world.offline = !world.offline;
      if (!world.offline) world.store.retryNow();
    } else if (roll < 0.88) {
      // The tab dies; the lifter reopens the log, maybe still offline.
      const offline = world.offline || random.chance(0.3);
      world = restart(world, { faults });
      await world.start(TODAY, { savedCopy: world.savedCopy, offline });
      try {
        lifter.rekey(world, label);
      } catch (error) {
        dumpState(world);
        throw error;
      }
    }
    // Rows shown from the saved copy take the keys of the read that replaces
    // it, so across a reopen the check is row for row by content.
    const check = () => {
      try {
        lifter.rekey(world, label);
      } catch (error) {
        dumpState(world);
        throw error;
      }
    };
    check();
    await clock.run({
      until: clock.now() + random.pick([0, 50, 300, 1500, 5000]),
      afterEach: check,
    });
  }

  world.offline = false;
  world.store.retryNow();
  await clock.run({ afterEach: () => lifter.rekey(world, label) });
  await settle(world, null, label);
  lifter.rekey(world, label);
  lifter.checkSheet(label);
  assert.deepEqual(world.failures, [], `${label}: a change was handed back`);
}

// --- Run -----------------------------------------------------------------------------

// LOG_SYNC_ONLY="tab closing" runs just the scenarios whose name contains it.
const onlyScenario = process.env.LOG_SYNC_ONLY ?? "";
for (const [name, run] of Object.entries(scenarios)) {
  if (!name.includes(onlyScenario)) continue;
  if (TRACE) console.log(`--- ${name}`);
  try {
    await run();
  } catch (error) {
    console.error(`Log sync scenario failed: ${name}`);
    throw error;
  }
}

const FUZZ_RUNS = Number(process.env.LOG_SYNC_FUZZ_RUNS ?? 300);
const onlySeed = Number(process.env.LOG_SYNC_SEED ?? 0);
for (let seed = onlySeed || 1; seed <= (onlySeed || FUZZ_RUNS); seed += 1) {
  await fuzz(seed);
}
for (let seed = onlySeed || 1; seed <= (onlySeed || FUZZ_RUNS); seed += 1) {
  await fuzzRestarts(seed);
}

console.log(
  `Log sync checks passed (${Object.keys(scenarios).length} scenarios, ${FUZZ_RUNS} fuzz runs, ${FUZZ_RUNS} with restarts).`,
);
