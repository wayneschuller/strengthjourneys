import { kv } from "@vercel/kv";
import { devLog } from "@/lib/processing-utils";
import { requireSheetFlowContext } from "@/lib/sheet-flow";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const base = await requireSheetFlowContext(req, res);
  if (!base) return;

  try {
    const record = (await kv.get(base.kvKey)) || {};
    const nextRecord = { ...record };

    delete nextRecord.provisionedSheetId;
    delete nextRecord.provisionedAt;
    delete nextRecord.provisionVersion;
    delete nextRecord.provisioningMethod;
    delete nextRecord.connectionMethod;

    if (Object.keys(nextRecord).length === 0) {
      await kv.del(base.kvKey);
      devLog("[sheet/unlink] cleared current sheet link and removed empty KV record", {
        email: base.session.user.email,
      });
      res.status(200).json({
        ok: true,
        message: "Current sheet disconnected.",
      });
      return;
    }

    await kv.set(base.kvKey, nextRecord);
    devLog("[sheet/unlink] cleared current sheet link from KV", {
      email: base.session.user.email,
    });
    res.status(200).json({
      ok: true,
      message: "Current sheet disconnected.",
    });
  } catch (error) {
    console.error("[sheet/unlink] clear current sheet link failed:", error);
    res.status(500).json({ error: error.message || "Failed to disconnect current sheet" });
  }
}
