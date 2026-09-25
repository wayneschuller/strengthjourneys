/**
 * The one place that turns a model choice into a provider model for the AI
 * lifting assistant.
 *
 * The chat route, the suggestions call, and the coach details shown in the UI
 * all ask here, so what the page says and what actually answers cannot drift.
 * Lifters pick a chat model from lib/ai/chat-model-catalog.js; anything not in
 * that catalog, or whose provider has no key configured, gets the default.
 */

import { openai } from "@ai-sdk/openai";
import { xai } from "@ai-sdk/xai";
import {
  CHAT_MODELS,
  DEFAULT_CHAT_MODEL_ID,
  findChatModel,
} from "@/lib/ai/chat-model-catalog";

const PROVIDER_KEYS = { xai: "XAI_API_KEY", openai: "OPENAI_API_KEY" };

/**
 * IDs of the catalog models whose provider key is configured here.
 *
 * @returns {string[]}
 */
export function getAvailableChatModelIds() {
  return CHAT_MODELS.filter((entry) => process.env[PROVIDER_KEYS[entry.provider]])
    .map((entry) => entry.id);
}

/**
 * The model that writes coaching answers, plus the provider options it needs,
 * or null when no provider key is configured at all.
 *
 * grok-4.20-non-reasoning rejects reasoningEffort outright (any value is a
 * 400), so xAI gets no options. The OpenAI models reason by default, which
 * is slow, so they are told not to.
 *
 * @param {string} [requestedId] A catalog ID chosen by the lifter.
 * @returns {{ model: import("ai").LanguageModel, providerOptions?: object } | null}
 */
export function getChatModel(requestedId) {
  const available = getAvailableChatModelIds();
  const id = available.includes(requestedId)
    ? requestedId
    : available.includes(DEFAULT_CHAT_MODEL_ID)
      ? DEFAULT_CHAT_MODEL_ID
      : available[0];
  if (!id) return null;

  if (findChatModel(id).provider === "xai") {
    return { model: xai.responses(id) };
  }
  return {
    model: openai(id),
    providerOptions: { openai: { reasoningEffort: "none" } },
  };
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
