/**
 * Read-only quota snapshot for the AI lifting assistant chat UI, plus the
 * current coach setup (prompt edition and models) for the page's AI details
 * panel. The page already calls this on load, so the details cost no extra
 * request.
 */

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import {
  appendAiChatQuotaHeaders,
  resolveAiChatQuota,
} from "@/lib/ai/chat-quota";
import { getChatModel, getSuggestionModel } from "@/lib/ai/models";
import { getActivePromptEdition } from "@/lib/ai/prompt-editions";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const session = await getServerSession(req, res, authOptions);

  try {
    const quota = await resolveAiChatQuota({
      req,
      res,
      session,
      increment: false,
    });
    appendAiChatQuotaHeaders(res, quota);
    return res.status(200).json({ ...quota, coach: await getCoachDetails() });
  } catch {
    return res.status(503).json({ error: "Quota service unavailable" });
  }
}

/**
 * What the coach is running right now. Only IDs and provider names: the
 * edition's text is proprietary and never leaves the server.
 */
async function getCoachDetails() {
  const edition = await getActivePromptEdition();
  const chatModel = getChatModel();
  const suggestionModel = getSuggestionModel();
  return {
    edition: edition?.id ?? null,
    model: chatModel?.modelId ?? null,
    // The SDK names providers like "xai.responses"; the family is enough here.
    provider: chatModel?.provider?.split(".")[0] ?? null,
    suggestionModel: suggestionModel?.modelId ?? null,
  };
}
