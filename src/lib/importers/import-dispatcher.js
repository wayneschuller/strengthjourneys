// Import parser dispatcher.
//
// Two entry points:
//   parseData(rows)         — for Google Sheets (SJ format only, read/write)
//   parseImportedFile(file) — for drag-and-drop CSV/file import (any format, view-only)
//
// All parsers take string[][] (rows with header) and return ParsedData[].

import { parseStrengthJourneysData } from "./strength-journeys-parser";
import { parseBtwbData } from "./btwb-parser";
import { parseTurnKeyData } from "./turnkey-parser";
import { decodeCSV } from "./decode-csv";

/**
 * A single logged lift after parsing and normalization.
 *
 * This is the canonical data shape used throughout the app. See
 * `sample-parsed-data.js` for concrete examples of this structure in use.
 *
 * @typedef {Object} LiftEntry
 * @property {string} date          ISO date string "YYYY-MM-DD"
 * @property {string} liftType      Normalized lift name ("Back Squat", "Bench Press", etc.)
 * @property {string} [rawLiftType] Original effective lift label from the sheet ("OHP", "Overhead Press", etc.)
 * @property {number} reps          Number of reps for this set
 * @property {number} weight        Weight used for this set
 * @property {"lb"|"kg"} [unitType] Units, if known
 * @property {string} [notes]       Optional notes from the sheet
 * @property {boolean} [isGoal]     True if this row represents a goal instead of an executed set
 * @property {string} [label]       Optional label or tag for this lift
 * @property {string} [URL]         Optional video or reference URL
 * @property {boolean} [isHistoricalPR] Marked true when this entry is a historical PR for its liftType + reps
 * @property {number} [rowIndex] 1-based row number in the source Google Sheet (header = row 1, first data row = row 2)
 */

/**
 * The fully parsed and normalized dataset.
 * @typedef {LiftEntry[]} ParsedData
 */

/**
 * Parse Google Sheets data in Strength Journeys format.
 * This is the only format supported for the live read/write sheet connection.
 *
 * @param {any[][]} data Raw Google Sheets `values` array (rows x columns)
 * @returns {ParsedData}
 */
export function parseData(data) {
  return parseStrengthJourneysData(data);
}

// -- Drag-and-drop file import (view-only, multi-format) ---------------------

/**
 * Known import formats and their header signatures.
 * Order matters — first match wins.
 */
const FORMAT_SIGNATURES = [
  {
    name: "BTWB",
    detect: (headers) =>
      headers.includes("Date") &&
      headers.includes("Description") &&
      headers.includes("Pukie"),
    parse: parseBtwbData,
  },
  {
    name: "TurnKey",
    detect: (headers) =>
      headers.includes("user_name") && headers.includes("workout_id"),
    parse: parseTurnKeyData,
  },
  {
    // Strength Journeys CSV export or compatible sheet
    // Detected by having the 4 required columns (after normalization happens inside the parser)
    name: "Strength Journeys",
    detect: (headers) => {
      const lower = headers.map((h) =>
        h.toLowerCase().replace(/[_-]/g, " ").trim(),
      );
      return (
        lower.some((h) => h === "date" || h === "workout date") &&
        lower.some((h) =>
          ["lift type", "lifttype", "exercise", "movement"].includes(h),
        ) &&
        lower.some((h) => ["reps", "rep", "repetitions"].includes(h)) &&
        lower.some((h) => ["weight", "load", "weight used"].includes(h))
      );
    },
    parse: parseStrengthJourneysData,
  },
];

/**
 * Detect the format of a header row.
 *
 * @param {string[]} headers First row of the imported data
 * @returns {{ name: string, parse: Function } | null}
 */
export function detectFormat(headers) {
  for (const sig of FORMAT_SIGNATURES) {
    if (sig.detect(headers)) return sig;
  }
  return null;
}

/**
 * Parse a drag-and-dropped file into ParsedData.
 * Handles container decoding (CSV → rows) and format detection.
 *
 * @param {File} file The dropped/selected file
 * @returns {Promise<{ data: ParsedData, formatName: string }>}
 * @throws {Error} If the file can't be parsed or format is unrecognized
 */
export async function parseImportedFile(file) {
  const text = await file.text();
  const rows = decodeCSV(text);

  if (rows.length < 2) {
    throw new Error("File appears to be empty or has no data rows.");
  }

  const headers = rows[0];
  const format = detectFormat(headers);

  if (!format) {
    throw new Error(
      "Unrecognized file format. Supported formats: BTWB export, Strength Journeys CSV export, TurnKey export. " +
        "Make sure your file has column headers in the first row.",
    );
  }

  const data = format.parse(rows);

  if (!data || data.length === 0) {
    throw new Error(
      `File was recognized as ${format.name} format but no valid entries were found. ` +
        "Check that the file contains workout data with dates, exercises, reps, and weights.",
    );
  }

  return { data, formatName: format.name };
}

// Re-export normalization utilities for use by other modules
export { normalizeLiftTypeNames } from "./parser-utilities";
