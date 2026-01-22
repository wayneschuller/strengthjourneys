import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages } from "ai";
import { devLog } from "@/lib/processing-utils";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

const SYSTEM_PROMPT =
  "You are a strength coach answering questions only about barbell exercises with an emphasis on getting strong." +
  "Emphasise safety and take precautions if user indicates any health concerns.";

export default async function handler(req, res) {
  // Only handle POST requests
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // Parallelize independent operations: session fetch and request body parsing
  const [session, body] = await Promise.all([
    getServerSession(req, res, authOptions),
    Promise.resolve(req.body), // Pages router already parses JSON body
  ]);

  let isAdvancedModel = false;

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "OpenAI API key is not set" });
  }

  const paidUsers = process.env.SJ_PAID_USERS;
  if (paidUsers) {
    isAdvancedModel = paidUsers.includes(session?.user?.email);
  }

  const { messages, userProvidedMetadata } = body;

  // Initialize the system messages array (already in ModelMessage format)
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
  // const AI_model = isAdvancedModel ? openai("gpt-4.1") : openai("o4-mini");
  // const AI_model = isAdvancedModel ? openai("gpt-5") : openai("gpt-5-mini");
  // const AI_model = openai("gpt-5-mini");
  const AI_model = openai("gpt-4.1");

  // Convert UI messages (from client) to model messages, then combine with system messages
  // Ensure messages is an array and convert it
  const userMessages = Array.isArray(messages) ? messages : [];
  const convertedUserMessages = convertToModelMessages(userMessages);
  // Ensure convertedUserMessages is an array (safety check)
  const modelMessages = [
    ...systemMessages,
    ...(Array.isArray(convertedUserMessages) ? convertedUserMessages : []),
  ];

  const result = await streamText({
    // model: openai("gpt-4o-mini"),
    // model: openai("gpt-4o"),
    // model: openai("gpt-5"),
    // max_completion_tokens: 5000, // GPT 5
    model: AI_model,
    messages: modelMessages,
  });

  // Convert the Response from toUIMessageStreamResponse() to work with pages router
  const response = result.toUIMessageStreamResponse({
    originalMessages: userMessages, // Required to prevent duplicate messages (use sanitized array)
    sendSources: true,
    sendReasoning: true,
  });

  // Copy headers from the Response to the pages router res
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  // Set status code
  res.status(response.status);

  // Pipe the response body to the pages router res
  if (response.body) {
    // Convert Web ReadableStream to Node.js stream and pipe to res
    const { Readable } = require("stream");
    const nodeStream = Readable.fromWeb(response.body);
    nodeStream.pipe(res);
  } else {
    res.end();
  }
}
