import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const SYSTEM_PROMPT =
  "You are a strength coach answering questions about the exercise with an emphasis on getting strong.";

export async function POST(req) {
  const { messages } = await req.json();

  // Initialize the system messages array
  let systemMessages = [{ role: "system", content: SYSTEM_PROMPT }];

  // Check for the EXTENDED_AI_PROMPT environment variable
  if (process.env.EXTENDED_AI_PROMPT) {
    systemMessages.push({
      role: "system",
      content: process.env.EXTENDED_AI_PROMPT,
    });
  }

  const result = await streamText({
    model: openai("gpt-4-turbo"),
    messages: [...systemMessages, ...messages],
  });

  return result.toDataStreamResponse();
}
