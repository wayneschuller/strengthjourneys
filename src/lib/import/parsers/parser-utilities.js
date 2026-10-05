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

// A lift name with case, accents and punctuation set aside, so two spellings
// of one name meet. The registry lookup uses it, and so does the merge's
// duplicate check for lifts the registry does not know.
export function normalizeLiftTypeLookupKey(liftType) {
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
  if (standardColumnNames[normalizedInput]) {
    return standardColumnNames[normalizedInput];
  }

  // Last, look past decoration a lifter adds to a header: a unit or hint in
  // brackets, a trailing colon, doubled spaces. "Weight (kg)" is still the
  // Weight column, and reading it as one keeps the parser from going looking
  // for the weights in some other column.
  const undecorated = normalizedInput
    .replace(/\s*[([{][^)\]}]*[)\]}]\s*/g, " ")
    .replace(/[:.]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
  return standardColumnNames[undecorated] || columnName; // Default to original if no match
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

// Apps that follow the phone's number format write "117,5" for 117.5
// (JEFIT and Alpha Progression do). A comma before one or two final digits is
// read as the decimal point; any other text comes back trimmed and untouched.
const DECIMAL_COMMA = /^(-?\d+),(\d{1,2})$/;

export function normalizeDecimalComma(value) {
  const text = String(value ?? "").trim();
  return DECIMAL_COMMA.test(text) ? text.replace(",", ".") : text;
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

// Collects notices into one collapsed group per parse, with one line per
// repair kind and a few examples, so large sheets keep the console readable.
// Repair advice stays enabled in production on every device, unlike devLog.
export function createParseRepairLog(source, { examples = 3 } = {}) {
  const kinds = new Map();
  const notices = [];
  return {
    issue(message, suggestion, level = "info") {
      notices.push({ message, suggestion, level });
    },
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
      const noticeCount = notices.length + kinds.size;
      if (noticeCount === 0) return;
      const title = `📝 ${source} parsing — ${noticeCount} notice${noticeCount === 1 ? "" : "s"}`;
      if (typeof window === "undefined") {
        console.groupCollapsed(title);
      } else {
        console.groupCollapsed("%c%s", "color:#22c55e;font-weight:bold", title);
      }
      try {
        for (const { message, suggestion, level } of notices) {
          logParseIssue(message, suggestion, level);
        }
        for (const [kind, { count, examples: shown }] of kinds) {
          logParseIssue(
            `${kind}: ${count} row${count === 1 ? "" : "s"}, e.g. ${shown.join("; ")}`,
            getParseRepairSuggestion(kind),
          );
        }
      } finally {
        console.groupEnd();
        notices.length = 0;
        kinds.clear();
      }
    },
  };
}

// Browser consoles support CSS via %c. Keep server/script output plain, and
// pass sheet text through %s so a cell containing "%c" cannot consume styles.
export function logParseIssue(message, suggestion, level = "info") {
  if (typeof window === "undefined") {
    console[level](`${message}\nSuggestion: ${suggestion}`);
    return;
  }
  console[level](
    "%s\n%cSuggestion: %s",
    message,
    "font-weight: normal; font-style: italic;",
    suggestion,
  );
}

function getParseRepairSuggestion(kind) {
  const suggestions = {
    "decimal comma":
      "For unambiguous weights, use a decimal point, for example 112.5kg.",
    "thousands comma": "Leave out thousands separators, for example 1025lb.",
    "stray character removed":
      "Remove stray quotes or backticks from the Weight cells shown above.",
    "range, kept the lower weight":
      "Record one weight per set in Weight; put ranges or targets in Notes.",
    "read the leading number":
      "Keep Weight to a number with kg or lb, for example 100kg; put extra details in Notes.",
    "no unit, read as kg like most of the sheet":
      "Add kg or lb to each weight so its unit is explicit, for example 100kg.",
    "unreadable weight, row skipped":
      "Enter a number with kg or lb in Weight, for example 100kg, to include this set.",
  };
  if (suggestions[kind]) return suggestions[kind];
  if (
    kind.includes("distance or time") ||
    kind === "time, not a weight, row skipped"
  ) {
    return "Keep Reps to a rep count and Weight to a lifting load; put distances, times and measurements in Notes or a separate tab.";
  }
  if (kind.startsWith("unit ") || kind.startsWith("unknown unit ")) {
    return "Use kg or lb for lifting weights; check the unit in the Weight cells shown above.";
  }
  return "Check the cells shown above and use a number with kg or lb in Weight.";
}

// -- What counts as a set ----------------------------------------------------

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Why a candidate set cannot become a lift entry, or null when it can. This is
// the one statement of what an imported set must have: a real ISO date, a
// lift name, whole reps above zero, and a load isValidLiftWeight accepts.
//
// It is asked twice. A parser asks while it walks its rows, so the import
// preview can say what was left out and why. The dispatcher asks again of
// every finished entry, so no format can hand the app a set the rest of the
// code would trip over. See the parser contract in import-dispatcher.js.
//
// `isDurationOrDistance` is the parser's word that a row with no reps is
// cardio or timed work rather than a set someone forgot to fill in.
export function getSetSkipReason({
  date,
  liftType,
  reps,
  weight,
  isDurationOrDistance = false,
}) {
  if (typeof date !== "string" || !ISO_DATE.test(date)) return "invalidDate";
  if (!liftType) return "missingExercise";
  if (!Number.isInteger(reps) || reps <= 0) {
    return isDurationOrDistance
      ? "unsupportedDurationOrDistance"
      : "missingReps";
  }
  if (!isValidLiftWeight(liftType, weight)) {
    return weight == null ? "missingWeight" : "invalidWeight";
  }
  return null;
}

// Adds to a parser's count of sets left out for `reason`. One by default;
// `sets` when one row of the export stood for several.
export function countSkip(skippedByReason, reason, sets = 1) {
  skippedByReason[reason] = (skippedByReason[reason] || 0) + sets;
}

// -- Reading an app's export -------------------------------------------------
//
// Helpers shared by the app-export parsers (Hevy, Strong and the rest). Each
// parser used to keep its own copy, and the copies had drifted into two
// readings of a number and two ways of finding a column. Both are kept, under
// names that say which is which, because merging them would change what some
// imports accept.

// A header cell as the parsers compare it: byte-order mark gone, trimmed,
// lower case.
export function normalizeHeaderCell(header) {
  return String(header || "")
    .replace(/^﻿/, "")
    .trim()
    .toLowerCase();
}

// The first column whose header, compared as above, is one of `names`.
// -1 when the export has no such column.
export function findColumn(headers, ...names) {
  const wanted = names.map(normalizeHeaderCell);
  return headers.findIndex((header) =>
    wanted.includes(normalizeHeaderCell(header)),
  );
}

// The first of `candidates` an export uses as a header, spelled and cased
// exactly as given. Candidates are in order of preference, so an earlier name
// wins even when a later one sits in an earlier column.
export function findExactColumn(headers, candidates) {
  for (const candidate of candidates) {
    const index = headers.indexOf(candidate);
    if (index >= 0) return index;
  }
  return -1;
}

// A number where the whole cell has to be the number: "100" and "117,5" read,
// "100kg" and a blank cell do not. Hevy, Fitbod and FitNotes are read this way.
export function parseStrictNumber(value) {
  const raw = normalizeDecimalComma(value);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseStrictInteger(value) {
  const raw = String(value ?? "").trim();
  if (!/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

// A number read from the front of the cell, so "100kg" reads as 100. Strong,
// StrongLifts and Wodify are read this way.
export function parseLeadingNumber(value) {
  const parsed = Number.parseFloat(normalizeDecimalComma(value));
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseLeadingInteger(value) {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

// A real day on the calendar, so "31 Feb" is turned away rather than rolled
// over into March.
export function isValidCalendarDate(year, month, day) {
  if (!year || !month || !day) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

// An exercise name as an export wrote it, tidied and passed through the
// shared normalizer. Apps name equipment in brackets: "Squat (Barbell)",
// "Bench Press (Dumbbell)". The normalizer drops only the barbell qualifier,
// so a dumbbell or Smith machine set stays its own lift and never joins the
// big four. Null for a blank cell.
export function normalizeExportLiftType(rawLiftType) {
  const cleaned = String(rawLiftType || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  return normalizeLiftTypeNames(cleaned);
}

// One notes cell from whatever a row offers, blanks and repeats left out.
export function buildNotes(...parts) {
  const unique = [];
  parts.forEach((part) => {
    const trimmed = String(part || "").trim();
    if (!trimmed) return;
    if (!unique.includes(trimmed)) unique.push(trimmed);
  });
  return unique.length > 0 ? unique.join(" | ") : undefined;
}
