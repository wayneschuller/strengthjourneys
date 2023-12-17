// parseGSheetData.js

import { devLog } from "@/lib/processing-utils";
import { parse } from "date-fns";

// Discern data format and parse
export function parseData(data) {
  const columnNames = data[0];
  let parsedData = null;

  if (columnNames[0] === "user_name" && columnNames[1] === "workout_id") {
    parsedData = parseTurnKeyData(data);
  } else {
    parsedData = parseBespokeData(data);
  }

  return parsedData;
}

// Parse Turnkey data format
//
function parseTurnKeyData(data) {
  const startTime = performance.now(); // We measure critical processing steps

  // Dynamically find where all our needed columns are
  const columnNames = data[0];
  const workout_date_COL = columnNames.indexOf("workout_date");
  const workout_id_COL = columnNames.indexOf("workout_id");
  const completed_COL = columnNames.indexOf("workout_completed");
  const exercise_name_COL = columnNames.indexOf("exercise_name");
  const assigned_reps_COL = columnNames.indexOf("assigned_reps");
  const assigned_weight_COL = columnNames.indexOf("assigned_weight");
  const assigned_sets_COL = columnNames.indexOf("assigned_sets");
  const actual_reps_COL = columnNames.indexOf("actual_reps");
  const actual_weight_COL = columnNames.indexOf("actual_weight");
  const actual_sets_COL = columnNames.indexOf("actual_sets");
  const missed_COL = columnNames.indexOf("assigned_exercise_missed");
  const units_COL = columnNames.indexOf("weight_units");

  let parsedData = [];

  data.slice(1).forEach((row) => {
    if (!row || row[0] === null) {
      devLog(`parseTurnKeyData() skipping bad row: ${JSON.stringify(row)}`);
      return;
    }

    if (row[actual_reps_COL] === "actual_reps") return; // Probably header row

    // Give up on this row if it is not a completed workout
    if (row[completed_COL] === "FALSE") return;

    // Give up on this row if missed_COL is true
    if (row[missed_COL] === "TRUE") return;

    // Give up on this row if there are no assigned reps
    // Happens when a BLOC coach leaves comments in the web app
    if (isNaN(parseInt(row[assigned_reps_COL]), 10)) {
      return;
    }

    let lifted_reps = parseInt(row[assigned_reps_COL], 10);
    let lifted_weight = parseFloat(row[assigned_weight_COL]);

    // Override if there is an actual_reps and actual_weight
    // This happens when the person lifts different to what was assigned by their coach
    if (
      isFinite(parseInt(row[actual_reps_COL]), 10) &&
      isFinite(parseFloat(row[actual_weight_COL]))
    ) {
      lifted_reps = parseInt(row[actual_reps_COL], 10);
      lifted_weight = parseFloat(row[actual_weight_COL]);
    }

    if (isNaN(lifted_reps) || lifted_reps === 0) return;
    if (isNaN(lifted_weight) || lifted_weight === 0) return;

    let unitType = row[units_COL]; // Record the units type global for later. (we assume it won't change in the data)

    const liftUrl = `https://app.turnkey.coach//workout/${row[workout_id_COL]}`;

    let liftType = row[exercise_name_COL];

    if (liftType === "Squat") liftType = "Back Squat"; // Our other two data types prefer the full name

    // Expand TurnKey sets into separate liftEntry tuples
    // This makes no difference to the graph, but it benefits a user wanting to convert their TurnKey data to our bespoke format
    // It may help with some achievements and tonnage count in a future feature
    let sets = 1;
    if (parseInt(row[assigned_sets_COL], 10) > 1)
      sets = parseInt(row[assigned_sets_COL], 10);
    if (parseInt(row[actual_sets_COL], 10) > 1)
      sets = parseInt(row[actual_sets_COL], 10);

    for (let i = 1; i <= sets; i++) {
      let notes = `Set ${i} of ${sets}`;
      if (sets === 1) notes = undefined; // No notes for a single set
      parsedData.push({
        date: row[workout_date_COL],
        liftType: liftType,
        reps: lifted_reps,
        weight: lifted_weight,
        url: liftUrl,
        unitType: unitType,
        notes: notes,
      });
    }
  });

  parsedData.sort((a, b) => {
    // Compare 'date' strings directly
    if (a.date > b.date) return 1;
    if (a.date < b.date) return -1;
    return 0;
  });

  devLog(
    "parseTurnKeyData() execution time: " +
      `\x1b[1m${Math.round(performance.now() - startTime)}` +
      `ms\x1b[0m` +
      ` (${parsedData.length} tuples)`,
  );

  return parsedData;
}

// Parse Bespoke Strength Journeys Google Sheet format
// Trying to be agnostic about column position
// We do assume that if date or lift type are blank we can infer from a previous row
// We return parsedData that is always sorted date ascending
// See @/lib/sample-parsed-data.js for data structure design

function parseBespokeData(data) {
  const startTime = performance.now();
  const columnNames = data[0];
  let previousDate = null;
  let previousLiftType = null;

  const objectsArray = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const obj = {};

    for (let j = 0; j < columnNames.length; j++) {
      const columnName = columnNames[j];
      const rowData = row[j];

      switch (columnName) {
        case "Date":
          obj["date"] = rowData !== "" ? rowData : previousDate;
          previousDate = obj["date"];
          break;
        case "Lift Type":
          obj["liftType"] = rowData !== "" ? rowData : previousLiftType;
          previousLiftType = obj["liftType"];
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
  const unitType = weightString.includes("kg") ? "kg" : "lb";

  return { value, unitType };
}

// Used to convert number strings to integer
// FIXME: not really needed
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

function convertDate(dateString, previousDate) {
  return dateString !== "" ? dateString : previousDate;
}
