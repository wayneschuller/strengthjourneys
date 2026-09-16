/**
 * Lightweight FitNotes importer regression checks.
 * The repository has no test runner, so this script exercises synthetic
 * FitNotes-shaped rows kept inline below, while preserving the application's
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

const { decodeCSV } = await import("../src/lib/data-sources/decode-csv.js");
const { parseFitNotesData } =
  await import("../src/lib/data-sources/fitnotes-parser.js");
const { detectFormat } =
  await import("../src/lib/data-sources/import-dispatcher.js");

// Synthetic rows in the FitNotes export shape, not a real export. It covers
// barbell sets, a bodyweight lift the registry knows carries no load, one it
// does not, a cardio row stating distance and a clock time, an impossible
// date, and a second training day.
const FITNOTES_KG_CSV = `Date,Exercise,Category,Weight (kgs),Reps,Distance,Distance Unit,Time,Comment
2026-03-02,Deadlift,Back,150.0,3,,,,"Felt strong"
2026-03-02,Deadlift,Back,155.0,3,,,,""
2026-03-02,Pull Up,Back,0.0,10,,,,""
2026-03-02,Plank,Abs,0.0,30,,,,""
2026-03-02,Rowing Machine,Cardio,,,200.0,m,0:01:48,""
2026-02-30,Squat,Legs,100.0,5,,,,""
2026-03-04,Bench Press,Chest,80.0,5,,,,""
`;

// The same export from a lifter working in pounds. Only the weight header
// changes, never the cells.
const FITNOTES_LB_CSV = `Date,Exercise,Category,Weight (lbs),Reps,Distance,Distance Unit,Time,Comment
2026-03-02,Bench Press,Chest,225.0,5,,,,""
`;

const kgRows = decodeCSV(FITNOTES_KG_CSV);
const lbRows = decodeCSV(FITNOTES_LB_CSV);

const detected = detectFormat(kgRows[0]);
assert.equal(detected?.id, "fitnotes");
assert.equal(detected?.name, "FitNotes");
assert.equal(detectFormat(lbRows[0])?.id, "fitnotes");

const importedAt = new Date(2026, 7, 14, 12, 0, 0);
const kg = parseFitNotesData(kgRows, { importedAt });
const lb = parseFitNotesData(lbRows, { importedAt });

assert.equal(kg.length, 4);
assert.equal(kg.importDiagnostics.sourceRows, 7);
assert.equal(kg.importDiagnostics.skippedRows, 3);
assert.equal(kg.importDiagnostics.workoutCount, 2);
assert.equal(kg.importDiagnostics.unitType, "kg");
assert.equal(kg.importDiagnostics.skippedByReason.invalidDate, 1);
assert.equal(
  kg.importDiagnostics.skippedByReason.unsupportedDurationOrDistance,
  1,
);

// An unweighted lift the registry does not know as a bodyweight load has no
// number to plot, so it is counted rather than imported at zero. Widening that
// is a registry decision, not a parser one.
assert.equal(kg.importDiagnostics.skippedByReason.invalidWeight, 1);
assert.ok(!kg.some((entry) => entry.liftType === "Plank"));

// A lift the registry does know as a bodyweight load imports at zero.
const pullup = kg.find((entry) => entry.liftType === "Pull-up");
assert.equal(pullup.weight, 0);
assert.equal(pullup.reps, 10);

// The unit comes from the weight header, and the cells never restate it.
assert.ok(kg.every((entry) => entry.unitType === "kg"));
assert.equal(lb[0].unitType, "lb");
assert.equal(lb[0].weight, 225);

// FitNotes names no workout, so provenance is anchored once per calendar day.
assert.equal(
  kg.filter((entry) => entry.notes?.includes("(FitNotes import 2026-08-14)"))
    .length,
  2,
);
const noted = kg.find((entry) => entry.notes?.includes("Felt strong"));
assert.ok(noted.notes.includes("(FitNotes import 2026-08-14)"));

// Other formats must not be claimed by FitNotes, and FitNotes must not fall
// through to the generic Strength Journeys signature.
assert.equal(
  detectFormat(["Date", "Exercise Name", "Weight", "Reps", "Workout Name"])?.id,
  "strong",
);
assert.equal(
  detectFormat(["Date", "Lift Type", "Reps", "Weight"])?.id,
  "strength-journeys",
);
assert.equal(detectFormat(["foo", "bar"]), null);

console.log("FitNotes importer validation passed.");
