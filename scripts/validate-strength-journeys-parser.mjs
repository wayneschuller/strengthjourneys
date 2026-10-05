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
const { logParseIssue, createParseRepairLog } =
  await import("../src/lib/import/parsers/parser-utilities.js");

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
    logged.filter((line) => line.startsWith(`${kind}: `)).length,
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
  assert.match(recoveryLogs[0], /Suggestion: Restore "Date"/);
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

// Keep the missing-header error for absent, mixed or ambiguous date evidence,
// and never claim an already named column.
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
]) {
  assert.throws(
    () => parseStrengthJourneysData(rows),
    /Missing required columns: Date/,
  );
}

const withDateHeader = recoveryRows.map((row) => [...row]);
withDateHeader[1][4] = "2026-10-03";
assert.deepEqual(parseStrengthJourneysData(withDateHeader), expectedRecovery);

// Recover Lift Type in every position, using registry synonyms, importer
// aliases and sparse anchors. Compare the full result to the labelled sheet.
const liftRecoveryRows = [
  ["Date", "Lift Type", "Reps", "Weight"],
  ["2026-10-02", "Squat (Barbell)", "5", "100kg"],
  ["", "", "3", "110kg"],
  ["2026-10-03", "RDL", "5", "70kg"],
  ["", "Overhead Press", "5", "40kg"],
  ["", " front squat ", "5", "60kg"],
];
const liftGroupCollapsed = console.groupCollapsed;
const liftGroupEnd = console.groupEnd;
console.groupCollapsed = () => {};
console.groupEnd = () => {};
try {
  for (const order of permutations([0, 1, 2, 3])) {
    const rows = liftRecoveryRows.map((row) =>
      order.map((index) => row[index]),
    );
    const expected = parseStrengthJourneysData(rows);
    const liftColumn = order.indexOf(1);
    rows[0][liftColumn] = "";
    // Simulate the Sheets API omitting a trailing empty header cell.
    if (liftColumn === 3) rows[0].pop();
    const before = structuredClone(rows);
    const recoveryLogs = [];
    console.info = (line) => recoveryLogs.push(line);
    assert.deepEqual(parseStrengthJourneysData(rows), expected);
    assert.deepEqual(rows, before);
    assert.equal(recoveryLogs.length, 1);
    assert.ok(
      recoveryLogs[0].includes(
        `Inferred Lift Type from the known lift names in column ${liftColumn + 1}`,
      ),
    );
    assert.ok(recoveryLogs[0].includes('Suggestion: Restore "Lift Type"'));
  }
} finally {
  console.info = info;
  console.groupCollapsed = liftGroupCollapsed;
  console.groupEnd = liftGroupEnd;
}

// Empty, unknown, weak or ambiguous evidence must not recover a header. A
// registered name in a labelled Notes column must not be mistaken for a lift.
for (const rows of [
  [["Date", "", "Reps", "Weight"]],
  [
    ["Date", "", "Reps", "Weight"],
    ["2026-10-02", "", "5", "100kg"],
  ],
  [
    ["Date", "", "Reps", "Weight"],
    ["2026-10-02", "My custom exercise", "5", "100kg"],
  ],
  [
    ["Date", "", "Reps", "Weight"],
    ["2026-10-02", "Deadlift", "5", "100kg"],
    ...Array.from({ length: 10 }, () => ["", "session note", "3", "110kg"]),
  ],
  [
    ["Date", "", "Reps", "Weight", ""],
    ["2026-10-02", "Deadlift", "5", "100kg", "Bench Press"],
  ],
  [
    ["Date", "Notes", "Reps", "Weight"],
    ["2026-10-02", "Deadlift", "5", "100kg"],
  ],
]) {
  assert.throws(
    () => parseStrengthJourneysData(rows),
    /Missing required columns: Lift Type/,
  );
}
assert.equal(
  parseStrengthJourneysData([
    ["Date", "Lift Type", "Reps", "Weight", ""],
    ["2026-10-02", "My custom exercise", "5", "100kg", "Deadlift"],
  ])[0].liftType,
  "My custom exercise",
);

// Registry evidence can identify a real log containing custom lifts or cardio,
// without dropping or renaming those entries. Count populated
// names only; sparse blanks must not dilute the confidence threshold.
const mixedLiftRows = [
  ["Date", "Lift Type", "Reps", "Weight"],
  ["2026-10-02", "Deadlift", "5", "100kg"],
  ["", "", "3", "110kg"],
  ["2026-10-03", "My custom exercise", "5", "40kg"],
  ["2026-10-04", "Bench Press", "5", "60kg"],
  ["2026-10-05", "RDL", "5", "70kg"],
  ["2026-10-06", "Overhead Press", "5", "40kg"],
];
const expectedMixedLifts = parseStrengthJourneysData(mixedLiftRows);
mixedLiftRows[0][1] = "";
assert.deepEqual(parseStrengthJourneysData(mixedLiftRows), expectedMixedLifts);
assert.deepEqual(
  parseStrengthJourneysData(mixedLiftRows.slice(0, -1)),
  expectedMixedLifts.slice(0, -1),
);

// A machine-heavy column needs only 10% registry matches. The other 90% of
// names are kept, while a column with less evidence still asks for a header.
const machineRows = [
  ["Date", "Lift Type", "Reps", "Weight"],
  ["2026-10-02", "Deadlift", "5", "100kg"],
  ...Array.from({ length: 9 }, (_, index) => [
    "",
    `Custom machine ${index}`,
    "10",
    "20kg",
  ]),
];
const machineExpected = parseStrengthJourneysData(machineRows);
machineRows[0][1] = "";
assert.deepEqual(parseStrengthJourneysData(machineRows), machineExpected);
assert.throws(
  () =>
    parseStrengthJourneysData([
      ...machineRows,
      ["", "Another machine", "10", "20kg"],
    ]),
  /Missing required columns: Lift Type/,
);

// Every missing-header combination in every column order, including entirely
// blank/truncated headers and sheets starting with data in row 1.
console.groupCollapsed = () => {};
console.groupEnd = () => {};
console.info = () => {};
try {
  for (const order of permutations([0, 1, 2, 3])) {
    const labelled = liftRecoveryRows.map((row) =>
      order.map((index) => row[index]),
    );
    const expected = parseStrengthJourneysData(labelled);
    for (let missing = 1; missing < 16; missing++) {
      const rows = labelled.map((row) => [...row]);
      for (let column = 0; column < 4; column++) {
        if (missing & (1 << column)) rows[0][column] = "";
      }
      while (rows[0].at(-1) === "") rows[0].pop();
      const before = structuredClone(rows);
      assert.deepEqual(parseStrengthJourneysData(rows), expected);
      assert.deepEqual(rows, before);
    }
    const headerless = labelled.slice(1);
    const before = structuredClone(headerless);
    assert.deepEqual(
      parseStrengthJourneysData(headerless),
      expected.map((entry) => ({ ...entry, rowIndex: entry.rowIndex - 1 })),
    );
    assert.deepEqual(headerless, before);
    assert.equal(parseStrengthJourneysData(headerless)[0].rowIndex, 1);
  }

  // Named counterparts make high reps and light unitless weights unambiguous.
  // When both are unnamed, repeated 45+ loads, decimals, zero loads or units
  // can separate them without relying on column order.
  for (const labelled of [
    [
      ["Date", "Lift Type", "Reps", "Weight"],
      ["2026-10-02", "Deadlift", "45", "5"],
    ],
    [
      ["Date", "Lift Type", "Reps", "Weight"],
      ["2026-10-02", "Deadlift", "5", "45"],
      ["", "", "3", "65"],
    ],
    [
      ["Date", "Lift Type", "Reps", "Weight"],
      ["2026-10-02", "Deadlift", "5", "2.5"],
    ],
    [
      ["Date", "Lift Type", "Reps", "Weight"],
      ["2026-10-02", "Pull-up", "5", "0"],
    ],
    [
      ["Date", "Lift Type", "Reps", "Weight"],
      ["2026-10-02", "Deadlift", "5", "45lb"],
    ],
    [
      ["Date", "Lift Type", "Reps", "Weight"],
      ["2026-10-02", "Deadlift", "5", "12,5kg"],
      ["", "", "3", "15"],
    ],
  ]) {
    const expected = parseStrengthJourneysData(labelled);
    for (const missing of [2, 3]) {
      const rows = labelled.map((row) => [...row]);
      rows[0][missing] = "";
      assert.deepEqual(parseStrengthJourneysData(rows), expected);
    }
    // A single 45 or 45 reps with a 5 load has too little evidence for both.
    if (
      labelled[1][2] !== "45" &&
      !(labelled.length === 2 && labelled[1][3] === "45")
    ) {
      const rows = labelled.map((row) => [...row]);
      rows[0] = [];
      assert.deepEqual(parseStrengthJourneysData(rows), expected);
    }
  }

  // Respect named Notes, but reject competing numeric columns when their
  // headers are blank. Never parse dates, timestamps or prose as loads.
  const withNotes = [
    ["Date", "Lift Type", "", "", "Notes"],
    ["2026-10-02", "Deadlift", "5", "45kg", "10"],
  ];
  assert.equal(parseStrengthJourneysData(withNotes)[0].notes, "10");
  for (const rows of [
    [
      ["Date", "Lift Type", "", ""],
      ["2026-10-02", "Deadlift", "5", "10"],
    ],
    [
      ["Date", "Lift Type", "", ""],
      ["2026-10-02", "Deadlift", "5", "45"],
    ],
    [
      ["Date", "Lift Type", "", "", ""],
      ["2026-10-02", "Deadlift", "5", "45kg", "10"],
    ],
    [
      ["Date", "Lift Type", "Reps", "", ""],
      ["2026-10-02", "Deadlift", "5", "45kg", "60lb"],
    ],
    [
      ["Date", "Lift Type", "Reps", ""],
      ["2026-10-02", "Deadlift", "5", "08:45"],
    ],
    [
      ["Date", "Lift Type", "Reps", ""],
      ["2026-10-02", "Deadlift", "5", "2026-10-03"],
    ],
    [
      ["Date", "Lift Type", "Reps", ""],
      ["2026-10-02", "Deadlift", "5", "45 minutes of training"],
    ],
    [
      ["Date", "Lift Type", "Reps", ""],
      ["2026-10-02", "Deadlift", "5", ""],
      ["", "", "", "45kg"],
    ],
  ]) {
    assert.throws(
      () => parseStrengthJourneysData(rows),
      /Missing required columns:/,
    );
  }
} finally {
  console.info = info;
  console.groupCollapsed = liftGroupCollapsed;
  console.groupEnd = liftGroupEnd;
}

// Browser output separates user text from formatting arguments: literal %c
// inside a cell stays text, while advice is italic without a repeated heading.
const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
const styledLogs = [];
const warn = console.warn;
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {},
});
console.warn = (...args) => styledLogs.push(args);
try {
  logParseIssue("Invalid date: %c", "Use YYYY-MM-DD.", "warn");
} finally {
  console.warn = warn;
  if (windowDescriptor) {
    Object.defineProperty(globalThis, "window", windowDescriptor);
  } else {
    delete globalThis.window;
  }
}
assert.deepEqual(styledLogs, [
  [
    "%s\n%cSuggestion: %s",
    "Invalid date: %c",
    "font-weight: normal; font-style: italic;",
    "Use YYYY-MM-DD.",
  ],
]);
assert.ok(logged.every((line) => line.includes("\nSuggestion: ")));

// All notice types share one collapsed group, while a clean parse (or a
// second flush) opens no group. Warnings keep their console severity.
const groupEvents = [];
const groupCollapsed = console.groupCollapsed;
const groupEnd = console.groupEnd;
console.groupCollapsed = (...args) => groupEvents.push(["open", ...args]);
console.groupEnd = () => groupEvents.push(["close"]);
console.info = (line) => groupEvents.push(["info", line]);
console.warn = (line) => groupEvents.push(["warn", line]);
try {
  const repairs = createParseRepairLog("Strength Journeys");
  repairs.flush();
  assert.equal(groupEvents.length, 0);
  repairs.issue("Inferred Date", 'Restore "Date".');
  repairs.issue("Invalid date", "Use YYYY-MM-DD.", "warn");
  repairs.add("decimal comma", 2, "112,5kg", "112.5kg");
  repairs.flush();
  repairs.flush();
} finally {
  console.groupCollapsed = groupCollapsed;
  console.groupEnd = groupEnd;
  console.info = info;
  console.warn = warn;
}
assert.deepEqual(
  groupEvents.map(([event]) => event),
  ["open", "info", "warn", "info", "close"],
);
assert.match(groupEvents[0][1], /Strength Journeys parsing.*3 notices/);

// An inferred Date or Lift Type column has to do that column's job. A stray
// column that merely passes the content test (two dates typed beside a set, a
// single known lift name) must not be taken when the real column is ruled
// out, or every set would be shown under two dates or one lift.
const quietly = (run) => {
  const saved = [console.groupCollapsed, console.groupEnd, console.info];
  console.groupCollapsed = () => {};
  console.groupEnd = () => {};
  console.info = () => {};
  try {
    return run();
  } finally {
    [console.groupCollapsed, console.groupEnd, console.info] = saved;
  }
};
const strayDateRows = [
  ["2026-03-02", "Back Squat", "5", "100kg", "", "", ""],
  ["", "", "5", "100kg", "", "", ""],
  ["see notes", "", "5", "100kg", "", "", ""],
  ["2026-03-04", "Bench Press", "5", "60kg", "", "", ""],
  ["", "", "5", "60kg", "", "", "2026-06-01"],
  ["", "", "5", "60kg", "", "", ""],
  ["2026-03-06", "Deadlift", "3", "140kg", "", "", "2026-06-08"],
  ["", "", "3", "140kg", "", "", ""],
];
assert.throws(
  () => quietly(() => parseStrengthJourneysData(strayDateRows)),
  /Missing required columns: Date/,
  "a column that starts halfway down the sets is not the Date column",
);

// The same stray column on the very first row covers every set, so only its
// thinness gives it away: one value for hundreds of sets.
const thinDateRows = Array.from({ length: 450 }, (_, i) => [
  i === 40
    ? "deload"
    : i % 9 === 0
      ? `2025-${String(1 + (i % 12)).padStart(2, "0")}-10`
      : "",
  i % 9 === 0 ? "Back Squat" : "",
  "5",
  "100kg",
  "",
  "",
  i === 0 ? "2026-06-01" : "",
]);
assert.throws(
  () => quietly(() => parseStrengthJourneysData(thinDateRows)),
  /Missing required columns: Date/,
  "one date over hundreds of sets is not the Date column",
);

const strayLiftRows = [
  ["Date", "", "Reps", "Weight", "Notes", "URL", ""],
  ["2026-03-02", "Kniebeuge", "5", "100kg", "", "", ""],
  ["", "", "5", "100kg", "", "", ""],
  ["2026-03-04", "Bankdruecken", "5", "60kg", "", "", ""],
  ["", "", "5", "60kg", "", "", "Deadlift"],
  ["2026-03-06", "Kreuzheben", "3", "140kg", "", "", ""],
  ["", "", "3", "140kg", "", "", ""],
];
assert.throws(
  () => quietly(() => parseStrengthJourneysData(strayLiftRows)),
  /Missing required columns: Lift Type/,
  "one known lift name in a spare column is not the Lift Type column",
);

// A real log may open with a set or two that has no date yet. That is not a
// reason to refuse a Date column which covers everything after it.
const orphanTopRows = [
  ["", "Lift Type", "Reps", "Weight"],
  ["", "Back Squat", "5", "20kg"],
  ...Array.from({ length: 40 }, (_, i) => [
    i % 4 === 0 ? `2026-03-${String(2 + i / 4).padStart(2, "0")}` : "",
    i % 4 === 0 ? "Back Squat" : "",
    "5",
    "100kg",
  ]),
];
assert.equal(
  quietly(() => parseStrengthJourneysData(orphanTopRows)).length,
  40,
  "orphan sets above the first date are skipped, not a reason to refuse",
);

// A unit or hint in brackets is decoration on a header, not a different
// column: the weights must come from "Weight (kg)", not from the unlabelled
// numeric column beside it.
const decoratedRows = [
  ["Date (yyyy-mm-dd)", "Lift Type", "Reps:", "Weight (kg)", "Notes", ""],
  ["2026-03-02", "Deadlift", "5", "140", "", "8"],
  ["", "", "3", "160", "", "9"],
  ["", "", "1", "180", "", "10"],
];
assert.deepEqual(
  quietly(() => parseStrengthJourneysData(decoratedRows)).map((entry) => [
    entry.date,
    entry.reps,
    entry.weight,
  ]),
  [
    ["2026-03-02", 5, 140],
    ["2026-03-02", 3, 160],
    ["2026-03-02", 1, 180],
  ],
);

// A unit written in the Weight header covers the bare numbers beneath it.
assert.deepEqual(
  quietly(() =>
    parseStrengthJourneysData([
      ["Date", "Lift Type", "Reps", "Weight (kg)"],
      ["2026-03-02", "Deadlift", "5", "140"],
      ["", "", "3", "160"],
    ]),
  ).map((entry) => `${entry.weight}${entry.unitType}`),
  ["140kg", "160kg"],
);

// A lifter's own headings. A linked sheet takes a labelled column at its
// word and asks for the header; a one-off file import may work it out.
const ownHeadingRows = [
  ["Day", "Movement", "Count", "Kg", "Comments"],
  ["2026-03-02", "Back Squat", "5", "100", "felt good"],
  ["", "", "5", "102.5", ""],
  ["2026-03-04", "Bench Press", "5", "60", ""],
  ["", "", "3", "65", ""],
];
assert.throws(
  () => quietly(() => parseStrengthJourneysData(ownHeadingRows)),
  /Missing required columns: Date, Reps, Weight/,
);
const { parseImportedFile } =
  await import("../src/lib/import/import-dispatcher.js");
const ownFile = new File(
  [ownHeadingRows.map((row) => row.join(",")).join("\n")],
  "my-training.csv",
);
const ownImport = await quietly(() => parseImportedFile(ownFile));
assert.equal(ownImport.formatId, "strength-journeys");
assert.deepEqual(
  ownImport.data.map((entry) => [
    entry.date,
    entry.liftType,
    entry.reps,
    `${entry.weight}${entry.unitType}`,
    entry.notes ?? "",
  ]),
  [
    ["2026-03-02", "Back Squat", 5, "100kg", "felt good"],
    ["2026-03-02", "Back Squat", 5, "102.5kg", ""],
    ["2026-03-04", "Bench Press", 5, "60kg", ""],
    ["2026-03-04", "Bench Press", 3, "65kg", ""],
  ],
);
// A file that is not a lifting log is still turned away.
await assert.rejects(
  quietly(() =>
    parseImportedFile(
      new File(
        ["Date,Payee,Amount\n2026-03-02,Grocer,54.20\n2026-03-03,Rent,900"],
        "bank.csv",
      ),
    ),
  ),
  /Unrecognized file format/,
);

// One reading of a sheet's layout serves the parser, the link check and the
// import merge. What the link check accepts (hasRequiredColumns) and where a
// write may go (getSheetWriteColumns, then resolveWriteColumns against row 1)
// must agree with what the parser can read.
const { detectSheetLayout, getSheetWriteColumns, hasRequiredColumns } =
  await import("../src/lib/import/parsers/strength-journeys-parser.js");
const { resolveWriteColumns } =
  await import("../src/lib/sheet/sheet-row-ops.js");
const sampleBody = [
  ["2026-03-02", "Deadlift", "5", "140kg", "09:00 ", ""],
  ["", "", "3", "160kg", "", ""],
  ["2026-03-01", "Back Squat", "5", "100kg", "", ""],
  ["", "", "5", "100kg", "", ""],
];
const reorder = (row, order) => order.map((from) => row[from] ?? "");
const layoutCases = [
  {
    name: "standard",
    rows: [
      ["Date", "Lift Type", "Reps", "Weight", "Notes", "URL"],
      ...sampleBody,
    ],
    linkable: true,
    write: { date: 0, liftType: 1, reps: 2, weight: 3, notes: 4, url: 5 },
  },
  {
    name: "synonyms and decoration",
    rows: [
      ["Workout Date", "Exercise", "Repetitions", "Load (kg)", "Comments"],
      ...sampleBody,
    ],
    linkable: true,
    write: { date: 0, liftType: 1, reps: 2, weight: 3, notes: 4, url: null },
  },
  {
    name: "own column order",
    rows: [
      ["Lift Type", "Notes", "Date", "RPE", "Weight", "Reps", "URL"],
      ...sampleBody.map((row) => [
        row[1],
        row[4],
        row[0],
        "",
        row[3],
        row[2],
        row[5],
      ]),
    ],
    linkable: true,
    write: { date: 2, liftType: 0, reps: 5, weight: 4, notes: 1, url: 6 },
  },
  {
    name: "Date header deleted",
    rows: [["", "Lift Type", "Reps", "Weight", "Notes", "URL"], ...sampleBody],
    linkable: true,
    write: { date: 0, liftType: 1, reps: 2, weight: 3, notes: 4, url: 5 },
  },
  {
    name: "own order with a heading deleted",
    rows: [
      ["Lift Type", "", "Weight", "Reps"],
      ...sampleBody.map((row) => reorder(row, [1, 0, 3, 2])),
    ],
    linkable: true,
    write: { date: 1, liftType: 0, reps: 3, weight: 2, notes: null, url: null },
  },
  {
    // Readable and linkable, but with nothing in row 1 to check a write by.
    name: "no header row",
    rows: sampleBody,
    linkable: true,
    write: null,
  },
  {
    name: "header only, no sets yet",
    rows: [["Date", "Lift Type", "Reps", "Weight", "Notes", "URL"]],
    linkable: true,
    write: { date: 0, liftType: 1, reps: 2, weight: 3, notes: 4, url: 5 },
  },
  {
    name: "not a lifting log",
    rows: [
      ["Date", "Payee", "Amount"],
      ["2026-03-02", "Grocer", "54.20"],
      ["2026-03-03", "Rent", "900"],
    ],
    linkable: false,
    write: null,
  },
];
for (const { name, rows, linkable, write } of layoutCases) {
  const layout = quietly(() => detectSheetLayout(rows));
  assert.equal(hasRequiredColumns(layout), linkable, `${name}: linkable`);
  const columns = linkable ? getSheetWriteColumns(layout) : null;
  assert.deepEqual(columns, write, `${name}: write columns`);
  if (columns) {
    // The server's own check of that map against row 1 must agree.
    assert.deepEqual(
      resolveWriteColumns(columns, rows[0]),
      { ok: true, columns },
      `${name}: server accepts the map`,
    );
  }
  // And whatever links, parses.
  if (linkable && rows.length > 1) {
    assert.ok(
      quietly(() => parseStrengthJourneysData(rows)).length > 0,
      `${name}: parses`,
    );
  }
}
// A map that no longer matches row 1 is refused, whichever way it is wrong.
const standardHeader = ["Date", "Lift Type", "Reps", "Weight", "Notes", "URL"];
for (const stale of [
  { date: 0, liftType: 1, reps: 3, weight: 2, notes: 4, url: 5 },
  { date: 0, liftType: 1, reps: 2, weight: 3, notes: null, url: 5 },
  { date: 0, liftType: 1, reps: 2, weight: 2, notes: 4, url: 5 },
]) {
  assert.equal(resolveWriteColumns(stale, standardHeader).ok, false);
}
assert.equal(
  resolveWriteColumns(
    { date: 0, liftType: 1, reps: 2, weight: 3, notes: 4, url: 5 },
    ["", "", "", "", "", ""],
  ).ok,
  false,
  "a first row that names nothing is not a header to write by",
);

// The repair the app makes to a sheet's first row: only the headings that
// are missing, only into blank cells, and a new row only when there is none.
const { planHeaderRepair } =
  await import("../src/lib/import/parsers/strength-journeys-parser.js");
const repairOf = (rows) =>
  quietly(() => planHeaderRepair(detectSheetLayout(rows), rows));
const filmedBody = sampleBody.map((row, i) =>
  i === 0 ? [...row.slice(0, 5), "https://youtu.be/abc"] : row,
);
const allSix = ["Date", "Lift Type", "Reps", "Weight", "Notes", "URL"].map(
  (name, column) => ({ column, name }),
);
assert.equal(repairOf([allSix.map(({ name }) => name), ...filmedBody]), null);
assert.deepEqual(repairOf(filmedBody), { insertRow: true, headings: allSix });
assert.deepEqual(repairOf([["", "", "", "", "", ""], ...filmedBody]), {
  insertRow: false,
  headings: allSix,
});
assert.deepEqual(
  repairOf([
    ["", "Lift Type", "Reps", "Weight", "Notes", "URL"],
    ...filmedBody,
  ]),
  { insertRow: false, headings: [{ column: 0, name: "Date" }] },
);
assert.deepEqual(
  repairOf([
    ["Lift Type", "", "Weight", "Reps"],
    ...sampleBody.map((row) => reorder(row, [1, 0, 3, 2])),
  ]),
  { insertRow: false, headings: [{ column: 1, name: "Date" }] },
);
// Two spare columns of text: no telling which is Notes, so neither is named.
assert.deepEqual(
  repairOf(filmedBody.map((row) => [...row, "meet"])).headings.map(
    ({ name }) => name,
  ),
  ["Date", "Lift Type", "Reps", "Weight", "URL"],
);
// A heading the lifter wrote, known to us or not, is never touched, and a
// sheet that only lacks optional headings is left as it is.
assert.equal(
  repairOf([["Date", "Lift Type", "Reps", "Weight", "RPE"], ...sampleBody]),
  null,
);
assert.equal(
  repairOf([["Date", "Lift Type", "Reps", "Weight"], ...filmedBody]),
  null,
);
assert.equal(
  repairOf([
    ["Date", "Payee", "Amount"],
    ["2026-03-02", "Grocer", "54.20"],
  ]),
  null,
);
// What the repair writes makes the sheet one the app reads without inference,
// and writes to.
const repairedRows = [allSix.map(({ name }) => name), ...filmedBody];
const repairedLayout = quietly(() => detectSheetLayout(repairedRows));
assert.deepEqual(repairedLayout.inferred, []);
assert.ok(getSheetWriteColumns(repairedLayout));

console.log("Strength Journeys parser checks passed.");

function permutations(values) {
  if (values.length === 0) return [[]];
  return values.flatMap((value, index) =>
    permutations(values.filter((_, other) => other !== index)).map((rest) => [
      value,
      ...rest,
    ]),
  );
}
