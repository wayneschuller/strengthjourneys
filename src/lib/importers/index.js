// Import parser dispatcher.
//
// Detects the format of incoming data (Google Sheets array-of-arrays or CSV file)
// and routes to the appropriate parser. All parsers return the same ParsedData shape.

import { parseStrengthJourneysData } from "./strength-journeys";
import { parseTurnKeyData } from "./turnkey";

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
 * Discern the incoming data format (TurnKey vs Strength Journeys sheet) and parse it
 * into the normalized `ParsedData` structure used throughout the app.
 *
 * @param {any[][]} data Raw Google Sheets `values` array (rows x columns)
 * @returns {ParsedData}
 */
export function parseData(data) {
  const columnNames = data[0];

  if (columnNames[0] === "user_name" && columnNames[1] === "workout_id") {
    return parseTurnKeyData(data); // TurnKey data source detected
  }

  return parseStrengthJourneysData(data); // Default to Strength Journeys format
}

// Re-export normalization utilities for use by other modules
export { normalizeLiftTypeNames } from "./normalize";
