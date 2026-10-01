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
 * Under the blurb the switcher shows two plain facts. `openWeights` says
 * whether anyone can download and run the model (DeepSeek V4 Flash is MIT
 * licensed on Hugging Face; the rest are closed). `cost` is what an answer
 * costs the site to produce, in broad bands from the benchmarks above: under
 * $1 per 1,000 answers is low, $1 to $10 is mid, above that is the highest.
 *
 * An entry with a `gatewayId` is served through the Vercel AI Gateway on one
 * shared key, so its provider needs no key or billing account of its own.
 * Claude Sonnet 5.5 and DeepSeek V4 Flash arrived this way on Oct 2 2026.
 * Benchmarked that day on five general questions with no lifting data,
 * median first word, full answer and cost per 1,000 answers: gpt-6-luna
 * 1.6s 3.0s $0.36, gpt-6-sol 1.2s 4.9s $7.41, claude-sonnet-5.5 2.0s 7.3s
 * $15.60. Claude costs twice GPT-6 Sol at the same list price because it
 * counts more input tokens for the same prompt and writes answers about
 * three times as long.
 * deepseek-v4-flash-0731 is the cheapest model here at $0.27, but the
 * slowest and least steady: 1.4-2.1s to the first word and 5.9-11.8s for a
 * full answer across two rounds, from a single gateway provider.
 * deepseek-v4.1-flash was quicker (1.1s, 2.9-7.2s) at $1.01-1.39 and was
 * offered briefly, then dropped: two DeepSeek entries confused the menu.
 * The plain deepseek-v4-flash was never offered: $0.50 and no quicker.
 *
 * `access` gates a model: "everyone", or "signed-in", which doubles as a
 * sign-in nudge in the switcher. The server enforces it (lib/ai/models.js);
 * the page only uses it to show the lock. A future supporter level would be
 * a third value here plus a server-side check of who is asking.
 */

export const DEFAULT_CHAT_MODEL_ID = "gpt-6-luna";

/**
 * @type {{ id: string, label: string, provider: "xai"|"openai"|"anthropic"|"deepseek", blurb: string, openWeights: boolean, cost: string, access: "everyone"|"signed-in", gatewayId?: string }[]}
 */
export const CHAT_MODELS = [
  {
    id: "gpt-6-luna",
    label: "GPT-6 Luna",
    provider: "openai",
    blurb: "The quickest full answers, short and precise",
    openWeights: false,
    cost: "Low cost",
    access: "everyone",
  },
  {
    id: "gpt-5.6-luna",
    label: "GPT-5.6 Luna",
    provider: "openai",
    blurb: "A balance of detail and length",
    openWeights: false,
    cost: "Low cost",
    access: "signed-in",
  },
  {
    id: "gpt-6-sol",
    label: "GPT-6 Sol",
    provider: "openai",
    blurb: "OpenAI's larger model, concise and careful",
    openWeights: false,
    cost: "Mid cost",
    access: "signed-in",
  },
  {
    id: "grok-4.20-non-reasoning",
    label: "Grok 4.20",
    provider: "xai",
    blurb: "Quickest to start, with detailed answers",
    openWeights: false,
    cost: "Mid cost",
    access: "everyone",
  },
  {
    id: "claude-sonnet-5.5",
    label: "Claude Sonnet 5.5",
    provider: "anthropic",
    gatewayId: "anthropic/claude-sonnet-5.5",
    blurb: "The most thorough answers, laid out step by step",
    openWeights: false,
    cost: "Highest cost",
    access: "signed-in",
  },
  {
    id: "deepseek-v4-flash-0731",
    label: "DeepSeek V4 Flash",
    provider: "deepseek",
    gatewayId: "deepseek/deepseek-v4-flash-0731",
    blurb: "Detailed, conversational answers at a steady pace",
    openWeights: true,
    cost: "Lowest cost",
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
