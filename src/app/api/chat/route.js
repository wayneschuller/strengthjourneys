import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { devLog } from "@/lib/processing-utils";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const SYSTEM_PROMPT =
  "You are a strength coach answering questions about the exercise with an emphasis on getting strong." +
  "Emphasise safety and take precautions if user indicates any health concerns.";

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
    devLog(`Extended prompt added...`);
  }

  const result = await streamText({
    model: openai("gpt-4o-mini"),
    // model: openai("gpt-4o"),
    messages: [...systemMessages, ...messages],
  });

  return result.toDataStreamResponse();
}
