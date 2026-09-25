/**
 * Thumbs feedback on AI lifting assistant replies, in two separate steps.
 *
 * "vote" counts a thumbs up or down against the prompt edition and model that
 * produced the reply. Only counts reach KV: no identity, no message text.
 *
 * "share" happens only when the lifter explicitly asks to send the chat to
 * Wayne. It emails the conversation, the lifting summary the coach saw, and the
 * edition and model, and stores nothing. The chat page promises discussions are
 * not stored on our servers, and this keeps that promise.
 *
 * Both are rate limited per hashed IP so the endpoint cannot inflate counts or
 * be used to send email in bulk.
 */

import { Resend } from "resend";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { isAllowedOrigin } from "@/lib/ai-chat-origin";
import {
  getForwardedIp,
  getUtcDateKey,
  hashRateLimitIdentity,
  incrementUsage,
} from "@/lib/ai-chat-quota";
import {
  promptEditionExists,
  recordPromptVote,
} from "@/lib/ai-prompt-editions";
import { devLog } from "@/lib/processing-utils";

const DAILY_LIMITS = { vote: 100, share: 10 };
const RATE_LIMIT_TTL_SECONDS = 60 * 60 * 48;
const SENTIMENTS = new Set(["up", "down"]);
// Model IDs become hash field names, so keep them to what providers use.
const MODEL_PATTERN = /^[a-z0-9][a-z0-9.\-]{0,59}$/i;
const MAX_SHARED_MESSAGES = 20;
const MAX_SHARED_CHARS = 30000;
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

  const { action, model, sentiment } = req.body || {};
  if (
    !(action in DAILY_LIMITS) ||
    !SENTIMENTS.has(sentiment) ||
    typeof model !== "string" ||
    !MODEL_PATTERN.test(model)
  ) {
    return res.status(400).json({ error: "Invalid feedback" });
  }

  const ipHash = hashRateLimitIdentity(getForwardedIp(req));
  const used = await incrementUsage(
    `sj:ai:feedback-ip:${action}:${ipHash}:${getUtcDateKey()}`,
    RATE_LIMIT_TTL_SECONDS,
  );
  if (used > DAILY_LIMITS[action]) {
    return res.status(429).json({ error: "Too much feedback today" });
  }

  if (action === "vote") {
    return handleVote(req, res);
  }
  return handleShare(req, res);
}

async function handleVote(req, res) {
  const { edition, model, sentiment, previous } = req.body;

  // Unknown editions are rejected so junk IDs cannot create vote keys.
  if (!(await promptEditionExists(edition))) {
    return res.status(400).json({ error: "Unknown edition" });
  }

  // The dev server shares production KV, so local testing would skew the
  // counts. It answers as if counted so the UI can still be exercised.
  if (process.env.NEXT_PUBLIC_STRENGTH_JOURNEYS_ENV === "development") {
    devLog(`Skipped counting ${sentiment} for ${edition} / ${model} in dev`);
    return res.status(200).json({ ok: true });
  }

  await recordPromptVote({
    id: edition,
    model,
    sentiment,
    previous: SENTIMENTS.has(previous) ? previous : null,
  });
  return res.status(200).json({ ok: true });
}

async function handleShare(req, res) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.FEEDBACK_EMAIL_TO;
  if (!apiKey || !to) {
    return res.status(503).json({ error: "Feedback service not configured" });
  }

  const { edition, model, sentiment, messages, userProvidedMetadata } =
    req.body;

  if (
    !Array.isArray(messages) ||
    messages.length === 0 ||
    messages.length > MAX_SHARED_MESSAGES ||
    messages.some(
      (m) =>
        !m ||
        (m.role !== "user" && m.role !== "assistant") ||
        typeof m.text !== "string",
    ) ||
    messages.reduce((total, m) => total + m.text.length, 0) >
      MAX_SHARED_CHARS ||
    (userProvidedMetadata != null &&
      (typeof userProvidedMetadata !== "string" ||
        userProvidedMetadata.length > MAX_METADATA_CHARS))
  ) {
    return res.status(400).json({ error: "Invalid shared chat" });
  }

  // Signed-in lifters are told their email goes along so Wayne can reply.
  const session = await getServerSession(req, res, authOptions);
  const name = session?.user?.name || "Anonymous visitor";
  const replyTo = session?.user?.email || null;
  const editionLabel =
    typeof edition === "string" && edition ? edition : "fallback prompt";
  const emoji = sentiment === "up" ? "👍" : "👎";

  const text = [
    `${name} shared a chat after a thumbs ${sentiment}.`,
    "",
    `Edition: ${editionLabel}`,
    `Model: ${model}`,
    `Signed in: ${replyTo ? `yes (${replyTo})` : "no"}`,
    "",
    // The rated reply is the last message, so the email reads top to bottom
    // exactly as the lifter saw it.
    ...messages.map((m) => `${m.role.toUpperCase()}:\n${m.text}\n`),
    "LIFTING SUMMARY THE COACH SAW:",
    userProvidedMetadata || "(none shared)",
  ].join("\n");

  try {
    const { error } = await new Resend(apiKey).emails.send({
      from: "Strength Journeys <feedback@updates.strengthjourneys.xyz>",
      to,
      subject: `${emoji} [AI chat] ${name} shared a chat (${editionLabel}, ${model})`,
      text,
      ...(replyTo ? { replyTo } : {}),
    });
    if (error) {
      console.error("Resend API error:", error);
      return res.status(500).json({ error: "Failed to share chat" });
    }
  } catch (error) {
    console.error("Error sending shared chat:", error);
    return res.status(500).json({ error: "Failed to share chat" });
  }

  return res.status(200).json({ ok: true });
}
