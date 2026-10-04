/**
 * Operation-oriented sheet API: delete-row
 *
 * Delete is intentionally separated from ordinary edits because it is the
 * highest-risk mutation in this sheet model. Deleting the wrong row can strip
 * inherited date/liftType context from many rows below it.
 *
 * Safety strategy:
 * - Client sends the exact target rowIndex plus a `before` snapshot.
 * - Server verifies that exact row still matches the expected logical row.
 * - Server then finds the next set row below and promotes onto it only the
 *   Date / Lift Type it would actually lose after deletion, leaving any cell
 *   that row fills itself untouched.
 * - Promotion and deletion are sent to Google as one batch.
 * - This keeps delete safe for both sparse sheets and "redundant" sheets where
 *   users manually repeat Date / Lift Type on every row.
 * - If verification fails, deletion is rejected.
 *
 * This is still not atomic with Google Sheets. The point is fail-closed
 * protection, not a transactional guarantee.
 */

import { getServerSession } from "next-auth/next";

import {
  planAnchorPromotion,
  readRowsBelow,
  startFirstSheetIdLookup,
  verifyRowSnapshot,
} from "@/lib/sheet/sheet-row-ops";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.accessToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { ssid, rowIndex, before } = req.body;

  if (!ssid || !rowIndex || typeof rowIndex !== "number" || !before) {
    return res
      .status(400)
      .json({ error: "Missing required fields: ssid, rowIndex, before" });
  }

  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    "Content-Type": "application/json",
  };

  try {
    // Runs alongside verification; awaited just before the row is deleted.
    const sheetIdLookup = startFirstSheetIdLookup({ ssid, headers });
    const verification = await verifyRowSnapshot({
      ssid,
      rowIndex,
      before,
      headers,
    });

    if (!verification.ok) {
      console.warn(
        "[sheet/delete-row] verification failed:",
        verification.message,
      );
      return res.status(409).json({
        error: verification.message,
        code: "PRECONDITION_FAILED",
        actual: verification.actual,
      });
    }

    const targetSheetId = await sheetIdLookup;

    // Deletion safety is based on what the next SET ROW would lose, not on
    // whether the target row "looks like" an anchor in the UI. Blank and
    // note-only rows are passed over: the parser never reads Date or Lift Type
    // from them, so an anchor promoted onto one would leave the sets below it
    // belonging to the session above.
    let promoteTo = null;
    const promotion = planAnchorPromotion(
      verification.actual,
      await readRowsBelow({ ssid, rowIndex, headers }),
    );
    if (promotion) {
      promoteTo = {
        rowIndex: rowIndex + 1 + promotion.offset,
        date: promotion.date,
        liftType: promotion.liftType,
      };
    }

    // The heir takes over the deleted row's own Date / Lift Type cells, copied
    // as they stand so a real date stays a date. Promotion and deletion go in
    // one batch: Google applies both or neither, so a failure cannot leave an
    // anchor promoted under a row that is still there.
    const requests = [];
    if (promoteTo) {
      const heirRowIndex0 = promoteTo.rowIndex - 1;
      for (const [columnIndex, value] of [
        [0, promoteTo.date],
        [1, promoteTo.liftType],
      ]) {
        if (value === null) continue;
        requests.push({
          copyPaste: {
            source: {
              sheetId: targetSheetId,
              startRowIndex: rowIndex - 1,
              endRowIndex: rowIndex,
              startColumnIndex: columnIndex,
              endColumnIndex: columnIndex + 1,
            },
            destination: {
              sheetId: targetSheetId,
              startRowIndex: heirRowIndex0,
              endRowIndex: heirRowIndex0 + 1,
              startColumnIndex: columnIndex,
              endColumnIndex: columnIndex + 1,
            },
            pasteType: "PASTE_NO_BORDERS",
          },
        });
      }
    }
    requests.push({
      deleteDimension: {
        range: {
          sheetId: targetSheetId,
          dimension: "ROWS",
          startIndex: rowIndex - 1,
          endIndex: rowIndex,
        },
      },
    });

    const deleteResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${ssid}:batchUpdate`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ requests }),
      },
    );

    if (!deleteResponse.ok) {
      const body = await deleteResponse.json().catch(() => ({}));
      const message = body?.error?.message || "Failed to delete row";
      console.error("[sheet/delete-row] batchUpdate failed:", message, {
        rowIndex,
        promoteTo,
      });
      return res.status(deleteResponse.status).json({ error: message });
    }

    return res.status(200).json({ deleted: true, rowIndex, promoteTo });
  } catch (error) {
    console.error("[sheet/delete-row] unexpected error:", error);
    return res
      .status(500)
      .json({ error: error.message || "Internal server error" });
  }
}
