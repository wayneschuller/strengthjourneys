/**
 * Lightweight Strength Journeys sheet parser regression checks.
 * The repository has no test runner, so this script exercises synthetic
 * sheet rows kept inline below, while preserving the application's normal
 * `@/` imports.
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
const { parseStrengthJourneysData } =
  await import("../src/lib/data-sources/strength-journeys-parser.js");

// Synthetic rows in the sheet's sparse shape, not a real sheet. They carry
// the typos real logs hold: a decimal comma, a stray backtick beside the 1,
// "g" for "kg", a range, a unitless weight in a kg sheet, and cardio logged
// with distances and times, which the parser leaves out.
const SHEET_CSV = `Date,Lift Type,Reps,Weight,Notes,URL,isGoal,Label
2026-03-02,Back Squat,5,100kg,,,,
,,3,"112,5kg",,,,
,,1,1\`57.5kg,,,,
,,3,60g,,,,
,,5,60-70kg,,,,
,,10,20,,,,
,,,,session note only,,,
2026-03-04,Run,3,100m,,,,
,Rowing,1,10 minute,,,,
,Waist,1,111cm,,,,
,Run,5km,41,,,,
,Bench Press,5,"1,025lb",,,,
`;

const logged = [];
const info = console.info;
console.info = (line) => logged.push(line);
const parsed = parseStrengthJourneysData(decodeCSV(SHEET_CSV));
console.info = info;

const sets = parsed.map((entry) => [
  entry.date,
  entry.liftType,
  entry.reps,
  `${entry.weight}${entry.unitType}`,
]);

assert.deepEqual(sets, [
  ["2026-03-02", "Back Squat", 5, "100kg"],
  ["2026-03-02", "Back Squat", 3, "112.5kg"],
  ["2026-03-02", "Back Squat", 1, "157.5kg"],
  ["2026-03-02", "Back Squat", 3, "60kg"],
  ["2026-03-02", "Back Squat", 5, "60kg"],
  ["2026-03-02", "Back Squat", 10, "20kg"],
  ["2026-03-04", "Bench Press", 5, "1025lb"],
]);

// One grouped line per kind of guess, never one per row.
for (const kind of [
  "decimal comma",
  "stray character removed",
  'unit "g" read as kg',
  "range, kept the lower weight",
  "no unit, read as kg like most of the sheet",
  "thousands comma",
  "reps are a distance or time, row skipped",
  '"m" is a distance or time, not a weight, row skipped',
  '"minute" is a distance or time, not a weight, row skipped',
  '"cm" is a distance or time, not a weight, row skipped',
]) {
  assert.equal(
    logged.filter((line) => line.includes(`: ${kind}: `)).length,
    1,
    `expected one log line for ${kind}`,
  );
}

console.log("Strength Journeys parser checks passed.");
