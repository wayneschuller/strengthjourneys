/**
 * Counts for the AI coach's opening suggestions (lib/ai/opening-suggestions.js),
 * kept in KV as one hash per UTC month. Counts only: no identity, no message
 * text, no age. Server only, since it holds the KV client.
 *
 * Fields, per audience:
 *   <audience>|views            blank-page views that showed chips
 *   <audience>|typed            chats started with the athlete's own words
 *   <audience>|shuffles         "More ideas" presses
 *   <audience>|shown|<key>      times a prompt was shown
 *   <audience>|picked|<key>     times a prompt started a chat
 *
 * Read them with `node scripts/ai-opening-suggestions.mjs`.
 */

import { kv } from "@/lib/kv";
import { getCuratedLift } from "@/lib/lifts/lift-registry";
import {
  OPENING_AUDIENCES,
  canonicalOpeningKey,
} from "@/lib/ai/opening-suggestions";

const KEY_PREFIX = "sj:ai:openers";
// The sampler learns from about the last three months, so it follows changing
// tastes and edits to the pools.
const SCORE_MONTHS = 3;
const MAX_SHOWN = 16;

const isKnownLift = (liftType) => Boolean(getCuratedLift(liftType));

export function openingStatsKey(monthKey) {
  return `${KEY_PREFIX}:${monthKey}`;
}

/** UTC months, newest first, as YYYY-MM. */
export function getRecentMonthKeys(count, now = new Date()) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index, 1),
    );
    return date.toISOString().slice(0, 7);
  });
}

/**
 * Counts one report from the page. Keys that are not our prompts are dropped.
 * @param {Object} report
 * @param {string} report.audience
 * @param {string[]} [report.shown] Present once per blank-page view.
 * @param {string} [report.picked] The prompt that started the chat.
 * @param {boolean} [report.typed] The chat started from the athlete's own words.
 * @param {boolean} [report.shuffled] The athlete asked for more ideas.
 * @returns {Promise<boolean>} false when there was nothing valid to count.
 */
export async function recordOpeningSuggestions({
  audience,
  shown,
  picked,
  typed,
  shuffled,
}) {
  if (!OPENING_AUDIENCES.includes(audience)) return false;
  const fields = [];

  if (Array.isArray(shown) && shown.length > 0) {
    const keys = new Set(
      shown
        .slice(0, MAX_SHOWN)
        .map((key) => canonicalOpeningKey(audience, key, isKnownLift)?.key)
        .filter(Boolean),
    );
    if (keys.size > 0) {
      fields.push(`${audience}|views`);
      keys.forEach((key) => fields.push(`${audience}|shown|${key}`));
    }
  }
  if (picked) {
    const key = canonicalOpeningKey(audience, picked, isKnownLift)?.key;
    if (key) fields.push(`${audience}|picked|${key}`);
  } else if (typed === true) {
    fields.push(`${audience}|typed`);
  } else if (shuffled === true) {
    fields.push(`${audience}|shuffles`);
  }
  if (fields.length === 0) return false;

  const hashKey = openingStatsKey(getRecentMonthKeys(1)[0]);
  const pipeline = kv.pipeline();
  fields.forEach((field) => pipeline.hincrby(hashKey, field, 1));
  await pipeline.exec();
  return true;
}

/**
 * The raw month hashes, newest first, for the stats script.
 * @param {string[]} monthKeys
 * @returns {Promise<{ month: string, counts: Record<string, number> }[]>}
 */
export async function readOpeningSuggestionMonths(monthKeys) {
  const pipeline = kv.pipeline();
  monthKeys.forEach((month) => pipeline.hgetall(openingStatsKey(month)));
  const results = await pipeline.exec();
  return monthKeys.map((month, index) => ({
    month,
    counts: toNumbers(results[index]),
  }));
}

/**
 * What the sampler needs: [picked, shown] per audience and template, summed
 * over every lift and the last few months. Prompts since removed are left out.
 * @returns {Promise<Record<string, Record<string, [number, number]>>>}
 */
export async function readOpeningSuggestionScores() {
  const months = await readOpeningSuggestionMonths(
    getRecentMonthKeys(SCORE_MONTHS),
  );
  const scores = Object.fromEntries(
    OPENING_AUDIENCES.map((audience) => [audience, {}]),
  );
  for (const { counts } of months) {
    for (const [field, count] of Object.entries(counts)) {
      const [audience, kind, key] = field.split("|");
      if (!scores[audience] || (kind !== "shown" && kind !== "picked")) {
        continue;
      }
      const template = canonicalOpeningKey(
        audience,
        key,
        isKnownLift,
      )?.template;
      if (!template) continue;
      const tally = (scores[audience][template] ??= [0, 0]);
      tally[kind === "picked" ? 0 : 1] += count;
    }
  }
  return scores;
}

function toNumbers(hash) {
  return Object.fromEntries(
    Object.entries(hash ?? {}).map(([field, value]) => [field, Number(value)]),
  );
}
