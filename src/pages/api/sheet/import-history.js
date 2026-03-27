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
import { gunzipSync } from "node:zlib";

export const config = {
  api: {
    bodyParser: false,
  },
};

async function readRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let requestBody;
  let rawBody;
  try {
    rawBody = await readRequestBody(req);
    const isGzipped = String(req.headers["content-encoding"] || "")
      .toLowerCase()
      .includes("gzip");
    const decodedBody = isGzipped ? gunzipSync(rawBody) : rawBody;
    const payloadBytes = decodedBody.byteLength;
    console.log("[sheet/import-history] payload:size", {
      compressedBytes: rawBody.byteLength,
      compressedMegabytes: Number((rawBody.byteLength / (1024 * 1024)).toFixed(3)),
      bytes: payloadBytes,
      megabytes: Number((payloadBytes / (1024 * 1024)).toFixed(3)),
      gzipped: isGzipped,
    });
    requestBody = JSON.parse(decodedBody.toString("utf8"));
  } catch (error) {
    return res.status(400).json({
      error: "Invalid import payload",
      details: error.message || "Could not decode request body",
    });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.accessToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { ssid, entries } = requestBody;

  if (!ssid || !Array.isArray(entries) || entries.length === 0) {
    return res
      .status(400)
      .json({ error: "Missing required fields: ssid, entries" });
  }

  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    "Content-Type": "application/json",
  };

  try {
    // Step 1: Read sheet metadata + existing data to find date positions.
    // When inserting at the very bottom, Google Sheets requires
    // inheritFromBefore:true for insertDimension.
    const metadataRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${ssid}?fields=sheets(properties(sheetId,title,gridProperties(rowCount)))`,
      { headers },
    );
    if (!metadataRes.ok) {
      const body = await metadataRes.json().catch(() => ({}));
      return res.status(metadataRes.status).json({
        error: body?.error?.message || "Failed to read sheet metadata",
      });
    }
    const metadataPayload = await metadataRes.json().catch(() => ({}));
    const firstSheet = Array.isArray(metadataPayload?.sheets)
      ? metadataPayload.sheets[0]
      : null;
    const targetSheetId = firstSheet?.properties?.sheetId ?? 0;
    const targetGridRowCount =
      firstSheet?.properties?.gridProperties?.rowCount ?? 0;

    // Step 2: Read existing sheet data to find date positions
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

    // Step 3: Group entries by date, sort oldest-first
    const byDate = {};
    for (const entry of entries) {
      if (!entry.date || !entry.liftType || !entry.weight) continue;
      if (!byDate[entry.date]) byDate[entry.date] = [];
      byDate[entry.date].push(entry);
    }
    const sortedDates = Object.keys(byDate).sort(); // ascending = oldest first

    const importJobs = [];

    // Step 4: Build insertion jobs per date.
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
        insertAfter = maxNewerRow.rowIndex;
      } else {
        // All existing data is older (or sheet is empty) — insert at top
        insertAfter = 1;
      }

      importJobs.push({
        date,
        rows,
        startIndex0: insertAfter,
      });
    }

    // Step 5: Apply all inserts in one batch, working from the bottom upward.
    // Descending start indexes keep earlier requests from shifting the target
    // rows for later ones. For ties, oldest-first means later (newer) dates end
    // up above older ones after repeated inserts at the same boundary.
    importJobs.sort((a, b) => {
      if (b.startIndex0 !== a.startIndex0) {
        return b.startIndex0 - a.startIndex0;
      }
      return a.date.localeCompare(b.date);
    });

    let effectiveGridRowCount = targetGridRowCount;
    const batchRequests = [];

    for (const job of importJobs) {
      const isAppendingAtBottom = job.startIndex0 >= effectiveGridRowCount;

      batchRequests.push({
        insertDimension: {
          range: {
            sheetId: targetSheetId,
            dimension: "ROWS",
            startIndex: job.startIndex0,
            endIndex: job.startIndex0 + job.rows.length,
          },
          inheritFromBefore: isAppendingAtBottom,
        },
      });

      batchRequests.push({
        updateCells: {
          range: {
            sheetId: targetSheetId,
            startRowIndex: job.startIndex0,
            endRowIndex: job.startIndex0 + job.rows.length,
            startColumnIndex: 0,
            endColumnIndex: 6,
          },
          rows: job.rows.map((row) => ({
            values: row.map((value) => ({
              userEnteredValue: { stringValue: String(value ?? "") },
            })),
          })),
          fields: "userEnteredValue",
        },
      });

      batchRequests.push({
        updateBorders: {
          range: {
            sheetId: targetSheetId,
            startRowIndex: job.startIndex0,
            endRowIndex: job.startIndex0 + job.rows.length,
            startColumnIndex: 0,
            endColumnIndex: 6,
          },
          top: { style: "NONE" },
        },
      });

      batchRequests.push({
        repeatCell: {
          range: {
            sheetId: targetSheetId,
            startRowIndex: job.startIndex0,
            endRowIndex: job.startIndex0 + job.rows.length,
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
      });

      batchRequests.push({
        updateBorders: {
          range: {
            sheetId: targetSheetId,
            startRowIndex: job.startIndex0,
            endRowIndex: job.startIndex0 + 1,
            startColumnIndex: 0,
            endColumnIndex: 6,
          },
          top: {
            style: "SOLID",
            color: { red: 0, green: 0, blue: 0 },
          },
        },
      });

      effectiveGridRowCount += job.rows.length;
    }

    if (batchRequests.length > 0) {
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
          error: body?.error?.message || "Failed to import rows",
          insertedSoFar: 0,
        });
      }
    }

    const totalInserted = importJobs.reduce(
      (sum, job) => sum + job.rows.length,
      0,
    );

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
