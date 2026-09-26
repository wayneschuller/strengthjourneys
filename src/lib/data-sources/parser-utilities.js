// Shared normalization utilities for all import parsers.

import {
  BIG_FOUR_LIFT_TYPES,
  BIG_FOUR_LIFT_TYPE_SET,
  CURATED_LIFTS,
} from "@/lib/lifts/lift-registry";

export const STANDARD_BIG_FOUR_LIFT_TYPES = BIG_FOUR_LIFT_TYPES;

export const STANDARD_BIG_FOUR_LIFT_TYPE_SET = BIG_FOUR_LIFT_TYPE_SET;

export const STANDARD_BODYWEIGHT_LOAD_LIFT_TYPES = [
  "Chin-up",
  "Pull-up",
  "Dip",
  "Ring Dip",
  "Muscle-up",
];

export const STANDARD_BODYWEIGHT_LOAD_LIFT_TYPE_SET = new Set(
  STANDARD_BODYWEIGHT_LOAD_LIFT_TYPES,
);

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

const BODYWEIGHT_LOAD_LIFT_TYPE_ALIASES = {
  "chin up": "Chin-up",
  "chin ups": "Chin-up",
  chinup: "Chin-up",
  chinups: "Chin-up",
  "pull up": "Pull-up",
  "pull ups": "Pull-up",
  pullup: "Pull-up",
  pullups: "Pull-up",
  dip: "Dip",
  dips: "Dip",
  "bar dip": "Dip",
  "bar dips": "Dip",
  "parallel bar dip": "Dip",
  "parallel bar dips": "Dip",
  "ring dip": "Ring Dip",
  "ring dips": "Ring Dip",
  "muscle up": "Muscle-up",
  "muscle ups": "Muscle-up",
  muscleup: "Muscle-up",
  muscleups: "Muscle-up",
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

function normalizeBodyweightLoadLiftTypeLookupKey(liftType) {
  return normalizeLiftTypeLookupKey(liftType)
    .replace(/\b(?:weighted|bodyweight|body weight|bw|strict)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeBodyweightLoadLiftType(liftType) {
  if (STANDARD_BODYWEIGHT_LOAD_LIFT_TYPE_SET.has(liftType)) return liftType;
  const key = normalizeBodyweightLoadLiftTypeLookupKey(liftType);
  return BODYWEIGHT_LOAD_LIFT_TYPE_ALIASES[key] || null;
}

export function isBodyweightLoadLiftName(liftType) {
  if (STANDARD_BODYWEIGHT_LOAD_LIFT_TYPE_SET.has(liftType)) return true;
  return Boolean(normalizeBodyweightLoadLiftType(liftType));
}

export function isValidLiftWeight(liftType, weight) {
  if (weight == null || String(weight).trim() === "") return false;
  const numericWeight = Number(weight);
  if (!Number.isFinite(numericWeight)) return false;
  if (numericWeight > 0) return true;
  return numericWeight === 0 && isBodyweightLoadLiftName(liftType);
}

// Every curated lift's name and synonyms, keyed the same way as the aliases
// above, so "Paused Bench" and "close-grip bench press" arrive under the
// registry's name and every page, chart and card sees one lift. The registry
// owns these; add a spelling there, not here.
const REGISTRY_LIFT_TYPE_ALIASES = new Map();
for (const lift of CURATED_LIFTS) {
  const synonyms = Array.isArray(lift.synonyms) ? lift.synonyms : [];
  for (const name of [lift.liftType, ...synonyms]) {
    const key = normalizeLiftTypeLookupKey(name);
    if (key) REGISTRY_LIFT_TYPE_ALIASES.set(key, lift.liftType);
  }
}

// Allow variations of common lift names and capitalization but harmonize for output.
export function normalizeLiftTypeNames(liftType) {
  const known = matchKnownLiftType(liftType);
  if (known) return known;

  const bare = stripBarbellQualifier(liftType);
  if (bare && bare !== String(liftType ?? "").trim()) {
    return matchKnownLiftType(bare) || liftType;
  }
  return liftType; // Defaults to original if no match
}

function matchKnownLiftType(liftType) {
  const key = normalizeLiftTypeLookupKey(liftType);
  return (
    BIG_FOUR_LIFT_TYPE_ALIASES[key] ||
    REGISTRY_LIFT_TYPE_ALIASES.get(key) ||
    normalizeBodyweightLoadLiftType(liftType) ||
    null
  );
}

// Gym apps name the plain barbell lift by its equipment: Hevy and Strong write
// "Squat (Barbell)", others write "Barbell Squat". Only the barbell qualifier
// is dropped, and only as a second try once the full name has missed, so
// "Barbell Row" keeps its registry name and "Bench Press (Dumbbell)" or
// "Squat (Smith Machine)" stay lifts of their own instead of joining the big four.
function stripBarbellQualifier(liftType) {
  return String(liftType ?? "")
    .replace(/\s*\(\s*barbell\s*\)\s*/gi, " ")
    .replace(/^\s*barbell\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
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

// Reads a weight cell like "100", "100kg" or "225 lb" into
// { value, unitType, _explicitUnit }. _explicitUnit is true when the cell
// named a unit and null when it did not, so a parser can pick a default.
//
// Almost every cell matches PLAIN_WEIGHT, so the common case costs one regex.
// Anything else goes through repairWeightText(), which fixes the typos real
// sheets hold and reports each fix in `repairs`, or sets `skip` when the cell
// is a distance or time rather than a load (cardio and body measurements share
// the sheet with lifts). The caller logs both with createParseRepairLog().
const PLAIN_WEIGHT = /^(\d+(?:\.\d+)?)\s*(kg|lbs?)?$/i;

export function convertWeightAndUnitType(weightString) {
  // Google Sheets API returns empty string for empty cells
  if (weightString == null || weightString === "") {
    return { value: undefined, unitType: undefined, _explicitUnit: null };
  }

  const text = String(weightString).trim();
  const plain = PLAIN_WEIGHT.exec(text);
  if (plain) {
    const unit = plain[2]?.toLowerCase();
    return {
      value: parseFloat(plain[1]),
      unitType: unit === "kg" ? "kg" : "lb", // parser applies the sheet's default
      _explicitUnit: unit ? true : null,
    };
  }
  return repairWeightText(text);
}

// Unit spellings seen in the wild. A null repair is a normal spelling; a
// string is logged, because it is a guess.
const WEIGHT_UNITS = {
  kg: ["kg", null],
  kgs: ["kg", null],
  kilo: ["kg", null],
  kilos: ["kg", null],
  kilogram: ["kg", null],
  kilograms: ["kg", null],
  g: ["kg", 'unit "g" read as kg'],
  k: ["kg", 'unit "k" read as kg'],
  gk: ["kg", 'unit "gk" read as kg'],
  kgg: ["kg", 'unit "kgg" read as kg'],
  lb: ["lb", null],
  lbs: ["lb", null],
  pound: ["lb", null],
  pounds: ["lb", null],
  "#": ["lb", null],
  ib: ["lb", 'unit "ib" read as lb'],
  ibs: ["lb", 'unit "ibs" read as lb'],
};

// Distance and time units: the row is cardio or a measurement, not a lift.
const NON_WEIGHT_UNIT =
  /^(?:mm|cm|m|km|mi|miles?|meters?|metres?|yds?|s|secs?|seconds?|mins?|minutes?|h|hrs?|hours?|cals?|kcal)$/i;

// Keys that slip into a number by accident: the backtick sits beside the 1.
const STRAY_CHARACTER = /[`'´~]/;

const WEIGHT_WITH_EXTRAS =
  /^(\d+(?:[.,]\d+)?)(\s*-\s*\d+(?:[.,]\d+)?)?\s*([a-z#]*)\.?$/i;

function repairWeightText(original) {
  const repairs = [];
  let text = original;

  if (STRAY_CHARACTER.test(text)) {
    text = text.replace(/[`'´~]/g, "").trim();
    repairs.push("stray character removed");
  }

  const match = WEIGHT_WITH_EXTRAS.exec(text);
  if (!match) {
    if (/\d:\d\d/.test(text)) {
      return {
        value: undefined,
        unitType: undefined,
        _explicitUnit: null,
        skip: "time, not a weight",
      };
    }
    // Last resort, as the parser has always done: the leading number, with
    // a unit if one appears anywhere ("100kg belt").
    const value = parseFloat(text);
    if (isNaN(value)) {
      return {
        value: undefined,
        unitType: undefined,
        _explicitUnit: null,
        skip: "unreadable weight",
      };
    }
    const lower = text.toLowerCase();
    const unitType = lower.includes("kg")
      ? "kg"
      : lower.includes("lb")
        ? "lb"
        : null;
    repairs.push("read the leading number");
    return {
      value,
      unitType: unitType || "lb",
      _explicitUnit: unitType ? true : null,
      repairs,
    };
  }

  let [, numberText, range, unitText] = match;

  // A comma before one or two digits is a decimal comma, a typo for some
  // lifters and the normal way to write it in much of Europe. Before three
  // digits it separates thousands.
  if (numberText.includes(",")) {
    const [whole, fraction] = numberText.split(",");
    if (fraction.length === 3) {
      numberText = whole + fraction;
      repairs.push("thousands comma");
    } else {
      numberText = `${whole}.${fraction}`;
      repairs.push("decimal comma");
    }
  }
  if (range) repairs.push("range, kept the lower weight");

  const unitKey = unitText.toLowerCase();
  let unitType = null;
  if (unitKey) {
    if (NON_WEIGHT_UNIT.test(unitKey)) {
      return {
        value: undefined,
        unitType: undefined,
        _explicitUnit: null,
        skip: `"${unitText}" is a distance or time, not a weight`,
      };
    }
    const known = WEIGHT_UNITS[unitKey];
    if (!known) {
      return {
        value: undefined,
        unitType: undefined,
        _explicitUnit: null,
        skip: `unknown unit "${unitText}"`,
      };
    }
    unitType = known[0];
    if (known[1]) repairs.push(known[1]);
  }

  return {
    value: parseFloat(numberText),
    unitType: unitType || "lb", // parser applies the sheet's default
    _explicitUnit: unitType ? true : null,
    repairs,
  };
}

// A reps cell holding "5km" or "20 min" is cardio logged in the reps column.
export function isDistanceOrTimeText(text) {
  const unit = /^\d+(?:[.,]\d+)?\s*([a-z]+)$/i.exec(String(text).trim())?.[1];
  return (
    Boolean(unit && NON_WEIGHT_UNIT.test(unit)) || /\d:\d\d/.test(String(text))
  );
}

// Collects every guess a parse makes and prints one console line per kind,
// with a count and a few examples, so a sheet full of decimal commas costs
// one line rather than thousands.
export function createParseRepairLog(source, { examples = 3 } = {}) {
  const kinds = new Map();
  return {
    add(kind, rowNumber, raw, outcome) {
      let entry = kinds.get(kind);
      if (!entry) kinds.set(kind, (entry = { count: 0, examples: [] }));
      entry.count++;
      if (entry.examples.length < examples) {
        entry.examples.push(
          `row ${rowNumber} "${raw}"${outcome ? ` → ${outcome}` : ""}`,
        );
      }
    },
    flush() {
      for (const [kind, { count, examples: shown }] of kinds) {
        console.info(
          `${source} (parser): ${kind}: ${count} row${count === 1 ? "" : "s"}, e.g. ${shown.join("; ")}`,
        );
      }
    },
  };
}
