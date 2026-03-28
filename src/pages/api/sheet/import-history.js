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
import { classifySheetFlowError } from "@/lib/sheet-flow-errors";
import { promptDeveloper } from "@/pages/api/auth/[...nextauth]";
import { BIG_FOUR_LIFT_TYPES } from "@/lib/processing-utils";
import { getServerSession } from "next-auth/next";
import { gunzipSync } from "node:zlib";

export const config = {
  api: {
    // We parse the raw body ourselves so gzipped imports can bypass the default
    // 1 MB Next.js JSON body parser limit on this route.
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

function logImportEvent(phase, meta = {}) {
  console.log("[sheet/import]", {
    phase,
    ...meta,
  });
}

function buildGoogleApiFailure(body, fallbackMessage, httpStatus) {
  const classifiedError = classifySheetFlowError({
    message: body?.error?.message || fallbackMessage,
  });

  return {
    httpStatus: classifiedError.code ? classifiedError.httpStatus : httpStatus,
    payload: {
      error: classifiedError.userMessage || fallbackMessage,
      ...(classifiedError.code ? { errorCode: classifiedError.code } : {}),
    },
  };
}

function summarizeImportedEntries(entries = []) {
  const liftTypeCounts = new Map();
  const unitTypes = new Set();
  const dateSet = new Set();
  let minDate = null;
  let maxDate = null;
  let bigFourEntryCount = 0;
  let bigFourLiftCount = 0;

  for (const entry of entries) {
    const liftType = typeof entry?.liftType === "string" ? entry.liftType.trim() : "";
    if (liftType) {
      const nextCount = (liftTypeCounts.get(liftType) || 0) + 1;
      if (!liftTypeCounts.has(liftType) && BIG_FOUR_LIFT_TYPES.includes(liftType)) {
        bigFourLiftCount += 1;
      }
      liftTypeCounts.set(liftType, nextCount);
      if (BIG_FOUR_LIFT_TYPES.includes(liftType)) {
        bigFourEntryCount += 1;
      }
    }

    const unitType = typeof entry?.unitType === "string" ? entry.unitType.trim() : "";
    if (unitType) unitTypes.add(unitType);

    const date = typeof entry?.date === "string" ? entry.date.trim() : "";
    if (date) {
      dateSet.add(date);
      if (!minDate || date < minDate) minDate = date;
      if (!maxDate || date > maxDate) maxDate = date;
    }
  }

  const sortedLiftTypes = [...liftTypeCounts.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .slice(0, 3)
    .map(([liftType, count]) => `${liftType} (${count})`);

  let unitSystem = null;
  if (unitTypes.size === 1) {
    unitSystem = [...unitTypes][0];
  } else if (unitTypes.size > 1) {
    unitSystem = "mixed";
  }

  return {
    liftTypeCount: liftTypeCounts.size,
    bigFourEntryCount,
    bigFourLiftCount,
    unitSystem,
    dateCount: dateSet.size,
    dateRange:
      minDate && maxDate ? (minDate === maxDate ? minDate : `${minDate} to ${maxDate}`) : null,
    topLiftTypes: sortedLiftTypes.length > 0 ? sortedLiftTypes.join(", ") : null,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const startedAt = Date.now();

  let requestBody;
  let rawBody;
  try {
    rawBody = await readRequestBody(req);
    const isGzipped = String(req.headers["content-encoding"] || "")
      .toLowerCase()
      .includes("gzip");
    // Client imports may arrive gzipped; decode before normal JSON parsing so
    // the rest of the handler can stay unchanged.
    const decodedBody = isGzipped ? gunzipSync(rawBody) : rawBody;
    const payloadBytes = decodedBody.byteLength;
    logImportEvent("request_decoded", {
      compressedBytes: rawBody.byteLength,
      compressedMegabytes: Number((rawBody.byteLength / (1024 * 1024)).toFixed(3)),
      bytes: payloadBytes,
      megabytes: Number((payloadBytes / (1024 * 1024)).toFixed(3)),
      gzipped: isGzipped,
    });
    requestBody = JSON.parse(decodedBody.toString("utf8"));
  } catch (error) {
    logImportEvent("request_invalid", {
      durationMs: Date.now() - startedAt,
      error: error.message || "Could not decode request body",
    });
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
    logImportEvent("request_rejected", {
      durationMs: Date.now() - startedAt,
      hasSsid: Boolean(ssid),
      entryCount: Array.isArray(entries) ? entries.length : 0,
      reason: "missing_required_fields",
    });
    return res
      .status(400)
      .json({ error: "Missing required fields: ssid, entries" });
  }

  logImportEvent("request_validated", {
    ssid,
    entryCount: entries.length,
  });

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
      const failure = buildGoogleApiFailure(
        body,
        "Failed to read sheet metadata",
        metadataRes.status,
      );
      return res.status(failure.httpStatus).json(failure.payload);
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
      const failure = buildGoogleApiFailure(
        body,
        "Failed to read sheet",
        dataRes.status,
      );
      return res.status(failure.httpStatus).json(failure.payload);
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
        const failure = buildGoogleApiFailure(
          body,
          "Failed to import rows",
          insertRes.status,
        );
        return res.status(failure.httpStatus).json({
          ...failure.payload,
          insertedSoFar: 0,
        });
      }
    }

    const totalInserted = importJobs.reduce(
      (sum, job) => sum + job.rows.length,
      0,
    );

    logImportEvent("write_complete", {
      ssid,
      entryCount: entries.length,
      dateCount: sortedDates.length,
      insertedRows: totalInserted,
      batchRequestCount: batchRequests.length,
      durationMs: Date.now() - startedAt,
    });

    const durationMs = Date.now() - startedAt;
    // Founder email metadata is intentionally lightweight and support-oriented.
    // It exists only to help with user support and import health visibility.
    const founderMeta = summarizeImportedEntries(entries);

    res.status(200).json({
      ok: true,
      insertedRows: totalInserted,
      dateCount: sortedDates.length,
    });

    void promptDeveloper("import-merged", session.user, {
      entryCount: entries.length,
      insertedRows: totalInserted,
      dateCount: sortedDates.length,
      durationMs,
      ...founderMeta,
    });
    return;
  } catch (err) {
    logImportEvent("write_failed", {
      ssid,
      entryCount: Array.isArray(entries) ? entries.length : 0,
      durationMs: Date.now() - startedAt,
      error: err.message || "Internal server error",
    });
    return res.status(500).json({ error: "Internal server error" });
  }
}
