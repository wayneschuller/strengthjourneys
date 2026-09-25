/**
 * Maintenance for the AI coach's prompt editions (src/lib/ai/prompt-editions.js).
 *
 * Writes go through this script, not ad hoc KV calls, because it keeps the
 * rules: editions are append-only, IDs come from the date, and every change is
 * mirrored to Wayne's private backup folder straight away. Reading history,
 * diffs and vote counts needs no command: run `backup` and read the folder.
 *
 * Talks to whatever KV the local .env names, which is production.
 * See docs/agents/ai-prompts.md for the workflow.
 *
 * Usage:
 *   node scripts/ai-prompt-editions.mjs create <prompt-file> "<note>" [--activate]
 *   node scripts/ai-prompt-editions.mjs activate <edition-id>
 *   node scripts/ai-prompt-editions.mjs backup
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { registerHooks } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const sourceRoot = path.join(repositoryRoot, "src");

// Outside the repo on purpose: the prompt text must never reach the public git
// history. The folder is plain files so diff, grep and editors all just work.
const BACKUP_DIR = path.join(
  os.homedir(),
  "hacking/strengthjourneys-private/prompts/editions",
);

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
    const loaded = nextLoad(url, context);
    if (url.startsWith(pathToFileURL(sourceRoot).href) && url.endsWith(".js")) {
      return { ...loaded, format: "module" };
    }
    return loaded;
  },
});

// The KV client reads its credentials at import time, so load .env first.
process.loadEnvFile(path.join(repositoryRoot, ".env"));
const {
  activatePromptEdition,
  createPromptEdition,
  listPromptEditions,
  readPromptEdition,
} = await import("../src/lib/ai/prompt-editions.js");

const [command, ...args] = process.argv.slice(2);

if (command === "create") {
  const [file, note] = args;
  if (!file || !note) usage();
  const text = readFileSync(file, "utf8");
  // Wayne's local date, since the ID should match the day he wrote it.
  const date = new Date().toLocaleDateString("en-CA");
  const id = await createPromptEdition({ text, note, date });
  console.log(`Created edition ${id}`);
  if (args.includes("--activate")) {
    await activatePromptEdition(id);
    console.log(`Activated ${id}; live within a minute`);
  }
  await backup();
} else if (command === "activate") {
  const [id] = args;
  if (!id) usage();
  await activatePromptEdition(id);
  console.log(`Activated ${id}; live within a minute`);
  await backup();
} else if (command === "backup") {
  await backup();
} else {
  usage();
}

/**
 * Mirrors every edition to <id>.txt and writes editions.json with notes, the
 * active pointer and vote counts. Edition files are only ever added, never
 * rewritten, because editions never change.
 */
async function backup() {
  mkdirSync(BACKUP_DIR, { recursive: true });
  const { ids, activeId, votes } = await listPromptEditions();
  const summary = [];
  let added = 0;

  for (const id of ids) {
    const edition = await readPromptEdition(id);
    const file = path.join(BACKUP_DIR, `${id}.txt`);
    if (!existsSync(file)) {
      writeFileSync(file, edition.text);
      added += 1;
    }
    summary.push({
      id,
      note: edition.note,
      createdAt: edition.createdAt,
      votes: votes[id],
    });
  }

  writeFileSync(
    path.join(BACKUP_DIR, "editions.json"),
    `${JSON.stringify({ backedUpAt: new Date().toISOString(), activeId, editions: summary }, null, 2)}\n`,
  );
  console.log(
    `Backed up ${ids.length} editions (${added} new) to ${BACKUP_DIR}; active: ${activeId ?? "none"}`,
  );
}

function usage() {
  console.error(
    [
      "Usage:",
      '  node scripts/ai-prompt-editions.mjs create <prompt-file> "<note>" [--activate]',
      "  node scripts/ai-prompt-editions.mjs activate <edition-id>",
      "  node scripts/ai-prompt-editions.mjs backup",
    ].join("\n"),
  );
  process.exit(1);
}
