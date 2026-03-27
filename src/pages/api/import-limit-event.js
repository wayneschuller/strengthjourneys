/**
 * Reports a large import request-limit hit so the founder can follow up.
 * This is best-effort only and never blocks the client-side recovery UX.
 * The point is visibility on rare oversized imports, not another critical path.
 */
import { getServerSession } from "next-auth/next";
import { authOptions, promptDeveloper } from "@/pages/api/auth/[...nextauth]";

function sanitizeString(value, maxLength = 160) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function sanitizeNumber(value, max = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(max, value));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const meta = typeof req.body?.meta === "object" && req.body?.meta ? req.body.meta : {};
  const sanitizedMeta = {
    page: sanitizeString(meta.page, 120),
    fileName: sanitizeString(meta.fileName, 160),
    reason: sanitizeString(meta.reason, 200),
    entryCount: sanitizeNumber(meta.entryCount, 1000000),
    payloadBytes: sanitizeNumber(meta.payloadBytes, 100 * 1024 * 1024),
    payloadMb: sanitizeNumber(meta.payloadMb, 1000),
  };

  try {
    await promptDeveloper("large-import", session.user, sanitizedMeta);
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("[import-limit-event] failed:", error);
    return res.status(500).json({ error: error.message || "Failed to report import limit event" });
  }
}
