/**
 * Read-only quota snapshot for the AI lifting assistant chat UI.
 */

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import {
  appendAiChatQuotaHeaders,
  resolveAiChatQuota,
} from "@/lib/ai-chat-quota";

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
    return res.status(200).json(quota);
  } catch {
    return res.status(503).json({ error: "Quota service unavailable" });
  }
}
