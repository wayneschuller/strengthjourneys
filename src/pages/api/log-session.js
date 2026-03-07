import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { getServerSession } from "next-auth/next";

// POST /api/log-session
// Inserts a new session's rows at the top of the sheet (below the header row).
//
// Body: {
//   ssid: string,
//   date: "YYYY-MM-DD",
//   lifts: [{ liftType: string, sets: [{ reps: number, weight: string, notes?: string, url?: string }] }]
// }
//
// Returns: { insertedRows: number, firstRowIndex: number }
// firstRowIndex is the 1-based sheet row of the first inserted row (always 2).

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.accessToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { ssid, date, lifts } = req.body;

  if (!ssid || !date || !Array.isArray(lifts) || lifts.length === 0) {
    return res.status(400).json({ error: "Missing required fields: ssid, date, lifts" });
  }

  // Flatten lifts into sheet rows.
  // Convention: date only on first row; lift type on first set of each lift.
  const rows = [];
  lifts.forEach((lift, liftIndex) => {
    if (!lift.sets?.length) return;
    lift.sets.forEach((set, setIndex) => {
      const isFirstRow = liftIndex === 0 && setIndex === 0;
      const isFirstSetOfLift = setIndex === 0;
      rows.push([
        isFirstRow ? date : "",
        isFirstSetOfLift ? (lift.liftType ?? "") : "",
        set.reps != null ? String(set.reps) : "",
        set.weight != null ? String(set.weight) : "",
        set.notes ?? "",
        set.url ?? "",
      ]);
    });
  });

  if (rows.length === 0) {
    return res.status(400).json({ error: "No valid sets to insert" });
  }

  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    "Content-Type": "application/json",
  };

  try {
    // Step 1: insert N empty rows below the header (row 1) via batchUpdate
    const insertRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${ssid}:batchUpdate`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          requests: [
            {
              insertDimension: {
                range: {
                  sheetId: 0,
                  dimension: "ROWS",
                  startIndex: 1, // 0-based: insert after row 1 (the header)
                  endIndex: 1 + rows.length,
                },
                inheritFromBefore: false,
              },
            },
          ],
        }),
      },
    );

    if (!insertRes.ok) {
      const body = await insertRes.json().catch(() => ({}));
      const msg = body?.error?.message || "Failed to insert rows";
      console.error("[log-session] insertDimension failed:", msg);
      return res.status(insertRes.status).json({ error: msg });
    }

    // Step 2: fill the inserted rows with data
    const endRow = 1 + rows.length; // row 2 to row (1 + rows.length), 1-based inclusive
    const range = `A2:F${endRow}`;

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
      firstRowIndex: 2, // always row 2 (below header) since we prepend
    });
  } catch (err) {
    console.error("[log-session] unexpected error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
