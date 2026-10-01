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

import { gateway } from "ai";
import { openai } from "@ai-sdk/openai";
import { xai } from "@ai-sdk/xai";
import {
  CHAT_MODELS,
  DEFAULT_CHAT_MODEL_ID,
  canUseChatModel,
  findChatModel,
} from "@/lib/ai/chat-model-catalog";

// Anthropic and DeepSeek have no key of their own: they are reached through
// the Vercel AI Gateway, which bills every provider to one credit balance.
const PROVIDER_KEYS = {
  xai: "XAI_API_KEY",
  openai: "OPENAI_API_KEY",
  anthropic: "AI_GATEWAY_API_KEY",
  deepseek: "AI_GATEWAY_API_KEY",
};

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
 * is slow, so they are told not to. Gateway models take the SDK's own
 * `reasoning` setting instead of provider options, and are all told not to
 * reason: left alone, Claude Sonnet 5.5 took 5.2s to its first word instead
 * of 2.0s, and DeepSeek V4.1 Flash, since dropped, 4.9s instead of 1.1s
 * (Oct 2 2026).
 *
 * `id` is the catalog ID, which for gateway models differs from the SDK's
 * modelId ("anthropic/claude-sonnet-5.5").
 *
 * @param {string} [requestedId] A catalog ID chosen by the lifter.
 * @param {{ isSignedIn?: boolean }} [requester] Who is asking, from the session.
 * @returns {{ id: string, model: import("ai").LanguageModel, providerOptions?: object, reasoning?: string } | null}
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

  const entry = findChatModel(id);
  if (entry.gatewayId) {
    return {
      id,
      model: gateway(entry.gatewayId),
      reasoning: "none",
    };
  }
  if (entry.provider === "xai") {
    return { id, model: xai.responses(id) };
  }
  return {
    id,
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
