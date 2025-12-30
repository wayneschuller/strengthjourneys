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
  const columnNames = data[0];
  let previousDate = null;
  let previousLiftType = null;

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
      const normalizedDate = normalizeDateString(row[dateCol]);
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
      obj.liftType = normalizeLiftTypeNames(row[liftTypeCol]);
      previousLiftType = row[liftTypeCol];
    } else {
      obj.liftType = previousLiftType;
    }

    // Process required fields
    obj.reps = convertStringToInt(row[repsCol]);
    const { value, unitType } = convertWeightAndUnitType(row[weightCol]);
    obj.weight = value;
    obj.unitType = unitType;

    // Validate that we have valid numbers for required fields
    if (obj.reps === undefined || obj.weight === undefined) {
      continue;
    }

    // Process optional fields only if they exist
    if (row[notesCol]) obj.notes = row[notesCol];
    if (row[isGoalCol]) obj.isGoal = row[isGoalCol] === "TRUE";
    if (row[labelCol]) obj.label = row[labelCol];
    if (row[urlCol]) obj.url = row[urlCol];

    objectsArray.push(obj);
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

  devLog(
    "parseGSheetData() execution time: " +
      `\x1b[1m${Math.round(performance.now() - startTime)}` +
      `ms\x1b[0m` +
      ` (${objectsArray.length} tuples)`,
  );

  return objectsArray;
}

// Used to convert number strings to integer
// Handles Google Sheets API format where numbers come as strings
function convertStringToInt(repsString) {
  // Google Sheets API returns empty string for empty cells
  if (!repsString || repsString === "") {
    return undefined;
  }

  // Trim whitespace and try to parse
  repsString = repsString.trim();
  const num = parseInt(repsString, 10);

  // Only return if it's a valid integer
  return isNaN(num) ? undefined : num;
}

// Used to convert strings like "226lb" to {225, "lb"}
// Handles Google Sheets API format where weights come as strings
function convertWeightAndUnitType(weightString) {
  // Google Sheets API returns empty string for empty cells
  if (!weightString || weightString === "") {
    return { value: undefined, unitType: undefined };
  }

  // Trim whitespace
  weightString = weightString.trim();

  // Try to parse the number part
  const num = parseFloat(weightString);
  if (isNaN(num)) {
    return { value: undefined, unitType: undefined };
  }

  // Simple string check for unit
  const hasKg = weightString.toLowerCase().includes("kg");
  return {
    value: num,
    unitType: hasKg ? "kg" : "lb",
  };
}

// Allow variations of some lift names and capitalization but harmonize for output
export function normalizeLiftTypeNames(liftType) {
  // The user data will be put in toLowerCase so just work with lower case samples
  const standardLiftTypes = {
    "bench press": "Bench Press",
    bench: "Bench Press",
    press: "Strict Press",
    "strict press": "Strict Press",
    "overhead press": "Strict Press",
    "military press": "Strict Press",
    ohp: "Strict Press",
    squat: "Back Squat",
    "back squat": "Back Squat",
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

// Used to normalize column names to a standard format
function normalizeColumnName(columnName) {
  const standardColumnNames = {
    // Lift Type variations
    "lift type": "Lift Type",
    lifttype: "Lift Type",
    lift_type: "Lift Type",
    "lift-type": "Lift Type",
    "LIFT TYPE": "Lift Type",
    LiftType: "Lift Type",
    Lift_Type: "Lift Type",
    "Lift-Type": "Lift Type",
    exercise: "Lift Type",
    Exercise: "Lift Type",
    EXERCISE: "Lift Type",
    movement: "Lift Type",
    Movement: "Lift Type",
    MOVEMENT: "Lift Type",

    // Date variations
    date: "Date",
    DATE: "Date",
    "workout date": "Date",
    "Workout Date": "Date",
    "WORKOUT DATE": "Date",
    workout_date: "Date",
    Workout_Date: "Date",

    // Reps variations
    reps: "Reps",
    REPS: "Reps",
    repetitions: "Reps",
    Repetitions: "Reps",
    REPETITIONS: "Reps",
    rep: "Reps",
    Rep: "Reps",
    REP: "Reps",

    // Weight variations
    weight: "Weight",
    WEIGHT: "Weight",
    load: "Weight",
    Load: "Weight",
    LOAD: "Weight",
    "weight used": "Weight",
    "Weight Used": "Weight",
    "WEIGHT USED": "Weight",
    weight_used: "Weight",
    Weight_Used: "Weight",

    // Notes variations
    notes: "Notes",
    NOTES: "Notes",
    note: "Notes",
    Note: "Notes",
    NOTE: "Notes",
    comment: "Notes",
    Comment: "Notes",
    COMMENT: "Notes",
    comments: "Notes",
    Comments: "Notes",
    COMMENTS: "Notes",

    // isGoal variations
    isgoal: "isGoal",
    ISGOAL: "isGoal",
    "is goal": "isGoal",
    "Is Goal": "isGoal",
    "IS GOAL": "isGoal",
    is_goal: "isGoal",
    Is_Goal: "isGoal",
    goal: "isGoal",
    Goal: "isGoal",
    GOAL: "isGoal",

    // Label variations
    label: "Label",
    LABEL: "Label",
    labels: "Label",
    Labels: "Label",
    LABELS: "Label",
    tag: "Label",
    Tag: "Label",
    TAG: "Label",
    tags: "Label",
    Tags: "Label",
    TAGS: "Label",

    // URL variations
    url: "URL",
    URL: "URL",
    link: "URL",
    Link: "URL",
    LINK: "URL",
    "video url": "URL",
    "Video URL": "URL",
    "VIDEO URL": "URL",
    video_url: "URL",
    Video_URL: "URL",
    "video-link": "URL",
    "Video-Link": "URL",
  };

  // First try exact match
  if (standardColumnNames[columnName]) {
    return standardColumnNames[columnName];
  }

  // Then try case-insensitive match with normalized version
  const normalizedInput = columnName.toLowerCase().replace(/[_-]/g, " ").trim();
  return standardColumnNames[normalizedInput] || columnName; // Default to original if no match
}
