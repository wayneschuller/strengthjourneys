// parseGSheetData.js

import { devLog } from "@/lib/SJ-utils";

function convertWeight(weightString) {
  if (weightString === undefined || weightString === "") {
    return { value: undefined, unitType: undefined };
  }

  const value = parseFloat(weightString);
  const unitType = weightString.includes("kg") ? "kg" : "lb";

  return { value, unitType };
}

function convertReps(repsString) {
  return repsString !== "" ? parseInt(repsString, 10) : undefined;
}

function convertDate(dateString, previousDate) {
  return dateString !== "" ? dateString : previousDate;
}

// Parse Bespoke Strength Journeys Google Sheet format
// Trying to be agnostic about column position
// We do assume that if date or lift type are blank we can infer from a previous row
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
          default:
            obj[columnName] = row[index]; // Pass through any other user rows
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
      Math.round(performance.now() - startTime) +
      "ms",
  );

  return objectsArray;
}

// Export the function for use in other files
export { parseGSheetData };
