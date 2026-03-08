import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { getServerSession } from "next-auth/next";

// Sheet encoding: see the "sparse rows and anchor rows" block comment at the
// top of sheet/log-session.js for the full data model (anchor rows, inheritance, etc.).

// PATCH /api/sheet/log-set
// Updates one set row in place — reps, weight, notes, and/or URL.
// Only writes columns C–F. Columns A (Date) and B (Lift Type) are anchor values
// that control sparse-encoding inheritance and are never touched here.
//
// Body: {
//   ssid: string,
//   rowIndex: number,   // 1-based sheet row number (from LiftEntry.rowIndex)
//   reps?: number,
//   weight?: string,    // e.g. "102.5kg" — must include unit suffix
//   notes?: string,
//   url?: string,
// }
//
// Returns: { updated: true, rowIndex }
//
// ─────────────────────────────────────────────────────────────────────────────
//
// DELETE /api/sheet/log-set
// Deletes a single set row. Handles anchor-row promotion so that date/liftType
// inheritance stays intact after deletion.
//
// If the deleted row is an anchor (carries date or liftType in cols A/B that
// downstream rows inherit), the client identifies the next row that will become
// the new anchor and sends its values in `promoteTo`. The API writes those values
// BEFORE deleting, because deleteDimension shifts all row indices below the
// deletion point up by one.
//
// Body: {
//   ssid: string,
//   rowIndex: number,       // 1-based row to delete
//   promoteTo?: {
//     rowIndex: number,     // 1-based row that becomes the new anchor
//     date?: string,        // write if the deleted row was a session anchor
//     liftType?: string,    // write if the deleted row was a lift anchor
//   }
// }
//
// Returns: { deleted: true, rowIndex }

export default async function handler(req, res) {
  if (req.method === "DELETE") return handleDelete(req, res);
  if (req.method !== "PATCH") {
    res.setHeader("Allow", "PATCH, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.accessToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { ssid, rowIndex, reps, weight, notes, url } = req.body;

  if (!ssid || !rowIndex || typeof rowIndex !== "number") {
    return res.status(400).json({ error: "Missing required fields: ssid, rowIndex" });
  }

  // Build the values array for columns C–F
  // We always write all four cells so the row stays consistent
  const values = [
    [
      reps != null ? String(reps) : "",
      weight != null ? String(weight) : "",
      notes != null ? String(notes) : "",
      url != null ? String(url) : "",
    ],
  ];

  // Columns C–F at the specified row
  const range = `C${rowIndex}:F${rowIndex}`;

  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    "Content-Type": "application/json",
  };

  try {
    const writeRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${ssid}/values/${range}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify({
          range,
          majorDimension: "ROWS",
          values,
        }),
      },
    );

    if (!writeRes.ok) {
      const body = await writeRes.json().catch(() => ({}));
      const msg = body?.error?.message || "Failed to update set";
      console.error("[sheet/log-set] values.update failed:", msg, { rowIndex, range });
      return res.status(writeRes.status).json({ error: msg });
    }

    return res.status(200).json({ updated: true, rowIndex });
  } catch (err) {
    console.error("[sheet/log-set] unexpected error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}

// DELETE /api/sheet/log-set
// Deletes a single set row from the sheet.
//
// Body: {
//   ssid: string,
//   rowIndex: number,          // 1-based row to delete
//   expectedDate?: string,     // YYYY-MM-DD — if provided, pre-read verifies the row
//                               // belongs to this session before deleting
//   promoteTo?: {              // if the deleted row is an anchor row (has date/liftType
//     rowIndex: number,        // in cols A/B that downstream rows inherit), write those
//     date?: string,           // values to this row BEFORE deleting, so the next row
//     liftType?: string,       // correctly becomes the new anchor.
//   }
// }
//
// Anchor row examples:
//   - Deleting first row of a session: promotes date + liftType to row below.
//   - Deleting first row of a lift type (not first of session): promotes liftType only.
//   - Deleting any other set: no promotion needed.
//
// The promotion write happens BEFORE the deleteDimension so we use the original
// row indices (deletion shifts all rows below it up by 1).
async function handleDelete(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.accessToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { ssid, rowIndex, expectedDate, promoteTo } = req.body;

  if (!ssid || !rowIndex || typeof rowIndex !== "number") {
    return res.status(400).json({ error: "Missing required fields: ssid, rowIndex" });
  }

  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    "Content-Type": "application/json",
  };

  let indexDriftWarning = null;

  try {
    // Step 0: Pre-read the target row to detect index drift.
    // If the row's date doesn't match what the client expects, we still proceed
    // (observability only) but return a warning so the client can surface it.
    if (expectedDate) {
      const readRange = `A${rowIndex}:B${rowIndex}`;
      const readRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${ssid}/values/${readRange}`,
        { headers },
      );
      if (readRes.ok) {
        const readData = await readRes.json();
        const cellDate = readData.values?.[0]?.[0] ?? "";
        const cellLift = readData.values?.[0]?.[1] ?? "";
        // Non-anchor rows have empty date cells (inherited from above), which is fine.
        // Only flag when the cell has a DIFFERENT date — that means index drift.
        if (cellDate && cellDate !== expectedDate) {
          indexDriftWarning = `Index drift: row ${rowIndex} has date "${cellDate}" but client expected "${expectedDate}" (liftType in cell: "${cellLift}")`;
          console.warn("[sheet/log-set DELETE]", indexDriftWarning);
        }
      }
    }

    // Step 1: Promote date/liftType to the next anchor row if needed.
    // This must happen before deletion since deletion shifts all row indices below.
    if (promoteTo?.rowIndex) {
      const promoteRange = `A${promoteTo.rowIndex}:B${promoteTo.rowIndex}`;
      const promoteValues = [[promoteTo.date ?? "", promoteTo.liftType ?? ""]];
      const promoteRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${ssid}/values/${promoteRange}?valueInputOption=USER_ENTERED`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify({ range: promoteRange, majorDimension: "ROWS", values: promoteValues }),
        },
      );
      if (!promoteRes.ok) {
        const body = await promoteRes.json().catch(() => ({}));
        const msg = body?.error?.message || "Failed to promote anchor data";
        console.error("[sheet/log-set DELETE] promote failed:", msg);
        return res.status(promoteRes.status).json({ error: msg });
      }
    }

    // Step 2: Delete the row. 1-based rowIndex → 0-based startIndex.
    const deleteRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${ssid}:batchUpdate`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: 0,
                  dimension: "ROWS",
                  startIndex: rowIndex - 1,
                  endIndex: rowIndex,
                },
              },
            },
          ],
        }),
      },
    );

    if (!deleteRes.ok) {
      const body = await deleteRes.json().catch(() => ({}));
      const msg = body?.error?.message || "Failed to delete row";
      console.error("[sheet/log-set DELETE] deleteDimension failed:", msg);
      return res.status(deleteRes.status).json({ error: msg });
    }

    return res.status(200).json({ deleted: true, rowIndex, ...(indexDriftWarning && { warning: indexDriftWarning }) });
  } catch (err) {
    console.error("[sheet/log-set DELETE] unexpected error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
