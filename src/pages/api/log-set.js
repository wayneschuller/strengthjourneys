import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { getServerSession } from "next-auth/next";

// PATCH /api/log-set
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
// Date (col A) and Lift Type (col B) are never modified by this route.

export default async function handler(req, res) {
  if (req.method !== "PATCH") {
    res.setHeader("Allow", "PATCH");
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
      console.error("[log-set] values.update failed:", msg, { rowIndex, range });
      return res.status(writeRes.status).json({ error: msg });
    }

    return res.status(200).json({ updated: true, rowIndex });
  } catch (err) {
    console.error("[log-set] unexpected error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
