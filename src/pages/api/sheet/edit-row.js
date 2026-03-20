/**
 * Operation-oriented sheet API: edit-row
 *
 * This route exists for intentional multi-cell updates to an existing row. It
 * is not "RESTful update by resource"; it is a verified sheet-row operation.
 *
 * Safety strategy:
 * - Client sends rowIndex + before snapshot + after snapshot.
 * - Server verifies the current logical row still matches `before`.
 * - Server writes only the editable cells (C:F) once verification passes.
 *
 * This is primarily useful when a newly inserted optimistic row picked up a
 * real rowIndex and needs its queued local edits flushed in one go.
 */

import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { getServerSession } from "next-auth/next";
import { forceNotesPlainText, verifyRowSnapshot } from "@/lib/sheet-row-ops";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.accessToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { ssid, rowIndex, before, after } = req.body;

  if (!ssid || !rowIndex || typeof rowIndex !== "number" || !before || !after) {
    return res.status(400).json({ error: "Missing required fields: ssid, rowIndex, before, after" });
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
      headers,
    });

    if (!verification.ok) {
      console.warn("[sheet/edit-row] verification failed:", verification.message);
      return res.status(409).json({
        error: verification.message,
        code: "PRECONDITION_FAILED",
        actual: verification.actual,
      });
    }

    const range = `C${rowIndex}:F${rowIndex}`;
    const values = [[after.reps ?? "", after.weight ?? "", after.notes ?? "", after.url ?? ""]];
    const writeResponse = await fetch(
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

    if (!writeResponse.ok) {
      const body = await writeResponse.json().catch(() => ({}));
      const message = body?.error?.message || "Failed to update row";
      console.error("[sheet/edit-row] values.update failed:", message, { rowIndex, range });
      return res.status(writeResponse.status).json({ error: message });
    }

    if ((after.notes ?? "").length > 0) {
      await forceNotesPlainText({ ssid, rowIndex, headers });
    }

    return res.status(200).json({ updated: true, rowIndex });
  } catch (error) {
    console.error("[sheet/edit-row] unexpected error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
