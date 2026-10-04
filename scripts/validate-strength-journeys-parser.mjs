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

const { decodeCSV } = await import("../src/lib/import/decode-csv.js");
const { parseStrengthJourneysData } =
  await import("../src/lib/import/parsers/strength-journeys-parser.js");

// Synthetic rows in the sheet's sparse shape, not a real sheet. They carry
// the typos real logs hold: a decimal comma, a stray backtick beside the 1,
// "g" for "kg", a range, a unitless weight in a kg sheet, and cardio logged
// with distances and times, which the parser leaves out.
const SHEET_CSV = `Date,Lift Type,Reps,Weight,Notes,URL,Label
2026-03-02,Back Squat,5,100kg,,,
,,3,"112,5kg",,,
,,1,1\`57.5kg,,,
,,3,60g,,,
,,5,60-70kg,,,
,,10,20,,,
,,,,session note only,,
2026-03-04,Run,3,100m,,,
,Rowing,1,10 minute,,,
,Waist,1,111cm,,,
,Run,5km,41,,,
,Bench Press,5,"1,025lb",,,
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

// A deleted Date header must recover the exact same entries, including sparse
// dates, raw cell text and source row numbers, without modifying the sheet.
const recoveryRows = [
  ["Date", "Lift Type", "Reps", "Weight", ""],
  ["2026-10-02", "Deadlift", "5", "100kg"],
  ["", "", "3", "110kg"],
  ["4/10/2026", "Bench Press", "5", "60kg"],
];
const expectedRecovery = parseStrengthJourneysData(recoveryRows);
assert.equal(
  logged.some((line) => line.includes("Inferred Date")),
  false,
);
for (const blankHeader of ["", "   ", null, undefined]) {
  const rows = recoveryRows.map((row) => [...row]);
  rows[0][0] = blankHeader;
  const before = structuredClone(rows);
  const recoveryLogs = [];
  console.info = (line) => recoveryLogs.push(line);
  try {
    assert.deepEqual(parseStrengthJourneysData(rows), expectedRecovery);
  } finally {
    console.info = info;
  }
  assert.deepEqual(rows, before);
  assert.equal(recoveryLogs.length, 1);
  assert.match(recoveryLogs[0], /Inferred Date.*column 1.*header is blank/);
}

// Inference follows content, not the position of A1, and can recover a sheet
// holding just one dated set.
assert.equal(
  parseStrengthJourneysData([
    ["Lift Type", "Weight", "", "Reps"],
    ["Deadlift", "100kg", "2026-10-02", "5"],
  ])[0].date,
  "2026-10-02",
);

// Keep the missing-header error for absent, mixed or ambiguous evidence, and
// never claim an already named column or infer other required fields.
for (const rows of [
  [["", "Lift Type", "Reps", "Weight"]],
  [
    ["", "Lift Type", "Reps", "Weight"],
    ["", "Deadlift", "5", "100kg"],
  ],
  [
    ["", "Lift Type", "Reps", "Weight"],
    ["100", "Deadlift", "5", "100kg"],
  ],
  [
    ["", "Lift Type", "Reps", "Weight"],
    ["2026-10-02", "Deadlift", "5", "100kg"],
    ...Array.from({ length: 100 }, () => ["", "", "3", "110kg"]),
    ["session note", "", "3", "110kg"],
  ],
  [
    ["", "Lift Type", "Reps", "Weight", ""],
    ["2026-10-02", "Deadlift", "5", "100kg", "2026-10-03"],
  ],
  [
    ["Notes", "Lift Type", "Reps", "Weight"],
    ["2026-10-02", "Deadlift", "5", "100kg"],
  ],
  [
    ["", "Lift Type", "", "Weight"],
    ["2026-10-02", "Deadlift", "5", "100kg"],
  ],
]) {
  assert.throws(
    () => parseStrengthJourneysData(rows),
    /Missing required columns: Date/,
  );
}

const withDateHeader = recoveryRows.map((row) => [...row]);
withDateHeader[1][4] = "2026-10-03";
assert.deepEqual(parseStrengthJourneysData(withDateHeader), expectedRecovery);

console.log("Strength Journeys parser checks passed.");
