/**
 * Lightweight Hevy importer regression checks.
 * The repository has no test runner, so this script exercises synthetic
 * Hevy-shaped rows kept inline below, while preserving the application's
 * normal `@/` imports.
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
const { detectFormat, parseImportedRows } =
  await import("../src/lib/import/import-dispatcher.js");
const { deduplicateImportedEntries, describeNearbyDuplicates } =
  await import("../src/lib/import/dedupe.js");
const { buildNextImportProfile } =
  await import("../src/lib/import/import-profile.js");

// Synthetic rows in the publicly described Hevy export shape, not real
// exports. The kg sample covers metric load, repeated identical sets,
// equipment qualifiers, bodyweight load, duration-only work, several workouts
// in one day and an impossible date. The lb sample covers imperial load and
// the weight_lbs/distance_miles headers.
const HEVY_KG_CSV = `title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe
Upper A,"25 Aug 2025, 09:38","25 Aug 2025, 10:54",Heavy five,Bench Press (Barbell),,Smooth,0,normal,100,5,,,8
Upper A,"25 Aug 2025, 09:38","25 Aug 2025, 10:54",Heavy five,Bench Press (Barbell),,Smooth,1,normal,100,5,,,8
Upper A,"25 Aug 2025, 09:38","25 Aug 2025, 10:54",,Bench Press (Dumbbell),,,0,normal,30,8,,,7.5
Upper A,"25 Aug 2025, 09:38","25 Aug 2025, 10:54",,Pull Up (Bodyweight),,,0,normal,,8,,,,
Conditioning,"25 Aug 2025, 18:00","25 Aug 2025, 18:30",,Plank,,,0,normal,,,0,60,
Lower PM,"25 Aug 2025, 19:05","25 Aug 2025, 20:00",,Deadlift (Trap Bar),,,0,normal,140,3,,,9
Bad row,"31 Feb 2025, 12:00","31 Feb 2025, 12:30",,Squat (Barbell),,,0,normal,100,5,,,,
`;

const HEVY_LB_CSV = `title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_lbs,reps,distance_miles,duration_seconds,rpe
Upper A,"28 Mar 2025, 17:29","28 Mar 2025, 18:45",,Bench Press (Barbell),,Go heavy,0,warmup,45,10,,,6
Upper A,"28 Mar 2025, 17:29","28 Mar 2025, 18:45",,Bench Press (Barbell),,,1,normal,185,8,,,8
Upper A,"28 Mar 2025, 17:29","28 Mar 2025, 18:45",,Bench Press (Dumbbell),,,0,normal,65,10,,,8
`;

const kgRows = decodeCSV(HEVY_KG_CSV);
const lbRows = decodeCSV(HEVY_LB_CSV);

const importedAt = new Date(2026, 7, 14, 12, 0, 0);
const { data: kg, diagnostics: kgDiagnostics } = parseImportedRows(kgRows, {
  importedAt,
});
const { data: lb } = parseImportedRows(lbRows, { importedAt });

assert.equal(detectFormat(kgRows[0])?.name, "Hevy");
assert.equal(detectFormat(kgRows[0])?.id, "hevy");
assert.equal(detectFormat(lbRows[0])?.name, "Hevy");
assert.equal(
  detectFormat([
    "\uFEFF TITLE ",
    " START_TIME ",
    "EXERCISE_TITLE",
    "WEIGHT_LBS",
    "REPS",
  ])?.name,
  "Hevy",
);

assert.equal(kg.length, 5);
assert.equal(kgDiagnostics.sourceRows, 7);
assert.equal(kgDiagnostics.skippedRows, 2);
assert.equal(kgDiagnostics.workoutCount, 2);
assert.equal(kgDiagnostics.unitType, "kg");
assert.equal(kgDiagnostics.skippedByReason.unsupportedDurationOrDistance, 1);
assert.equal(kgDiagnostics.skippedByReason.invalidDate, 1);

assert.equal(lb.length, 3);
assert.ok(lb.every((entry) => entry.unitType === "lb"));
assert.equal(lb[0].notes.startsWith("17:29 "), true);
assert.equal(lb[0].notes.includes("(Hevy: Upper A · set 1)"), true);
assert.equal(lb[0].notes.includes("(Hevy import 2026-08-14)"), true);
assert.equal(
  kg.filter((entry) => entry.notes.includes("(Hevy import 2026-08-14)")).length,
  2,
);

assert.equal(
  kg.some((entry) => entry.liftType === "Bench Press (Dumbbell)"),
  true,
);
assert.equal(kg.find((entry) => entry.liftType === "Pull-up")?.weight, 0);

const repeatedBenchSets = kg.filter(
  (entry) =>
    entry.date === "2025-08-25" &&
    entry.liftType === "Bench Press" &&
    entry.reps === 5 &&
    entry.weight === 100,
);
assert.equal(repeatedBenchSets.length, 2);

const partialMerge = deduplicateImportedEntries(repeatedBenchSets, [
  repeatedBenchSets[0],
]);
assert.equal(partialMerge.skippedCount, 1);
assert.equal(partialMerge.newEntries.length, 1);

const changedSet = { ...lb[0], weight: lb[0].weight + 5 };
const changedMerge = deduplicateImportedEntries([changedSet], [lb[0]]);
assert.equal(changedMerge.conflictCount, 1);
assert.equal(changedMerge.newEntries.length, 0);

const firstImport = buildNextImportProfile(null, {
  formatId: "hevy",
  formatName: "Hevy",
  sheetId: "sheet-a",
  checkedAt: "2026-07-31T10:00:00.000Z",
  latestWorkoutDate: "2026-07-30",
  insertedRows: 120,
});
assert.equal(firstImport.relationship, "first_import");
assert.equal(firstImport.profile.sources.hevy.importCount, 1);
assert.equal(firstImport.profile.lastSheetId, "sheet-a");

const repeatImport = buildNextImportProfile(firstImport.profile, {
  formatId: "hevy",
  formatName: "Hevy",
  checkedAt: "2026-08-07T10:00:00.000Z",
  latestWorkoutDate: "2026-08-06",
  insertedRows: 18,
});
assert.equal(repeatImport.relationship, "repeat_same_source");
assert.equal(repeatImport.relationshipLabel, "2nd successful Hevy import");

const mixedSourceImport = buildNextImportProfile(repeatImport.profile, {
  formatId: "strong",
  formatName: "Strong",
  checkedAt: "2026-08-14T10:00:00.000Z",
  latestWorkoutDate: "2024-03-04",
  insertedRows: 40,
});
assert.equal(mixedSourceImport.relationship, "new_source");
assert.equal(Object.keys(mixedSourceImport.profile.sources).length, 2);
assert.equal(mixedSourceImport.profile.lastSourceName, "Strong");
assert.equal(mixedSourceImport.profile.latestImportedWorkoutDate, "2026-08-06");
assert.equal(mixedSourceImport.cadenceLabel, "approximately weekly");

const currentCheck = buildNextImportProfile(mixedSourceImport.profile, {
  formatId: "hevy",
  formatName: "Hevy",
  checkedAt: "2026-08-14T12:00:00.000Z",
  latestWorkoutDate: "2026-08-06",
  insertedRows: 0,
  outcome: "already_current",
});
assert.equal(currentCheck.relationship, "freshness_check");
assert.equal(currentCheck.profile.successfulImportCount, 3);
assert.equal(currentCheck.profile.lastSourceName, "Hevy");

const switchedSheetImport = buildNextImportProfile(currentCheck.profile, {
  formatId: "wodify",
  formatName: "Wodify",
  sheetId: "sheet-b",
  checkedAt: "2026-08-15T12:00:00.000Z",
  latestWorkoutDate: "2025-01-10",
  insertedRows: 12,
});
assert.equal(switchedSheetImport.relationship, "first_import");
assert.equal(switchedSheetImport.profile.lastSheetId, "sheet-b");
assert.equal(
  switchedSheetImport.profile.latestImportedWorkoutDate,
  "2025-01-10",
);
assert.deepEqual(Object.keys(switchedSheetImport.profile.sources), ["wodify"]);

// An app that follows the phone's number format writes "117,5". Number()
// reads that as NaN, which used to drop the set.
const { data: decimalCommaEntries } = parseImportedRows(
  decodeCSV(`title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe
Upper A,"25 Aug 2025, 09:38","25 Aug 2025, 10:54",,Bench Press (Barbell),,,0,normal,"117,5",5,,,8
`),
);
assert.deepEqual(
  decimalCommaEntries.map((entry) => [entry.weight, entry.unitType]),
  [[117.5, "kg"]],
);

// A coach's app dates a workout by its schedule, so the merge looks for the
// same sets in the sheet up to three days either side. That is for sources
// marked scheduledDates in import-sources.js, which today is TurnKey alone.
const lift = (date, liftType, reps, weight) => ({
  date,
  liftType,
  reps,
  weight,
  unitType: "kg",
});
const scheduledSquats = [
  lift("2026-03-02", "Back Squat", 5, 100),
  lift("2026-03-02", "Back Squat", 5, 100),
  lift("2026-03-02", "Back Squat", 5, 100),
];
const loggedNextDay = [
  lift("2026-03-03", "Back Squat", 5, 60),
  lift("2026-03-03", "Back Squat", 5, 100),
  lift("2026-03-03", "Back Squat", 5, 100),
  lift("2026-03-03", "Back Squat", 5, 100),
];

const scheduledMerge = deduplicateImportedEntries(
  scheduledSquats,
  loggedNextDay,
  { formatId: "turnkey" },
);
assert.equal(scheduledMerge.newEntries.length, 0);
assert.equal(scheduledMerge.skippedCount, 3);
assert.equal(scheduledMerge.nearbyCount, 3);
assert.match(describeNearbyDuplicates(3, "TurnKey"), /TurnKey.*3 sets/);
assert.equal(describeNearbyDuplicates(0, "TurnKey"), "");

// The same sets from an app the lifter logs in themselves are a second
// session: people repeat a lift at the same load within a few days.
for (const formatId of ["hevy", "strong", undefined]) {
  const lifterLogged = deduplicateImportedEntries(
    scheduledSquats,
    loggedNextDay,
    { formatId },
  );
  assert.equal(lifterLogged.newEntries.length, 3, String(formatId));
  assert.equal(lifterLogged.nearbyCount, 0, String(formatId));
}

// Three days is the reach, in either direction.
const mergeAt = (sheetDate) =>
  deduplicateImportedEntries(
    scheduledSquats,
    scheduledSquats.map((entry) => ({ ...entry, date: sheetDate })),
    { formatId: "turnkey" },
  );
assert.equal(mergeAt("2026-02-27").nearbyCount, 3);
assert.equal(mergeAt("2026-03-05").nearbyCount, 3);
assert.equal(mergeAt("2026-02-26").nearbyCount, 0);
assert.equal(mergeAt("2026-03-06").nearbyCount, 0);
// On the same day it is a plain duplicate, with nothing to explain.
assert.equal(mergeAt("2026-03-02").skippedCount, 3);
assert.equal(mergeAt("2026-03-02").nearbyCount, 0);

// Every set of the lift has to be there. Two of three proves little.
const partlyLogged = deduplicateImportedEntries(
  scheduledSquats,
  loggedNextDay.slice(0, 3),
  { formatId: "turnkey" },
);
assert.equal(partlyLogged.newEntries.length, 3);
assert.equal(partlyLogged.nearbyCount, 0);

// One logged session answers for one scheduled session, not two. The
// workout scheduled either side of it is still new.
const scheduledTwice = [
  ...scheduledSquats,
  ...scheduledSquats.map((entry) => ({ ...entry, date: "2026-03-04" })),
];
const loggedOnce = deduplicateImportedEntries(scheduledTwice, loggedNextDay, {
  formatId: "turnkey",
});
assert.equal(loggedOnce.nearbyCount, 3);
assert.equal(loggedOnce.newEntries.length, 3);
assert.ok(loggedOnce.newEntries.every((entry) => entry.date === "2026-03-04"));

// A session the sheet holds on its own day is matched there first, and is
// not spent on the workout scheduled the day before it.
const ownDayFirst = deduplicateImportedEntries(
  [
    ...scheduledSquats,
    ...scheduledSquats.map((entry) => ({ ...entry, date: "2026-03-03" })),
  ],
  loggedNextDay,
  { formatId: "turnkey" },
);
assert.equal(ownDayFirst.nearbyCount, 0);
assert.equal(ownDayFirst.skippedCount, 3);
assert.ok(ownDayFirst.newEntries.every((entry) => entry.date === "2026-03-02"));

console.log("Importer and recurring-profile validation passed.");
