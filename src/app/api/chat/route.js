import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { devLog } from "@/lib/processing-utils";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const SYSTEM_PROMPT =
  "You are a strength coach answering questions only about barbell exercises with an emphasis on getting strong." +
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

    devLog(`Using EXTENDED_AI_PROMPT...`);

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

  // isAdvancedModel = true; // While in early release, let everyone have the best model
  const AI_model = isAdvancedModel ? openai("gpt-4.1") : openai("o4-mini");
  // const AI_model = isAdvancedModel ? openai("gpt-5") : openai("gpt-5-mini");

  const result = await streamText({
    // model: openai("gpt-4o-mini"),
    // model: openai("gpt-4o"),
    // model: openai("gpt-5"),
    model: AI_model,
    messages: [...systemMessages, ...messages],
    // max_completion_tokens: 5000, // GPT 5
  });

  return result.toDataStreamResponse();
}
