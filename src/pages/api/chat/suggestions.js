/**
 * Follow-up question suggestions for the AI lifting assistant.
 *
 * Split out of /api/chat so the main answer stream closes as soon as the
 * coaching reply is done. The client calls this once the answer has rendered.
 *
 * This does not consume a chat turn, but an exhausted quota blocks it so the
 * endpoint cannot be used as a free model tap.
 */

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { resolveAiChatQuota } from "@/lib/ai-chat-quota";
import { isAllowedOrigin } from "@/lib/ai-chat-origin";
import { generateSuggestedQuestions } from "@/lib/ai-chat-suggestions";

const MAX_USER_MESSAGE_CHARS = 3000;
const MAX_ASSISTANT_TEXT_CHARS = 12000;
const MAX_METADATA_CHARS = 4500;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  if (
    process.env.NODE_ENV === "production" &&
    !isAllowedOrigin(req.headers.origin)
  ) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { latestUserMessage, assistantText, userProvidedMetadata } =
    req.body || {};

  if (
    typeof latestUserMessage !== "string" ||
    typeof assistantText !== "string"
  ) {
    return res.status(400).json({ error: "Invalid suggestion request" });
  }

  if (
    userProvidedMetadata != null &&
    typeof userProvidedMetadata !== "string"
  ) {
    return res.status(400).json({ error: "Invalid chat metadata" });
  }

  if (
    latestUserMessage.length > MAX_USER_MESSAGE_CHARS ||
    assistantText.length > MAX_ASSISTANT_TEXT_CHARS ||
    (userProvidedMetadata?.length ?? 0) > MAX_METADATA_CHARS
  ) {
    return res.status(413).json({ error: "Suggestion request is too large" });
  }

  const session = await getServerSession(req, res, authOptions);

  let quota;
  try {
    quota = await resolveAiChatQuota({
      req,
      res,
      session,
      increment: false,
    });
  } catch {
    return res.status(503).json({ error: "Quota service unavailable" });
  }

  if (quota.blocked) {
    return res.status(403).json({ error: "AI quota exhausted." });
  }

  const questions = await generateSuggestedQuestions({
    latestUserMessage,
    assistantText,
    userProvidedMetadata,
  });

  return res.status(200).json({ questions });
}
