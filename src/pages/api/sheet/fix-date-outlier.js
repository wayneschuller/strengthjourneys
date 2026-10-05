/**
 * Operation-oriented sheet API: fix-date-outlier.
 *
 * Applies a high-confidence date typo correction to the explicit date cells in
 * one parsed workout section. Blank inherited date cells stay blank, so the
 * official sparse sheet format keeps working while manually filled-down dates
 * are corrected too.
 *
 * The date cells are found the way every other sheet write finds its
 * columns: by the Date heading, wherever the lifter keeps it. The client
 * sends the column map its parse found and the server checks it against row 1
 * before writing (see resolveWriteColumns).
 */

import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { getServerSession } from "next-auth/next";
import { normalizeDateInput } from "@/lib/date-utils";
import {
  columnLetter,
  readSheetRows,
  resolveWriteColumns,
} from "@/lib/sheet/sheet-row-ops";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
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
    currentDate,
    suggestedDate,
    columns: requestedColumns,
  } = req.body;

  if (
    !ssid ||
    !Number.isInteger(startRowIndex) ||
    !Number.isInteger(endRowIndex) ||
    startRowIndex < 2 ||
    endRowIndex < startRowIndex ||
    !isYmd(currentDate) ||
    !isYmd(suggestedDate)
  ) {
    return res.status(400).json({
      error:
        "Missing or invalid fields: ssid, startRowIndex, endRowIndex, currentDate, suggestedDate",
    });
  }

  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
    "Content-Type": "application/json",
  };

  try {
    // Row 1 settles which column holds the dates, and is read alongside the
    // section's own rows.
    const [[headerRow], sectionRows] = await Promise.all([
      readSheetRows({ ssid, headers, fromRow: 1, toRow: 1 }),
      readSheetRows({
        ssid,
        headers,
        fromRow: startRowIndex,
        toRow: endRowIndex,
      }),
    ]);
    const layout = resolveWriteColumns(requestedColumns, headerRow);
    if (!layout.ok) {
      return res.status(409).json({
        error: `Sheet layout check failed: ${layout.message}`,
        code: "PRECONDITION_FAILED",
      });
    }
    const dateColumn = layout.columns.date;

    // Sheets leaves out trailing blank rows, so pad to the section's length.
    const rowCount = endRowIndex - startRowIndex + 1;
    const rows = Array.from({ length: rowCount }, (_, index) => {
      return sectionRows[index] ?? [];
    });

    const firstDate = normalizeDateInput(rows[0]?.[dateColumn]);
    if (firstDate !== currentDate) {
      return res.status(409).json({
        error: `The workout date changed before it could be fixed.`,
        code: "PRECONDITION_FAILED",
        actual: firstDate || "",
      });
    }

    const nextRows = rows.map((row) => {
      const rawDate = row?.[dateColumn] ?? "";
      const normalizedDate = normalizeDateInput(rawDate);
      if (!rawDate) return [""];
      if (normalizedDate !== currentDate) {
        throw new DateSectionMismatchError(normalizedDate || rawDate);
      }
      return [suggestedDate];
    });

    const letter = columnLetter(dateColumn);
    const range = `${letter}${startRowIndex}:${letter}${endRowIndex}`;
    const writeResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${ssid}/values/${range}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify({
          range,
          majorDimension: "ROWS",
          values: nextRows,
        }),
      },
    );

    if (!writeResponse.ok) {
      const body = await writeResponse.json().catch(() => ({}));
      const message = body?.error?.message || "Failed to update date cells";
      return res.status(writeResponse.status).json({ error: message });
    }

    return res.status(200).json({
      updated: true,
      startRowIndex,
      endRowIndex,
      updatedDateCells: nextRows.filter((row) => row[0] === suggestedDate)
        .length,
    });
  } catch (error) {
    if (error instanceof DateSectionMismatchError) {
      return res.status(409).json({
        error: `The workout section changed before it could be fixed.`,
        code: "PRECONDITION_FAILED",
        actual: error.actual,
      });
    }

    console.error("[sheet/fix-date-outlier] unexpected error:", error);
    // A read Google refused keeps Google's status.
    return res
      .status(error.status || 500)
      .json({ error: error.message || "Internal server error" });
  }
}

class DateSectionMismatchError extends Error {
  constructor(actual) {
    super("Date section mismatch");
    this.actual = actual;
  }
}

function isYmd(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
