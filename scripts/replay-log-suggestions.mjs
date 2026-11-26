/**
 * Replays the /log set suggestions over a real training log. For every set
 * in the date range it rebuilds what the lift block would have offered just
 * before that set (all earlier history, plus the sets already done that day)
 * and checks whether the set the athlete actually logged was on offer.
 *
 * Use it to measure a change to lift-block-coaching-state.js: run it before
 * and after, over the same file and range. Logs from athletes who type their
 * own sets are the best ground truth, since the buttons did not steer them.
 *
 * Reads a sheet-format CSV (see strengthjourneys-private/strength-journeys-
 * sheets/README.md). Prints only aggregates unless --rows is given; never
 * commit its output, which is the athlete's training data.
 *
 * Usage:
 *   node scripts/replay-log-suggestions.mjs <file.csv> [from] [to]
 *     [--lifts "Back Squat,Bench Press"] [--rows] [--metric|--imperial]
 *     [--app]
 *     --app     read an app export (Hevy, Strong, Fitbod...) through the
 *               importer instead of as a sheet. Those apps chose many of the
 *               weights, so their logs are weaker ground truth.
 *     from, to  YYYY-MM-DD, default the last 90 days of the file
 */

import { readFileSync } from "node:fs";

import "./source-loader.mjs";

const { decodeCSV } = await import("@/lib/import/decode-csv");
const { parseData, parseImportedRows } =
  await import("@/lib/import/import-dispatcher");
const { getLiftBlockCoachingState } =
  await import("@/components/log/lift-block-coaching-state");

const args = process.argv.slice(2);
const flag = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? null : (args[index + 1] ?? null);
};
const positional = args.filter(
  (arg, index) => !arg.startsWith("--") && args[index - 1] !== "--lifts",
);
const [file, fromArg, toArg] = positional;
if (!file) {
  console.error("Usage: node scripts/replay-log-suggestions.mjs <file.csv>");
  process.exit(1);
}
const lifts = flag("--lifts")?.split(",");
const showRows = args.includes("--rows");

const rows = decodeCSV(readFileSync(file, "utf8"));
const parsedData = (
  args.includes("--app") ? parseImportedRows(rows).data : parseData(rows)
).filter((entry) => entry.liftType !== "Bodyweight");
const lastDate = parsedData.reduce(
  (latest, entry) => (entry.date > latest ? entry.date : latest),
  "",
);
const from =
  fromArg ??
  new Date(Date.parse(`${lastDate}T00:00:00Z`) - 90 * 86400000)
    .toISOString()
    .slice(0, 10);
const to = toArg ?? lastDate;
// The display unit follows the log unless told otherwise.
const kgCount = parsedData.filter((entry) => entry.unitType === "kg").length;
const isMetric = args.includes("--metric")
  ? true
  : args.includes("--imperial")
    ? false
    : kgCount >= parsedData.length / 2;
const nearWeight = isMetric ? 2.5 : 5;

const sessions = new Map();
for (const entry of parsedData) {
  if (entry.date < from || entry.date > to) continue;
  if (lifts && !lifts.includes(entry.liftType)) continue;
  const key = `${entry.date}|${entry.liftType}`;
  if (!sessions.has(key)) sessions.set(key, []);
  sessions.get(key).push(entry);
}

const results = [];
for (const [key, sets] of [...sessions.entries()].sort()) {
  const [date, liftType] = key.split("|");
  sets.sort((a, b) => a.rowIndex - b.rowIndex);
  sets.forEach((actual, index) => {
    const realSets = sets.slice(0, index);
    const state = getLiftBlockCoachingState({
      isMetric,
      lastRealSet: realSets.at(-1),
      liftType,
      parsedData,
      realSets,
      sessionDate: date,
      sex: "male",
      standards: {},
      storedBarType: null,
      storedPlatePreference: "blue",
      topLiftsByTypeAndReps: {},
      topLiftsByTypeAndRepsLast12Months: {},
    });
    const buttons = state?.buttons ?? [];
    const exact = buttons.some(
      (b) => b.reps === actual.reps && b.weight === actual.weight,
    );
    results.push({
      date,
      liftType,
      index,
      actual: `${actual.reps}@${actual.weight}`,
      phase: state?.telemetryContext?.phase ?? "none",
      offered: buttons.map((b) => `${b.kind}:${b.reps}@${b.weight}`),
      exact,
      weight: buttons.some((b) => b.weight === actual.weight),
      near: buttons.some(
        (b) =>
          Math.abs(b.reps - actual.reps) <= 1 &&
          Math.abs(b.weight - actual.weight) <= nearWeight,
      ),
    });
  });
}

if (showRows) {
  for (const row of results) {
    const mark = row.exact ? "HIT " : row.weight ? "wt  " : "miss";
    console.log(
      `${row.date} ${row.liftType.padEnd(14)} #${row.index} ${row.actual.padEnd(9)} ${mark} ${row.phase.padEnd(10)} | ${row.offered.join("  ")}`,
    );
  }
  console.log("");
}

const pct = (part, whole) =>
  whole > 0 ? `${((part / whole) * 100).toFixed(0)}%` : "-";
const summarise = (rows) => {
  const exact = rows.filter((r) => r.exact).length;
  const weight = rows.filter((r) => r.weight).length;
  const near = rows.filter((r) => r.near).length;
  return `${String(rows.length).padStart(5)} sets  exact ${pct(exact, rows.length).padStart(4)}  weight ${pct(weight, rows.length).padStart(4)}  near ${pct(near, rows.length).padStart(4)}`;
};
const groupBy = (keyOf) => {
  const groups = new Map();
  for (const row of results) {
    const key = keyOf(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()].sort(([, a], [, b]) => b.length - a.length);
};

console.log(
  `Replayed ${from} to ${to}, ${isMetric ? "kg" : "lb"}. exact = reps and weight offered; weight = the weight offered; near = within 1 rep and ${nearWeight}${isMetric ? "kg" : "lb"}.\n`,
);
console.log(`${summarise(results)}  all\n`);
for (const [phase, rows] of groupBy((r) => r.phase)) {
  console.log(`${summarise(rows)}  ${phase}`);
}
console.log("");
for (const [liftType, rows] of groupBy((r) => r.liftType).slice(0, 8)) {
  console.log(`${summarise(rows)}  ${liftType}`);
}
