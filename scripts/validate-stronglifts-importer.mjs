/**
 * Lightweight StrongLifts importer regression checks.
 * The repository has no test runner, so this script exercises synthetic
 * StrongLifts-shaped rows kept inline below, while preserving the
 * application's normal `@/` imports.
 *
 * Both layouts are covered, and so is the day/month order of the legacy date,
 * which carries no locale and has to be settled by reading the whole column.
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
const { parseStrongliftsData } =
  await import("../src/lib/data-sources/stronglifts-parser.js");
const { detectFormat } =
  await import("../src/lib/data-sources/import-dispatcher.js");

// Synthetic rows in the legacy wide shape, not real exports. This variant
// carries a bare "Body Weight" column with the unit inside the cell, which is
// how the spreadsheet export writes it, and day-first dates.
const LEGACY_DAY_FIRST_CSV = `Date,Note,Workout,Body Weight,Exercise 1,Weight (KG),Weight (LB),Set 1,Set 2,Set 3,Set 4,Set 5,Exercise 2,Weight (KG),Weight (LB),Set 1,Set 2,Set 3,Set 4,Set 5
16/03/2015,"",A,84KG,Squat,60,130,5,5,5,5,5,Bench press,40,90,5,5,5,5,5
18/03/2015,"",B,84KG,Squat,62.5,140,5,5,5,5,5,Overhead press,30,65,5,5,5,5,5
23/03/2015,"",A,83.5KG,Squat,65,145,5,5,5,5,5,Bench press,42.5,95,5,5,5,5,5
`;

// The same layout as the US export documents it: a unit-suffixed body weight
// column and month-first dates, proven month-first by a day above twelve.
const LEGACY_MONTH_FIRST_CSV = `Date,Note,Body Weight (KG),Body Weight (LB),Exercise 1,Weight (KG),Weight (LB),Set 1,Set 2,Set 3,Set 4,Set 5
03/16/2015,"",84,185,Squat,60,130,5,5,5,5,5
03/18/2015,"",84,185,Squat,62.5,140,5,5,5,5,5
`;

// Every component is twelve or below, so the column cannot settle its own
// order and the documented US reading has to win.
const LEGACY_AMBIGUOUS_CSV = `Date,Note,Workout,Body Weight,Exercise 1,Weight (KG),Weight (LB),Set 1,Set 2,Set 3,Set 4,Set 5
02/05/17,"",A,64.5kg,Squat,50,110,5,5,5,5,5
`;

// Current exports pair a reps column with a weight column per set, and write
// an unambiguous year-first date.
const CURRENT_CSV = `Date,Exercise,Note,Set 1 (Reps),Set 1 (KG),Set 2 (Reps),Set 2 (KG)
2017/05/02,Squat,Felt good,5,60,5,60
2017/05/04,Bench press,"",5,40,5,40
`;

const dayFirstRows = decodeCSV(LEGACY_DAY_FIRST_CSV);
const monthFirstRows = decodeCSV(LEGACY_MONTH_FIRST_CSV);
const ambiguousRows = decodeCSV(LEGACY_AMBIGUOUS_CSV);
const currentRows = decodeCSV(CURRENT_CSV);

// A bare "Body Weight" column is the spreadsheet export's own spelling, so it
// has to detect just like the unit-suffixed one.
assert.equal(detectFormat(dayFirstRows[0])?.id, "stronglifts");
assert.equal(detectFormat(monthFirstRows[0])?.id, "stronglifts");
assert.equal(detectFormat(currentRows[0])?.id, "stronglifts");

const dayFirst = parseStrongliftsData(dayFirstRows);
const monthFirst = parseStrongliftsData(monthFirstRows);
const ambiguous = parseStrongliftsData(ambiguousRows);
const current = parseStrongliftsData(currentRows);

// Three workouts, two exercises each, five sets each.
assert.equal(dayFirst.length, 30);

// A day above twelve can only be a day, so the whole column reads day-first.
// Read month-first, all three would claim a month of 16, 18 and 23, fail
// validation, and be dropped outright, which is the old behaviour.
const dayFirstDates = [...new Set(dayFirst.map((entry) => entry.date))].sort();
assert.deepEqual(dayFirstDates, ["2015-03-16", "2015-03-18", "2015-03-23"]);

// A day above twelve on the other side proves the opposite order.
const monthFirstDates = [
  ...new Set(monthFirst.map((entry) => entry.date)),
].sort();
assert.deepEqual(monthFirstDates, ["2015-03-16", "2015-03-18"]);

// Undecidable columns keep the order the legacy format documents.
assert.equal(ambiguous[0].date, "2017-02-05");

// The current layout writes a year-first date, which no inference touches.
assert.equal(current.length, 4);
assert.deepEqual([...new Set(current.map((entry) => entry.date))].sort(), [
  "2017-05-02",
  "2017-05-04",
]);

// Weights come from whichever unit column the export populated.
const squat = dayFirst.find((entry) => entry.liftType === "Back Squat");
assert.equal(squat.unitType, "kg");
assert.equal(squat.weight, 60);
assert.equal(squat.reps, 5);

// Lift names arrive under the registry's spelling.
const lifts = new Set(dayFirst.map((entry) => entry.liftType));
assert.ok(lifts.has("Back Squat"));
assert.ok(lifts.has("Bench Press"));
assert.ok(lifts.has("Strict Press"));

// A file that is not a StrongLifts export must not be claimed by it.
assert.notEqual(detectFormat(["foo", "bar"])?.id, "stronglifts");

console.log("StrongLifts importer validation passed.");
