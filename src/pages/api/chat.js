/**
 * AI lifting assistant chat API. Streams model output for the public AI page.
 *
 * Anonymous users get a limited allowance tracked via cookie + KV; signed-in
 * users get a higher daily cap. Quota is enforced server-side before any model
 * call so it cannot be bypassed from the client.
 */

import { openai } from "@ai-sdk/openai";
import { xai } from "@ai-sdk/xai";
import { streamText, convertToModelMessages } from "ai";
import { devLog } from "@/lib/processing-utils";
import {
  appendAiChatQuotaHeaders,
  resolveAiChatQuota,
} from "@/lib/ai-chat-quota";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

const SYSTEM_PROMPT =
  "You are a strength coach answering questions only about barbell exercises with an emphasis on getting strong." +
  "Emphasise safety and take precautions if user indicates any health concerns.";

const ALLOWED_EXACT_HOSTS = [
  "localhost:3000",
  "127.0.0.1:3000",
];

const ALLOWED_HOST_SUFFIXES = ["strengthjourneys.xyz"];

function isAllowedOrigin(origin) {
  if (!origin) return true;

  try {
    const { host, hostname } = new URL(origin);

    return (
      ALLOWED_EXACT_HOSTS.includes(host) ||
      ALLOWED_HOST_SUFFIXES.some(
        (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
      )
    );
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  if (process.env.NODE_ENV === "production" && !isAllowedOrigin(req.headers.origin)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const [session, body] = await Promise.all([
    getServerSession(req, res, authOptions),
    Promise.resolve(req.body),
  ]);

  const { messages, userProvidedMetadata } = body || {};
  const userMessages = Array.isArray(messages) ? messages : [];

  if (userMessages.length === 0) {
    devLog("WARNING: No messages received from client");
    return res.status(400).json({ error: "No messages provided" });
  }

  const useXai = !!process.env.XAI_API_KEY;

  if (!useXai && !process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "No AI API key is set" });
  }

  let quota;
  try {
    quota = await resolveAiChatQuota({
      req,
      res,
      session,
      increment: true,
    });
  } catch {
    return res.status(503).json({ error: "Quota service unavailable" });
  }

  appendAiChatQuotaHeaders(res, quota);

  if (quota.blocked) {
    return res.status(403).json({
      error:
        quota.code === "SIGN_IN_REQUIRED"
          ? "Sign in to continue chatting."
          : "AI quota exhausted. Try again tomorrow.",
      ...quota,
    });
  }

  let systemMessages = [{ role: "system", content: SYSTEM_PROMPT }];

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

  systemMessages.push({
    role: "system",
    content: buildTemporalContextPrompt(),
  });

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

  let AI_model;
  if (useXai) {
    AI_model = xai("grok-3-mini");
  } else {
    AI_model = openai("gpt-4.1");
  }

  const convertedUserMessages = await convertToModelMessages(userMessages);

  const modelMessages = [...systemMessages, ...convertedUserMessages];

  devLog(`AI model: ${AI_model.modelId}`);

  const result = await streamText({
    model: AI_model,
    messages: modelMessages,
  });

  const response = result.toUIMessageStreamResponse({
    originalMessages: userMessages,
    sendSources: true,
    sendReasoning: true,
  });

  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  appendAiChatQuotaHeaders(res, quota);

  res.status(response.status);

  if (response.body) {
    const { Readable } = require("stream");
    const nodeStream = Readable.fromWeb(response.body);
    nodeStream.pipe(res);
  } else {
    res.end();
  }
}

function buildTemporalContextPrompt() {
  const now = new Date();
  const utcDate = now.toISOString().slice(0, 10);

  return [
    `Today's date is ${utcDate} UTC.`,
    "Use this date when reasoning about training recency, missed sessions, deloads, layoffs, and gaps between logged session dates.",
    "If the user's lifting data includes dated sessions, compare those dates against today before commenting on momentum or recent fatigue.",
  ].join(" ");
}
