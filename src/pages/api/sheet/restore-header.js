/**
 * Operation-oriented sheet API: restore-header
 *
 * Puts back the headings a lifting log needs in row 1: a whole header row
 * above a sheet that starts straight in with data, or the name of a required
 * column whose heading cell is blank.
 *
 * It earns its own operation because it is the only write that touches row 1
 * of an existing sheet, and the only one the app makes without being asked.
 * The app can read such a sheet by working its columns out from what is in
 * them, but nothing can be logged to it, merged into it or linked from another
 * device until the headings are back. Rather than leave the lifter a chore,
 * the client calls this once, then tells them what was done. Google Sheets
 * keeps the version history if they would rather it had not.
 *
 * Safety strategy:
 * - The client says what it expects to be repaired, from its own reading of
 *   the whole sheet. Nothing is taken from that but agreement.
 * - The server reads the top of the sheet and works the repair out again with
 *   the same detection. If the two differ, or the server finds nothing to
 *   repair (another tab got there first), nothing is written.
 * - Only blank cells are filled, or one row added above the data. A heading
 *   the lifter wrote is never replaced.
 * - Inserting the row and writing its headings is one batch: both or neither.
 */

import { getServerSession } from "next-auth/next";

import {
  detectSheetLayout,
  planHeaderRepair,
} from "@/lib/import/parsers/strength-journeys-parser";
import {
  columnLetter,
  readSheetRows,
  startFirstSheetIdLookup,
} from "@/lib/sheet/sheet-row-ops";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

// Enough rows to tell the columns apart; the client has checked all of them.
const SAMPLE_ROWS = 200;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.accessToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { ssid, expected } = req.body;
  if (!ssid || !expected || !Array.isArray(expected.headings)) {
    return res
      .status(400)
      .json({ error: "Missing required fields: ssid, expected" });
  }

  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    "Content-Type": "application/json",
  };

  try {
    // Only an inserted row needs the tab's ID; the lookup overlaps the read.
    const sheetIdLookup = startFirstSheetIdLookup({ ssid, headers });
    const rows = await readSheetRows({
      ssid,
      headers,
      fromRow: 1,
      toRow: SAMPLE_ROWS,
    });
    const plan = planHeaderRepair(detectSheetLayout(rows), rows);
    if (!plan) {
      return res.status(200).json({ repaired: false, reason: "in-order" });
    }

    // Keep the headings both readings agree on. The four required ones must
    // all be among them, or the two readings are of different sheets.
    const agreed = plan.headings.filter((heading) =>
      expected.headings.some(
        (other) =>
          other?.column === heading.column && other?.name === heading.name,
      ),
    );
    const requiredInPlan = plan.headings.filter((heading) =>
      REQUIRED_NAMES.includes(heading.name),
    );
    if (
      Boolean(expected.insertRow) !== plan.insertRow ||
      requiredInPlan.some((heading) => !agreed.includes(heading)) ||
      !agreed.length
    ) {
      return res.status(409).json({
        repaired: false,
        error: "The sheet no longer looks the way the repair expected.",
        code: "PRECONDITION_FAILED",
      });
    }

    const response = plan.insertRow
      ? await insertHeaderRow({
          ssid,
          headers,
          sheetId: await sheetIdLookup,
          headings: agreed,
        })
      : await fillHeadingCells({ ssid, headers, headings: agreed });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const message = body?.error?.message || "Failed to restore the header";
      console.error("[sheet/restore-header] write failed:", message);
      return res.status(response.status).json({ error: message });
    }

    return res.status(200).json({
      repaired: true,
      insertedRow: plan.insertRow,
      headings: agreed,
    });
  } catch (error) {
    console.error("[sheet/restore-header] unexpected error:", error);
    return res
      .status(error.status || 500)
      .json({ error: error.message || "Internal server error" });
  }
}

const REQUIRED_NAMES = ["Date", "Lift Type", "Reps", "Weight"];

// One batch: the new row and its headings land together or not at all. The
// row takes nothing from the data row beneath it, and the headings are bold
// like the header of a sheet the app created.
function insertHeaderRow({ ssid, headers, sheetId, headings }) {
  const width = Math.max(...headings.map((heading) => heading.column)) + 1;
  const cells = Array.from({ length: width }, (_, column) => {
    const heading = headings.find((candidate) => candidate.column === column);
    return heading
      ? {
          userEnteredValue: { stringValue: heading.name },
          userEnteredFormat: { textFormat: { bold: true } },
        }
      : {};
  });
  return fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${ssid}:batchUpdate`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        requests: [
          {
            insertDimension: {
              range: {
                sheetId,
                dimension: "ROWS",
                startIndex: 0,
                endIndex: 1,
              },
              inheritFromBefore: false,
            },
          },
          {
            updateCells: {
              start: { sheetId, rowIndex: 0, columnIndex: 0 },
              rows: [{ values: cells }],
              fields: "userEnteredValue,userEnteredFormat.textFormat.bold",
            },
          },
        ],
      }),
    },
  );
}

// RAW, so a heading is stored as the plain text it is.
function fillHeadingCells({ ssid, headers, headings }) {
  return fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${ssid}/values:batchUpdate`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        valueInputOption: "RAW",
        data: headings.map((heading) => ({
          range: `${columnLetter(heading.column)}1`,
          majorDimension: "ROWS",
          values: [[heading.name]],
        })),
      }),
    },
  );
}
