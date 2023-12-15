// parseGSheetData.js

import { devLog } from "@/lib/processing-utils";

function convertWeight(weightString) {
  if (weightString === undefined || weightString === "") {
    return { value: undefined, unitType: undefined };
  }

  const value = parseFloat(weightString);
  const unitType = weightString.includes("kg") ? "kg" : "lb";

  return { value, unitType };
}

function convertReps(repsString) {
  if (!repsString) {
    return undefined;
  }

  repsString = repsString.trim();

  if (repsString === "" || isNaN(parseInt(repsString, 10))) {
    return undefined;
  }

  return parseInt(repsString, 10);
}

function convertDate(dateString, previousDate) {
  return dateString !== "" ? dateString : previousDate;
}

// Discern data format and parse (see @/lib/sample-parsed-data.js for data structure design)
export function parseData(data) {
  const columnNames = data[0];
  let parsedData = null;

  if (columnNames[0] === "user_name" && columnNames[1] === "workout_id") {
    devLog(`Turnkey data detected`);
    devLog(data);
    return null;
  } else {
    parsedData = parseGSheetData(data);
    return parsedData;
  }
}

// Parse Bespoke Strength Journeys Google Sheet format
// Trying to be agnostic about column position
// We do assume that if date or lift type are blank we can infer from a previous row
// We return parsedData that is always sorted date ascending
function parseGSheetData(data) {
  const startTime = performance.now(); // We measure critical processing steps
  const columnNames = data[0];

  let previousDate = null;
  let previousLiftType = null;

  const objectsArray = data
    .slice(1)
    .map((row) => {
      const obj = {};

      columnNames.forEach((columnName, index) => {
        switch (columnName) {
          case "Date":
            obj["date"] = convertDate(row[index], previousDate);
            previousDate = obj["date"];
            break;
          case "Lift Type":
            // Use one camelcase word for the field
            obj["liftType"] = row[index] !== "" ? row[index] : previousLiftType;
            previousLiftType = obj["liftType"];
            break;
          case "Reps":
            obj["reps"] = convertReps(row[index]);
            break;
          case "Weight":
            const { value, unitType } = convertWeight(row[index]);
            obj["weight"] = value;
            obj["unitType"] = unitType;
            break;
          case "Notes":
            obj["notes"] = row[index];
            break;
          default:
            obj[columnName] = row[index]; // Pass through any other user rows
          //FIXME: Notes should become notes
        }
      });

      if (obj["reps"] === undefined || obj["weight"] === undefined) {
        return null;
      }

      return obj;
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.date) - new Date(b.date)); // Sort by date ascending

  devLog(
    "parseGSheetData() execution time: " +
      `\x1b[1m${Math.round(performance.now() - startTime)}` +
      `ms\x1b[0m` +
      ` (${objectsArray.length} tuples)`,
  );

  return objectsArray;
}
