/**
 * Operation-oriented sheet API: edit-row
 *
 * This route exists for intentional multi-cell updates to an existing row. It
 * is not "RESTful update by resource"; it is a verified sheet-row operation.
 *
 * Safety strategy:
 * - Client sends rowIndex + before snapshot + after snapshot, and the column
 *   map its parse found, so a sheet laid out the lifter's own way is edited in
 *   its own columns.
 * - Server checks that map against row 1, then verifies the current logical
 *   row still matches `before`.
 * - Server writes only the cells that differ between the two, in one request,
 *   so cells the lifter did not touch keep their own text.
 *
 * It is safe to send twice. A client that never heard back sends the same
 * edit again; a row that already reads as `after` is answered as done rather
 * than rejected. The log page sends every field edit through here.
 */

import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { getServerSession } from "next-auth/next";
import {
  columnLetter,
  diffEditableSnapshot,
  forceNotesPlainText,
  getChangedEditableFields,
  startFirstSheetIdLookup,
  verifyRowSnapshot,
} from "@/lib/sheet/sheet-row-ops";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.accessToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { ssid, rowIndex, before, after, columns: requestedColumns } = req.body;

  if (!ssid || !rowIndex || typeof rowIndex !== "number" || !before || !after) {
    return res.status(400).json({
      error: "Missing required fields: ssid, rowIndex, before, after",
    });
  }

  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    "Content-Type": "application/json",
  };

  try {
    const changedFields = getChangedEditableFields(before, after);
    if (!changedFields.length) {
      return res.status(200).json({ updated: false, rowIndex });
    }
    // Notes get plain-text formatting after the write, which needs the tab
    // ID. Start that lookup now so it overlaps verification and the write.
    const needsNotesFormat =
      changedFields.includes("notes") && (after.notes ?? "").length > 0;
    const sheetIdLookup = needsNotesFormat
      ? startFirstSheetIdLookup({ ssid, headers })
      : null;
    const verification = await verifyRowSnapshot({
      ssid,
      rowIndex,
      before,
      headers,
      columns: requestedColumns,
    });

    if (!verification.ok) {
      // The row already holds this edit: an earlier send landed and only its
      // response was lost.
      if (
        verification.actual &&
        !diffEditableSnapshot(verification.actual, after).length
      ) {
        return res
          .status(200)
          .json({ updated: true, rowIndex, alreadyApplied: true });
      }
      console.warn(
        "[sheet/edit-row] verification failed:",
        verification.message,
      );
      return res.status(409).json({
        error: verification.message,
        code: "PRECONDITION_FAILED",
        actual: verification.actual,
      });
    }

    // Each changed field goes to the sheet's own column for it. A field the
    // sheet has no column for has nowhere to be written.
    const { columns } = verification;
    const writableFields = changedFields.filter(
      (field) => columns[field] !== null,
    );
    if (!writableFields.length) {
      return res.status(200).json({ updated: false, rowIndex });
    }
    const writeResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${ssid}/values:batchUpdate`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          valueInputOption: "USER_ENTERED",
          data: writableFields.map((field) => ({
            range: `${columnLetter(columns[field])}${rowIndex}`,
            majorDimension: "ROWS",
            values: [[after[field] ?? ""]],
          })),
        }),
      },
    );

    if (!writeResponse.ok) {
      const body = await writeResponse.json().catch(() => ({}));
      const message = body?.error?.message || "Failed to update row";
      console.error("[sheet/edit-row] values.batchUpdate failed:", message, {
        rowIndex,
        writableFields,
      });
      return res.status(writeResponse.status).json({ error: message });
    }

    if (needsNotesFormat && columns.notes !== null) {
      await forceNotesPlainText({
        ssid,
        rowIndex,
        headers,
        sheetIdLookup,
        notesColumn: columns.notes,
      });
    }

    return res.status(200).json({ updated: true, rowIndex });
  } catch (error) {
    console.error("[sheet/edit-row] unexpected error:", error);
    return res
      .status(500)
      .json({ error: error.message || "Internal server error" });
  }
}
