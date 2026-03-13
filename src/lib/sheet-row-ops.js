/**
 * Operation-oriented Google Sheets helpers for the log write APIs.
 *
 * This module is intentionally NOT organized around REST resources like
 * "sets" or "sessions". The sheet is the source of truth and the riskiest
 * failures happen at the sheet-row level, so the APIs are modeled around
 * explicit sheet operations:
 * - edit-cell
 * - edit-row
 * - insert-row
 * - delete-row
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

export const EDITABLE_COLUMN_CONFIG = {
  reps: { letter: "C", startColumnIndex: 2 },
  weight: { letter: "D", startColumnIndex: 3 },
  notes: { letter: "E", startColumnIndex: 4 },
  url: { letter: "F", startColumnIndex: 5 },
};

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
    const message = body?.error?.message || "Failed to read row for verification";
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

  if (!diffs.length && (!expectedAnchorType || expectedAnchorType === actualAnchorType)) {
    return { ok: true, actual, actualAnchorType };
  }

  const mismatchLines = diffs.map(
    (diff) => `${diff.key}: expected "${diff.expected}" but found "${diff.actual}"`,
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

export async function forceNotesPlainText({ ssid, rowIndex, headers }) {
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${ssid}:batchUpdate`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      requests: [
        {
          repeatCell: {
            range: {
              sheetId: 0,
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
  });
}
