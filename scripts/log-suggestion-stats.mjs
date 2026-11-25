/**
 * Prints how the /log set suggestions are doing, from the anonymous records
 * described in src/lib/log-suggestion-telemetry.js: how often athletes take a
 * suggestion rather than typing their own set, per phase and per suggestion
 * kind, and where custom sets land against the nearest thing we offered.
 *
 * Reads whatever KV the local .env names, which is production. Read only.
 *
 * Usage:
 *   node scripts/log-suggestion-stats.mjs [months] [--dev] [--json]
 *     months  how many UTC months back, default 3
 *     --dev   read the dev and preview pool instead of production
 *     --json  print every record as JSON lines, for deeper analysis
 */

import path from "node:path";

import { repositoryRoot } from "./source-loader.mjs";

// The KV client reads its credentials at import time, so load .env first.
process.loadEnvFile(path.join(repositoryRoot, ".env"));

const { readLogSuggestionMonths } = await import("@/lib/log-suggestion-stats");

const args = process.argv.slice(2);
const monthCount = Number(args.find((arg) => /^\d+$/.test(arg))) || 3;
const useDev = args.includes("--dev");
const asJson = args.includes("--json");

const monthKeys = Array.from({ length: monthCount }, (_, index) => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index, 1))
    .toISOString()
    .slice(0, 7);
});
const months = await readLogSuggestionMonths(monthKeys, {
  env: useDev ? "development" : "production",
});
const records = months.flatMap(({ month, records }) =>
  records.map((record) => ({ month, ...record })),
);

if (asJson) {
  records.forEach((record) => console.log(JSON.stringify(record)));
  process.exit(0);
}

console.log(
  `Set suggestions, ${monthKeys.at(-1)} to ${monthKeys[0]} (UTC months)${
    useDev ? ", dev pool" : ""
  }: ${records.length} sets added\n`,
);
if (records.length === 0) process.exit(0);

const pct = (part, whole) =>
  whole > 0 ? `${((part / whole) * 100).toFixed(0)}%` : "-";

// Hit rate per phase: of the sets added where we offered something, how many
// were one of our offers.
console.log("== Suggestion taken, by phase ==");
const byPhase = groupBy(records, (record) =>
  [record.mode, record.phase].join(" / "),
);
for (const [phase, rows] of sortBySize(byPhase)) {
  const taken = rows.filter((row) => row.event === "suggestion").length;
  console.log(
    `  ${`${taken}/${rows.length}`.padStart(9)} ${pct(taken, rows.length).padStart(5)}  ${phase}`,
  );
}

// Per kind: shown, taken, and where in the row it sat when taken.
console.log("\n== Each suggestion kind ==");
const kinds = new Map();
for (const record of records) {
  record.offered.forEach((button, index) => {
    const row = kinds.get(button.kind) ?? { shown: 0, taken: 0, slots: [] };
    row.shown += 1;
    if (record.event === "suggestion" && record.picked === index) {
      row.taken += 1;
      row.slots.push(index + 1);
    }
    kinds.set(button.kind, row);
  });
}
for (const [kind, row] of [...kinds.entries()].sort(
  ([, a], [, b]) => b.taken / b.shown - a.taken / a.shown,
)) {
  console.log(
    `  ${`${row.taken}/${row.shown}`.padStart(9)} ${pct(row.taken, row.shown).padStart(5)}  ${kind}`,
  );
}

// Custom sets: how far from the nearest offer, in reps and in proportion of
// the anchor. Small gaps mean a rule was close; big ones mean a rule is
// missing.
const customs = records.filter((record) => record.event === "custom");
console.log(`\n== Custom sets (${customs.length}) ==`);
const gapBuckets = new Map();
for (const record of customs) {
  const nearest = nearestOffer(record);
  const bucket = !nearest
    ? "nothing offered"
    : nearest.weightGap === 0 && nearest.repsGap === 0
      ? "typed an offered set"
      : nearest.weightGap === 0
        ? `same weight, reps ${signed(nearest.repsGap)}`
        : nearest.repsGap === 0
          ? `same reps, weight ${bucketRatio(nearest.weightGap)}`
          : `reps ${signed(nearest.repsGap)}, weight ${bucketRatio(nearest.weightGap)}`;
  gapBuckets.set(bucket, (gapBuckets.get(bucket) ?? 0) + 1);
}
for (const [bucket, count] of [...gapBuckets.entries()].sort(
  ([, a], [, b]) => b - a,
)) {
  console.log(`  ${String(count).padStart(5)}  ${bucket}`);
}

function nearestOffer(record) {
  if (!record.offered.length || !record.entered) return null;
  return record.offered
    .map((button) => ({
      weightGap: round2(record.entered.weight - button.weight),
      repsGap: record.entered.reps - button.reps,
    }))
    .sort(
      (a, b) =>
        Math.abs(a.weightGap) - Math.abs(b.weightGap) ||
        Math.abs(a.repsGap) - Math.abs(b.repsGap),
    )[0];
}

function bucketRatio(gap) {
  const percent = Math.round(gap * 100);
  const step = Math.abs(percent) <= 10 ? 2 : 10;
  const bucketed = Math.round(percent / step) * step;
  return `${bucketed >= 0 ? "+" : ""}${bucketed}% of top`;
}

function signed(value) {
  return value > 0 ? `+${value}` : String(value);
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function groupBy(rows, keyOf) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyOf(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return groups;
}

function sortBySize(groups) {
  return [...groups.entries()].sort(([, a], [, b]) => b.length - a.length);
}
