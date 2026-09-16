/**
 * Lightweight Fitbod importer regression checks.
 * The repository has no test runner, so this script exercises synthetic
 * Fitbod-shaped rows kept inline below, while preserving the application's
 * normal `@/` imports.
 *
 * Fitbod is deliberately a silent format: it is absent from the import app
 * guides, from the picker source list, and from the unrecognized-format error
 * message, so the checks here cover detection and parsing rather than any
 * presentation surface.
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
const { parseFitbodData } =
  await import("../src/lib/data-sources/fitbod-parser.js");
const { detectFormat } =
  await import("../src/lib/data-sources/import-dispatcher.js");
const { getImportSource } = await import("../src/lib/import/import-sources.js");

// Synthetic rows in the column shape corroborated by community Fitbod
// converters, not a real export. It covers a warmup set, repeated working
// sets, an equipment qualifier, a bodyweight lift, a cardio-only row, a row
// with no reps, an impossible date, and a second calendar day.
const FITBOD_CSV = `Date,Exercise,Reps,Weight(kg),Duration(s),Distance(m),Incline,Resistance,isWarmup,Note,multiplier
2025-08-25 08:15:00,Bench Press (Barbell),5,45,,,,,true,,1
2025-08-25 08:20:00,Bench Press (Barbell),5,100,,,,,false,Felt strong,1
2025-08-25 08:25:00,Bench Press (Barbell),5,100,,,,,false,,1
2025-08-25 08:40:00,Pull-up,8,0,,,,,false,,1
2025-08-25 08:55:00,Treadmill Run,,,1800,5000,2,,false,,1
2025-08-25 09:00:00,Back Squat,,140,,,,,false,,1
2026-02-31 08:00:00,Deadlift,3,140,,,,,false,,1
2025-08-26 07:30:00,Deadlift,3,140,,,,,false,,1
`;

const rows = decodeCSV(FITBOD_CSV);
const importedAt = new Date(2026, 7, 14, 12, 0, 0);
const parsed = parseFitbodData(rows, { importedAt });

const detected = detectFormat(rows[0]);
assert.equal(detected?.id, "fitbod");
assert.equal(detected?.name, "Fitbod");

assert.equal(parsed.length, 5);
assert.equal(parsed.importDiagnostics.sourceRows, 8);
assert.equal(parsed.importDiagnostics.skippedRows, 3);
assert.equal(
  parsed.importDiagnostics.skippedByReason.unsupportedDurationOrDistance,
  1,
);
assert.equal(parsed.importDiagnostics.skippedByReason.missingReps, 1);
assert.equal(parsed.importDiagnostics.skippedByReason.invalidDate, 1);
assert.equal(parsed.importDiagnostics.workoutCount, 2);
assert.equal(parsed.importDiagnostics.unitType, "kg");

// Fitbod exports kilograms whatever the user's display unit is set to.
assert.ok(parsed.every((entry) => entry.unitType === "kg"));

// The shared normalizer drops the barbell qualifier, so these join the big
// four rather than becoming a lift of their own.
assert.ok(parsed.some((entry) => entry.liftType === "Bench Press"));

const warmupSet = parsed.find(
  (entry) => entry.date === "2025-08-25" && entry.weight === 45,
);
assert.ok(warmupSet.notes.includes("Warmup"));
assert.ok(warmupSet.notes.startsWith("08:15 "));
assert.ok(warmupSet.notes.includes("(Fitbod import 2026-08-14)"));

const pullup = parsed.find((entry) => entry.liftType === "Pull-up");
assert.equal(pullup.weight, 0);
assert.equal(pullup.reps, 8);

// Fitbod timestamps every set, so provenance is anchored once a day rather
// than once a set.
const notedSet = parsed.find((entry) => entry.notes?.includes("Felt strong"));
assert.ok(!notedSet.notes.includes("(Fitbod import"));
assert.equal(
  parsed.filter((entry) => entry.notes.includes("(Fitbod import 2026-08-14)"))
    .length,
  2,
);

const deadlifts = parsed.filter((entry) => entry.liftType === "Deadlift");
assert.equal(deadlifts.length, 1);
assert.equal(deadlifts[0].date, "2025-08-26");

// The KV import profile keys a lifter's per-source history on this id, so it
// has to resolve the same way whether or not Fitbod is offered anywhere in
// the app.
const source = getImportSource({ formatId: "fitbod", formatName: "Fitbod" });
assert.equal(source.id, "fitbod");
assert.equal(source.name, "Fitbod");

// Fitbod is detected ahead of StrongLifts, whose current-layout signature also
// accepts a bare "date" and "exercise" pair. Neither may swallow the other.
assert.equal(
  detectFormat(["Date", "Body Weight (kg)", "Exercise 1", "Set 1"])?.id,
  "stronglifts",
);
assert.equal(
  detectFormat(["Date", "Exercise Name", "Weight", "Reps", "Workout Name"])?.id,
  "strong",
);
assert.equal(detectFormat(["foo", "bar"]), null);

console.log("Fitbod importer validation passed.");
