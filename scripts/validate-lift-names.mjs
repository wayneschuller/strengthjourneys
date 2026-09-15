/**
 * Lift-name regression checks for every importer.
 * Gym apps spell the same lift many ways ("Squat (Barbell)", "Barbell Squat",
 * "RDL"), and a wrong mapping either hides a lifter's history from a lift
 * guide or files a dumbbell set under the big four. The repository has no test
 * runner, so this script exercises the shared normalizer and real parsers
 * directly while preserving the application's normal `@/` imports.
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
    // The lift registry imports its JSON files with no import attribute, which
    // bare Node refuses before a hook could step in. Serve them as modules.
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

const { normalizeLiftTypeNames } =
  await import("../src/lib/data-sources/parser-utilities.js");
const { CURATED_LIFTS } = await import("../src/lib/lifts/lift-registry.js");
const { decodeCSV } = await import("../src/lib/data-sources/decode-csv.js");
const { detectFormat } =
  await import("../src/lib/data-sources/import-dispatcher.js");
const { parseStrongData } =
  await import("../src/lib/data-sources/strong-parser.js");

// Every registry name and synonym must come back as its own lift, and no
// spelling may belong to two lifts.
const owners = new Map();
for (const lift of CURATED_LIFTS) {
  for (const name of [lift.liftType, ...(lift.synonyms ?? [])]) {
    assert.equal(normalizeLiftTypeNames(name), lift.liftType, name);
    const key = name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    assert.ok(
      !owners.has(key) || owners.get(key) === lift.liftType,
      `"${name}" names both ${owners.get(key)} and ${lift.liftType}`,
    );
    owners.set(key, lift.liftType);
  }
}

const expectedNames = {
  // Barbell qualifiers, both app styles, reach the big four and variations.
  "Squat (Barbell)": "Back Squat",
  "Bench Press (Barbell)": "Bench Press",
  "Deadlift (Barbell)": "Deadlift",
  "Overhead Press (Barbell)": "Strict Press",
  "Military Press (Barbell)": "Strict Press",
  "Barbell Squat": "Back Squat",
  "Barbell Back Squat": "Back Squat",
  "Barbell Bench Press": "Bench Press",
  "Barbell Deadlift": "Deadlift",
  "Barbell Shoulder Press": "Strict Press",
  "Front Squat (Barbell)": "Front Squat",
  "Overhead Squat (Barbell)": "Overhead Squat",
  "Romanian Deadlift (Barbell)": "Romanian Deadlift",
  "Hip Thrust (Barbell)": "Hip Thrust",
  "Push Press (Barbell)": "Push Press",
  "Sumo Deadlift (Barbell)": "Sumo Deadlift",
  "Deficit Deadlift (Barbell)": "Deficit Deadlift",
  "Box Squat (Barbell)": "Box Squat",
  "Incline Bench Press (Barbell)": "Incline Bench Press",
  "Close Grip Bench Press (Barbell)": "Close Grip Bench Press",
  "Rack Pull (Barbell)": "Rack Pull",
  "Bent Over Row (Barbell)": "Barbell Row",

  // Registry names that already carry the word keep it.
  "Barbell Row": "Barbell Row",
  "Barbell Curl": "Barbell Curl",

  // Common spellings with no equipment at all.
  "Shoulder Press": "Strict Press",
  RDL: "Romanian Deadlift",
  "Bent Over Row": "Barbell Row",
  "Safety Squat Bar Squat": "Safety Bar Squat",
  "Pull Up (Bodyweight)": "Pull-up",

  // Other equipment stays a lift of its own.
  "Bench Press (Dumbbell)": "Bench Press (Dumbbell)",
  "Squat (Smith Machine)": "Squat (Smith Machine)",
  "Deadlift (Trap Bar)": "Deadlift (Trap Bar)",
  "Shoulder Press (Dumbbell)": "Shoulder Press (Dumbbell)",
  "Romanian Deadlift (Dumbbell)": "Romanian Deadlift (Dumbbell)",
  "Barbell Lunge": "Barbell Lunge",
  "Sumo Deadlift High Pull": "Sumo Deadlift High Pull",
};
for (const [raw, expected] of Object.entries(expectedNames)) {
  assert.equal(normalizeLiftTypeNames(raw), expected, raw);
}

// Synthetic rows in the publicly described Strong export shape, not a real
// export. Barbell lifts should reach the big four and registry variations;
// dumbbell, Smith machine, trap bar and assisted variants must stay their own.
const STRONG_SAMPLE_CSV = `Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE
2026-09-01 07:00:00,Lower A,1h 5m,Squat (Barbell),1,100,5,0,0,,,
2026-09-01 07:00:00,Lower A,1h 5m,Squat (Smith Machine),1,140,5,0,0,,,
2026-09-01 07:00:00,Lower A,1h 5m,Front Squat (Barbell),1,80,3,0,0,,,
2026-09-01 07:00:00,Lower A,1h 5m,Romanian Deadlift (Barbell),1,100,8,0,0,,,
2026-09-01 07:00:00,Lower A,1h 5m,Romanian Deadlift (Dumbbell),1,30,10,0,0,,,
2026-09-01 07:00:00,Lower A,1h 5m,Deadlift (Trap Bar),1,180,3,0,0,,,
2026-09-03 07:00:00,Upper A,58m,Bench Press (Barbell),1,80,5,0,0,,,
2026-09-03 07:00:00,Upper A,58m,Bench Press (Dumbbell),1,30,10,0,0,,,
2026-09-03 07:00:00,Upper A,58m,Overhead Press (Barbell),1,50,5,0,0,,,
2026-09-03 07:00:00,Upper A,58m,Shoulder Press (Dumbbell),1,20,10,0,0,,,
2026-09-03 07:00:00,Upper A,58m,Bent Over Row (Barbell),1,60,8,0,0,,,
2026-09-03 07:00:00,Upper A,58m,Pull Up (Assisted),1,20,8,0,0,,,
`;

const strongRows = decodeCSV(STRONG_SAMPLE_CSV);
assert.equal(detectFormat(strongRows[0])?.id, "strong");

const strong = parseStrongData(strongRows);
const strongNames = Object.fromEntries(
  strong.map((entry) => [entry.rawLiftType, entry.liftType]),
);
assert.deepEqual(strongNames, {
  "Squat (Barbell)": "Back Squat",
  "Squat (Smith Machine)": "Squat (Smith Machine)",
  "Front Squat (Barbell)": "Front Squat",
  "Romanian Deadlift (Barbell)": "Romanian Deadlift",
  "Romanian Deadlift (Dumbbell)": "Romanian Deadlift (Dumbbell)",
  "Deadlift (Trap Bar)": "Deadlift (Trap Bar)",
  "Bench Press (Barbell)": "Bench Press",
  "Bench Press (Dumbbell)": "Bench Press (Dumbbell)",
  "Overhead Press (Barbell)": "Strict Press",
  "Shoulder Press (Dumbbell)": "Shoulder Press (Dumbbell)",
  "Bent Over Row (Barbell)": "Barbell Row",
  "Pull Up (Assisted)": "Pull Up (Assisted)",
});

console.log("Lift-name validation passed.");
