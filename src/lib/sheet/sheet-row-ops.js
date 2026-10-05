/**
 * Operation-oriented Google Sheets helpers for the log write APIs.
 *
 * This module is intentionally NOT organized around REST resources like
 * "sets" or "sessions". The sheet is the source of truth and the riskiest
 * failures happen at the sheet-row level, so the APIs are modeled around
 * explicit sheet operations:
 * - edit-row
 * - insert-row
 * - delete-row
 * - delete-session
 *
 * These helpers implement the column map and the verification layer shared
 * by those operations.
 * The verification is deliberately "fail closed": we only verify the row at the
 * client-supplied rowIndex, and we never try to hunt for a similar-looking row
 * elsewhere in the sheet. Repeated reps/weight combinations are common, so
 * relocation by content would be more dangerous than rejecting the write.
 *
 * This is not atomic. Google Sheets does not give us a transactional
 * compare-and-swap for these read-then-write flows. The goal here is to block
 * obvious stale-index bugs, improve observability, and make silent corruption
 * much less likely while the client sync model is being hardened.
 */

import { normalizeColumnName } from "@/lib/import/parsers/parser-utilities";

// --- Where a sheet keeps its columns -----------------------------------------
//
// A lifter's sheet does not have to be laid out our way. The parser finds each
// column by its header, wherever it is, and every write here follows the same
// map: a role (date, liftType, reps, weight, notes, url) to a 0-based column.
// The client sends the map its parse found; the server never takes it on
// trust, and checks it against row 1 of the sheet as it stands before writing.

export const STANDARD_COLUMNS = Object.freeze({
  date: 0,
  liftType: 1,
  reps: 2,
  weight: 3,
  notes: 4,
  url: 5,
});

// The order of the six logical values the client sends for a new row.
const COLUMN_ROLES = ["date", "liftType", "reps", "weight", "notes", "url"];
const REQUIRED_ROLES = ["date", "liftType", "reps", "weight"];
const EDITABLE_ROLES = ["reps", "weight", "notes", "url"];
const ROLE_HEADERS = {
  date: "Date",
  liftType: "Lift Type",
  reps: "Reps",
  weight: "Weight",
  notes: "Notes",
  url: "URL",
};
// Sheet reads cover A to Z, as the app's own read does.
const LAST_COLUMN_INDEX = 25;

export function columnLetter(index) {
  return String.fromCharCode(65 + index);
}

/**
 * Settle the columns a write will use, or refuse it.
 *
 * With no map from the client (an older tab, or the import merge) the columns
 * are taken from the header names. With one, every claim is checked against
 * row 1: a role's column must be headed with that role's name, or be blank
 * where the parser inferred it, and no header may name a role somewhere the
 * client did not expect. A sheet whose first row names none of the required
 * columns is not one to write to.
 *
 * @param {object|null|undefined} requested Role -> 0-based column, null when
 *   the sheet has no such column.
 * @param {string[]|undefined} headerRow Raw cells of the sheet's row 1.
 * @returns {{ok: true, columns: object} | {ok: false, message: string}}
 */
export function resolveWriteColumns(requested, headerRow) {
  const names = Array.from({ length: LAST_COLUMN_INDEX + 1 }, (_, column) =>
    normalizeColumnName(String(headerRow?.[column] ?? "").trim()),
  );
  const fail = (message) => ({ ok: false, message });

  const columns = {};
  for (const role of COLUMN_ROLES) {
    const named = names.indexOf(ROLE_HEADERS[role]);
    if (requested == null) {
      columns[role] = named === -1 ? null : named;
      continue;
    }
    const index = requested[role];
    columns[role] =
      Number.isInteger(index) && index >= 0 && index <= LAST_COLUMN_INDEX
        ? index
        : null;
    if (named !== -1 && named !== columns[role]) {
      return fail(
        `row 1 has ${ROLE_HEADERS[role]} in column ${columnLetter(named)}, not where this write expected it`,
      );
    }
  }

  let namedRequired = 0;
  const used = new Set();
  for (const role of COLUMN_ROLES) {
    const index = columns[role];
    if (index === null) {
      if (REQUIRED_ROLES.includes(role)) {
        return fail(`row 1 has no ${ROLE_HEADERS[role]} header`);
      }
      continue;
    }
    if (used.has(index)) {
      return fail(`column ${columnLetter(index)} is claimed twice`);
    }
    used.add(index);
    if (names[index] === ROLE_HEADERS[role]) {
      if (REQUIRED_ROLES.includes(role)) namedRequired += 1;
    } else if (names[index] !== "") {
      return fail(
        `column ${columnLetter(index)} is headed "${names[index]}", not ${ROLE_HEADERS[role]}`,
      );
    }
  }
  if (namedRequired === 0) {
    return fail("row 1 names none of Date, Lift Type, Reps or Weight");
  }
  return { ok: true, columns };
}

/** One sheet row's cells, read through the column map. */
export function toRawRow(cells, columns, rowIndex) {
  const at = (index) => (index === null ? "" : (cells?.[index] ?? ""));
  return {
    rowIndex,
    rawDate: at(columns.date),
    rawLiftType: at(columns.liftType),
    reps: at(columns.reps),
    weight: at(columns.weight),
    notes: at(columns.notes),
    url: at(columns.url),
  };
}

/**
 * Rows as the parser reads them: each with the date and lift it inherits from
 * the nearest filled cell above, within the rows given.
 *
 * @param {string[][]} rows Consecutive raw rows.
 * @param {object} columns
 * @param {number} firstRowIndex 1-based sheet row of `rows[0]`.
 */
export function toLogicalRows(rows, columns, firstRowIndex) {
  let date = "";
  let liftType = "";
  return rows.map((cells = [], offset) => {
    const raw = toRawRow(cells, columns, firstRowIndex + offset);
    if (raw.rawDate) date = raw.rawDate;
    if (raw.rawLiftType) liftType = raw.rawLiftType;
    return { ...raw, date, liftType };
  });
}

/**
 * Lay the six logical values of a new row out in the sheet's own columns.
 * Cells the sheet has no column for are dropped; cells between are null.
 */
export function placeRowValues(values, columns) {
  const indices = Object.values(columns).filter((index) => index !== null);
  const cells = new Array(Math.max(...indices) + 1).fill(null);
  COLUMN_ROLES.forEach((role, position) => {
    if (columns[role] !== null) cells[columns[role]] = values[position];
  });
  return cells;
}

/** Raw cells of consecutive sheet rows, A to Z, as one read. */
export async function readSheetRows({ ssid, headers, fromRow, toRow }) {
  const range = `A${fromRow}:${columnLetter(LAST_COLUMN_INDEX)}${toRow}`;
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${ssid}/values/${range}?majorDimension=ROWS`,
    { headers },
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(
      body?.error?.message || "Failed to read sheet rows",
    );
    error.status = response.status;
    throw error;
  }

  const payload = await response.json();
  return payload.values ?? [];
}

// A1 ranges without a tab name ("A2:F10") read the first *visible* tab, so
// grid mutations must target that same tab. Asking for `hidden` rides along in
// the same metadata request, so matching Google's rule costs nothing extra.
/**
 * Starts the first-tab lookup without awaiting it, so a route can run it
 * alongside its verification reads and await it only before a grid mutation.
 * The lookup must still happen per request: a cached ID goes stale the moment
 * a lifter reorders or hides tabs, which is the bug it exists to prevent.
 * The attached no-op catch keeps an early return from leaving an unhandled
 * rejection; awaiting the returned promise still throws.
 */
export function startFirstSheetIdLookup({ ssid, headers }) {
  const lookup = readFirstSheetId({ ssid, headers });
  lookup.catch(() => {});
  return lookup;
}

export async function readFirstSheetId({ ssid, headers }) {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${ssid}?fields=sheets(properties(sheetId,hidden))`,
    { headers },
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = body?.error?.message || "Failed to read sheet metadata";
    throw new Error(message);
  }

  const payload = await response.json();
  const firstVisibleSheet = payload?.sheets?.find(
    (sheet) => !sheet?.properties?.hidden,
  );
  const sheetId = firstVisibleSheet?.properties?.sheetId;
  if (!Number.isInteger(sheetId)) {
    throw new Error("Spreadsheet has no writable first tab");
  }

  return sheetId;
}

export function buildEditableSnapshot({
  date,
  liftType,
  reps,
  weight,
  unitType,
  notes,
  url,
}) {
  return {
    date: date != null ? String(date) : "",
    liftType: liftType != null ? String(liftType) : "",
    reps: reps != null ? String(reps) : "",
    weight:
      weight != null
        ? `${weight}${unitType != null ? String(unitType) : ""}`
        : "",
    notes: notes != null ? String(notes) : "",
    url: url != null ? String(url) : "",
  };
}

export async function readRawRow({ ssid, rowIndex, headers, columns }) {
  const [cells] = await readSheetRows({
    ssid,
    headers,
    fromRow: rowIndex,
    toRow: rowIndex,
  });
  return cells ? toRawRow(cells, columns, rowIndex) : null;
}

// A lift block interrupted by more non-set rows than this is not one the log
// page can have produced or shown.
const PROMOTION_SCAN_ROWS = 200;

/** The raw rows under a row, as far as an anchor promotion needs to look. */
export function readRowsBelow({ ssid, rowIndex, headers }) {
  return readSheetRows({
    ssid,
    headers,
    fromRow: rowIndex + 1,
    toRow: rowIndex + PROMOTION_SCAN_ROWS,
  });
}

/**
 * Which row takes over the Date / Lift Type of a row about to be deleted, and
 * which of the two it needs.
 *
 * The heir is the next set row, the first row below with both reps and
 * weight, because that is the next row the parser reads anchors from. It
 * needs a cell only if it leaves that cell blank and is still in the deleted
 * row's session. A cell it fills itself is reported as null so the write
 * skips it; an empty string there would clear it.
 *
 * @param {{rawDate: string, rawLiftType: string, date: string, liftType: string}} target
 *   Logical row being deleted.
 * @param {string[][]} following Raw rows below it, in sheet order.
 * @param {object} [columns] The sheet's column map.
 * @returns {{offset: number, date: string|null, liftType: string|null}|null}
 *   `offset` 0 is the row directly below.
 */
export function planAnchorPromotion(
  target,
  following,
  columns = STANDARD_COLUMNS,
) {
  for (let offset = 0; offset < following.length; offset += 1) {
    const row = toRawRow(following[offset], columns, null);
    const isSetRow = row.reps !== "" && row.weight !== "";
    if (!isSetRow) continue;

    const { rawDate, rawLiftType } = row;
    const staysInSameSession = !rawDate || rawDate === target.date;
    const needsDate = staysInSameSession && Boolean(target.rawDate) && !rawDate;
    const needsLiftType =
      staysInSameSession && Boolean(target.rawLiftType) && !rawLiftType;
    if (!needsDate && !needsLiftType) return null;

    return {
      offset,
      date: needsDate ? target.date : null,
      liftType: needsLiftType ? target.liftType : null,
    };
  }
  return null;
}

export function getAnchorTypeFromLogicalRow(row) {
  if (row?.rawDate) return "session";
  if (row?.rawLiftType) return "lift";
  return "plain";
}

export function diffEditableSnapshot(actual, expected) {
  const keys = ["date", "liftType", "reps", "weight", "notes", "url"];
  const diffs = [];

  for (const key of keys) {
    const actualValue = actual?.[key] ?? "";
    const expectedValue = expected?.[key] ?? "";
    if (actualValue !== expectedValue) {
      diffs.push({ key, actual: actualValue, expected: expectedValue });
    }
  }

  return diffs;
}

/**
 * The editable cells an edit actually changes. Only these are written, so an
 * untouched cell keeps its own text: a unitless "225", a "112,5kg", or a link
 * typed as a formula would otherwise be rewritten as the app reads them.
 */
export function getChangedEditableFields(before, after) {
  return EDITABLE_ROLES.filter(
    (field) => (after?.[field] ?? "") !== (before?.[field] ?? ""),
  );
}

/**
 * Has this exact row already been inserted in its slot? A client that lost
 * the response to an insert sends it again flagged as a retry; answering
 * "already there" keeps one tap from becoming two rows.
 *
 * The comparison is on raw cells, blank Date and Lift Type included. The log
 * only ever inserts after the last row of a lift block or of a session, so the
 * row that follows is another lift's or another session's anchor and cannot
 * pass for a plain set by accident, however many identical sets came before.
 */
export function isInsertedRowPresent(
  rawRow,
  values,
  columns = STANDARD_COLUMNS,
) {
  if (!rawRow || !Array.isArray(values)) return false;
  const cells = [
    rawRow.rawDate,
    rawRow.rawLiftType,
    rawRow.reps,
    rawRow.weight,
    rawRow.notes,
    rawRow.url,
  ];
  return COLUMN_ROLES.every(
    (role, position) =>
      // A value the sheet has no column for was never written, so its
      // absence says nothing.
      columns[role] === null ||
      String(cells[position] ?? "").trim() ===
        String(values[position] ?? "").trim(),
  );
}

/**
 * Read the sheet from row 1 down to a row, check the write's column map
 * against the header, and compare the row with what the client believes it
 * holds. One read serves all three, so honouring a lifter's own column order
 * costs no extra request.
 *
 * @param {object} [options.columns] The column map the client parsed. Omitted
 *   by older tabs, in which case the header names decide.
 * @returns {Promise<{ok: boolean, actual: object|null, columns: object|null,
 *   actualAnchorType?: string, message?: string}>}
 */
export async function verifyRowSnapshot({
  ssid,
  rowIndex,
  before,
  expectedAnchorType = null,
  headers,
  columns: requestedColumns = null,
}) {
  const rows = await readSheetRows({
    ssid,
    headers,
    fromRow: 1,
    toRow: rowIndex,
  });
  const layout = resolveWriteColumns(requestedColumns, rows[0]);
  if (!layout.ok) {
    return {
      ok: false,
      actual: null,
      columns: null,
      message: `Sheet layout check failed: ${layout.message}`,
    };
  }
  const { columns } = layout;

  // Row 1 is the header; inheritance starts at row 2. Sheets leaves out
  // trailing blank rows, so the target itself may be missing from the read.
  const dataRows = rows.slice(1);
  while (dataRows.length < rowIndex - 1) dataRows.push([]);
  const actual =
    rowIndex >= 2
      ? toLogicalRows(dataRows, columns, 2)[rowIndex - 2]
      : { ...toRawRow([], columns, rowIndex), date: "", liftType: "" };
  const diffs = diffEditableSnapshot(actual, before);
  const actualAnchorType = getAnchorTypeFromLogicalRow(actual);

  if (
    !diffs.length &&
    (!expectedAnchorType || expectedAnchorType === actualAnchorType)
  ) {
    return { ok: true, actual, actualAnchorType, columns };
  }

  const mismatchLines = diffs.map(
    (diff) =>
      `${diff.key}: expected "${diff.expected}" but found "${diff.actual}"`,
  );
  if (expectedAnchorType && expectedAnchorType !== actualAnchorType) {
    mismatchLines.push(
      `anchorType: expected "${expectedAnchorType}" but found "${actualAnchorType}"`,
    );
  }

  return {
    ok: false,
    actual,
    actualAnchorType,
    columns,
    message: `Preflight verification failed for row ${rowIndex}: ${mismatchLines.join(" | ")}`,
  };
}

// Formatting is best-effort: the value write has already landed, so a failed
// tab lookup must not turn a saved edit into an error for the lifter.
export async function forceNotesPlainText({
  ssid,
  rowIndex,
  headers,
  sheetIdLookup,
  notesColumn = STANDARD_COLUMNS.notes,
}) {
  let sheetId;
  try {
    sheetId = await (sheetIdLookup ?? readFirstSheetId({ ssid, headers }));
  } catch (error) {
    console.warn("[sheet] notes plain-text format skipped:", error.message);
    return;
  }
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${ssid}:batchUpdate`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        requests: [
          {
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: rowIndex - 1,
                endRowIndex: rowIndex,
                startColumnIndex: notesColumn,
                endColumnIndex: notesColumn + 1,
              },
              cell: {
                userEnteredFormat: {
                  numberFormat: { type: "TEXT" },
                  horizontalAlignment: "LEFT",
                },
              },
              fields:
                "userEnteredFormat.numberFormat,userEnteredFormat.horizontalAlignment",
            },
          },
        ],
      }),
    },
  );
}
