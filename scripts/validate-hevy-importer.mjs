/**
 * Lightweight Hevy importer regression checks.
 * The repository has no test runner, so this script exercises public-shaped
 * fixtures directly while preserving the application's normal `@/` imports.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
    const loaded = nextLoad(url, context);
    if (url.startsWith(pathToFileURL(sourceRoot).href) && url.endsWith(".js")) {
      return { ...loaded, format: "module" };
    }
    return loaded;
  },
});

const { decodeCSV } = await import("../src/lib/data-sources/decode-csv.js");
const { parseHevyData } =
  await import("../src/lib/data-sources/hevy-parser.js");
const { detectFormat } =
  await import("../src/lib/data-sources/import-dispatcher.js");
const { deduplicateImportedEntries } =
  await import("../src/lib/import/dedupe.js");

async function readFixture(name) {
  const fixturePath = path.join(
    repositoryRoot,
    "fixtures",
    "imports",
    "hevy",
    name,
  );
  return decodeCSV(await readFile(fixturePath, "utf8"));
}

const importedAt = new Date(2026, 7, 14, 12, 0, 0);
const kg = parseHevyData(await readFixture("hevy-kg.csv"), { importedAt });
const lb = parseHevyData(await readFixture("hevy-lb.csv"), { importedAt });

assert.equal(detectFormat((await readFixture("hevy-kg.csv"))[0])?.name, "Hevy");
assert.equal(detectFormat((await readFixture("hevy-lb.csv"))[0])?.name, "Hevy");
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
assert.equal(kg.importDiagnostics.sourceRows, 7);
assert.equal(kg.importDiagnostics.skippedRows, 2);
assert.equal(kg.importDiagnostics.workoutCount, 2);
assert.equal(kg.importDiagnostics.unitType, "kg");
assert.equal(
  kg.importDiagnostics.skippedByReason.unsupportedDurationOrDistance,
  1,
);
assert.equal(kg.importDiagnostics.skippedByReason.invalidDate, 1);

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

console.log("Hevy importer validation passed.");
