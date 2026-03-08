import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { getServerSession } from "next-auth/next";

// Sheet encoding: see the "sparse rows and anchor rows" block comment at the
// top of insert-sheet.js for the full data model (anchor rows, inheritance, etc.).

// PATCH /api/edit-sheet
// Updates reps and/or weight (and optionally notes/url) for a single set row,
// identified by its 1-based rowIndex in the sheet.
//
// Body: {
//   ssid: string,
//   rowIndex: number,       // 1-based sheet row number
//   reps?: number,
//   weight?: string,        // e.g. "102.5kg"
//   notes?: string,
//   url?: string,
// }
//
// Only updates columns C–F (Reps, Weight, Notes, URL).
// Date (col A) and Lift Type (col B) are never modified by this route —
// they are anchor values managed by insert-sheet.js (insert) and handleDelete (delete).

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
      console.error("[edit-sheet] values.update failed:", msg, { rowIndex, range });
      return res.status(writeRes.status).json({ error: msg });
    }

    return res.status(200).json({ updated: true, rowIndex });
  } catch (err) {
    console.error("[edit-sheet] unexpected error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}

// DELETE /api/edit-sheet
// Deletes a single set row from the sheet.
//
// Body: {
//   ssid: string,
//   rowIndex: number,          // 1-based row to delete
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

  const { ssid, rowIndex, promoteTo } = req.body;

  if (!ssid || !rowIndex || typeof rowIndex !== "number") {
    return res.status(400).json({ error: "Missing required fields: ssid, rowIndex" });
  }

  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    "Content-Type": "application/json",
  };

  try {
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
        console.error("[edit-sheet DELETE] promote failed:", msg);
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
      console.error("[edit-sheet DELETE] deleteDimension failed:", msg);
      return res.status(deleteRes.status).json({ error: msg });
    }

    return res.status(200).json({ deleted: true, rowIndex });
  } catch (err) {
    console.error("[edit-sheet DELETE] unexpected error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
