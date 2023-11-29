// parseGSheetData.js

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
            obj[columnName] = convertDate(row[index], previousDate);
            previousDate = obj[columnName];
            break;
          case "Lift Type":
            // Use one camelcase word for the field
            obj["liftType"] = row[index] !== "" ? row[index] : previousLiftType;
            previousLiftType = obj["liftType"];
            break;
          case "Reps":
            obj[columnName] = convertReps(row[index]);
            break;
          case "Weight":
            const { value, unitType } = convertWeight(row[index]);
            obj[columnName] = value;
            obj["unitType"] = unitType;
            break;
          default:
            obj[columnName] = row[index];
        }
      });

      if (obj["Reps"] === undefined || obj["Weight"] === undefined) {
        return null;
      }

      return obj;
    })
    .filter(Boolean);

  return objectsArray;
}

// Export the function for use in other files
export { parseGSheetData };
