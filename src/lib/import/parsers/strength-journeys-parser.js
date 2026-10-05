// Parse Strength Journeys Google Sheet format.
// This is the official Strength Journeys template we offer a sample of:
// https://docs.google.com/spreadsheets/d/14J9z9iJBCeJksesf3MdmpTUmo2TIckDxIQcTx1CPEO0/edit#gid=0
//
// We try to be agnostic about column positions by normalizing header names.
//
// SPARSE ENCODING / ANCHOR ROWS:
// The sheet uses a sparse encoding where Date and Lift Type are
// only written on "anchor rows" — the first row of a session or the first row of
// a new lift type within a session. All subsequent rows for the same date/lift
// leave those cells blank and inherit from the previous row via `previousDate`
// and `previousLiftType`. See the full data model (examples, anchor types,
// insertion order, deletion/promotion rules) in the block comment at the top of
// src/pages/api/sheet/insert-row.js.
//
// Returns a `ParsedData` array that is always sorted by date ascending.
// See getDemoParsedData in @/lib/import/sample-parsed-data.js for example data.

import { recordTiming } from "@/lib/processing-utils";
import { normalizeDateInput } from "@/lib/date-utils";
import { getCuratedLift } from "@/lib/lifts/lift-registry";
import {
  normalizeLiftTypeNames,
  normalizeColumnName,
  convertStringToInt,
  convertWeightAndUnitType,
  createParseRepairLog,
  isDistanceOrTimeText,
  STANDARD_BODYWEIGHT_LOAD_LIFT_TYPE_SET,
} from "@/lib/import/parsers/parser-utilities";

// How each parse found its columns, kept beside the array it returned so the
// rows themselves stay plain lift objects.
const sheetLayouts = new WeakMap();

/**
 * Where the sheet behind a parse keeps its columns, and which of them had to
 * be worked out from their contents.
 *
 * @param {import("./index").ParsedData} parsedData As returned by
 *   parseStrengthJourneysData (the same array, not a copy).
 * @returns {{hasHeaderRow: boolean, header: string[],
 *   columns: Object<string, number>, inferred: string[]} | null} `header` is
 *   row 1 with recognised names normalised (empty when the sheet has no
 *   header row). `columns` maps Date, Lift Type, Reps, Weight, Notes, Label
 *   and URL to a 0-based column index, -1 when absent.
 */
export function getSheetLayout(parsedData) {
  return (parsedData && sheetLayouts.get(parsedData)) ?? null;
}

const STANDARD_COLUMN_ORDER = [
  "Date",
  "Lift Type",
  "Reps",
  "Weight",
  "Notes",
  "URL",
];

/**
 * Can the log page write to a sheet laid out like this? Its write routes
 * address cells by position: a header in row 1, then Date, Lift Type, Reps,
 * Weight, Notes and URL in columns A to F. Reading copes with any order, and
 * with no header at all; a write to such a sheet would land under the wrong
 * heading.
 *
 * A required column still counts when its header cell is blank and its
 * contents put it in the right place (a header deleted by accident). Notes
 * and URL may be unlabelled, as on older sheets; they may not be labelled as
 * something else.
 */
export function isStandardSheetLayout(layout) {
  if (!layout?.hasHeaderRow) return false;
  // A first row with nothing recognisable in it is not a header to trust.
  if (!STANDARD_COLUMN_ORDER.some((name, i) => layout.header[i] === name)) {
    return false;
  }
  return STANDARD_COLUMN_ORDER.every((name, column) => {
    const header = layout.header[column] ?? "";
    if (column >= 4) return header === name || header === "";
    return (
      layout.columns[name] === column && (header === name || header === "")
    );
  });
}

/**
 * Parse the Strength Journeys Google Sheet format into `ParsedData`.
 *
 * @param {any[][]} data Raw Google Sheets `values` array (rows x columns)
 * @returns {import("./index").ParsedData}
 */
export function parseStrengthJourneysData(data) {
  const startTime = performance.now();
  let previousDate = null;
  let previousRawDate = null;
  let previousLiftType = null;
  let previousRawLiftType = null;
  const localeHint =
    typeof navigator !== "undefined" && typeof navigator.language === "string"
      ? navigator.language
      : undefined;

  const firstRowNames = (data[0] ?? []).map((name) =>
    normalizeColumnName(String(name ?? "")),
  );
  // A date in the first row, with no recognized headers, identifies a sheet
  // that starts directly with data. An empty first row is still a header row.
  const hasHeaderRow =
    firstRowNames.some((name) =>
      ["Date", "Lift Type", "Reps", "Weight", "Notes", "Label", "URL"].includes(
        name,
      ),
    ) ||
    !(data[0] ?? []).some((value) => normalizeDateInput(value, localeHint));
  const normalizedColumnNames = hasHeaderRow ? firstRowNames : [];
  const firstDataRow = hasHeaderRow ? 1 : 0;
  const repairLog = createParseRepairLog("Strength Journeys");

  // Find indices for all columns
  let dateColumnIndex = normalizedColumnNames.indexOf("Date");
  let liftTypeColumnIndex = normalizedColumnNames.indexOf("Lift Type");
  let repsColumnIndex = normalizedColumnNames.indexOf("Reps");
  let weightColumnIndex = normalizedColumnNames.indexOf("Weight");
  let notesColumnIndex = normalizedColumnNames.indexOf("Notes");
  let labelColumnIndex = normalizedColumnNames.indexOf("Label");
  let urlColumnIndex = normalizedColumnNames.indexOf("URL");

  // Complete named headers bypass inference entirely. Recovered columns are
  // local to this parse; never change the sheet or assume a column position.
  const columns = inferRequiredColumns(
    data,
    {
      Date: dateColumnIndex,
      "Lift Type": liftTypeColumnIndex,
      Reps: repsColumnIndex,
      Weight: weightColumnIndex,
    },
    localeHint,
    normalizedColumnNames,
    firstDataRow,
  );
  const inferredColumns = [];
  for (const [name, index] of Object.entries(columns)) {
    if (index !== -1 && normalizedColumnNames[index] !== name) {
      inferredColumns.push(name);
      const evidence = {
        Date: "date values",
        "Lift Type": "known lift names",
        Reps: "whole-number values paired with weights",
        Weight: "load values paired with rep counts",
      };
      repairLog.issue(
        `Inferred ${name} from the ${evidence[name]} in column ${index + 1} because ${hasHeaderRow ? "its header is blank" : "the sheet starts with data instead of a header row"}.`,
        hasHeaderRow
          ? `Restore "${name}" in the first-row header of column ${index + 1} in your Google Sheet.`
          : `Insert a header row above your first set and put "${name}" in column ${index + 1}.`,
      );
    }
  }
  dateColumnIndex = columns.Date;
  liftTypeColumnIndex = columns["Lift Type"];
  repsColumnIndex = columns.Reps;
  weightColumnIndex = columns.Weight;

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
      `Missing required columns: ${missingColumns.join(", ")}. ${hasHeaderRow ? "Please ensure your Google Sheet first row includes missing column headers." : "Could not confidently infer the columns. Please insert a header row above your first set with Date, Lift Type, Reps and Weight in their corresponding columns."} Click the feedback button below if you need help!`,
    );
  }

  const objectsArray = [];
  // Cache column indices outside the loop since they never change
  const dateCol = dateColumnIndex;
  const liftTypeCol = liftTypeColumnIndex;
  const repsCol = repsColumnIndex;
  const weightCol = weightColumnIndex;
  const notesCol = notesColumnIndex;
  const labelCol = labelColumnIndex;
  const urlCol = urlColumnIndex;

  for (let i = firstDataRow; i < data.length; i++) {
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
      const normalizedDate = normalizeDateInput(row[dateCol], localeHint);
      if (normalizedDate) {
        // Valid date: use it and update previousDate
        obj.date = normalizedDate;
        previousDate = normalizedDate;
        previousRawDate = row[dateCol];
      } else {
        // Invalid date: warn, skip this row, and reset previousDate to null
        // This ensures that subsequent rows with blank dates will also be skipped
        // until a new valid date is found, enforcing data integrity
        repairLog.issue(
          `Invalid date encountered at row ${i + 1}: '${row[dateCol]}'. Row skipped.`,
          "Use a valid date in YYYY-MM-DD format, for example 2026-10-02. Blank dates inherit the previous date; sets after an invalid date are skipped until the next valid date.",
          "warn",
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
    // The log's verified writes compare against the sheet's own cell text.
    // Keep that text wherever reading it changed it ("3/8/2026", " 5"), the
    // way rawLiftType and rawWeight already do for their cells.
    if (previousRawDate !== obj.date) obj.rawDate = String(previousRawDate);
    // --- END DATE HANDLING LOGIC ---

    // Process lift type next since it's used for previousLiftType
    if (row[liftTypeCol]) {
      obj.rawLiftType = row[liftTypeCol];
      obj.liftType = normalizeLiftTypeNames(row[liftTypeCol]);
      previousLiftType = obj.liftType; // Store normalized value so inherited rows get "Strict Press" not "Overhead Press"
      previousRawLiftType = obj.rawLiftType;
    } else {
      obj.liftType = previousLiftType;
      obj.rawLiftType = previousRawLiftType;
    }

    // Process required fields. Cardio and timed work ("5km", "10 minute")
    // share some sheets with lifts; leave those rows out rather than read a
    // distance as a load.
    if (isDistanceOrTimeText(row[repsCol])) {
      repairLog.add(
        "reps are a distance or time, row skipped",
        i + 1,
        row[repsCol],
      );
      continue;
    }
    obj.reps = convertStringToInt(row[repsCol]);
    if (String(obj.reps) !== String(row[repsCol])) {
      obj.rawReps = String(row[repsCol]);
    }
    if (row[weightCol]) obj.rawWeight = row[weightCol]; // Store raw before normalization
    const { value, unitType, _explicitUnit, repairs, skip } =
      convertWeightAndUnitType(row[weightCol]);
    if (skip) {
      repairLog.add(`${skip}, row skipped`, i + 1, row[weightCol]);
      continue;
    }
    if (repairs) {
      for (const repair of repairs) {
        repairLog.add(
          repair,
          i + 1,
          row[weightCol],
          `${value}${_explicitUnit ? unitType : ""}`,
        );
      }
    }
    obj.weight = value;
    obj.unitType = unitType;
    if (_explicitUnit !== null) obj._explicitUnit = _explicitUnit; // true=explicit, null=ambiguous

    // Validate that we have valid numbers for required fields
    if (obj.reps === undefined || obj.weight === undefined) {
      continue;
    }

    // Process optional fields only if they exist
    if (row[notesCol]) obj.notes = row[notesCol];
    if (row[labelCol]) obj.label = row[labelCol];
    if (row[urlCol]) obj.URL = row[urlCol];

    // Store the 1-based sheet row number so the editor can write back to the exact row
    obj.rowIndex = i + 1;

    objectsArray.push(obj);
  }

  // Two-pass smart default for unitType
  //
  // Why: users often write weights without a unit suffix (e.g. "100" instead of
  // "100kg"). A blind default of "lb" would mislabel kg-only users' data.
  //
  // How: convertWeightAndUnitType() tags each row with _explicitUnit: true when
  // a suffix was present (e.g. "100kg", "225lb"), or null when ambiguous ("100").
  // After the first pass we count explicit kg vs lb declarations. If kg wins,
  // every ambiguous entry inherits "kg" as its unitType — matching what the user
  // almost certainly intended. On a tie (or all-lb majority), we default to "lb".
  let explicitKg = 0;
  let explicitLb = 0;
  const unitless = [];
  objectsArray.forEach((obj) => {
    if (obj._explicitUnit) {
      if (obj.unitType === "kg") explicitKg++;
      else explicitLb++;
    } else {
      unitless.push(obj);
    }
    delete obj._explicitUnit; // Clean up temp field
  });
  // If majority of explicit entries are kg, treat ambiguous entries as kg too (tie → lb).
  // Unitless rows arrive as "lb", so test the list, not a missing unitType.
  if (explicitKg > explicitLb) {
    for (const obj of unitless) {
      obj.unitType = "kg";
      repairLog.add(
        "no unit, read as kg like most of the sheet",
        obj.rowIndex,
        obj.rawWeight,
      );
    }
  }

  repairLog.flush();

  // FIXME: if there are no entries we could throw an error to prompt them to sheet docs article?

  // Safe array sort
  // We have to make sure our sorting preserves intraday order
  objectsArray.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.localeCompare(b.date);
  });

  recordTiming(
    "Parse",
    performance.now() - startTime,
    `${objectsArray.length} lifts`,
  );

  sheetLayouts.set(objectsArray, {
    hasHeaderRow,
    header: normalizedColumnNames.map((name) => String(name ?? "").trim()),
    columns: {
      Date: dateColumnIndex,
      "Lift Type": liftTypeColumnIndex,
      Reps: repsColumnIndex,
      Weight: weightColumnIndex,
      Notes: notesColumnIndex,
      Label: labelColumnIndex,
      URL: urlColumnIndex,
    },
    inferred: inferredColumns,
  });

  return objectsArray;
}

// Resolve sparse Date/Lift Type columns first, then consider Reps and Weight
// together. Names supplied by the user always win, including optional headers.
// Only missing-header parses pay for profiling the unnamed columns.
function inferRequiredColumns(
  data,
  namedColumns,
  localeHint,
  headers,
  firstDataRow,
) {
  if (Object.values(namedColumns).every((index) => index !== -1)) {
    return { ...namedColumns };
  }
  return dropImplausibleAnchors(
    data,
    inferFromColumnProfiles(
      data,
      namedColumns,
      localeHint,
      headers,
      firstDataRow,
    ),
    namedColumns,
    firstDataRow,
  );
}

// A column can look like Date or Lift Type on very little: two meet dates
// typed beside a set are a column where "every filled cell is a date", and a
// single "Deadlift" in a spare column is 100% known lifts. Normally the real
// column is found too and the tie refuses to guess. But when the real column
// is ruled out (one stray word among the dates, lift names the registry does
// not know) the stray column is the only candidate left, and every set in the
// sheet would be shown under two dates or one lift.
//
// So an inferred Date or Lift Type column has to do the job of one:
// - nearly every set has a value on its row or above it, since that is where
//   a set gets its date and lift from. A few orphan rows at the top of a real
//   log are tolerated; a column that starts halfway down is not.
// - it carries enough values for the sets under it. Even a long session is a
//   few dozen sets, so a column averaging more than MAX_SETS_PER_ANCHOR sets
//   per value is not labelling them.
// Columns named in the header are never questioned.
const MIN_ANCHOR_COVERAGE = 0.95;
const MAX_SETS_PER_ANCHOR = 200;

function dropImplausibleAnchors(data, columns, namedColumns, firstDataRow) {
  if (columns.Reps === -1 || columns.Weight === -1) return columns;

  const checked = { ...columns };
  for (const name of ["Date", "Lift Type"]) {
    const column = columns[name];
    if (column === -1 || namedColumns[name] !== -1) continue;
    let values = 0;
    let sets = 0;
    let coveredSets = 0;
    for (let row = firstDataRow; row < data.length; row++) {
      if (String(data[row][column] ?? "").trim()) values++;
      if (!isSetRow(data[row], columns.Reps, columns.Weight)) continue;
      sets++;
      if (values > 0) coveredSets++;
    }
    if (
      sets > 0 &&
      (coveredSets < sets * MIN_ANCHOR_COVERAGE ||
        values * MAX_SETS_PER_ANCHOR < sets)
    ) {
      checked[name] = -1;
    }
  }
  return checked;
}

function inferFromColumnProfiles(
  data,
  namedColumns,
  localeHint,
  headers,
  firstDataRow,
) {
  const columns = { ...namedColumns };

  // Sheets omits trailing blank header cells, including an entirely blank row.
  const columnCount = data.reduce(
    (width, row) => Math.max(width, row.length),
    0,
  );
  const profiles = [];
  for (let column = 0; column < columnCount; column++) {
    if (String(headers[column] ?? "").trim()) continue;
    profiles.push(profileUnnamedColumn(data, column, localeHint, firstDataRow));
  }

  if (columns.Date === -1) {
    columns.Date = uniqueColumn(
      profiles.filter((p) => p.dates === p.populated),
    );
  }
  if (columns["Lift Type"] === -1) {
    // Even a machine-heavy log can have only a few familiar lifts. Registry
    // matches are evidence, not a whitelist for the entries we preserve.
    columns["Lift Type"] = uniqueColumn(
      profiles.filter((p) => p.lifts / p.populated >= 0.1),
    );
  }
  if (columns.Date === -1 || columns["Lift Type"] === -1) return columns;
  if (columns.Reps !== -1 && columns.Weight !== -1) return columns;

  const available = profiles.filter(
    (p) => !Object.values(columns).includes(p.column),
  );
  const repCandidates =
    columns.Reps !== -1
      ? [{ column: columns.Reps }]
      : available.filter(
          (p) => p.reps / p.populated >= 0.8 && p.explicitUnits === 0,
        );
  const weightCandidates =
    columns.Weight !== -1
      ? [{ column: columns.Weight }]
      : available.filter((p) => p.weights / p.populated >= 0.8);
  let assignment = null;
  for (const reps of repCandidates) {
    for (const weight of weightCandidates) {
      if (reps.column === weight.column) continue;
      if (columns.Reps === -1 && columns.Weight === -1) {
        // Units, fractional or zero loads distinguish Weight directly. For two
        // integer columns, require a repeated load pattern above 30 alongside
        // mostly 1–30 reps. A lone 45 in a column is not enough evidence.
        const hasWeightClues =
          weight.explicitUnits > 0 ||
          weight.fractions > 0 ||
          weight.zeroLoads > 0;
        const hasLoadPattern =
          weight.largeLoads >= 2 &&
          weight.largeLoads / weight.weights >= 0.5 &&
          reps.typicalReps / reps.populated >= 0.8;
        if (!hasWeightClues && !hasLoadPattern) continue;
      }
      // A column of unrelated numbers elsewhere in the sheet is not enough:
      // the candidate pair must contain at least one actual set together.
      if (!hasPairedSet(data, reps.column, weight.column, firstDataRow))
        continue;
      if (assignment) return columns; // Multiple plausible pairs: ask for headers.
      assignment = { Reps: reps.column, Weight: weight.column };
    }
  }
  return assignment ? { ...columns, ...assignment } : columns;
}

// Inspect every populated cell rather than sampling early rows. The regular
// parser still owns repairs/skips; profiling merely identifies column roles.
function profileUnnamedColumn(data, column, localeHint, firstDataRow) {
  const profile = {
    column,
    populated: 0,
    dates: 0,
    lifts: 0,
    reps: 0,
    typicalReps: 0,
    weights: 0,
    explicitUnits: 0,
    fractions: 0,
    zeroLoads: 0,
    largeLoads: 0,
  };
  for (let row = firstDataRow; row < data.length; row++) {
    const text = String(data[row][column] ?? "").trim();
    if (!text) continue;
    profile.populated++;
    if (normalizeDateInput(text, localeHint)) profile.dates++;
    const liftType = normalizeLiftTypeNames(text);
    if (
      getCuratedLift(liftType) ||
      STANDARD_BODYWEIGHT_LOAD_LIFT_TYPE_SET.has(liftType)
    )
      profile.lifts++;
    if (/^\d+$/.test(text) && Number(text) > 0) {
      profile.reps++;
      if (Number(text) <= 30) profile.typicalReps++;
    }
    const weight = inferenceWeight(text);
    if (weight) {
      profile.weights++;
      if (weight._explicitUnit) profile.explicitUnits++;
      if (!Number.isInteger(weight.value)) profile.fractions++;
      if (weight.value === 0) profile.zeroLoads++;
      if (weight.value > 30) profile.largeLoads++;
    }
  }
  return profile;
}

// Avoid the weight parser's permissive leading-number fallback here: a date,
// timestamp or free-form note starting with a number cannot identify Weight.
function inferenceWeight(text) {
  const weight = convertWeightAndUnitType(text);
  return !weight.skip &&
    Number.isFinite(weight.value) &&
    weight.value >= 0 &&
    !weight.repairs?.includes("read the leading number")
    ? weight
    : null;
}

function hasPairedSet(data, repsColumn, weightColumn, firstDataRow) {
  for (let row = firstDataRow; row < data.length; row++) {
    if (isSetRow(data[row], repsColumn, weightColumn)) return true;
  }
  return false;
}

function isSetRow(row, repsColumn, weightColumn) {
  const reps = String(row[repsColumn] ?? "").trim();
  const weight = String(row[weightColumn] ?? "").trim();
  return (
    /^\d+$/.test(reps) && Number(reps) > 0 && Boolean(inferenceWeight(weight))
  );
}

function uniqueColumn(profiles) {
  const populated = profiles.filter((p) => p.populated > 0);
  return populated.length === 1 ? populated[0].column : -1;
}
