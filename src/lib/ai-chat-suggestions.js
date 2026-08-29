/**
 * Follow-up question generation for the AI lifting assistant.
 *
 * This runs as its own request after the main answer has finished streaming,
 * so a slow suggestion call can never hold the chat stream open. It uses a
 * cheap non-reasoning model because the task is a few lines of JSON, not
 * coaching.
 */

import { openai } from "@ai-sdk/openai";
import { xai } from "@ai-sdk/xai";
import { generateText } from "ai";
import { devLog } from "@/lib/processing-utils";

export const MAX_SUGGESTION_INPUT_CHARS = 5000;
export const MAX_SUGGESTION_TEXT_CHARS = 90;
export const MAX_SUGGESTIONS = 3;

const SUGGESTION_MAX_OUTPUT_TOKENS = 300;

const SUGGESTION_INSTRUCTIONS = [
  "Create clickable suggested next questions for a strength coaching chat.",
  'Return only JSON in this shape: {"questions":["..."]}.',
  `Return exactly ${MAX_SUGGESTIONS} questions.`,
  `Each question must be under ${MAX_SUGGESTION_TEXT_CHARS} characters.`,
  "Each question must be from the user's point of view, addressed to the AI coach.",
  "Do not ask the user for information. Do not write questions the coach would ask the user.",
  'Good: "Estimate my e1RM from 112.5x3".',
  'Bad: "How did 112.5x3 feel?".',
  "Prefer concrete next-step questions tied to the latest answer.",
  "Do not include medical diagnosis prompts.",
].join(" ");

/**
 * Picks the cheapest capable model. Suggestions never need chain-of-thought,
 * so we deliberately avoid the reasoning model used for the main answer.
 */
function getSuggestionModel() {
  if (process.env.XAI_API_KEY) return xai("grok-4.20-non-reasoning");
  if (process.env.OPENAI_API_KEY) return openai("gpt-4.1-mini");
  return null;
}

export async function generateSuggestedQuestions({
  latestUserMessage,
  assistantText,
  userProvidedMetadata,
}) {
  if (!latestUserMessage?.trim() || !assistantText?.trim()) return [];

  const model = getSuggestionModel();
  if (!model) return [];

  try {
    const result = await generateText({
      model,
      instructions: SUGGESTION_INSTRUCTIONS,
      prompt: buildSuggestionPrompt({
        latestUserMessage,
        assistantText,
        userProvidedMetadata,
      }),
      maxOutputTokens: SUGGESTION_MAX_OUTPUT_TOKENS,
    });

    return parseSuggestedQuestions(result.text);
  } catch (error) {
    devLog("Failed to generate AI follow-up suggestions", error);
    return [];
  }
}

function buildSuggestionPrompt({
  latestUserMessage,
  assistantText,
  userProvidedMetadata,
}) {
  return truncateText(
    [
      "Latest user message:",
      latestUserMessage,
      "",
      "Latest assistant answer:",
      assistantText,
      "",
      "Optional lifting context summary:",
      extractMetadataSection(userProvidedMetadata || "", "data_context") ||
        "No lifting context summary shared.",
    ].join("\n"),
    MAX_SUGGESTION_INPUT_CHARS,
  );
}

export function parseSuggestedQuestions(text) {
  const trimmedText = text?.trim();
  if (!trimmedText) return [];

  try {
    const jsonText = trimmedText.match(/\{[\s\S]*\}/)?.[0] || trimmedText;
    const parsed = JSON.parse(jsonText);
    const questions = Array.isArray(parsed?.questions) ? parsed.questions : [];

    return [
      ...new Set(
        questions
          .filter((question) => typeof question === "string")
          .map((question) => question.trim())
          .filter((question) => question.length > 0)
          .map((question) =>
            question.length > MAX_SUGGESTION_TEXT_CHARS
              ? `${question.slice(0, MAX_SUGGESTION_TEXT_CHARS - 1).trim()}?`
              : question,
          ),
      ),
    ].slice(0, MAX_SUGGESTIONS);
  } catch {
    return [];
  }
}

function extractMetadataSection(metadata, sectionName) {
  const sectionStart = `[${sectionName}]`;
  const startIndex = metadata.indexOf(sectionStart);
  if (startIndex === -1) return "";

  const nextSectionIndex = metadata.indexOf(
    "\n[",
    startIndex + sectionStart.length,
  );
  return metadata
    .slice(startIndex, nextSectionIndex === -1 ? undefined : nextSectionIndex)
    .trim();
}

function truncateText(text, maxChars) {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars).trim()}\n[truncated]`;
}
