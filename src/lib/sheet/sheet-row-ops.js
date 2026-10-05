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
 * These helpers implement the verification layer shared by those operations.
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

// The sheet layout every write here addresses by position: a header in row 1
// over these six columns, A to F.
const STANDARD_HEADERS = [
  "Date",
  "Lift Type",
  "Reps",
  "Weight",
  "Notes",
  "URL",
];

/**
 * Is this row 1 the standard header? The parser can read a sheet whose
 * columns are in another order, or which has no header at all, by finding or
 * inferring each column. A write cannot: it puts a date in column A and a
 * weight in column D. So a route that writes by position checks first.
 *
 * The four required headers must be in place. Notes and URL may be blank,
 * which only means the app will not read those columns back.
 *
 * @param {string[]|undefined} row Raw cells of the sheet's first row.
 */
export function isStandardHeaderRow(row) {
  return STANDARD_HEADERS.every((name, column) => {
    const cell = normalizeColumnName(String(row?.[column] ?? "").trim());
    return cell === name || (column >= 4 && cell === "");
  });
}

export const EDITABLE_COLUMN_CONFIG = {
  reps: { letter: "C", startColumnIndex: 2 },
  weight: { letter: "D", startColumnIndex: 3 },
  notes: { letter: "E", startColumnIndex: 4 },
  url: { letter: "F", startColumnIndex: 5 },
};

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

export async function readLogicalRow({ ssid, rowIndex, headers }) {
  const range = `A2:F${rowIndex}`;
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${ssid}/values/${range}?majorDimension=ROWS`,
    { headers },
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message =
      body?.error?.message || "Failed to read row for verification";
    throw new Error(message);
  }

  const payload = await response.json();
  const rows = payload.values ?? [];
  const targetOffset = rowIndex - 2;
  const targetRow = rows[targetOffset] ?? [];

  let inheritedDate = "";
  let inheritedLiftType = "";

  for (let i = 0; i <= targetOffset; i += 1) {
    const row = rows[i] ?? [];
    if (row[0]) inheritedDate = row[0];
    if (row[1]) inheritedLiftType = row[1];
  }

  return {
    rowIndex,
    rawDate: targetRow[0] ?? "",
    rawLiftType: targetRow[1] ?? "",
    date: inheritedDate,
    liftType: inheritedLiftType,
    reps: targetRow[2] ?? "",
    weight: targetRow[3] ?? "",
    notes: targetRow[4] ?? "",
    url: targetRow[5] ?? "",
  };
}

export async function readRawRow({ ssid, rowIndex, headers }) {
  const range = `A${rowIndex}:F${rowIndex}`;
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${ssid}/values/${range}?majorDimension=ROWS`,
    { headers },
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = body?.error?.message || "Failed to read raw row";
    throw new Error(message);
  }

  const payload = await response.json();
  const row = payload.values?.[0];
  if (!row) return null;

  return {
    rowIndex,
    rawDate: row[0] ?? "",
    rawLiftType: row[1] ?? "",
    reps: row[2] ?? "",
    weight: row[3] ?? "",
    notes: row[4] ?? "",
    url: row[5] ?? "",
  };
}

// A lift block interrupted by more non-set rows than this is not one the log
// page can have produced or shown.
const PROMOTION_SCAN_ROWS = 200;

/** The raw rows under a row, as far as an anchor promotion needs to look. */
export async function readRowsBelow({ ssid, rowIndex, headers }) {
  const range = `A${rowIndex + 1}:F${rowIndex + PROMOTION_SCAN_ROWS}`;
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${ssid}/values/${range}?majorDimension=ROWS`,
    { headers },
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = body?.error?.message || "Failed to read following rows";
    throw new Error(message);
  }

  const payload = await response.json();
  return payload.values ?? [];
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
 * @returns {{offset: number, date: string|null, liftType: string|null}|null}
 *   `offset` 0 is the row directly below.
 */
export function planAnchorPromotion(target, following) {
  for (let offset = 0; offset < following.length; offset += 1) {
    const row = following[offset] ?? [];
    const isSetRow = (row[2] ?? "") !== "" && (row[3] ?? "") !== "";
    if (!isSetRow) continue;

    const rawDate = row[0] ?? "";
    const rawLiftType = row[1] ?? "";
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
  return Object.keys(EDITABLE_COLUMN_CONFIG).filter(
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
export function isInsertedRowPresent(rawRow, values) {
  if (!rawRow || !Array.isArray(values)) return false;
  const cells = [
    rawRow.rawDate,
    rawRow.rawLiftType,
    rawRow.reps,
    rawRow.weight,
    rawRow.notes,
    rawRow.url,
  ];
  return cells.every(
    (cell, column) =>
      String(cell ?? "").trim() === String(values[column] ?? "").trim(),
  );
}

export async function verifyRowSnapshot({
  ssid,
  rowIndex,
  before,
  expectedAnchorType = null,
  headers,
}) {
  const actual = await readLogicalRow({ ssid, rowIndex, headers });
  const diffs = diffEditableSnapshot(actual, before);
  const actualAnchorType = getAnchorTypeFromLogicalRow(actual);

  if (
    !diffs.length &&
    (!expectedAnchorType || expectedAnchorType === actualAnchorType)
  ) {
    return { ok: true, actual, actualAnchorType };
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
                startColumnIndex: 4,
                endColumnIndex: 5,
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
