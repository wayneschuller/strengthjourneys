// TurnKey coaching platform exports.
//
// One row per assigned exercise, with the sets, reps and weight a coach
// assigned and whatever the lifter recorded doing instead. Each row is
// expanded into one entry per set. Follows the parser contract in
// import-dispatcher.js.
//
// What counts as left out, checked against a real five-year export: an
// exercise the lifter did whose numbers we cannot read. That is mostly a
// coach's prescription written as free text ("work up to a heavy 3 to 5"),
// which has no reps to read, and an exercise assigned by RPE or left at zero
// with no load recorded against it. A workout never completed, or an exercise
// marked missed, was not trained, so it is neither imported nor counted.
//
// The export states a unit on every row, and it can state the wrong one. That
// same history labels its first seven months lb, while the numbers are the
// kilograms the lifter logged in their own sheet on those days. A lifter
// trains in one unit, so when a file states two, every row is read in the one
// most of its rows use, and the console says how many sets that changed.

import { requireImportSource } from "@/lib/import/import-sources";
import { devLog } from "@/lib/processing-utils";
import {
  countSkip,
  createParseRepairLog,
  getSetSkipReason,
  isValidLiftWeight,
  normalizeDecimalComma,
  normalizeLiftTypeNames,
} from "@/lib/import/parsers/parser-utilities";

export const turnKeyFormat = {
  ...requireImportSource("turnkey"),
  detect: isTurnKeyExport,
  parse: parseTurnKeyData,
};

function isTurnKeyExport(headers) {
  return headers.includes("user_name") && headers.includes("workout_id");
}

function readUnit(value) {
  const text = String(value ?? "")
    .trim()
    .toLowerCase();
  if (text.startsWith("kg")) return "kg";
  if (text.startsWith("lb")) return "lb";
  return null;
}

// The unit most rows state, or null when no row states one or the two are
// level, in which case each row keeps its own.
function getMainUnit(data, units_COL) {
  let kg = 0;
  let lb = 0;
  for (const row of data.slice(1)) {
    const unit = readUnit(row?.[units_COL]);
    if (unit === "kg") kg++;
    if (unit === "lb") lb++;
  }
  if (kg === lb) return null;
  return kg > lb ? "kg" : "lb";
}

function parseTurnKeyData(data) {
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
  const skippedByReason = {};
  const acceptedWorkouts = new Set();
  const mainUnit = getMainUnit(data, units_COL);
  let setsReadInMainUnit = 0;

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

    // One row stands for this many sets, whether they are imported or not
    // This makes no difference to the graph, but it benefits a user wanting to convert their TurnKey data to our bespoke format
    // It may help with some achievements and tonnage count in a future feature
    let sets = 1;
    if (parseInt(row[assigned_sets_COL], 10) > 1)
      sets = parseInt(row[assigned_sets_COL], 10);
    if (parseInt(row[actual_sets_COL], 10) > 1)
      sets = parseInt(row[actual_sets_COL], 10);

    // No assigned reps happens when a BLOC coach writes the prescription as
    // a comment in the web app. There is no number to read, so the reps stay
    // missing even if something sits in the actual columns.
    const hasAssignedReps = !isNaN(parseInt(row[assigned_reps_COL], 10));

    let lifted_reps = parseInt(row[assigned_reps_COL], 10);
    let lifted_weight = parseFloat(
      normalizeDecimalComma(row[assigned_weight_COL]),
    );

    // Override if there is an actual_reps and actual_weight
    // This happens when the person lifts different to what was assigned by their coach
    if (
      isFinite(parseInt(row[actual_reps_COL], 10)) &&
      isFinite(parseFloat(normalizeDecimalComma(row[actual_weight_COL])))
    ) {
      lifted_reps = parseInt(row[actual_reps_COL], 10);
      lifted_weight = parseFloat(normalizeDecimalComma(row[actual_weight_COL]));
    }

    const statedUnit = readUnit(row[units_COL]);
    const unitType = mainUnit ?? row[units_COL];

    const liftURL = `https://app.turnkey.coach/workout/${row[workout_id_COL]}`;

    const rawLiftType = row[exercise_name_COL];
    const liftType = normalizeLiftTypeNames(rawLiftType);

    // TurnKey writes 0 where no load was entered, as it does for an exercise
    // assigned by RPE. That is a missing load, not a zero one, unless the
    // lift is one that carries none.
    const noLoadEntered = !isFinite(lifted_weight) || lifted_weight === 0;
    const skipReason = getSetSkipReason({
      date: row[workout_date_COL],
      liftType,
      reps: hasAssignedReps ? lifted_reps : null,
      weight:
        noLoadEntered && !isValidLiftWeight(liftType, lifted_weight)
          ? null
          : lifted_weight,
    });
    if (skipReason) {
      countSkip(skippedByReason, skipReason, sets);
      return;
    }

    acceptedWorkouts.add(row[workout_id_COL]);
    if (mainUnit && statedUnit && statedUnit !== mainUnit) {
      setsReadInMainUnit += sets;
    }

    // Expand TurnKey sets into separate liftEntry tuples
    for (let i = 1; i <= sets; i++) {
      let notes = `Set ${i} of ${sets}`;
      if (sets === 1) notes = undefined; // No notes for a single set
      parsedData.push({
        date: row[workout_date_COL],
        liftType: liftType,
        rawLiftType: rawLiftType,
        reps: lifted_reps,
        weight: lifted_weight,
        URL: liftURL,
        unitType: unitType,
        notes: notes,
      });
    }
  });

  if (setsReadInMainUnit > 0) {
    const otherUnit = mainUnit === "kg" ? "lb" : "kg";
    const repairLog = createParseRepairLog(turnKeyFormat.name);
    repairLog.issue(
      `${setsReadInMainUnit} sets are labelled ${otherUnit} in this export and were read as ${mainUnit}, the unit most of it uses.`,
      `TurnKey can label a row with a unit the lifter never trained in. Check a lift from those dates, and use the feedback button if it should be ${otherUnit}.`,
    );
    repairLog.flush();
  }

  return {
    entries: parsedData,
    skippedByReason,
    workoutCount: acceptedWorkouts.size,
    unitType: mainUnit ?? undefined,
  };
}
