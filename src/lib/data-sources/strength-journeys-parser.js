// Parse Strength Journeys Google Sheet format.
// This is the official Strength Journeys template we offer a sample of:
// https://docs.google.com/spreadsheets/d/14J9z9iJBCeJksesf3MdmpTUmo2TIckDxIQcTx1CPEO0/edit#gid=0
//
// We try to be agnostic about column positions by normalizing header names.
//
// SPARSE ENCODING / ANCHOR ROWS:
// The sheet uses a sparse encoding where Date (col A) and Lift Type (col B) are
// only written on "anchor rows" — the first row of a session or the first row of
// a new lift type within a session. All subsequent rows for the same date/lift
// leave those cells blank and inherit from the previous row via `previousDate`
// and `previousLiftType`. See the full data model (examples, anchor types,
// insertion order, deletion/promotion rules) in the block comment at the top of
// src/pages/api/sheet/insert-row.js.
//
// Returns a `ParsedData` array that is always sorted by date ascending.
// See @/lib/data-sources/sample-parsed-data.js for example data using this structure.

import { recordTiming } from "@/lib/processing-utils";
import { normalizeDateInput } from "@/lib/date-utils";
import {
  normalizeLiftTypeNames,
  normalizeColumnName,
  convertStringToInt,
  convertWeightAndUnitType,
} from "@/lib/data-sources/parser-utilities";

/**
 * Parse the Strength Journeys Google Sheet format into `ParsedData`.
 *
 * @param {any[][]} data Raw Google Sheets `values` array (rows x columns)
 * @returns {import("./index").ParsedData}
 */
export function parseStrengthJourneysData(data) {
  const startTime = performance.now();
  const columnNames = data[0];
  let previousDate = null;
  let previousLiftType = null;
  let previousRawLiftType = null;
  const localeHint =
    typeof navigator !== "undefined" && typeof navigator.language === "string"
      ? navigator.language
      : undefined;

  const normalizedColumnNames = columnNames.map(normalizeColumnName);

  // Find indices for all columns
  let dateColumnIndex = normalizedColumnNames.indexOf("Date");
  let liftTypeColumnIndex = normalizedColumnNames.indexOf("Lift Type");
  let repsColumnIndex = normalizedColumnNames.indexOf("Reps");
  let weightColumnIndex = normalizedColumnNames.indexOf("Weight");
  let notesColumnIndex = normalizedColumnNames.indexOf("Notes");
  let isGoalColumnIndex = normalizedColumnNames.indexOf("isGoal");
  let labelColumnIndex = normalizedColumnNames.indexOf("Label");
  let urlColumnIndex = normalizedColumnNames.indexOf("URL");

  // Check only required columns
  if (
    dateColumnIndex === -1 ||
    liftTypeColumnIndex === -1 ||
    repsColumnIndex === -1 ||
    weightColumnIndex === -1
  ) {
    const missingColumns = [];
    if (dateColumnIndex === -1) missingColumns.push("Date");
    if (liftTypeColumnIndex === -1) missingColumns.push("Lift Type");
    if (repsColumnIndex === -1) missingColumns.push("Reps");
    if (weightColumnIndex === -1) missingColumns.push("Weight");

    throw new Error(
      `Missing required columns: ${missingColumns.join(", ")}. Please ensure your Google Sheet first row includes missing column headers. Click the feedback button below if you need help!`,
    );
  }

  const objectsArray = [];
  // Cache column indices outside the loop since they never change
  const dateCol = dateColumnIndex;
  const liftTypeCol = liftTypeColumnIndex;
  const repsCol = repsColumnIndex;
  const weightCol = weightColumnIndex;
  const notesCol = notesColumnIndex;
  const isGoalCol = isGoalColumnIndex;
  const labelCol = labelColumnIndex;
  const urlCol = urlColumnIndex;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    // Quick validation check for required fields before processing
    // Google Sheets API always returns strings (or numbers) for cells, never null/undefined
    if (row[repsCol] === "" || row[weightCol] === "") {
      continue;
    }

    const obj = {};

    // --- DATE HANDLING LOGIC ---
    // If the date cell is filled, try to normalize it
    if (row[dateCol]) {
      const normalizedDate = normalizeDateInput(row[dateCol], localeHint);
      if (normalizedDate) {
        // Valid date: use it and update previousDate
        obj.date = normalizedDate;
        previousDate = normalizedDate;
      } else {
        // Invalid date: warn, skip this row, and reset previousDate to null
        // This ensures that subsequent rows with blank dates will also be skipped
        // until a new valid date is found, enforcing data integrity
        console.warn(
          `Strength Journeys (parser): Invalid date encountered at row ${i + 1}: '${row[dateCol]}'. Row skipped.`,
        );
        previousDate = null;
        continue;
      }
    } else {
      // Date cell is blank: only use previousDate if it is not null
      if (previousDate) {
        obj.date = previousDate;
      } else {
        // No valid previous date to inherit from, skip this row
        continue;
      }
    }
    // --- END DATE HANDLING LOGIC ---

    // Process lift type next since it's used for previousLiftType
    if (row[liftTypeCol]) {
      obj.rawLiftType = row[liftTypeCol];
      obj.liftType = normalizeLiftTypeNames(row[liftTypeCol]);
      previousLiftType = obj.liftType; // Store normalized value so inherited rows get "Strict Press" not "Overhead Press"
      previousRawLiftType = obj.rawLiftType;
    } else {
      obj.liftType = previousLiftType;
      obj.rawLiftType = previousRawLiftType;
    }

    // Process required fields
    obj.reps = convertStringToInt(row[repsCol]);
    const { value, unitType, _explicitUnit } = convertWeightAndUnitType(
      row[weightCol],
    );
    obj.weight = value;
    obj.unitType = unitType;
    if (_explicitUnit !== null) obj._explicitUnit = _explicitUnit; // true=explicit, null=ambiguous

    // Validate that we have valid numbers for required fields
    if (obj.reps === undefined || obj.weight === undefined) {
      continue;
    }

    // Process optional fields only if they exist
    if (row[notesCol]) obj.notes = row[notesCol];
    if (row[isGoalCol]) obj.isGoal = row[isGoalCol] === "TRUE";
    if (row[labelCol]) obj.label = row[labelCol];
    if (row[urlCol]) obj.URL = row[urlCol];

    // Store the 1-based sheet row number so the editor can write back to the exact row
    obj.rowIndex = i + 1;

    objectsArray.push(obj);
  }

  // Two-pass smart default for unitType
  //
  // Why: users often write weights without a unit suffix (e.g. "100" instead of
  // "100kg"). A blind default of "lb" would mislabel kg-only users' data.
  //
  // How: convertWeightAndUnitType() tags each row with _explicitUnit: true when
  // a suffix was present (e.g. "100kg", "225lb"), or null when ambiguous ("100").
  // After the first pass we count explicit kg vs lb declarations. If kg wins,
  // every ambiguous entry inherits "kg" as its unitType — matching what the user
  // almost certainly intended. On a tie (or all-lb majority), we default to "lb".
  let explicitKg = 0;
  let explicitLb = 0;
  objectsArray.forEach((obj) => {
    if (obj._explicitUnit) {
      if (obj.unitType === "kg") explicitKg++;
      else explicitLb++;
    }
    delete obj._explicitUnit; // Clean up temp field
  });
  // If majority of explicit entries are kg, treat ambiguous entries as kg too (tie → lb)
  const smartDefault = explicitKg > explicitLb ? "kg" : "lb";
  if (smartDefault === "kg" && explicitKg > 0) {
    objectsArray.forEach((obj) => {
      if (!obj.unitType) obj.unitType = smartDefault;
    });
  }

  // FIXME: if there are no entries we could throw an error to prompt them to sheet docs article?

  // Safe array sort
  // We have to make sure our sorting preserves intraday order
  objectsArray.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.localeCompare(b.date);
  });

  recordTiming(
    "Parse",
    performance.now() - startTime,
    `${objectsArray.length} lifts`,
  );

  return objectsArray;
}
