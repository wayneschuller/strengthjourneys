import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { getServerSession } from "next-auth/next";

// DELETE /api/sheet/delete
// Deletes all rows belonging to a session — everything from the session's first
// row through to (but not including) the next session's first row. This matches
// the "date umbrella" convention: blank rows, comment rows, and any other content
// between sessions are deleted along with the session's lift rows.
//
// The client computes the row range from parsedData (which has rowIndex on every
// entry) and sends it explicitly. The server trusts these bounds.
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

  const { ssid, startRowIndex, endRowIndex } = req.body;

  if (
    !ssid ||
    typeof startRowIndex !== "number" ||
    typeof endRowIndex !== "number" ||
    startRowIndex < 2 || // row 1 is the header — never delete it
    endRowIndex < startRowIndex
  ) {
    return res.status(400).json({
      error: "Missing or invalid fields: ssid, startRowIndex, endRowIndex",
    });
  }

  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    "Content-Type": "application/json",
  };

  try {
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
                  sheetId: 0,
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
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
