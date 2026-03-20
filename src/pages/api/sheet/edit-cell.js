/**
 * Operation-oriented sheet API: edit-cell
 *
 * This route is intentionally NOT a generic REST "update set" endpoint. The
 * sheet is a user-visible artifact with sparse anchor rows, so we model writes
 * as explicit sheet operations instead of pretending rows are stable REST
 * resources.
 *
 * Safety strategy:
 * - The client sends the target rowIndex plus a "before" snapshot.
 * - The server pre-reads that exact row and verifies the logical row snapshot.
 * - If verification fails, the write is rejected.
 * - We never search for a "similar" row elsewhere in the sheet.
 *
 * This flow is not atomic with Google Sheets. The extra read is a fail-safe and
 * observability layer, not a transactional guarantee.
 */

import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { getServerSession } from "next-auth/next";
import {
  EDITABLE_COLUMN_CONFIG,
  forceNotesPlainText,
  verifyRowSnapshot,
} from "@/lib/sheet-row-ops";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.accessToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { ssid, rowIndex, field, value, before } = req.body;

  if (!ssid || !rowIndex || typeof rowIndex !== "number" || !field || !before) {
    return res.status(400).json({ error: "Missing required fields: ssid, rowIndex, field, value, before" });
  }

  const config = EDITABLE_COLUMN_CONFIG[field];
  if (!config) {
    return res.status(400).json({ error: `Unsupported editable field: ${field}` });
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
      console.warn("[sheet/edit-cell] verification failed:", verification.message);
      return res.status(409).json({
        error: verification.message,
        code: "PRECONDITION_FAILED",
        actual: verification.actual,
      });
    }

    const range = `${config.letter}${rowIndex}`;
    const writeResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${ssid}/values/${range}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify({
          range,
          majorDimension: "ROWS",
          values: [[value != null ? String(value) : ""]],
        }),
      },
    );

    if (!writeResponse.ok) {
      const body = await writeResponse.json().catch(() => ({}));
      const message = body?.error?.message || "Failed to update cell";
      console.error("[sheet/edit-cell] values.update failed:", message, { rowIndex, field });
      return res.status(writeResponse.status).json({ error: message });
    }

    if (field === "notes" && value != null && String(value).length > 0) {
      await forceNotesPlainText({ ssid, rowIndex, headers });
    }

    return res.status(200).json({ updated: true, rowIndex, field });
  } catch (error) {
    console.error("[sheet/edit-cell] unexpected error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
