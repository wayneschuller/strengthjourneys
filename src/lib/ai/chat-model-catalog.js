/**
 * The chat models a lifter can pick in the AI assistant, as plain data.
 *
 * Both sides read this list: the page renders the model switcher from it, and
 * lib/ai/models.js builds the provider model for a requested ID only if it is
 * listed here, so a client cannot ask for an unlisted (pricier) model. It has
 * no imports on purpose, so the page never bundles provider SDKs.
 *
 * Every entry is a fast, non-reasoning model: lifters get an answer in a few
 * seconds, and price and speed decide what is offered. Benchmarks on the
 * Sep 26 2026 prompt edition, median of five questions, full answer time and
 * cost per 1,000 answers: grok-4.20 4.7s $4.00, gpt-6-luna 3.6s $0.31,
 * gpt-5.6-luna 3.9s $0.81, gpt-6-sol 4.3s $6.06. grok-4.7 was left out: it
 * always reasons (15.7s, $12.67).
 *
 * GPT-6 Luna is the default: on a "Review my training this month" run with
 * real data it was fastest (4.4s median full answer, vs 7.5s Grok 4.20 and
 * 7.9s GPT-5.6 Luna), steadiest between runs, and cheapest. The switcher
 * marks the default as "Recommended", so changing it here moves the badge.
 * The menu lists providers in catalog order, so OpenAI comes first.
 *
 * Blurbs describe how a model answers, never how recent it is: "newest"
 * goes stale the day another model ships.
 *
 * An entry with a `gatewayId` is served through the Vercel AI Gateway on one
 * shared key, so its provider needs no key or billing account of its own.
 * Claude Sonnet 5.5 and DeepSeek V4.1 Flash arrived this way on Oct 2 2026
 * and are yet to be benchmarked; their blurbs are placeholders until then.
 *
 * `access` gates a model: "everyone", or "signed-in", which doubles as a
 * sign-in nudge in the switcher. The server enforces it (lib/ai/models.js);
 * the page only uses it to show the lock. A future supporter level would be
 * a third value here plus a server-side check of who is asking.
 */

export const DEFAULT_CHAT_MODEL_ID = "gpt-6-luna";

/**
 * @type {{ id: string, label: string, provider: "xai"|"openai"|"anthropic"|"deepseek", blurb: string, access: "everyone"|"signed-in", gatewayId?: string }[]}
 */
export const CHAT_MODELS = [
  {
    id: "gpt-6-luna",
    label: "GPT-6 Luna",
    provider: "openai",
    blurb: "The quickest full answers, short and precise",
    access: "everyone",
  },
  {
    id: "gpt-5.6-luna",
    label: "GPT-5.6 Luna",
    provider: "openai",
    blurb: "A balance of detail and length",
    access: "signed-in",
  },
  {
    id: "gpt-6-sol",
    label: "GPT-6 Sol",
    provider: "openai",
    blurb: "OpenAI's larger model, concise and careful",
    access: "signed-in",
  },
  {
    id: "grok-4.20-non-reasoning",
    label: "Grok 4.20",
    provider: "xai",
    blurb: "Quickest to start, with detailed answers",
    access: "everyone",
  },
  {
    id: "claude-sonnet-5.5",
    label: "Claude Sonnet 5.5",
    provider: "anthropic",
    gatewayId: "anthropic/claude-sonnet-5.5",
    blurb: "Anthropic's all-rounder, clear and considered",
    access: "signed-in",
  },
  {
    id: "deepseek-v4.1-flash",
    label: "DeepSeek V4.1 Flash",
    provider: "deepseek",
    gatewayId: "deepseek/deepseek-v4.1-flash",
    blurb: "A lightweight model for quick questions",
    access: "everyone",
  },
];

export const PROVIDER_NAMES = {
  xai: "xAI",
  openai: "OpenAI",
  anthropic: "Anthropic",
  deepseek: "DeepSeek",
};

/**
 * @param {{ access: string }} model A catalog entry.
 * @param {boolean} isSignedIn
 */
export function canUseChatModel(model, isSignedIn) {
  return model.access === "everyone" || isSignedIn;
}

/**
 * @param {string} id
 */
export function findChatModel(id) {
  return CHAT_MODELS.find((model) => model.id === id) || null;
}
