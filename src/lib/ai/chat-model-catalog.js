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
 */

export const DEFAULT_CHAT_MODEL_ID = "grok-4.20-non-reasoning";

/**
 * @type {{ id: string, label: string, provider: "xai"|"openai", blurb: string }[]}
 */
export const CHAT_MODELS = [
  {
    id: "grok-4.20-non-reasoning",
    label: "Grok 4.20",
    provider: "xai",
    blurb: "Quickest to start, with detailed answers",
  },
  {
    id: "gpt-6-luna",
    label: "GPT-6 Luna",
    provider: "openai",
    blurb: "OpenAI's newest, with short and precise answers",
  },
  {
    id: "gpt-5.6-luna",
    label: "GPT-5.6 Luna",
    provider: "openai",
    blurb: "A balance of detail and length",
  },
  {
    id: "gpt-6-sol",
    label: "GPT-6 Sol",
    provider: "openai",
    blurb: "OpenAI's larger model, concise and careful",
  },
];

export const PROVIDER_NAMES = { xai: "xAI", openai: "OpenAI" };

/**
 * @param {string} id
 */
export function findChatModel(id) {
  return CHAT_MODELS.find((model) => model.id === id) || null;
}
