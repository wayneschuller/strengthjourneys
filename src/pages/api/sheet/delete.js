/**
 * Operation-oriented sheet API: delete a complete training session.
 * The server verifies both known data endpoints and the entire date boundary
 * before allowing this destructive row-range mutation.
 */

import { getServerSession } from "next-auth/next";

import { diffEditableSnapshot, readFirstSheetId } from "@/lib/sheet-row-ops";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

// DELETE /api/sheet/delete
// Deletes all rows belonging to a session — everything from the session's first
// row through to (but not including) the next session's first row. This matches
// the "date umbrella" convention: blank rows, comment rows, and any other content
// between sessions are deleted along with the session's lift rows.
//
// The client computes the row range from parsedData (which has rowIndex on every
// entry), while the server independently verifies that the supplied bounds still
// describe exactly one session before deleting anything.
//
// Body: {
//   ssid: string,
//   startRowIndex: number,   // 1-based, inclusive — first row of the session
//   endRowIndex: number,     // 1-based, inclusive — last row of the umbrella
// }

export default async function handler(req, res) {
  if (req.method !== "DELETE") {
    res.setHeader("Allow", "DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.accessToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const {
    ssid,
    startRowIndex,
    endRowIndex,
    lastDataRowIndex,
    expectedDate,
    firstBefore,
    lastBefore,
  } = req.body;

  if (
    !ssid ||
    !Number.isInteger(startRowIndex) ||
    !Number.isInteger(endRowIndex) ||
    !Number.isInteger(lastDataRowIndex) ||
    startRowIndex < 2 || // row 1 is the header — never delete it
    lastDataRowIndex < startRowIndex ||
    endRowIndex < lastDataRowIndex ||
    !expectedDate ||
    !firstBefore ||
    !lastBefore
  ) {
    return res.status(400).json({
      error:
        "Missing or invalid fields: ssid, startRowIndex, endRowIndex, lastDataRowIndex, expectedDate, firstBefore, lastBefore",
    });
  }

  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    "Content-Type": "application/json",
  };

  try {
    const targetSheetId = await readFirstSheetId({ ssid, headers });
    const verificationRange = `A2:F${endRowIndex + 1}`;
    const readRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${ssid}/values/${verificationRange}?majorDimension=ROWS`,
      { headers },
    );
    if (!readRes.ok) {
      const body = await readRes.json().catch(() => ({}));
      const message = body?.error?.message || "Failed to verify session rows";
      return res.status(readRes.status).json({ error: message });
    }

    const readData = await readRes.json();
    const rows = readData.values ?? [];
    const logicalRows = buildLogicalRows(rows);
    const firstActual = logicalRows[startRowIndex - 2] ?? emptyLogicalRow();
    const lastActual = logicalRows[lastDataRowIndex - 2] ?? emptyLogicalRow();
    const firstDiffs = diffEditableSnapshot(firstActual, firstBefore);
    const lastDiffs = diffEditableSnapshot(lastActual, lastBefore);
    const explicitDates = logicalRows
      .slice(startRowIndex - 2, endRowIndex - 1)
      .map((row) => row.rawDate)
      .filter(Boolean);
    const nextRow = logicalRows[endRowIndex - 1] ?? null;
    const rangeHasForeignDate = explicitDates.some(
      (date) => date !== expectedDate,
    );
    const nextRowBreaksBoundary =
      nextRow && (!nextRow.rawDate || nextRow.rawDate === expectedDate);

    if (
      firstActual.rawDate !== expectedDate ||
      firstDiffs.length ||
      lastDiffs.length ||
      rangeHasForeignDate ||
      nextRowBreaksBoundary
    ) {
      const warning = `Session delete preflight failed for rows ${startRowIndex}-${endRowIndex}`;
      console.warn("[sheet/delete] BLOCKING:", warning, {
        firstDiffs,
        lastDiffs,
        explicitDates,
        nextRawDate: nextRow?.rawDate ?? null,
      });
      return res.status(409).json({
        error:
          "Session rows changed before deletion. Refresh the log and try again.",
        code: "PRECONDITION_FAILED",
        warning,
        actual: { first: firstActual, last: lastActual },
      });
    }

    // Sheets API deleteRange uses 0-based startRowIndex (inclusive) and endRowIndex (exclusive)
    const deleteRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${ssid}:batchUpdate`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          requests: [
            {
              deleteRange: {
                range: {
                  sheetId: targetSheetId,
                  startRowIndex: startRowIndex - 1, // convert 1-based → 0-based
                  endRowIndex: endRowIndex, // 1-based inclusive → 0-based exclusive
                },
                shiftDimension: "ROWS",
              },
            },
          ],
        }),
      },
    );

    if (!deleteRes.ok) {
      const body = await deleteRes.json().catch(() => ({}));
      const msg = body?.error?.message || "Failed to delete session rows";
      console.error("[sheet/delete] deleteRange failed:", msg, {
        startRowIndex,
        endRowIndex,
      });
      return res.status(deleteRes.status).json({ error: msg });
    }

    return res.status(200).json({
      deleted: true,
      rowsDeleted: endRowIndex - startRowIndex + 1,
    });
  } catch (err) {
    console.error("[sheet/delete] unexpected error:", err);
    return res
      .status(500)
      .json({ error: err.message || "Internal server error" });
  }
}

function buildLogicalRows(rows) {
  let inheritedDate = "";
  let inheritedLiftType = "";

  return rows.map((row = []) => {
    if (row[0]) inheritedDate = row[0];
    if (row[1]) inheritedLiftType = row[1];
    return {
      rawDate: row[0] ?? "",
      rawLiftType: row[1] ?? "",
      date: inheritedDate,
      liftType: inheritedLiftType,
      reps: row[2] ?? "",
      weight: row[3] ?? "",
      notes: row[4] ?? "",
      url: row[5] ?? "",
    };
  });
}

function emptyLogicalRow() {
  return {
    rawDate: "",
    rawLiftType: "",
    date: "",
    liftType: "",
    reps: "",
    weight: "",
    notes: "",
    url: "",
  };
}
