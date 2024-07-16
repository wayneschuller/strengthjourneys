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
    parsedData = parseBespokeData(data); // Default to Strength Journeys bespoke format
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

  const objectsArray = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const obj = {}; // We build the object as we parse each column in the row

    for (let j = 0; j < columnNames.length; j++) {
      // FIXME: could we assume some sane defaults if the columnnames are missing?
      const columnName = columnNames[j];
      let rowData = row[j];

      // Trim the rowData string if it is a string
      if (typeof rowData === "string") {
        rowData = rowData.trim();
      }

      switch (columnName) {
        case "Date":
          if (rowData) {
            obj["date"] = rowData;
            previousDate = rowData;
          } else {
            obj["date"] = previousDate;
          }
          break;
        case "Lift Type":
          if (rowData) {
            obj["liftType"] = rowData;
            previousLiftType = rowData;
          } else {
            obj["liftType"] = previousLiftType;
          }
          break;
        case "Reps":
          obj["reps"] = convertStringToInt(rowData);
          break;
        case "Weight":
          const { value, unitType } = convertWeightAndUnitType(rowData);
          obj["weight"] = value;
          obj["unitType"] = unitType;
          break;
        case "Notes":
          obj["notes"] = rowData;
          break;
        case "isGoal":
          obj["isGoal"] = rowData === "TRUE"; // Will default to false if blank
          break;
        default:
          obj[columnName] = rowData;
      }
    }

    if (obj["reps"] !== undefined && obj["weight"] !== undefined) {
      objectsArray.push(obj);
    }
  }

  objectsArray.sort((a, b) => a.date.localeCompare(b.date));

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
