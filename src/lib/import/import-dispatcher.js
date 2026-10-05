// Import parser dispatcher.
//
// Two entry points:
//   parseData(rows)         — for Google Sheets (SJ format only, read/write)
//   parseImportedFile(file) — for drag-and-drop CSV/file import (any format, view-only)
//
// THE PARSER CONTRACT
//
// Each app's export is read by one module in parsers/, and that module's whole
// interface is one exported descriptor:
//
//   export const hevyFormat = {
//     ...requireImportSource("hevy"),   // id and name, from import-sources.js
//     detect: isHevyExport,
//     parse: parseHevyData,
//   };
//
//   detect(headers) → boolean
//     True only for this app's header row. Keep it exact: an export's headings
//     are fixed, and a loose match here takes another app's file.
//
//   parse(rows, { importedAt }) → { entries, skippedByReason?, workoutCount?, unitType? }
//     entries          One LiftEntry per set, in any order. Each needs an ISO
//                      date, a liftType from normalizeExportLiftType (or
//                      normalizeLiftTypeNames), whole reps above zero, a
//                      weight isValidLiftWeight accepts, and a unitType. Set
//                      rawLiftType to the export's own exercise text when the
//                      row has one.
//     skippedByReason  Counts of the sets left out, keyed by the reasons
//                      getSetSkipReason returns, added up with countSkip.
//                      Return it only when every skip is counted; a parser
//                      that cannot yet say why leaves it out altogether.
//     workoutCount     When the export marks where one workout ends.
//     unitType         When one unit holds for the whole file.
//
// The dispatcher does the rest for every format, so no parser has to:
//   - tries each detect in the order of APP_EXPORT_FORMATS, first match wins
//   - drops any entry getSetSkipReason turns away, and counts it
//   - sorts by date, keeping the file's own order within a day
//   - times the parse
//   - builds the diagnostics the import preview shows
//
// Adding an app is one line in import-sources.js, one parser file, and one
// line in APP_EXPORT_FORMATS. `npm run validate:imports` then holds it to all
// of the above.
//
// The lifter's own spreadsheet is the exception. parseStrengthJourneysData is
// the sheet reader, with callers well beyond this file and rules of its own:
// it takes a lifter's sheet at its word where an app export is held to the
// contract. So it is wrapped here, not converted, and its rows pass through
// untouched.

import { requireImportSource } from "@/lib/import/import-sources";
import { btwbFormat } from "@/lib/import/parsers/btwb-parser";
import { fitbodFormat } from "@/lib/import/parsers/fitbod-parser";
import { fitNotesFormat } from "@/lib/import/parsers/fitnotes-parser";
import { hevyFormat } from "@/lib/import/parsers/hevy-parser";
import {
  countSkip,
  getSetSkipReason,
} from "@/lib/import/parsers/parser-utilities";
import { parseStrengthJourneysData } from "@/lib/import/parsers/strength-journeys-parser";
import { strongFormat } from "@/lib/import/parsers/strong-parser";
import { strongliftsFormat } from "@/lib/import/parsers/stronglifts-parser";
import { turnKeyFormat } from "@/lib/import/parsers/turnkey-parser";
import { wodifyFormat } from "@/lib/import/parsers/wodify-parser";
import { decodeCSV } from "@/lib/import/decode-csv";
import { decodeWorkbook } from "@/lib/import/decode-workbook";
import { devLog, recordTiming } from "@/lib/processing-utils";

/**
 * A single logged lift after parsing and normalization.
 *
 * This is the canonical data shape used throughout the app. See
 * `getDemoParsedData` in `import/sample-parsed-data.js` for this structure in use.
 *
 * @typedef {Object} LiftEntry
 * @property {string} date          ISO date string "YYYY-MM-DD"
 * @property {string} liftType      Normalized lift name ("Back Squat", "Bench Press", etc.)
 * @property {string} [rawLiftType] Original effective lift label from the sheet ("OHP", "Overhead Press", etc.)
 * @property {string} [rawDate]     The sheet's own date text, only when it differs from `date` ("3/8/2026")
 * @property {string} [rawReps]     The sheet's own reps text, only when it differs from `reps` (" 5")
 * @property {number} reps          Number of reps for this set
 * @property {number} weight        Weight used for this set
 * @property {"lb"|"kg"} [unitType] Units, if known
 * @property {string} [notes]       Optional notes from the sheet
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
 * One app's export format, as its parser module declares it. See the parser
 * contract at the top of this file.
 *
 * @typedef {Object} ImportFormat
 * @property {string} id   Durable id, persisted in import profiles
 * @property {string} name Display name, also written into provenance notes
 * @property {(headers: string[]) => boolean} detect
 * @property {(rows: string[][], context: { importedAt: Date }) => {
 *   entries: LiftEntry[],
 *   skippedByReason?: Object<string, number>,
 *   workoutCount?: number,
 *   unitType?: "lb"|"kg",
 * }} parse
 */

/**
 * What an import left out, for the preview to show.
 *
 * @typedef {Object} ImportDiagnostics
 * @property {number} sourceRows   Sets the file offered: parsed plus skipped
 * @property {number} parsedRows
 * @property {number} skippedRows
 * @property {Object<string, number>} skippedByReason
 * @property {number} [workoutCount]
 * @property {"lb"|"kg"} [unitType]
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

// The app exports, in the order their signatures are tried. Order matters:
// the first match wins.
/** @type {ImportFormat[]} */
const APP_EXPORT_FORMATS = [
  hevyFormat,
  // Ahead of StrongLifts, whose current layout also accepts a bare date and
  // exercise pair.
  fitbodFormat,
  strongliftsFormat,
  strongFormat,
  wodifyFormat,
  btwbFormat,
  turnKeyFormat,
  // One flat row per set, with the lifter's unit stated in the weight header.
  // Last of the apps, and ahead of the Strength Journeys signature below,
  // which would otherwise claim any date/exercise/reps/weight table.
  fitNotesFormat,
];

// A Strength Journeys CSV export or a compatible sheet, tried after every app
// export. Recognised by the four required columns under names we know; a file
// with headings of the lifter's own gets a second chance in parseImportedRows.
const strengthJourneysFormat = {
  ...requireImportSource("strength-journeys"),
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
  parse: (rows) => ({ entries: parseStrengthJourneysData(rows) }),
};

/**
 * Every format a dropped file can be recognised as, in detection order.
 * @type {ImportFormat[]}
 */
export const IMPORT_FORMATS = [...APP_EXPORT_FORMATS, strengthJourneysFormat];

/**
 * Detect the format of a header row.
 *
 * @param {string[]} headers First row of the imported data
 * @returns {ImportFormat | null}
 */
export function detectFormat(headers) {
  for (const format of IMPORT_FORMATS) {
    if (format.detect(headers)) return format;
  }
  return null;
}

/**
 * Parse a drag-and-dropped file into ParsedData.
 * Handles container decoding (CSV → rows) and format detection.
 *
 * @param {File} file The dropped/selected file
 * @returns {Promise<{ data: ParsedData, formatId: string, formatName: string, diagnostics: ImportDiagnostics | null }>}
 * @throws {Error} If the file can't be parsed or format is unrecognized
 */
export async function parseImportedFile(file) {
  const ext = file.name.split(".").pop()?.toLowerCase();
  let rows;

  if (["xls", "xlsx"].includes(ext)) {
    rows = await decodeWorkbook(file);
  } else {
    const text = await file.text();
    rows = decodeCSV(text);
  }

  return parseImportedRows(rows);
}

/**
 * Parse decoded rows (header first) in whichever format their header row
 * matches. The part of parseImportedFile that needs no File, so the
 * validation scripts can hold every format to the contract.
 *
 * @param {string[][]} rows
 * @param {{ importedAt?: Date }} [context] `importedAt` dates the provenance
 *   note some formats write into the first set of each workout.
 * @returns {{ data: ParsedData, formatId: string, formatName: string, diagnostics: ImportDiagnostics | null }}
 * @throws {Error} If the format is unrecognized or holds no valid entries
 */
export function parseImportedRows(rows, { importedAt = new Date() } = {}) {
  if (rows.length < 2) {
    throw new Error("File appears to be empty or has no data rows.");
  }

  const headers = rows[0];
  let format = detectFormat(headers);
  let parsed = null;

  // No app's export has these headings. It may still be a lifter's own
  // spreadsheet: one set per row, with a date, a lift, reps and a weight
  // under whatever headings they chose, or none. The sheet parser can work
  // those columns out from their contents, so give it the chance before
  // turning the file away. App exports never reach this: their headings are
  // fixed, and matching them exactly above is what keeps them reliable.
  if (!format) {
    const data = parseOwnSpreadsheet(rows);
    if (data) {
      format = strengthJourneysFormat;
      parsed = { data, diagnostics: null };
    }
  }

  if (!format) {
    throw new Error(
      "Unrecognized file format. Supported formats: Hevy export, Strong export, StrongLifts 5x5 export, Wodify export, BTWB export, Strength Journeys CSV export, TurnKey export, FitNotes export, or your own spreadsheet with one set per row: a date, a lift name, reps and a weight.",
    );
  }

  if (!parsed) {
    parsed =
      format === strengthJourneysFormat
        ? { data: format.parse(rows).entries, diagnostics: null }
        : parseAppExport(format, rows, { importedAt });
  }

  if (!parsed.data || parsed.data.length === 0) {
    throw new Error(
      `File was recognized as ${format.name} format but no valid entries were found. ` +
        "Check that the file contains workout data with dates, exercises, reps, and weights.",
    );
  }

  return {
    data: parsed.data,
    formatId: format.id,
    formatName: format.name,
    diagnostics: parsed.diagnostics,
  };
}

// Runs one app's parser and holds what comes back to the contract: only valid
// sets, in date order, with the skips added up.
function parseAppExport(format, rows, context) {
  const startTime = performance.now();
  const result = format.parse(rows, context);

  const skippedByReason = { ...result.skippedByReason };
  const turnedAway = {};
  const data = result.entries.filter((entry) => {
    const reason = getSetSkipReason(entry);
    if (!reason) return true;
    countSkip(skippedByReason, reason);
    countSkip(turnedAway, reason);
    return false;
  });

  // Dates are ISO strings, so text order is date order, and the sort is
  // stable, so sets within a day stay in the order the file had them.
  data.sort((a, b) => a.date.localeCompare(b.date));

  recordTiming(
    `Parse ${format.name}`,
    performance.now() - startTime,
    `${data.length} lifts`,
  );

  // A parser should never hand over a set this turns away. When one does it
  // is a parser fault, not something in the lifter's file, so say so here.
  if (Object.keys(turnedAway).length > 0) {
    devLog(
      `${format.name} parser returned entries that are not valid sets:`,
      turnedAway,
    );
  }

  // Counts are shown only for a parser that counts every skip. For the rest,
  // "imported X of Y" would be a guess at Y.
  if (!result.skippedByReason) return { data, diagnostics: null };

  const skippedRows = Object.values(skippedByReason).reduce(
    (sum, count) => sum + count,
    0,
  );
  return {
    data,
    diagnostics: {
      sourceRows: data.length + skippedRows,
      parsedRows: data.length,
      skippedRows,
      skippedByReason,
      workoutCount: result.workoutCount,
      unitType: result.unitType,
    },
  };
}

// The sheet parser throws when it cannot place the four required columns, and
// here that just means "not a lifting log we can read".
function parseOwnSpreadsheet(rows) {
  try {
    const parsed = parseStrengthJourneysData(rows, {
      claimLabelledColumns: true,
    });
    return parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

// Re-export normalization utilities for use by other modules
export { normalizeLiftTypeNames } from "@/lib/import/parsers/parser-utilities";
