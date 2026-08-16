/**
 * Single source of truth for the per-user KV record key.
 *
 * CONVENTION: `sj:user:<email, trimmed and lowercased>`. The address is
 * normalized once, here, so the invariant "one human, one record" is true by
 * construction rather than by assumption.
 *
 * Sign-in is Google OAuth only and Google's `email` claim is already
 * normalized, so this is a no-op for every address the app sees today (a census
 * of the live keyspace found zero with uppercase or stray whitespace). It is
 * written this way because the alternative — keying on the raw claim — would
 * silently create a *second* record for the same person if that ever stopped
 * holding. Normalizing costs nothing and removes the need for the read-time
 * fallback this module used to carry.
 *
 * Anything touching `sj:user:*` should import from here rather than
 * interpolating the key inline; call sites that spell the key themselves are
 * how the two halves of the codebase drifted apart in the first place.
 */

import { kv } from "@/lib/kv";

export function getUserKvKey(email) {
  if (!email) return null;
  return `sj:user:${String(email).trim().toLowerCase()}`;
}

/**
 * Reads the per-user record and returns the key writes must target. `record` is
 * `{}` when nothing exists, which callers may treat as "this person is new".
 */
export async function readUserRecord(email) {
  const writeKey = getUserKvKey(email);
  if (!writeKey) return { record: {}, writeKey: null };

  return { record: (await kv.get(writeKey)) || {}, writeKey };
}

/**
 * Writes `updates` on top of the freshest value in KV.
 *
 * Callers typically hold a record snapshot read some time earlier, and a plain
 * `kv.set(key, {...snapshot, ...updates})` silently drops any field a
 * concurrent request wrote in between — delayed-email IDs and outcome
 * timestamps are exactly that kind of field. Re-reading immediately before the
 * write narrows the window to a single round trip, and only the keys in
 * `updates` are authored by this caller.
 *
 * Pass a function to derive updates from the fresh record, e.g. when a field
 * should be preserved if already set: `(latest) => ({ at: latest.at || now })`.
 */
export async function mergeUserRecord(writeKey, updates) {
  const latest = (await kv.get(writeKey)) || {};
  const resolved = typeof updates === "function" ? updates(latest) : updates;
  const nextRecord = { ...latest, ...resolved };
  await kv.set(writeKey, nextRecord);
  return nextRecord;
}
