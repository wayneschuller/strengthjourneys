/**
 * Holds every import format to the parser contract.
 *
 * The contract is written at the top of src/lib/import/import-dispatcher.js.
 * The other validate-*-importer scripts check what one app's parser makes of
 * one app's quirks. This one checks what all of them owe the dispatcher, and
 * it walks the dispatcher's own list, so a format added without a fixture
 * here fails the run.
 *
 * Every fixture is synthetic: invented rows under each format's real column
 * headings. Hevy, Strong, StrongLifts, Fitbod, FitNotes, TurnKey and Wodify's
 * legacy layout follow the shape of real exports we have studied. BTWB and
 * Wodify's public layout are built from the parser's own reading of the
 * format, because we hold no real export of either; their counts pin what
 * the parser does today, which is not the same as proving it right, and BTWB
 * does not yet say why it leaves a line out.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const sourceRoot = path.join(repositoryRoot, "src");

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) {
      return nextResolve(specifier, context);
    }
    const target = path.join(sourceRoot, specifier.slice(2));
    return {
      shortCircuit: true,
      url: pathToFileURL(path.extname(target) ? target : `${target}.js`).href,
    };
  },
  load(url, context, nextLoad) {
    // The lift registry imports its JSON files the way the Next bundlers
    // allow, with no import attribute, which bare Node refuses before a hook
    // could step in. Serve them here as modules exporting the parsed object.
    if (
      url.startsWith(pathToFileURL(sourceRoot).href) &&
      url.endsWith(".json")
    ) {
      return {
        shortCircuit: true,
        format: "module",
        source: `export default ${readFileSync(fileURLToPath(url), "utf8")};`,
      };
    }
    const loaded = nextLoad(url, context);
    if (url.startsWith(pathToFileURL(sourceRoot).href) && url.endsWith(".js")) {
      return { ...loaded, format: "module" };
    }
    return loaded;
  },
});

const { decodeCSV } = await import("../src/lib/import/decode-csv.js");
const { IMPORT_FORMATS, detectFormat, parseImportedRows } =
  await import("../src/lib/import/import-dispatcher.js");
const { IMPORT_SOURCES, requireImportSource } =
  await import("../src/lib/import/import-sources.js");
const { IMPORT_APP_PAGES } =
  await import("../src/lib/import/import-app-guides.js");
const { getSetSkipReason } =
  await import("../src/lib/import/parsers/parser-utilities.js");

// One or more files per format id. `count` is the sets a file should yield,
// `skipped` the reasons it should report, or null for a parser that does not
// yet count its skips, and `workoutCount` the workouts it should find when
// the format marks them. Rows are deliberately out of date order.
const FIXTURES = {
  hevy: [
    {
      name: "one row per set",
      csv: `title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe
Lower,"27 Aug 2025, 18:00","27 Aug 2025, 19:00",,Squat (Barbell),,,0,normal,100,5,,,8
Conditioning,"26 Aug 2025, 07:00","26 Aug 2025, 07:20",,Plank,,,0,normal,,,0,60,
Upper,"25 Aug 2025, 09:38","25 Aug 2025, 10:54",,Bench Press (Barbell),,,0,normal,80,5,,,
`,
      count: 2,
      skipped: { unsupportedDurationOrDistance: 1 },
    },
  ],
  fitbod: [
    {
      name: "one row per set",
      csv: `Date,Exercise,Reps,Weight(kg),Duration(s),Distance(m),Incline,Resistance,isWarmup,Note,multiplier
2025-08-26 07:30:00,Deadlift,3,140,,,,,false,,1
2025-08-25 08:15:00,Bench Press (Barbell),5,100,,,,,false,,1
2025-08-25 08:50:00,Treadmill,0,0,600,1500,,,false,,0
2025-08-25 09:00:00,Bench Press (Barbell),,100,,,,,false,,1
`,
      count: 2,
      skipped: { unsupportedDurationOrDistance: 1, missingReps: 1 },
    },
  ],
  stronglifts: [
    {
      name: "legacy layout, one row per workout",
      csv: `Date,Note,Workout,Body Weight,Exercise 1,Weight (KG),Weight (LB),Set 1,Set 2,Set 3,Set 4,Set 5,Exercise 2,Weight (KG),Weight (LB),Set 1,Set 2,Set 3,Set 4,Set 5
18/03/2015,"",B,84KG,Squat,62.5,140,5,5,5,5,5,Overhead press,30,65,5,5,5,5,5
16/03/2015,"",A,84KG,Squat,60,130,5,5,5,4,0,Bench press,,,5,5,,,
bad date,"",A,84KG,Squat,60,130,5,5,,,,,,,,,,,
`,
      // Sets are counted, not rows: a failed set written as 0, two bench sets
      // with no load beside them, and two sets under a date that is not one.
      // Blank set cells were never sets.
      count: 14,
      skipped: { missingReps: 1, missingWeight: 2, invalidDate: 2 },
    },
    {
      name: "current layout, one row per exercise",
      csv: `Date (yyyy/mm/dd),Workout Name,Exercise,Set 1 (Reps),Set 1 (KG),Set 2 (Reps),Set 2 (KG),Set 3 (Reps),Set 3 (KG),Note
2025/03/04,Workout B,Deadlift,5,100,,,,,
2025/03/02,Workout A,Squat,5,60,5,60,5,0,Easy
`,
      count: 3,
      skipped: { invalidWeight: 1 },
    },
  ],
  strong: [
    {
      name: "one row per set",
      csv: `Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE
2024-03-04 18:05:11,Lower A,1h 2m,Squat (Barbell),W,40,5,0,0,,Felt fresh,
2024-03-04 18:05:11,Lower A,1h 2m,Squat (Barbell),1,60,5,0,0,,Felt fresh,
2024-03-04 18:05:11,Lower A,1h 2m,Squat (Barbell),Rest Timer,,,,120,,Felt fresh,
2024-03-04 18:05:11,Lower A,1h 2m,Squat (Barbell),2,100,5,0,0,Belt on,Felt fresh,8
2024-03-04 18:05:11,Lower A,1h 2m,Squat (Barbell),3,"102,5",5,0,0,,Felt fresh,8.5
2024-03-04 18:05:11,Lower A,1h 2m,Bench Press (Dumbbell),1,30,10,0,0,,Felt fresh,
2024-03-04 18:05:11,Lower A,1h 2m,Pull Up,1,0,8,0,0,,Felt fresh,
2024-03-04 18:05:11,Lower A,1h 2m,Leg Press,1,0,10,0,0,,Felt fresh,
2024-03-04 18:05:11,Lower A,1h 2m,Plank,1,0,0,0,60,,Felt fresh,
2024-03-04 18:05:11,Lower A,1h 2m,Running,1,0,0,5,1500,,Felt fresh,
2024-03-02 07:30:00,Upper A,45m,Overhead Press (Barbell),1,20,5,0,0,,,
2024-03-02 07:30:00,Upper A,45m,Overhead Press (Barbell),2,40,0,0,0,,,
2024-03-02 07:30:00,Upper A,45m,Deadlift (Barbell),1,,5,0,0,,,
2024-03-02 07:30:00,Upper A,45m,,1,50,5,0,0,,,
not a date,Upper A,45m,Squat (Barbell),1,100,5,0,0,,,
2024-03-06 19:00:00,Lower B,50m,Deadlift (Barbell),1,140,3,0,0,,,9
`,
      // A warm-up marked W is a set. The rest timer row is not one, so it is
      // neither imported nor counted. Plank and the run are timed work.
      count: 8,
      skipped: {
        unsupportedDurationOrDistance: 2,
        invalidWeight: 1,
        missingReps: 1,
        missingWeight: 1,
        missingExercise: 1,
        invalidDate: 1,
      },
      workoutCount: 3,
    },
  ],
  wodify: [
    {
      name: "legacy layout, numeric columns",
      csv: `Name,Name(2),Label,Public Name,Date,Sets,Reps,Weight,Rep Scheme,Notes,Is PR,Text,Result 1,Result 1Label,Result 2,Result 2Label,Fully Formatted Result,Formatted Result,UOMLabel,Performance Result Type Label,Name(21),Description
Sam Lifter,6:00 AM,kg,Example Box,03/04/2024,3,5,100,,"60, 80, 5@90kg",False,,100,Weight,,,3 x 5 @ 100 kg,3 x 5 @ 100,kg,Weight,Back Squat,Build to a heavy five
Sam Lifter,6:00 AM,kg,Example Box,03/04/2024,1,3,85,,poor form,True,New 3 rep max. 85 kg 03/04/2024,85,Weight,,,1 x 3 @ 85 kg,1 x 3 @ 85,kg,Weight,Bench Press,
Sam Lifter,5:30 PM,kg,Example Box,03/02/2024,1,7,0,,,False,,0,Weight,,,1 x 7 @ 0 kg,1 x 7 @ 0,kg,Weight,Front Squat,
Sam Lifter,5:30 PM,kg,Example Box,03/02/2024,2,2,140,,,False,,140,Weight,,,2 x 2 @ 140 kg,2 x 2 @ 140,kg,Weight,Deadlift,
Sam Lifter,5:30 PM,kg,Example Box,,1,1,120,,,False,,120,Weight,,,1 x 1 @ 120 kg,1 x 1 @ 120,kg,Weight,Deadlift,
Sam Lifter,5:30 PM,kg,Example Box,03/06/2024,,,,,,False,,300,Total,,,300 kg,300,kg,Total,Back Squat,
`,
      // Three warm-ups read from the squat's notes, then its three sets, the
      // bench single and two deadlift doubles. A set logged at 0 kg and a
      // row with no date are counted. The total is a sum, not a set.
      count: 9,
      skipped: { invalidWeight: 1, invalidDate: 1 },
    },
    {
      name: "public layout, result text",
      csv: `Date,Component,Result,Performance Result Type,Comment,Personal Record Description,Component Description
03/05/2024,Back Squat,5 x 5 @ 225 lbs,Weightlifting,Moved well,,5x5 across
03/07/2024,Helen,9:12,Metcon,,,
03/01/2024,Bench Press,3 x 3 @ 100 kg,Weightlifting,,,
03/01/2024,Deadlift,3 x 3 @ 315,Weightlifting,,,
`,
      // A metcon is scored by the clock. Three deadlift sets name no unit,
      // so their load cannot be used.
      count: 8,
      skipped: { unsupportedDurationOrDistance: 1, missingWeight: 3 },
    },
  ],
  btwb: [
    {
      name: "legacy column order",
      csv: `Date,Workout,Result,Prescribed,Pukie,Work performed,Work time,Formatted Result,Notes,Description
03/04/2024,Back Squat 5x5,,true,false,,,5x5,Felt strong,"Sets
5 Back Squats | 100 kg
3 Back Squats | 110 kg"
03/02/2024,AMRAP 12,,true,false,,,3 rounds + 4 Thrusters,Brutal,"AMRAP 12 mins:
8 Thrusters, 40 kg | 8 reps
8 Pull-ups"
03/06/2024,Complex,,true,false,,,60 kg,,"1x [ 1 Power Clean + 2 Front Squats ] | 60 kg"
03/07/2024,Overhead Presses,,true,false,,,,,"Sets
5 Overhead Presses | 95 lbs
5 Overhead Presses | 0 lbs
Rest 2 mins"
never,Back Squat,,true,false,,,,,"5 Back Squats | 100 kg"
`,
      count: 8,
      skipped: null,
    },
    {
      name: "current column order",
      csv: `Date,Formatted Result,Result,Performed,Workout,Description,Notes
2024-03-09,100 kg,,true,Deadlift 3x3,"Sets
3 Deadlifts | 100 kg
3 Deadlifts | 105 kg",
2024-03-01,60 kg,,true,Back Squat,"Sets
5 Back Squats | 60 kg",Easy
`,
      count: 3,
      skipped: null,
    },
  ],
  turnkey: [
    {
      name: "assigned and actual sets",
      csv: `user_name,workout_id,workout_date,workout_completed,workout_type,workout_title,tonnage,assigned_exercise_missed,exercise_name,exercise_type,exercise_text,assigned_reps,assigned_reps_type,assigned_sets,assigned_sets_type,assigned_weight,assigned_weight_type,weight_type_value,weight_units,actual_reps,actual_sets,actual_weight
Sam,9001,2024-03-04,TRUE,workout,Week 1 Day 1,3585,FALSE,Squat,resistance,,5,standard,3,standard,100,standard,,kg,,,
Sam,9001,2024-03-04,TRUE,workout,Week 1 Day 1,3585,FALSE,Bench Press,resistance,,5,standard,3,standard,70,standard,,kg,4,3,72.5
Sam,9001,2024-03-04,TRUE,workout,Week 1 Day 1,3585,TRUE,Deadlift,resistance,,5,standard,1,standard,140,standard,,kg,,,
Sam,9002,2024-03-06,FALSE,workout,Week 1 Day 2,,FALSE,Squat,resistance,,5,standard,3,standard,102.5,standard,,kg,,,
Sam,9003,2024-03-01,TRUE,workout,Week 0 Day 3,1162.5,FALSE,Press,resistance,,5,standard,1,standard,"42,5",standard,,kg,,,
Sam,9003,2024-03-01,TRUE,workout,Week 0 Day 3,1162.5,FALSE,Deadlift,resistance,Work up to a heavy 3 to 5,,standard,0,custom,0,standard,,kg,,,
Sam,9003,2024-03-01,TRUE,workout,Week 0 Day 3,1162.5,FALSE,Barbell Row,resistance,,8,standard,2,standard,0,RPE,8,kg,,,
Sam,9003,2024-03-01,TRUE,workout,Week 0 Day 3,1162.5,FALSE,Bench Press,resistance,,5,standard,2,standard,0,RPE,8,kg,5,2,95
Sam,9003,2024-03-01,TRUE,workout,Week 0 Day 3,1162.5,FALSE,Chin-Up,resistance,,8,standard,2,standard,0,bodyweight,,kg,,,
`,
      // One row is several sets. The missed deadlift and the workout never
      // completed were not trained, so they are not counted. The free-text
      // prescription has no reps to read, and the rows assigned by RPE with
      // nothing recorded against them have no load. Chin-ups carry none.
      count: 11,
      skipped: { missingReps: 1, missingWeight: 2 },
      workoutCount: 2,
    },
  ],
  fitnotes: [
    {
      name: "one row per set",
      csv: `Date,Exercise,Category,Weight (kgs),Reps,Distance,Distance Unit,Time,Comment
2026-03-04,Squat,Legs,100.0,5,,,,""
2026-03-02,Deadlift,Back,150.0,3,,,,"Felt strong"
2026-03-02,Rowing Machine,Cardio,,,200.0,m,0:01:48,""
`,
      count: 2,
      skipped: { unsupportedDurationOrDistance: 1 },
    },
  ],
  "strength-journeys": [
    {
      name: "the app's own export",
      csv: `Date,Lift Type,Reps,Weight,Notes
2026-03-04,Back Squat,5,100kg,
2026-03-02,Deadlift,3,150kg,Felt strong
`,
      count: 2,
      skipped: null,
    },
  ],
};

const importedAt = new Date(2026, 7, 14, 12, 0, 0);
const KNOWN_SKIP_REASONS = new Set([
  "invalidDate",
  "missingExercise",
  "missingReps",
  "missingWeight",
  "invalidWeight",
  "unsupportedDurationOrDistance",
]);

// -- A format is declared once ----------------------------------------------

const formatIds = IMPORT_FORMATS.map((format) => format.id);
assert.equal(
  new Set(formatIds).size,
  formatIds.length,
  "two formats share an id",
);
assert.deepEqual(
  [...formatIds].sort(),
  IMPORT_SOURCES.map((source) => source.id).sort(),
  "import-sources.js and the dispatcher's format list name different formats",
);
for (const format of IMPORT_FORMATS) {
  assert.equal(typeof format.detect, "function", `${format.id} detect`);
  assert.equal(typeof format.parse, "function", `${format.id} parse`);
  assert.equal(format.name, requireImportSource(format.id).name, format.id);
}
assert.throws(() => requireImportSource("no-such-app"));

// A guide page promises an importer, so every guide needs a format behind it.
for (const page of IMPORT_APP_PAGES) {
  assert.ok(
    formatIds.includes(page.slug),
    `guide /import/${page.slug} has no import format`,
  );
}
assert.deepEqual(
  Object.keys(FIXTURES).filter((id) => !formatIds.includes(id)),
  [],
  "a fixture names a format the dispatcher does not list",
);

// -- Every format keeps the contract ----------------------------------------

for (const format of IMPORT_FORMATS) {
  const fixtures = FIXTURES[format.id];
  assert.ok(
    fixtures?.length > 0,
    `${format.id} has no fixture in validate-import-contract.mjs; add one`,
  );
  // The lifter's own sheet is read by the sheet parser under its own rules,
  // and passes through the dispatcher untouched.
  const isSheetReader = format.id === "strength-journeys";

  for (const fixture of fixtures) {
    const label = `${format.id} (${fixture.name})`;
    const rows = decodeCSV(fixture.csv);

    // Its own header row reaches it, past every format tried before it.
    assert.equal(detectFormat(rows[0])?.id, format.id, `${label} detection`);

    const result = parseImportedRows(rows, { importedAt });
    assert.equal(result.formatId, format.id, label);
    assert.equal(result.formatName, format.name, label);
    assert.equal(result.data.length, fixture.count, `${label} set count`);

    // Date order, whatever order the file was in.
    const dates = result.data.map((entry) => entry.date);
    assert.deepEqual(dates, [...dates].sort(), `${label} is not in date order`);

    if (isSheetReader) {
      assert.equal(result.diagnostics, null, label);
      continue;
    }

    for (const entry of result.data) {
      assert.equal(getSetSkipReason(entry), null, `${label} invalid set`);
      assert.ok(["kg", "lb"].includes(entry.unitType), `${label} unitType`);
      assert.ok(
        entry.rawLiftType === undefined ||
          (typeof entry.rawLiftType === "string" && entry.rawLiftType !== ""),
        `${label} rawLiftType`,
      );
      assert.ok(
        entry.notes === undefined || typeof entry.notes === "string",
        `${label} notes`,
      );
    }

    // The parser itself returns only valid sets. The dispatcher would drop
    // an invalid one, but a parser that leans on that hides its own skips.
    const raw = format.parse(rows, { importedAt });
    assert.ok(Array.isArray(raw.entries), `${label} parse() entries`);
    assert.equal(
      raw.entries.length,
      result.data.length,
      `${label} parser returned sets the dispatcher had to drop`,
    );

    if (fixture.skipped === null) {
      assert.equal(raw.skippedByReason, undefined, label);
      assert.equal(result.diagnostics, null, `${label} diagnostics`);
      continue;
    }

    // Skip counts add up, and use only reasons the preview has words for
    // (IMPORT_SKIP_REASON_LABELS in import-workflow-section.js).
    const { diagnostics } = result;
    assert.deepEqual(diagnostics.skippedByReason, fixture.skipped, label);
    if (fixture.workoutCount !== undefined) {
      assert.equal(diagnostics.workoutCount, fixture.workoutCount, label);
    }
    for (const reason of Object.keys(diagnostics.skippedByReason)) {
      assert.ok(KNOWN_SKIP_REASONS.has(reason), `${label} reason ${reason}`);
    }
    const skippedTotal = Object.values(diagnostics.skippedByReason).reduce(
      (sum, count) => sum + count,
      0,
    );
    assert.equal(diagnostics.skippedRows, skippedTotal, label);
    assert.equal(diagnostics.parsedRows, result.data.length, label);
    assert.equal(
      diagnostics.sourceRows,
      diagnostics.parsedRows + diagnostics.skippedRows,
      label,
    );
  }
}

// -- What counts as a set ----------------------------------------------------

const validSet = {
  date: "2026-03-02",
  liftType: "Deadlift",
  reps: 3,
  weight: 150,
};
assert.equal(getSetSkipReason(validSet), null);
assert.equal(
  getSetSkipReason({ ...validSet, date: "3/2/2026" }),
  "invalidDate",
);
assert.equal(getSetSkipReason({ ...validSet, date: null }), "invalidDate");
assert.equal(
  getSetSkipReason({ ...validSet, liftType: "" }),
  "missingExercise",
);
assert.equal(getSetSkipReason({ ...validSet, reps: 0 }), "missingReps");
assert.equal(getSetSkipReason({ ...validSet, reps: -5 }), "missingReps");
assert.equal(getSetSkipReason({ ...validSet, reps: 2.5 }), "missingReps");
assert.equal(
  getSetSkipReason({ ...validSet, reps: null, isDurationOrDistance: true }),
  "unsupportedDurationOrDistance",
);
assert.equal(getSetSkipReason({ ...validSet, weight: null }), "missingWeight");
assert.equal(getSetSkipReason({ ...validSet, weight: 0 }), "invalidWeight");
// No load is a real load for a lift the registry knows as bodyweight.
assert.equal(
  getSetSkipReason({ ...validSet, liftType: "Pull-up", weight: 0 }),
  null,
);
// The first thing wrong is the reason given.
assert.equal(
  getSetSkipReason({ date: "", liftType: "", reps: 0, weight: null }),
  "invalidDate",
);

assert.throws(
  () => parseImportedRows([["Date", "Lift Type", "Reps", "Weight"]]),
  /empty/,
);
assert.throws(
  () =>
    parseImportedRows([
      ["foo", "bar"],
      ["1", "2"],
    ]),
  /Unrecognized file format/,
);

console.log(
  `Import contract validation passed for ${IMPORT_FORMATS.length} formats.`,
);
