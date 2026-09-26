/**
 * Read-only quota snapshot for the AI lifting assistant chat UI, plus the
 * current coach setup (prompt edition and models) for the page's model
 * switcher and AI details panel. The page already calls this on load, so the details cost no extra
 * request.
 */

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import {
  appendAiChatQuotaHeaders,
  resolveAiChatQuota,
} from "@/lib/ai/chat-quota";
import {
  getAvailableChatModelIds,
  getChatModel,
  getSuggestionModel,
} from "@/lib/ai/models";
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
  return {
    edition: edition?.id ?? null,
    // What a lifter gets when their pick is unavailable or they have none.
    defaultModel: getChatModel()?.model.modelId ?? null,
    // The switcher only offers models whose provider key is configured.
    availableModels: getAvailableChatModelIds(),
    suggestionModel: getSuggestionModel()?.model.modelId ?? null,
  };
}
