/**
 * Operation-oriented sheet API: fix-date-outlier.
 *
 * Applies a high-confidence date typo correction to the explicit date cells in
 * one parsed workout section. Blank inherited date cells stay blank, so the
 * official sparse sheet format keeps working while manually filled-down dates
 * are corrected too.
 */

import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { getServerSession } from "next-auth/next";
import { normalizeDateInput } from "@/lib/date-utils";

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
    const range = `A${startRowIndex}:A${endRowIndex}`;
    const readResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${ssid}/values/${range}?majorDimension=ROWS&dateTimeRenderOption=FORMATTED_STRING`,
      { headers },
    );

    if (!readResponse.ok) {
      const body = await readResponse.json().catch(() => ({}));
      const message = body?.error?.message || "Failed to read date cells";
      return res.status(readResponse.status).json({ error: message });
    }

    const payload = await readResponse.json();
    const rowCount = endRowIndex - startRowIndex + 1;
    const rows = Array.from({ length: rowCount }, (_, index) => {
      return payload.values?.[index] ?? [];
    });

    const firstDate = normalizeDateInput(rows[0]?.[0]);
    if (firstDate !== currentDate) {
      return res.status(409).json({
        error: `The workout date changed before it could be fixed.`,
        code: "PRECONDITION_FAILED",
        actual: firstDate || "",
      });
    }

    const nextRows = rows.map((row) => {
      const rawDate = row?.[0] ?? "";
      const normalizedDate = normalizeDateInput(rawDate);
      if (!rawDate) return [""];
      if (normalizedDate !== currentDate) {
        throw new DateSectionMismatchError(normalizedDate || rawDate);
      }
      return [suggestedDate];
    });

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
    return res
      .status(500)
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
