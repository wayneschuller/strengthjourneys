/**
 * Batch import historical lift entries into a user's Google Sheet.
 *
 * Accepts an array of entries, groups them by date, and inserts them
 * in chronological order (oldest first) at the correct sheet positions.
 * Each date group becomes a new session with a bold top border.
 *
 * POST body:
 *   { ssid, entries: [{ date, liftType, reps, weight, unitType }] }
 *
 * This route handles all the complexity of finding insertion positions
 * and building snapshots server-side, so the client doesn't need to.
 */

import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { getServerSession } from "next-auth/next";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.accessToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { ssid, entries } = req.body;

  if (!ssid || !Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: "Missing required fields: ssid, entries" });
  }

  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    "Content-Type": "application/json",
  };

  try {
    // Step 1: Read existing sheet data to find date positions
    const dataRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${ssid}/values/A:F?majorDimension=ROWS`,
      { headers },
    );
    if (!dataRes.ok) {
      const body = await dataRes.json().catch(() => ({}));
      return res.status(dataRes.status).json({
        error: body?.error?.message || "Failed to read sheet",
      });
    }
    const { values: sheetRows = [] } = await dataRes.json();

    // Build a map of date → highest row index (1-based, skipping header at index 0)
    // Sheet is newest-first: row index 1 = header, row 2+ = data
    // We carry forward dates through sparse rows
    const dateRowMap = []; // [{ date, rowIndex }] for all data rows
    let currentDate = null;
    for (let i = 1; i < sheetRows.length; i++) {
      const row = sheetRows[i];
      if (row?.[0]) currentDate = row[0]; // col A has a date
      if (currentDate) {
        dateRowMap.push({ date: currentDate, rowIndex: i + 1 }); // 1-based
      }
    }

    // Step 2: Group entries by date, sort oldest-first
    const byDate = {};
    for (const entry of entries) {
      if (!entry.date || !entry.liftType || !entry.weight) continue;
      if (!byDate[entry.date]) byDate[entry.date] = [];
      byDate[entry.date].push(entry);
    }
    const sortedDates = Object.keys(byDate).sort(); // ascending = oldest first

    let totalInserted = 0;
    let rowShift = 0; // cumulative shift from previous insertions

    // Step 3: Insert each date group, oldest first (highest row indices first)
    // Oldest dates go to the bottom of the sheet, so their insertions don't
    // shift the row indices needed for later (newer) date groups.
    for (const date of sortedDates) {
      const dateEntries = byDate[date];

      // Group by lift type within the date
      const liftOrder = [];
      const liftGroups = {};
      for (const entry of dateEntries) {
        if (!liftGroups[entry.liftType]) {
          liftGroups[entry.liftType] = [];
          liftOrder.push(entry.liftType);
        }
        liftGroups[entry.liftType].push(entry);
      }

      // Build sheet rows (sparse encoding)
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const importNote = `Strength Journeys import ${today}`;
      const rows = [];
      for (let li = 0; li < liftOrder.length; li++) {
        const liftType = liftOrder[li];
        const sets = liftGroups[liftType];
        for (let si = 0; si < sets.length; si++) {
          const s = sets[si];
          const isSessionAnchor = li === 0 && si === 0;
          const isLiftAnchor = si === 0 && li > 0;
          rows.push([
            isSessionAnchor ? date : "",
            isSessionAnchor || isLiftAnchor ? liftType : "",
            String(s.reps || 1),
            `${s.weight}${s.unitType || "kg"}`,
            importNote,
            "", // url
          ]);
        }
      }

      // Find insertion point: after the last row with a date newer than this one
      // Account for rows already shifted by previous insertions
      const newerRows = dateRowMap.filter((r) => r.date > date);
      let insertAfter;
      if (newerRows.length > 0) {
        // Insert after the highest rowIndex among newer rows
        const maxNewerRow = newerRows.reduce(
          (best, r) => (r.rowIndex > best.rowIndex ? r : best),
          newerRows[0],
        );
        insertAfter = maxNewerRow.rowIndex + rowShift;
      } else {
        // All existing data is older (or sheet is empty) — insert at top
        insertAfter = 1;
      }

      const startIndex0 = insertAfter;

      // Insert empty rows
      const batchRequests = [
        {
          insertDimension: {
            range: {
              sheetId: 0,
              dimension: "ROWS",
              startIndex: startIndex0,
              endIndex: startIndex0 + rows.length,
            },
            inheritFromBefore: false,
          },
        },
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
        {
          repeatCell: {
            range: {
              sheetId: 0,
              startRowIndex: startIndex0,
              endRowIndex: startIndex0 + rows.length,
              startColumnIndex: 4,
              endColumnIndex: 5,
            },
            cell: {
              userEnteredFormat: {
                numberFormat: { type: "TEXT" },
                horizontalAlignment: "LEFT",
              },
            },
            fields:
              "userEnteredFormat.numberFormat,userEnteredFormat.horizontalAlignment",
          },
        },
        // Session border
        {
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
        },
      ];

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
        return res.status(insertRes.status).json({
          error: body?.error?.message || "Failed to insert rows",
          insertedSoFar: totalInserted,
        });
      }

      // Write data
      const firstNewRow = insertAfter + 1;
      const lastNewRow = insertAfter + rows.length;
      const range = `A${firstNewRow}:F${lastNewRow}`;

      const writeRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${ssid}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify({ range, majorDimension: "ROWS", values: rows }),
        },
      );
      if (!writeRes.ok) {
        const body = await writeRes.json().catch(() => ({}));
        return res.status(writeRes.status).json({
          error: body?.error?.message || "Failed to write rows",
          insertedSoFar: totalInserted,
        });
      }

      totalInserted += rows.length;
      rowShift += rows.length;
    }

    return res.status(200).json({
      ok: true,
      insertedRows: totalInserted,
      dateCount: sortedDates.length,
    });
  } catch (err) {
    console.error("[sheet/import-history] error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
