/**
 * Versioned system prompts ("editions") for the AI lifting assistant, kept in KV.
 *
 * The repo is open source but the coach prompt is not, so its text lives only
 * in KV and in Wayne's private backup folder, never in git. An edition is the
 * prompt text alone; the model is chosen per request (it may one day depend on
 * the user's tier), so feedback is counted per edition and model pair.
 *
 * Edition IDs are the local date the edition was created, with a letter for a
 * second or later edition that day: 2026-09-26, 2026-09-26b, 2026-09-26c. They
 * sort as plain strings and read naturally in the UI and in diffs.
 *
 * Editions are append-only. Once written, an edition key is never changed or
 * deleted; the only mutable key is the active pointer. That keeps the history
 * trustworthy and makes rollback a single pointer change.
 *
 * Maintenance (create, activate, backup) runs from scripts/ai-prompt-editions.mjs
 * and is documented in docs/agents/ai-prompts.md.
 */

// Only the KV client: the maintenance script imports this file under plain
// Node, where heavier app modules (the lift registry) do not load.
import { kv } from "@/lib/kv";

const KEY_PREFIX = "sj:ai:prompt";
const ACTIVE_KEY = `${KEY_PREFIX}:active`;

const EDITION_ID_PATTERN = /^\d{4}-\d{2}-\d{2}[b-z]?$/;

// Instances on Fluid compute serve many requests, so one KV read per minute
// per warm instance covers all of them. Activating an edition therefore reaches
// every instance within a minute, with no redeploy.
const ACTIVE_CACHE_TTL_MS = 60_000;
let activeCache = { edition: null, fetchedAt: 0 };

function editionKey(id) {
  return `${KEY_PREFIX}:edition:${id}`;
}

function votesKey(id) {
  return `${KEY_PREFIX}:votes:${id}`;
}

/**
 * The edition the chat should use right now, or null when none is active.
 * A KV failure serves the last cached edition rather than failing the chat.
 *
 * @returns {Promise<{ id: string, text: string } | null>}
 */
export async function getActivePromptEdition() {
  if (Date.now() - activeCache.fetchedAt < ACTIVE_CACHE_TTL_MS) {
    return activeCache.edition;
  }

  try {
    const id = await kv.get(ACTIVE_KEY);
    const edition = id ? await readPromptEdition(id) : null;
    activeCache = {
      edition: edition ? { id, text: edition.text } : null,
      fetchedAt: Date.now(),
    };
  } catch (error) {
    console.error("Prompt edition lookup failed:", error?.message);
    // Retry on the next request instead of caching the failure for a minute.
    return activeCache.edition;
  }

  return activeCache.edition;
}

/**
 * @param {string} id
 * @returns {Promise<{ text: string, note: string, createdAt: string } | null>}
 */
export async function readPromptEdition(id) {
  if (!EDITION_ID_PATTERN.test(id)) return null;
  // Upstash parses stored JSON back into an object.
  return (await kv.get(editionKey(id))) || null;
}

/**
 * Stores new prompt text as the next edition for the given date. It does not
 * activate it, so an edition can be reviewed or compared before going live.
 *
 * @param {{ text: string, note: string, date: string }} params date is YYYY-MM-DD
 * @returns {Promise<string>} the new edition ID
 */
export async function createPromptEdition({ text, note, date }) {
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Edition text is empty");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Expected a YYYY-MM-DD date, got ${date}`);
  }

  const value = { text, note: note || "", createdAt: new Date().toISOString() };

  // SET NX claims the first free suffix, so an existing edition can never be
  // overwritten, even by two creations racing on the same day.
  for (const suffix of ["", ..."bcdefghijklmnopqrstuvwxyz"]) {
    const id = `${date}${suffix}`;
    if (await kv.set(editionKey(id), value, { nx: true })) return id;
  }
  throw new Error(`No edition IDs left for ${date}`);
}

/**
 * Points the chat at an existing edition. Rollback is activating an older one.
 *
 * @param {string} id
 */
export async function activatePromptEdition(id) {
  if (!(await readPromptEdition(id))) {
    throw new Error(`Edition ${id} does not exist`);
  }
  await kv.set(ACTIVE_KEY, id);
}

/**
 * Every edition ID oldest first, the active ID, and each edition's vote counts.
 * Used by the backup, which is the only full read of the history.
 *
 * @returns {Promise<{ ids: string[], activeId: string | null, votes: Record<string, Record<string, number>> }>}
 */
export async function listPromptEditions() {
  // A SCAN is fine here: the backup is the only caller, it runs daily, and
  // the whole KV holds a few hundred keys. It saves keeping an index in sync.
  const prefix = editionKey("");
  const ids = [];
  let cursor = "0";
  do {
    const [next, keys] = await kv.scan(cursor, { match: `${prefix}*`, count: 500 });
    ids.push(...keys.map((key) => key.slice(prefix.length)));
    cursor = String(next);
  } while (cursor !== "0");
  ids.sort();
  const activeId = await kv.get(ACTIVE_KEY);
  const votes = {};
  for (const id of ids) {
    votes[id] = (await kv.hgetall(votesKey(id))) || {};
  }
  return { ids, activeId: activeId || null, votes };
}

/**
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function promptEditionExists(id) {
  if (!EDITION_ID_PATTERN.test(id)) return false;
  return (await kv.exists(editionKey(id))) === 1;
}

/**
 * Counts one thumbs vote against an edition and model. Only counts are stored:
 * no identity and no message text, so this adds nothing personal to KV.
 * A changed vote moves the count instead of adding a second one.
 *
 * @param {{ id: string, model: string, sentiment: "up"|"down", previous?: "up"|"down"|null }} params
 */
export async function recordPromptVote({ id, model, sentiment, previous }) {
  const key = votesKey(id);
  if (previous && previous !== sentiment) {
    await kv.hincrby(key, `${model}:${previous}`, -1);
  }
  await kv.hincrby(key, `${model}:${sentiment}`, 1);
}
