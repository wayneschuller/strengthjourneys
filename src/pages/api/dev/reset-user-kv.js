import { getServerSession } from "next-auth/next";
import { kv } from "@vercel/kv";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

function isDevelopmentEnv() {
  return process.env.NEXT_PUBLIC_STRENGTH_JOURNEYS_ENV === "development";
}

export default async function handler(req, res) {
  if (!isDevelopmentEnv()) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const mode = req.body?.mode === "delete" ? "delete" : "onboarding";
  const kvKey = `sj:user:${session.user.email}`;

  try {
    if (mode === "delete") {
      await kv.del(kvKey);
      res.status(200).json({ ok: true, mode, message: "KV user record deleted." });
      return;
    }

    const record = (await kv.get(kvKey)) || {};
    const nextRecord = { ...record };

    delete nextRecord.provisionedSheetId;
    delete nextRecord.provisionedAt;
    delete nextRecord.provisionVersion;
    delete nextRecord.provisioningMethod;
    delete nextRecord.connectionMethod;
    delete nextRecord.activationPromptedAt;
    delete nextRecord.returnPromptedAt;
    delete nextRecord.lastSeenAt;

    if (Object.keys(nextRecord).length === 0) {
      await kv.del(kvKey);
      res.status(200).json({
        ok: true,
        mode,
        message: "KV onboarding fields cleared (record removed; now empty).",
      });
      return;
    }

    await kv.set(kvKey, nextRecord);
    res.status(200).json({ ok: true, mode, message: "KV onboarding fields cleared." });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to reset KV state" });
  }
}
