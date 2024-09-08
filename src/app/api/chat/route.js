import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { devLog } from "@/lib/processing-utils";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const SYSTEM_PROMPT =
  "You are a strength coach answering questions about the exercise with an emphasis on getting strong." +
  "Emphasise safety and take precautions if user indicates any health concerns.";

export async function POST(req) {
  if (!process.env.OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({ error: "OpenAI API key is not set" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const { messages } = await req.json();

  // Initialize the system messages array
  let systemMessages = [{ role: "system", content: SYSTEM_PROMPT }];

  // Check for the EXTENDED_AI_PROMPT environment variable
  if (process.env.EXTENDED_AI_PROMPT) {
    systemMessages.unshift({
      role: "system",
      content: process.env.EXTENDED_AI_PROMPT,
    });

    const charCount = process.env.EXTENDED_AI_PROMPT.length;
    const wordCount = process.env.EXTENDED_AI_PROMPT.trim().split(/\s+/).length;
    devLog(
      `Extended prompt detected: Characters: ${charCount}, Words: ${wordCount}`,
    );
  }

  const result = await streamText({
    model: openai("gpt-4o-mini"),
    // model: openai("gpt-4o"),
    messages: [...systemMessages, ...messages],
  });

  return result.toDataStreamResponse();
}
