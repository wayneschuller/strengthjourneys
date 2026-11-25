/**
 * Storage for the anonymous /log suggestion telemetry described in
 * lib/log-suggestion-telemetry.js. One KV list per UTC month, newest first,
 * capped in length and left to expire, so the pool stays small and
 * self-cleaning. Server only, since it holds the KV client.
 *
 * Read it with `node scripts/log-suggestion-stats.mjs`.
 */

import { kv } from "@/lib/kv";
import { getCuratedLift } from "@/lib/lifts/lift-registry";
import { sanitizeLogSuggestionRecord } from "@/lib/log-suggestion-telemetry";

const KEY_PREFIX = "sj:log:suggestions";
// A few thousand sets are logged a month today; this leaves room to grow
// while bounding what a flood of fake records could take.
const MAX_RECORDS_PER_MONTH = 20000;
// Thirteen months, so a full year can be compared with the month before it.
const RECORD_TTL_SECONDS = 400 * 24 * 60 * 60;

const isKnownLift = (liftType) => Boolean(getCuratedLift(liftType));

/** Production writes the real pool; dev and preview get their own. */
export function logSuggestionKey(monthKey, env = process.env.VERCEL_ENV) {
  const suffix = env === "production" ? "" : ":dev";
  return `${KEY_PREFIX}:${monthKey}${suffix}`;
}

function currentMonthKey(now = new Date()) {
  return now.toISOString().slice(0, 7);
}

/**
 * Sanitises and stores one record.
 * @returns {Promise<boolean>} false when the record was not valid.
 */
export async function recordLogSuggestion(raw) {
  const record = sanitizeLogSuggestionRecord(raw, { isKnownLift });
  if (!record) return false;

  const key = logSuggestionKey(currentMonthKey());
  await kv
    .pipeline()
    .lpush(key, JSON.stringify(record))
    .ltrim(key, 0, MAX_RECORDS_PER_MONTH - 1)
    .expire(key, RECORD_TTL_SECONDS)
    .exec();
  return true;
}

/**
 * Every stored record for the given months, for the stats script.
 * @param {string[]} monthKeys YYYY-MM
 * @param {{ env?: string }} [options] Pass env "development" for the dev pool.
 */
export async function readLogSuggestionMonths(monthKeys, { env } = {}) {
  const pipeline = kv.pipeline();
  monthKeys.forEach((month) =>
    pipeline.lrange(logSuggestionKey(month, env ?? "production"), 0, -1),
  );
  const results = await pipeline.exec();
  return monthKeys.map((month, index) => ({
    month,
    records: (results[index] ?? [])
      .map((entry) => {
        if (entry && typeof entry === "object") return entry;
        try {
          return JSON.parse(entry);
        } catch {
          return null;
        }
      })
      .filter(Boolean),
  }));
}
