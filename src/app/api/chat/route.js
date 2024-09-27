import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { devLog } from "@/lib/processing-utils";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const SYSTEM_PROMPT =
  "You are a strength coach answering questions about the exercise with an emphasis on getting strong." +
  "Emphasise safety and take precautions if user indicates any health concerns.";

export async function POST(req) {
  const session = await getServerSession(authOptions);
  let isAdvancedModel = false;

  if (!process.env.OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({ error: "OpenAI API key is not set" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const paidUsers = process.env.SJ_PAID_USERS;
  if (paidUsers) {
    isAdvancedModel = paidUsers.includes(session?.user?.email);
  }

  const { messages, userProvidedMetadata } = await req.json();

  // Initialize the system messages array
  let systemMessages = [{ role: "system", content: SYSTEM_PROMPT }];

  // Check for the EXTENDED_AI_PROMPT environment variable
  const envAIPrompt = process.env.EXTENDED_AI_PROMPT;
  if (envAIPrompt) {
    let decodedPrompt = envAIPrompt;

    // FIXME: We had some half working code to optionally read base64 encoded extended prompt.
    // if (isBase64(envAIPrompt)) { decodedPrompt = Buffer.from(envAIPrompt, "base64").toString("utf-8"); } else { decodedPrompt = envAIPrompt; }

    systemMessages = [
      {
        role: "system",
        content: decodedPrompt,
      },
    ];

    const charCount = decodedPrompt.length;
    const wordCount = decodedPrompt.trim().split(/\s+/).length;
    devLog(
      `Extended prompt detected: Characters: ${charCount}, Words: ${wordCount}`,
    );
  }

  if (userProvidedMetadata?.length > 10) {
    systemMessages.push({ role: "system", content: userProvidedMetadata });
  }

  // FIXME: we could put this client side (and make optional?)
  if (session?.user?.name) {
    let firstName = null;
    firstName = session.user.name.split(" ")[0] || session.user.name;
    systemMessages.push({
      role: "system",
      content: `The user's name is: ${firstName}. `,
    });
  }

  isAdvancedModel = true; // While in early release, let everyone have the best model
  const AI_model = isAdvancedModel
    ? openai("gpt-4o-2024-08-06") // in a few weeks this will be the default
    : openai("gpt-4o-mini");

  const result = await streamText({
    // model: openai("gpt-4o-mini"), // Anyone
    // model: openai("gpt-4o"), // Paid users only
    model: AI_model,
    messages: [...systemMessages, ...messages],
  });

  return result.toDataStreamResponse();
}

function isBase64(str) {
  try {
    const buffer = Buffer.from(str, "base64");
    return buffer.toString("base64") === str;
  } catch {
    return false;
  }
}
