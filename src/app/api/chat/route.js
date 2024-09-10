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
  let isPaidUser = false;

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
    const isPaidUser = paidUsers.includes(session?.user?.email);
  }

  const AI_model = isPaidUser ? openai("gpt-4o") : openai("gpt-4o-mini");

  const { messages, userProvidedMetadata } = await req.json();

  // Initialize the system messages array
  let systemMessages = [{ role: "system", content: SYSTEM_PROMPT }];

  // Check for the EXTENDED_AI_PROMPT environment variable
  if (process.env.EXTENDED_AI_PROMPT) {
    systemMessages = [
      {
        role: "system",
        content: process.env.EXTENDED_AI_PROMPT,
      },
    ];

    const charCount = process.env.EXTENDED_AI_PROMPT.length;
    const wordCount = process.env.EXTENDED_AI_PROMPT.trim().split(/\s+/).length;
    devLog(
      `Extended prompt detected: Characters: ${charCount}, Words: ${wordCount}`,
    );
  }

  if (userProvidedMetadata?.length > 10) {
    systemMessages.push({ role: "system", content: userProvidedMetadata });
  }

  if (session?.user?.name) {
    let firstName = null;
    firstName = session.user.name.split(" ")[0] || session.user.name;
    systemMessages.push({
      role: "system",
      content: `The user's name is: ${firstName}. `,
    });
  }

  const result = await streamText({
    // model: openai("gpt-4o-mini"), // Anyone
    // model: openai("gpt-4o"), // Paid users only
    model: AI_model,
    messages: [...systemMessages, ...messages],
  });

  return result.toDataStreamResponse();
}
