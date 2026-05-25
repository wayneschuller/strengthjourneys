// Shared normalization utilities for all import parsers.

import {
  BIG_FOUR_LIFT_TYPES,
  BIG_FOUR_LIFT_TYPE_SET,
} from "@/lib/big-four-lifts";

export const STANDARD_BIG_FOUR_LIFT_TYPES = BIG_FOUR_LIFT_TYPES;

export const STANDARD_BIG_FOUR_LIFT_TYPE_SET = BIG_FOUR_LIFT_TYPE_SET;

const BIG_FOUR_LIFT_TYPE_ALIASES = {
  // English
  "back squat": "Back Squat",
  squat: "Back Squat",
  squats: "Back Squat",
  "bench press": "Bench Press",
  bench: "Bench Press",
  deadlift: "Deadlift",
  deadlifts: "Deadlift",
  press: "Strict Press",
  "strict press": "Strict Press",
  "overhead press": "Strict Press",
  "military press": "Strict Press",
  ohp: "Strict Press",

  // German and Dutch
  kniebeuge: "Back Squat",
  kniebeugen: "Back Squat",
  bankdrucken: "Bench Press",
  bankdrukken: "Bench Press",
  kreuzheben: "Deadlift",
  schulterdrucken: "Strict Press",
  schouderdrukken: "Strict Press",
  uberkopfdrucken: "Strict Press",

  // Spanish
  sentadilla: "Back Squat",
  sentadillas: "Back Squat",
  "press de banca": "Bench Press",
  banca: "Bench Press",
  "peso muerto": "Deadlift",
  "press militar": "Strict Press",
  "press de hombros": "Strict Press",

  // French
  "developpe couche": "Bench Press",
  "souleve de terre": "Deadlift",
  "developpe militaire": "Strict Press",
  "developpe epaules": "Strict Press",

  // Portuguese
  agachamento: "Back Squat",
  supino: "Bench Press",
  "levantamento terra": "Deadlift",
  "peso morto": "Deadlift",
  "desenvolvimento militar": "Strict Press",

  // Italian
  "panca piana": "Bench Press",
  "distensione su panca": "Bench Press",
  "stacco da terra": "Deadlift",
  "lento avanti": "Strict Press",
};

function normalizeLiftTypeLookupKey(liftType) {
  return String(liftType || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Allow variations of common big-four lift names and capitalization but harmonize for output.
export function normalizeLiftTypeNames(liftType) {
  const key = normalizeLiftTypeLookupKey(liftType);
  return BIG_FOUR_LIFT_TYPE_ALIASES[key] || liftType; // Defaults to original if no match
}

export function normalizeBigFourLiftType(liftType) {
  const normalized = normalizeLiftTypeNames(liftType);
  return STANDARD_BIG_FOUR_LIFT_TYPE_SET.has(normalized) ? normalized : null;
}

// Used to normalize column names to a standard format
export function normalizeColumnName(columnName) {
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

// Used to convert number strings to integer
// Handles Google Sheets API format where numbers come as strings
export function convertStringToInt(repsString) {
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
// Returns _explicitUnit: true if unit was explicitly stated, null if ambiguous (no suffix)
export function convertWeightAndUnitType(weightString) {
  // Google Sheets API returns empty string for empty cells
  if (!weightString || weightString === "") {
    return { value: undefined, unitType: undefined, _explicitUnit: null };
  }

  // Trim whitespace
  weightString = weightString.trim();

  // Try to parse the number part
  const num = parseFloat(weightString);
  if (isNaN(num)) {
    return { value: undefined, unitType: undefined, _explicitUnit: null };
  }

  // Simple string check for unit
  const lower = weightString.toLowerCase();
  const hasKg = lower.includes("kg");
  const hasLb = lower.includes("lb");
  const hasExplicitUnit = hasKg || hasLb;

  return {
    value: num,
    unitType: hasKg ? "kg" : "lb", // default to "lb" if ambiguous; two-pass will fix
    _explicitUnit: hasExplicitUnit ? true : null,
  };
}
