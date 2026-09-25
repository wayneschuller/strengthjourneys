/**
 * The one place that picks which models the AI lifting assistant uses.
 *
 * The chat route, the suggestions call, and the coach details shown in the UI
 * all ask here, so what the page says and what actually answers cannot drift.
 * The choice is per request rather than baked into a prompt edition, because
 * it may later depend on the user (a paid tier with frontier models).
 */

import { openai } from "@ai-sdk/openai";
import { xai } from "@ai-sdk/xai";

/**
 * The model that writes coaching answers, or null when no key is configured.
 *
 * grok-4.20-non-reasoning generates at roughly 2.3x the throughput of grok-4.5
 * and starts ~1.8s sooner, which on a measured turn is the difference between a
 * 17s answer and a 6s one. It rejects reasoningEffort outright, so no xAI
 * provider options are sent.
 */
export function getChatModel() {
  if (process.env.XAI_API_KEY) return xai.responses("grok-4.20-non-reasoning");
  if (process.env.OPENAI_API_KEY) return openai("gpt-4.1");
  return null;
}

/**
 * The model that writes follow-up question suggestions. Suggestions are a few
 * lines of JSON and never need chain-of-thought, so this is the cheapest
 * capable non-reasoning model.
 */
export function getSuggestionModel() {
  if (process.env.XAI_API_KEY) return xai("grok-4.20-non-reasoning");
  if (process.env.OPENAI_API_KEY) return openai("gpt-4.1-mini");
  return null;
}
