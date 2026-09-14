/**
 * Lightweight Fitbod importer regression checks.
 * The repository has no test runner, so this script exercises public-shaped
 * fixtures directly while preserving the application's normal `@/` imports.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
    if (url.startsWith(pathToFileURL(sourceRoot).href) && url.endsWith(".json")) {
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

async function readFixture(name) {
  const fixturePath = path.join(
    repositoryRoot,
    "fixtures",
    "imports",
    "fitbod",
    name,
  );
  return decodeCSV(await readFile(fixturePath, "utf8"));
}

const rows = await readFixture("fitbod-sample.csv");
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
assert.equal(parsed.importDiagnostics.unitType, "kg");
assert.ok(parsed.every((entry) => entry.unitType === "kg"));

const warmupSet = parsed.find(
  (entry) => entry.date === "2025-08-25" && entry.weight === 45,
);
assert.ok(warmupSet.notes.includes("Warmup"));
assert.ok(warmupSet.notes.startsWith("08:15 "));
assert.ok(warmupSet.notes.includes("(Fitbod import 2026-08-14)"));

const pullup = parsed.find((entry) => entry.liftType === "Pull-up");
assert.equal(pullup.weight, 0);
assert.equal(pullup.reps, 8);

const secondNoteEntry = parsed.find((entry) => entry.notes?.includes("Felt strong"));
assert.ok(secondNoteEntry.notes.includes("Felt strong"));
assert.ok(!secondNoteEntry.notes.includes("(Fitbod import"));

const deadlifts = parsed.filter((entry) => entry.liftType === "Deadlift");
assert.equal(deadlifts.length, 1);
assert.equal(deadlifts[0].date, "2025-08-26");

// Files that don't look like Fitbod exports must not be misdetected.
assert.equal(
  detectFormat(["Date", "Exercise Name", "Weight", "Reps", "Workout Name"])?.id,
  "strong",
);
assert.equal(detectFormat(["foo", "bar"]), null);

console.log("fitbod importer checks passed");
