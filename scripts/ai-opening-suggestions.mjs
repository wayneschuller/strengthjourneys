/**
 * Prints how the AI coach's opening suggestions are doing: per audience, how
 * often each prompt was shown and how often it started a chat, best first.
 * Prompts with lift names are grouped under their template, with each lift
 * beneath. See src/lib/ai/opening-suggestions.js.
 *
 * Reads whatever KV the local .env names, which is production. Read only.
 *
 * Usage:
 *   node scripts/ai-opening-suggestions.mjs [months]   (default 3)
 */

import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const sourceRoot = path.join(repositoryRoot, "src");

// The KV client reads its credentials at import time, so load .env first.
process.loadEnvFile(path.join(repositoryRoot, ".env"));

// Resolve the app's `@/` imports, as the validate-* scripts do.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const target = path.join(sourceRoot, specifier.slice(2));
    return {
      shortCircuit: true,
      url: pathToFileURL(path.extname(target) ? target : `${target}.js`).href,
    };
  },
  load(url, context, nextLoad) {
    // The lift registry imports its JSON files with no import attribute, which
    // bare Node refuses before a hook could step in. Serve them as modules.
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

const { OPENING_AUDIENCES, canonicalOpeningKey } =
  await import("@/lib/ai/opening-suggestions");
const { getRecentMonthKeys, readOpeningSuggestionMonths } =
  await import("@/lib/ai/opening-suggestion-stats");

const AUDIENCE_NAMES = {
  first: "First visit (nothing shared)",
  bio: "Bio details only",
  partial: "Part of the log",
  full: "Whole log",
};

const monthCount = Number(process.argv[2]) || 3;
const monthKeys = getRecentMonthKeys(monthCount);
const months = await readOpeningSuggestionMonths(monthKeys);

const totals = {};
for (const { counts } of months) {
  for (const [field, count] of Object.entries(counts)) {
    totals[field] = (totals[field] ?? 0) + count;
  }
}

console.log(
  `Opening suggestions, ${monthKeys.at(-1)} to ${monthKeys[0]} (UTC months)\n`,
);

for (const audience of OPENING_AUDIENCES) {
  const views = totals[`${audience}|views`] ?? 0;
  const typed = totals[`${audience}|typed`] ?? 0;
  const templates = new Map();
  let picks = 0;

  for (const [field, count] of Object.entries(totals)) {
    const [fieldAudience, kind, key] = field.split("|");
    if (fieldAudience !== audience || (kind !== "shown" && kind !== "picked")) {
      continue;
    }
    if (kind === "picked") picks += count;
    const template =
      canonicalOpeningKey(audience, key, () => true)?.template ??
      `${key} (retired)`;
    const row = templates.get(template) ?? {
      shown: 0,
      picked: 0,
      variants: new Map(),
    };
    row[kind] += count;
    if (key !== template) {
      const variant = row.variants.get(key) ?? { shown: 0, picked: 0 };
      variant[kind] += count;
      row.variants.set(key, variant);
    }
    templates.set(template, row);
  }

  console.log(`== ${AUDIENCE_NAMES[audience]} ==`);
  console.log(
    `${views} views, ${picks} chats from a chip, ${typed} typed their own, ${Math.max(0, views - picks - typed)} left without chatting\n`,
  );
  if (templates.size === 0) {
    console.log("  No counts yet.\n");
    continue;
  }

  const rows = [...templates.entries()].sort(
    ([, a], [, b]) => rate(b) - rate(a) || b.shown - a.shown,
  );
  for (const [template, row] of rows) {
    console.log(`  ${formatRow(row)}  ${template}`);
    const variants = [...row.variants.entries()].sort(
      ([, a], [, b]) => b.shown - a.shown,
    );
    for (const [key, variant] of variants) {
      console.log(`      ${formatRow(variant)}  ${key}`);
    }
  }
  console.log("");
}

function rate({ shown, picked }) {
  return shown > 0 ? Math.min(picked, shown) / shown : 0;
}

// Picked of shown, the pick rate, and a rough 90% margin: wide means the
// sampler is still finding out.
function formatRow(row) {
  const p = rate(row);
  const margin =
    row.shown > 0 ? 1.645 * Math.sqrt((p * (1 - p)) / row.shown) : 0;
  return [
    `${row.picked}/${row.shown}`.padStart(9),
    `${(p * 100).toFixed(1)}%`.padStart(6),
    `±${(margin * 100).toFixed(0)}`.padStart(4),
  ].join(" ");
}
