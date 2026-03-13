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
 * - Server also verifies the expected anchor type (session / lift / plain).
 * - Promotion is only allowed to the immediate next physical row.
 * - If any verification fails, deletion is rejected.
 *
 * This is still not atomic with Google Sheets. The point is fail-closed
 * protection, not a transactional guarantee.
 */

import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { getServerSession } from "next-auth/next";
import { verifyRowSnapshot } from "@/lib/sheet-row-ops";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.accessToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { ssid, rowIndex, before, expectedAnchorType, promoteTo } = req.body;

  if (!ssid || !rowIndex || typeof rowIndex !== "number" || !before) {
    return res.status(400).json({ error: "Missing required fields: ssid, rowIndex, before" });
  }

  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    "Content-Type": "application/json",
  };

  try {
    const verification = await verifyRowSnapshot({
      ssid,
      rowIndex,
      before,
      expectedAnchorType,
      headers,
    });

    if (!verification.ok) {
      console.warn("[sheet/delete-row] verification failed:", verification.message);
      return res.status(409).json({
        error: verification.message,
        code: "PRECONDITION_FAILED",
        actual: verification.actual,
      });
    }

    if (promoteTo?.rowIndex && promoteTo.rowIndex !== rowIndex + 1) {
      return res.status(409).json({
        error: `Delete promotion target must be the immediate next row. Expected ${rowIndex + 1}, received ${promoteTo.rowIndex}.`,
        code: "PRECONDITION_FAILED",
      });
    }

    if (promoteTo?.rowIndex) {
      const promoteRange = `A${promoteTo.rowIndex}:B${promoteTo.rowIndex}`;
      const promoteValues = [[promoteTo.date ?? "", promoteTo.liftType ?? ""]];
      const promoteResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${ssid}/values/${promoteRange}?valueInputOption=USER_ENTERED`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify({
            range: promoteRange,
            majorDimension: "ROWS",
            values: promoteValues,
          }),
        },
      );

      if (!promoteResponse.ok) {
        const body = await promoteResponse.json().catch(() => ({}));
        const message = body?.error?.message || "Failed to promote anchor data";
        console.error("[sheet/delete-row] promote failed:", message, { rowIndex, promoteTo });
        return res.status(promoteResponse.status).json({ error: message });
      }
    }

    const deleteResponse = await fetch(
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

    if (!deleteResponse.ok) {
      const body = await deleteResponse.json().catch(() => ({}));
      const message = body?.error?.message || "Failed to delete row";
      console.error("[sheet/delete-row] deleteDimension failed:", message, { rowIndex });
      return res.status(deleteResponse.status).json({ error: message });
    }

    return res.status(200).json({ deleted: true, rowIndex });
  } catch (error) {
    console.error("[sheet/delete-row] unexpected error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
