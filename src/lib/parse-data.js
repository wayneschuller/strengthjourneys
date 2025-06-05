// parseGSheetData.js

import { devLog } from "@/lib/processing-utils";
import { parse } from "date-fns";
import { parseTurnKeyData } from "@/lib/parse-turnkey-importer";
// Discern data format and parse
export function parseData(data) {
  const columnNames = data[0];
  let parsedData = null;

  if (columnNames[0] === "user_name" && columnNames[1] === "workout_id") {
    parsedData = parseTurnKeyData(data); // TurnKey data source detected
  } else {
    parsedData = parseBespokeData(data); // Default to Strength Journeys Google Sheet bespoke format
  }

  // devLog(parsedData);

  return parsedData;
}

// Parse Bespoke Strength Journeys Google Sheet format
// This is the official Strength Journeys format that we offer a sample of:
// https://docs.google.com/spreadsheets/d/14J9z9iJBCeJksesf3MdmpTUmo2TIckDxIQcTx1CPEO0/edit#gid=0
//
// Trying to be agnostic about column position
// We do assume that if date or lift type are blank we can infer from a previous row
// We return a parsedData array of objects that is always sorted date ascending
// See @/lib/sample-parsed-data.js for data structure design
function parseBespokeData(data) {
  const startTime = performance.now();
  const columnNames = data[0]; // We assume the column names are in the first row of data
  let previousDate = null;
  let previousLiftType = null;

  // Before we loop through the data, let's make sure we have the critical column names
  let dateColumnIndex = columnNames.indexOf("Date");
  let liftTypeColumnIndex = columnNames.indexOf("Lift Type");
  let repsColumnIndex = columnNames.indexOf("Reps");
  let weightColumnIndex = columnNames.indexOf("Weight");

  // Check if we have the minimum required columns
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
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const obj = {}; // We build the object as we parse each column in the row

    // devLog(row);
    // Loop through each column in the row and parse each cell
    for (let j = 0; j < columnNames.length; j++) {
      // FIXME: could we assume some sane defaults if the columnnames are missing?
      const columnName = columnNames[j];
      let cellData = row[j]; // Grab the cell from this row and column combo

      // Trim the rowData string if it is a string
      if (typeof cellData === "string") {
        cellData = cellData.trim();
      }

      // FIXME: Why aren't we putting URL explicitly in this switch? Are we just getting it from the default?

      switch (columnName) {
        case "Date":
          if (cellData) {
            // Normalize the date string to ensure proper format
            const normalizedDate = normalizeDateString(cellData);
            if (normalizedDate) {
              obj["date"] = normalizedDate;
              previousDate = normalizedDate;
            }
          } else {
            obj["date"] = previousDate;
          }
          break;
        case "Lift Type":
          if (cellData) {
            obj["liftType"] = normalizeLiftTypeNames(cellData);
            previousLiftType = cellData;
          } else {
            obj["liftType"] = previousLiftType;
          }
          break;
        case "Reps":
          obj["reps"] = convertStringToInt(cellData);
          break;
        case "Weight":
          const { value, unitType } = convertWeightAndUnitType(cellData);
          obj["weight"] = value;
          obj["unitType"] = unitType;
          break;
        case "Notes":
          if (cellData) obj["notes"] = cellData;
          break;
        case "isGoal":
          obj["isGoal"] = cellData === "TRUE"; // Will default to false if blank
          break;
        case "Label":
          if (cellData) obj["label"] = cellData;
          break;
        default:
          obj[columnName] = cellData; // Kind of a hack to store any extra columns - we don't use this.
      }
    }

    // FIXME: Check for this earlier at beginning of the loop
    if (obj["reps"] !== undefined && obj["weight"] !== undefined) {
      objectsArray.push(obj);
    }
  }

  // FIXME: if there are no entries we could throw an error to prompt them to sheet docs article?

  // Safe array sort
  objectsArray.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.localeCompare(b.date);
  });

  devLog(
    "parseGSheetData() execution time: " +
      `\x1b[1m${Math.round(performance.now() - startTime)}` +
      `ms\x1b[0m` +
      ` (${objectsArray.length} tuples)`,
  );

  return objectsArray;
}

// Used to convert strings like "226lb" to {225, "lb"}
function convertWeightAndUnitType(weightString) {
  if (weightString === undefined || weightString === "") {
    return { value: undefined, unitType: undefined };
  }

  const value = parseFloat(weightString);
  const unitType = weightString.toLowerCase().includes("kg") ? "kg" : "lb";

  return { value, unitType };
}

// Used to convert number strings to integer
// FIXME: not really needed?
function convertStringToInt(repsString) {
  if (!repsString) {
    return undefined;
  }

  repsString = repsString.trim();

  if (repsString === "" || isNaN(parseInt(repsString, 10))) {
    return undefined;
  }

  return parseInt(repsString, 10);
}

// Allow variations of some lift names and capitalization but harmonize for output
export function normalizeLiftTypeNames(liftType) {
  const standardLiftTypes = {
    "bench press": "Bench Press",
    "Bench press": "Bench Press",
    "strict press": "Strict Press",
    "Strict press": "Strict Press",
    "back squat": "Back Squat",
    squat: "Back Squat",
    deadlift: "Deadlift",
  };

  const key = liftType.toLowerCase();
  return standardLiftTypes[key] || liftType; // Defaults to original if no match
}

// Helper function to normalize date strings to YYYY-MM-DD format
// Occasionally google sheets will return dates in the format "2025-5-23"
// instead of "2025-05-23"
// Our assumed date format is always YYYY-MM-DD
// Maybe one day we will use Typescript like grownups.
// Fast string-only date normalization
function normalizeDateString(dateStr) {
  if (!dateStr) return null;

  // Trim is very fast - just removes whitespace from start/end
  dateStr = dateStr.trim();

  // Split is fast - just splits on delimiter
  const parts = dateStr.split("-");
  if (parts.length !== 3) return null;

  // Fast string operations only
  const year = parts[0];
  if (year.length !== 4) return null;

  // Zero-pad month and day using string operations only
  const month = parts[1].padStart(2, "0");
  const day = parts[2].padStart(2, "0");

  // Simple numeric validation without parsing
  if (month < "01" || month > "12") return null;
  if (day < "01" || day > "31") return null;

  return `${year}-${month}-${day}`;
}
