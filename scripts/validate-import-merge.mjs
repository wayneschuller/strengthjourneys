/**
 * Runs the import writer's real rules with the sheet write faked.
 *
 * Every screen that merges an import, fills a new sheet from one, or saves
 * sets typed by hand goes through src/lib/import/import-merge.js. This script
 * holds that module to what a merge should write, ask and say: what goes to
 * the sheet, when the lifter is asked first, when a preview is finished, and
 * that a preview with nothing to add is recorded once.
 *
 * The sets are synthetic. The changed-set case uses rows in the publicly
 * described Hevy export shape, because a conflict is only recognised from
 * the source details an app's import writes into the notes.
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
const { parseImportedRows } =
  await import("../src/lib/import/import-dispatcher.js");
const { compareImportToSheet, createImportWriter, toSheetEntries } =
  await import("../src/lib/import/import-merge.js");

// A writer whose sheet write is recorded, not sent. `fail` makes the next
// write reject the way the import route's refusal does.
function makeWriter() {
  const writes = [];
  let fail = null;
  const writer = createImportWriter({
    async write(request) {
      writes.push(request);
      if (fail) {
        const error = new Error(fail);
        fail = null;
        throw error;
      }
      return {
        insertedRows: request.entries.length,
        dateCount: new Set(request.entries.map((entry) => entry.date)).size,
      };
    },
  });
  return {
    writer,
    writes,
    failNext(message) {
      fail = message;
    },
  };
}

function set(date, liftType, reps, weight, extra = {}) {
  return { date, liftType, reps, weight, unitType: "kg", ...extra };
}

const squats = [
  set("2026-03-02", "Back Squat", 5, 100),
  set("2026-03-02", "Back Squat", 5, 100),
  set("2026-03-04", "Back Squat", 3, 110),
];
const base = {
  ssid: "sheet-1",
  formatId: "strong",
  formatName: "Strong",
  source: "test",
  comparisonPending: false,
};

// --- The shape of a set on its way to the sheet -----------------------------

assert.deepEqual(
  toSheetEntries([
    { date: "2026-03-02", liftType: "Deadlift", reps: 1, weight: 180 },
    set("2026-03-02", "Deadlift", 1, 400, { unitType: "lb", notes: "belt" }),
    set("2026-03-02", "Deadlift", 1, 150, { notes: "", rowIndex: 9 }),
  ]),
  [
    {
      date: "2026-03-02",
      liftType: "Deadlift",
      reps: 1,
      weight: 180,
      unitType: "kg",
    },
    {
      date: "2026-03-02",
      liftType: "Deadlift",
      reps: 1,
      weight: 400,
      unitType: "lb",
      notes: "belt",
    },
    {
      date: "2026-03-02",
      liftType: "Deadlift",
      reps: 1,
      weight: 150,
      unitType: "kg",
    },
  ],
);

// --- Nothing to merge with, or not yet ---------------------------------------

{
  const { writer, writes } = makeWriter();
  const noSheet = await writer.merge({
    ...base,
    ssid: null,
    importedEntries: squats,
    sheetEntries: [],
  });
  assert.equal(noSheet.status, "not_ready");
  assert.equal(noSheet.notice, null);

  const empty = await writer.merge({
    ...base,
    importedEntries: [],
    sheetEntries: [],
  });
  assert.equal(empty.status, "not_ready");

  const checking = await writer.merge({
    ...base,
    importedEntries: squats,
    sheetEntries: null,
    comparisonPending: true,
  });
  assert.equal(checking.status, "checking");
  assert.equal(checking.notice.title, "Still checking your sheet");
  assert.equal(checking.previewDone, false);
  assert.equal(writes.length, 0, "nothing is written before the comparison");
}

// --- A merge of sets the sheet lacks -----------------------------------------

{
  const { writer, writes } = makeWriter();
  let writeStarts = 0;
  const sheet = [squats[0], set("2026-02-27", "Bench Press", 5, 80)];
  const result = await writer.merge(
    { ...base, importedEntries: squats, sheetEntries: sheet },
    { onWriteStart: () => (writeStarts += 1) },
  );

  assert.equal(result.status, "merged");
  assert.equal(result.previewDone, true);
  assert.equal(writeStarts, 1);
  assert.equal(writes.length, 1);
  // One of the two identical sets is in the sheet; the other is still new.
  assert.deepEqual(writes[0].entries, toSheetEntries([squats[1], squats[2]]));
  assert.equal(writes[0].ssid, "sheet-1");
  assert.equal(writes[0].source, "test");
  assert.equal(writes[0].formatId, "strong");
  assert.deepEqual(writes[0].importSummary, {
    outcome: "merged",
    candidateEntryCount: 3,
    skippedCount: 1,
    conflictCount: 0,
    latestWorkoutDate: "2026-03-04",
  });
  assert.equal(result.notice.title, "Merged into your sheet");
  assert.equal(
    result.notice.description,
    "Added 2 rows across 2 dates. Skipped 1 duplicate.",
  );
}

// --- A write the route refuses -----------------------------------------------

{
  const { writer, writes, failNext } = makeWriter();
  failNext("The sheet could not be reached.");
  const result = await writer.merge({
    ...base,
    importedEntries: squats,
    sheetEntries: [],
  });
  assert.equal(result.status, "failed");
  assert.equal(result.previewDone, false, "a failed merge keeps the preview");
  assert.equal(result.notice.title, "Merge failed");
  assert.equal(result.notice.description, "The sheet could not be reached.");
  assert.equal(result.notice.variant, "destructive");
  assert.equal(writes.length, 1);
}

// --- A preview the sheet already holds ---------------------------------------

{
  const { writer, writes } = makeWriter();
  const input = { ...base, importedEntries: squats, sheetEntries: squats };

  // Looking at the preview records it once, however often it is looked at.
  await writer.noteComparison({ ...input, source: "test_comparison" });
  await writer.noteComparison({ ...input, source: "test_comparison" });
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].entries, []);
  assert.equal(writes[0].source, "test_comparison");
  assert.equal(writes[0].importSummary.outcome, "already_current");
  assert.equal(writes[0].importSummary.skippedCount, 3);

  // Pressing merge on it says so and does not record it a second time.
  const result = await writer.merge(input);
  assert.equal(result.status, "already_current");
  assert.equal(result.previewDone, false);
  assert.equal(result.notice.title, "Your training data is already up to date");
  assert.equal(writes.length, 1);

  // A different sheet is a different comparison.
  await writer.noteComparison({ ...input, ssid: "sheet-2" });
  assert.equal(writes.length, 2);
}

{
  // Pressed without having been looked at first, the merge records it, and
  // a record that cannot be kept is never the lifter's problem.
  const { writer, writes, failNext } = makeWriter();
  failNext("offline");
  const result = await writer.merge({
    ...base,
    importedEntries: squats,
    sheetEntries: squats,
  });
  assert.equal(result.status, "already_current");
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].entries, []);
}

{
  // While there is something to add, looking records nothing.
  const { writer, writes } = makeWriter();
  await writer.noteComparison({
    ...base,
    importedEntries: squats,
    sheetEntries: [],
  });
  await writer.noteComparison({
    ...base,
    importedEntries: squats,
    sheetEntries: null,
    comparisonPending: true,
  });
  assert.equal(writes.length, 0);
}

// --- Sets for lifts the sheet already has that day ---------------------------

{
  const { writer, writes } = makeWriter();
  // The lifter typed this session in by hand at slightly different loads.
  const typed = [1, 2, 3, 4, 5].map(() =>
    set("2026-03-09", "Back Squat", 5, 102.5),
  );
  const fromApp = [1, 2, 3, 4, 5].map(() =>
    set("2026-03-09", "Back Squat", 5, 100),
  );
  const input = { ...base, importedEntries: fromApp, sheetEntries: typed };

  const first = await writer.merge(input);
  assert.equal(first.status, "asked");
  assert.equal(first.previewDone, false);
  assert.equal(first.notice.title, "Your sheet may already have these");
  assert.match(first.notice.description, /Press merge again to add them\.$/);
  assert.equal(writes.length, 0, "the first press only asks");

  const second = await writer.merge(input);
  assert.equal(second.status, "merged");
  assert.equal(writes.length, 1);
  assert.equal(writes[0].entries.length, 5);

  // A different file is asked about afresh.
  const other = await writer.merge({
    ...input,
    importedEntries: [...fromApp, set("2026-03-09", "Back Squat", 5, 100)],
  });
  assert.equal(other.status, "asked");
  assert.equal(writes.length, 1);
}

// --- Sets the sheet holds differently ----------------------------------------

{
  const HEVY_CSV = `title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe
Upper,"25 Aug 2025, 09:38","25 Aug 2025, 10:54",,Bench Press (Barbell),,,0,normal,100,5,,,8
Upper,"25 Aug 2025, 09:38","25 Aug 2025, 10:54",,Bench Press (Barbell),,,1,normal,100,5,,,8
`;
  const { data: imported } = parseImportedRows(decodeCSV(HEVY_CSV), {
    importedAt: new Date(2026, 7, 14, 12, 0, 0),
  });
  assert.equal(imported.length, 2);
  // The sheet took the first set from an earlier import of the same workout,
  // and the lifter has since corrected its load there.
  const inSheet = [{ ...imported[0], weight: imported[0].weight + 5 }];
  const hevy = { ...base, formatId: "hevy", formatName: "Hevy" };

  const { writer, writes } = makeWriter();
  const comparison = compareImportToSheet(imported, inSheet, "hevy");
  assert.equal(comparison.conflictCount, 1);
  assert.equal(comparison.newEntriesCount, 1);

  const result = await writer.merge({
    ...hevy,
    importedEntries: imported,
    sheetEntries: inSheet,
  });
  assert.equal(result.status, "merged");
  assert.equal(
    result.previewDone,
    false,
    "a changed set left for review keeps the preview open",
  );
  assert.equal(writes.length, 1);
  assert.equal(writes[0].entries.length, 1);
  assert.equal(writes[0].importSummary.conflictCount, 1);
  assert.match(
    result.notice.description,
    /Left 1 changed set untouched for review\.$/,
  );

  // Once the new set is in the sheet, only the changed one is left.
  const after = await writer.merge({
    ...hevy,
    importedEntries: imported,
    sheetEntries: [...inSheet, imported[1]],
  });
  assert.equal(after.status, "conflicts_only");
  assert.equal(after.previewDone, false);
  assert.equal(after.notice.title, "Changed sets need review");
  assert.equal(after.notice.variant, "destructive");
  assert.equal(writes.length, 2);
  assert.deepEqual(writes[1].entries, [], "nothing is overwritten");
  assert.equal(writes[1].importSummary.outcome, "conflicts_only");
}

// --- A whole import into a new sheet, and sets typed by hand -----------------

{
  const { writer, writes } = makeWriter();
  const data = await writer.writeWholeImport({
    ssid: "new-sheet",
    entries: squats,
    formatId: "strong",
    formatName: "Strong",
    source: "sheet_setup_create",
  });
  assert.equal(data.insertedRows, 3);
  assert.deepEqual(writes[0].entries, toSheetEntries(squats));
  assert.deepEqual(writes[0].importSummary, {
    outcome: "merged",
    candidateEntryCount: 3,
    skippedCount: 0,
    conflictCount: 0,
    latestWorkoutDate: "2026-03-04",
  });

  await writer.writeManualEntries({
    ssid: "sheet-1",
    entries: [set("2019-01-01", "Deadlift", 1, 200)],
    source: "import_page_manual",
  });
  assert.equal(writes[1].trackImportRitual, false);
  assert.equal(writes[1].formatName, "Strength Journeys");
  assert.equal(writes[1].importSummary, undefined);
}

console.log("Import merge checks passed.");
