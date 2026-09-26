/**
 * The one place that turns a model choice into a provider model for the AI
 * lifting assistant.
 *
 * The chat route, the suggestions call, and the coach details shown in the UI
 * all ask here, so what the page says and what actually answers cannot drift.
 * Lifters pick a chat model from lib/ai/chat-model-catalog.js; anything not in
 * that catalog, locked for this lifter, or whose provider has no key
 * configured, gets the default. This is the enforcement point for model
 * access: the page's lock icons are only a hint.
 */

import { openai } from "@ai-sdk/openai";
import { xai } from "@ai-sdk/xai";
import {
  CHAT_MODELS,
  DEFAULT_CHAT_MODEL_ID,
  canUseChatModel,
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
 * @param {{ isSignedIn?: boolean }} [requester] Who is asking, from the session.
 * @returns {{ model: import("ai").LanguageModel, providerOptions?: object } | null}
 */
export function getChatModel(requestedId, { isSignedIn = false } = {}) {
  const available = getAvailableChatModelIds().filter((id) =>
    canUseChatModel(findChatModel(id), isSignedIn),
  );
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
 * The model that writes follow-up question suggestions, with its provider
 * options. Suggestions are three short questions in JSON, built from the
 * latest question and answer only. Timed on Sep 26 2026 against Grok 4.20,
 * GPT-4.1 mini and nano: all took 1.3-2s, but GPT-6 Luna and Grok kept the
 * questions tied to the answer (mini and nano drifted generic), and Luna is
 * the cheaper by far.
 *
 * @returns {{ model: import("ai").LanguageModel, providerOptions?: object } | null}
 */
export function getSuggestionModel() {
  if (process.env.OPENAI_API_KEY) {
    return {
      model: openai("gpt-6-luna"),
      providerOptions: { openai: { reasoningEffort: "none" } },
    };
  }
  if (process.env.XAI_API_KEY) return { model: xai("grok-4.20-non-reasoning") };
  return null;
}
