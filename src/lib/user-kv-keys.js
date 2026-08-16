/**
 * Single source of truth for the per-user KV record key.
 *
 * CONVENTION: the canonical key is `sj:user:<email exactly as the OAuth
 * provider supplied it>`. Every write goes to that exact key. Reads must also
 * check a trimmed/lowercased variant of the same address, because some older
 * records were written under that casing before the convention settled.
 *
 * WHY THIS MATTERS: a module that picks its own casing reads a *different*
 * record than the one the rest of the app writes, and an absent record is
 * indistinguishable from a brand new user. Bugs of that shape are silent —
 * eligibility checks simply never fire and no error is ever logged. Anything
 * touching `sj:user:*` should import from here rather than interpolating the
 * key inline.
 */

import { kv } from "@/lib/kv";

export function getUserKvKeys(email) {
  if (!email) return { exactKey: null, normalizedKey: null };

  const exactEmail = String(email);
  const normalizedEmail = exactEmail.trim().toLowerCase();
  return {
    exactKey: `sj:user:${exactEmail}`,
    normalizedKey: `sj:user:${normalizedEmail}`,
  };
}

/**
 * Reads the merged per-user record and returns the key that writes must target.
 *
 * Fields from the exact key win over the legacy normalized key so the newer
 * record stays authoritative. `record` is `{}` when nothing exists under either
 * key, which callers may treat as "this person is genuinely new".
 *
 * `legacyRecord` is the normalized-key half on its own. Nothing writes to that
 * key any more, so it is frozen history; callers migrating it forward must
 * layer it *underneath* the exact-key record rather than over the top.
 */
export async function readUserRecord(email) {
  const { exactKey, normalizedKey } = getUserKvKeys(email);
  if (!exactKey) return { record: {}, legacyRecord: {}, writeKey: null };

  const exactRecord = (await kv.get(exactKey)) || {};
  const normalizedRecord =
    normalizedKey !== exactKey ? (await kv.get(normalizedKey)) || {} : {};

  return {
    record: { ...normalizedRecord, ...exactRecord },
    legacyRecord: normalizedRecord,
    writeKey: exactKey,
  };
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
