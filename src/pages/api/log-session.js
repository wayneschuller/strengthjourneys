import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { getServerSession } from "next-auth/next";

// POST /api/log-session
// Inserts one or more rows into the sheet at a specified position.
//
// Body: {
//   ssid: string,
//   rows: string[][],              // exact cell values to write [A, B, C, D, E, F]
//   insertAfterRowIndex?: number,  // 1-based row to insert after. Defaults to 1 (after header).
//   newSession?: boolean,          // when true, draws a top border above the first row
// }
//
// Row column mapping: A=Date, B=LiftType, C=Reps, D=Weight, E=Notes, F=URL
// The client is responsible for constructing each row correctly:
//   - New session (no prior rows for this date): include date in A, lift type in B
//   - Adding a set to existing lift: leave A and B blank (inherited by the parser)
//   - Adding a new lift to existing session: leave A blank, set B to lift type
//
// Returns: { insertedRows: number, firstRowIndex: number }

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
  // 0-based startIndex for Sheets API = insertAfterRowIndex (see comment below).
  //
  // Conversion: "insert after 1-based row N" → "0-based startIndex = N"
  //   Header = row 1 (1-based) = index 0 (0-based)
  //   Insert after row 1 → startIndex 1 → new row becomes row 2 ✓
  //   Insert after row 7 → startIndex 7 → new row becomes row 8 ✓
  const insertAfter = typeof insertAfterRowIndex === "number" ? insertAfterRowIndex : 1;
  const startIndex0 = insertAfter; // 0-based start index for insertDimension

  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    "Content-Type": "application/json",
  };

  try {
    // Step 1: insert N empty rows at the target position.
    // If this is the first row of a new session, also draw a top border to
    // visually separate sessions in the sheet.
    // ─── Google Sheets formatting quirks ────────────────────────────────────────
    //
    // insertDimension.inheritFromBefore controls which neighbour's formatting the
    // new rows copy:
    //
    //   true  → copy from the row ABOVE the insertion point
    //           Problem: inserting right after the header row copies the header's
    //           grey background, bold font, etc. onto the new data rows.
    //
    //   false → copy from the row BELOW the insertion point
    //           Problem: if the row below starts a previous session it has a
    //           top border (our session separator). The new rows inherit that
    //           border, making them look like session separators themselves.
    //
    // Solution: use inheritFromBefore:false (row below is always a clean data row
    // or an empty sheet row — never the styled header), then ALWAYS explicitly
    // clear the top border on every inserted row to neutralise the border-from-below
    // risk. Finally, if this is a new session, stamp the separator border back onto
    // the very first inserted row only.
    //
    // ────────────────────────────────────────────────────────────────────────────

    const batchRequests = [
      {
        insertDimension: {
          range: {
            sheetId: 0,
            dimension: "ROWS",
            startIndex: startIndex0,
            endIndex: startIndex0 + rows.length,
          },
          // false = inherit from row below (clean data rows, not the header).
          // See note above for why this is preferred over true.
          inheritFromBefore: false,
        },
      },
      // Always clear the top border on ALL inserted rows.
      // Guards against the case where the row below has a session-separator
      // top border that would be inherited (see note above).
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
    ];

    if (newSession) {
      // Stamp the session-separator border onto the first inserted row only.
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
      console.error("[log-session] insertDimension failed:", msg);
      return res.status(insertRes.status).json({ error: msg });
    }

    // Step 2: write data into the newly inserted rows.
    // After insertion, the new rows start at 1-based row (insertAfter + 1).
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
      console.error("[log-session] values.update failed:", msg);
      return res.status(writeRes.status).json({ error: msg });
    }

    return res.status(200).json({
      insertedRows: rows.length,
      firstRowIndex: firstNewRow,
    });
  } catch (err) {
    console.error("[log-session] unexpected error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
