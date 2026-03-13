/**
 * Operation-oriented sheet API: insert-row
 *
 * This route intentionally does not model rows as REST resources. In this
 * codebase the Google Sheet is a first-class user-visible document, so we keep
 * the API aligned to sheet operations instead:
 * - edit-cell
 * - edit-row
 * - insert-row
 * - delete-row
 *
 * `insert-row` is the structural write used for:
 * - appending a set to an existing lift block
 * - inserting a brand-new lift block for a date
 * - starting a brand-new session
 *
 * The client sends the exact row values to insert plus the insertion position.
 * This keeps creation row-oriented while edit-cell / edit-row stay focused on
 * non-structural updates.
 */

import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { getServerSession } from "next-auth/next";

// ─── Design principle: the sheet is a first-class artefact ──────────────────
//
// The user's Google Sheet is not just a data store — it is a living training
// log that the user opens, shares, and reads directly. Every API write must
// keep the sheet looking clean, aesthetic, and human-readable:
//
//   • Sparse encoding    — Date and Lift Type are only written on anchor rows;
//                          subsequent rows are intentionally blank so the sheet
//                          reads like a structured log, not a repetitive table.
//   • Session borders    — A bold top border is drawn above each new session's
//                          first row (the session anchor) to visually separate
//                          sessions at a glance.
//   • No stray styling   — Inserted rows must not inherit header backgrounds,
//                          borders, or other formatting from adjacent rows.
//                          See the insertDimension formatting notes below.
//
// When adding new write operations, always open the sheet afterwards and verify
// it still looks tidy. Formatting bugs are user-visible and matter.
//
// ─────────────────────────────────────────────────────────────────────────────

// ─── Sheet encoding: sparse rows and anchor rows ────────────────────────────
//
// The Google Sheet uses a SPARSE ENCODING to stay human-readable. Date (col A)
// and Lift Type (col B) are only written on "anchor rows" — the parser
// (`parse-data.js`) carries each value forward to subsequent blank cells.
//
// Sheet layout (newest session at top, header = row 1):
//
//   Row │ A (Date)    │ B (Lift Type)  │ C (Reps) │ D (Weight) │ …
//   ────┼─────────────┼────────────────┼──────────┼────────────┼───
//    2  │ 2026-03-08  │ Bench Press    │ 5        │ 20kg       │   ← session anchor
//    3  │             │                │ 3        │ 25kg       │   ← inherits date + liftType
//    4  │             │ Deadlift       │ 5        │ 100kg      │   ← lift anchor (new liftType)
//    5  │             │                │ 3        │ 120kg      │   ← inherits liftType
//    6  │ 2026-03-01  │ Bench Press    │ 5        │ 20kg       │   ← session anchor (prev session)
//
// ANCHOR ROW TYPES:
//   • Session anchor — first row of a date. Carries BOTH date (col A) and the
//     first lift type (col B). Visually separated from the session above it by
//     a bold top border drawn via updateBorders (see formatting notes below).
//   • Lift anchor    — first row of a lift type within a session (not the first
//     row of the session itself). Carries liftType (col B) only; date is blank
//     and inherited from the session anchor above.
//   • Plain set row  — any set after the first for a given lift type. Both A
//     and B are blank; date and liftType are inherited from above.
//
// INSERTION ORDER:
//   New sessions are inserted at the TOP (after the header row), so more recent
//   dates always have lower row indices. Sets are inserted after the last known
//   row of their lift type within the session.
//
// ─────────────────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.accessToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { ssid, rows, insertAfterRowIndex, newSession } = req.body;

  if (!ssid || !Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: "Missing required fields: ssid, rows" });
  }

  // insertAfterRowIndex is 1-based. Default: 1 (insert after the header row).
  // 0-based startIndex for Sheets API = insertAfterRowIndex.
  const insertAfter = typeof insertAfterRowIndex === "number" ? insertAfterRowIndex : 1;
  const startIndex0 = insertAfter;

  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    "Content-Type": "application/json",
  };

  try {
    // Step 1: insert N empty rows at the target position.
    //
    // Google Sheets formatting quirk:
    // - inheritFromBefore:true copies header styling when inserting after row 1
    // - inheritFromBefore:false can copy a top border from the row below
    //
    // We prefer false, then explicitly clear the top border on all inserted
    // rows, and stamp a new session border back onto the first inserted row
    // only when `newSession` is true.
    const batchRequests = [
      {
        insertDimension: {
          range: {
            sheetId: 0,
            dimension: "ROWS",
            startIndex: startIndex0,
            endIndex: startIndex0 + rows.length,
          },
          inheritFromBefore: false,
        },
      },
      {
        updateBorders: {
          range: {
            sheetId: 0,
            startRowIndex: startIndex0,
            endRowIndex: startIndex0 + rows.length,
            startColumnIndex: 0,
            endColumnIndex: 6,
          },
          top: { style: "NONE" },
        },
      },
      {
        repeatCell: {
          range: {
            sheetId: 0,
            startRowIndex: startIndex0,
            endRowIndex: startIndex0 + rows.length,
            startColumnIndex: 4,
            endColumnIndex: 5,
          },
          cell: {
            userEnteredFormat: {
              numberFormat: { type: "TEXT" },
              horizontalAlignment: "LEFT",
            },
          },
          fields: "userEnteredFormat.numberFormat,userEnteredFormat.horizontalAlignment",
        },
      },
    ];

    if (newSession) {
      batchRequests.push({
        updateBorders: {
          range: {
            sheetId: 0,
            startRowIndex: startIndex0,
            endRowIndex: startIndex0 + 1,
            startColumnIndex: 0,
            endColumnIndex: 6,
          },
          top: {
            style: "SOLID",
            color: { red: 0, green: 0, blue: 0 },
          },
        },
      });
    }

    const insertRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${ssid}:batchUpdate`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ requests: batchRequests }),
      },
    );

    if (!insertRes.ok) {
      const body = await insertRes.json().catch(() => ({}));
      const msg = body?.error?.message || "Failed to insert rows";
      console.error("[sheet/insert-row] insertDimension failed:", msg);
      return res.status(insertRes.status).json({ error: msg });
    }

    // Step 2: write data into the newly inserted rows.
    const firstNewRow = insertAfter + 1;
    const lastNewRow = insertAfter + rows.length;
    const range = `A${firstNewRow}:F${lastNewRow}`;

    const writeRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${ssid}/values/${range}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify({
          range,
          majorDimension: "ROWS",
          values: rows,
        }),
      },
    );

    if (!writeRes.ok) {
      const body = await writeRes.json().catch(() => ({}));
      const msg = body?.error?.message || "Failed to write row values";
      console.error("[sheet/insert-row] values.update failed:", msg);
      return res.status(writeRes.status).json({ error: msg });
    }

    return res.status(200).json({
      insertedRows: rows.length,
      firstRowIndex: firstNewRow,
    });
  } catch (err) {
    console.error("[sheet/insert-row] unexpected error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
