// POST /api/sheet/unlink
//
// Disconnects the user's currently linked Google Sheet by clearing the
// sheet-identity fields from their KV record (sj:user:<email>). Does NOT
// delete or modify the actual Google Sheet — it only removes the app's memory
// of which sheet belongs to this user.
//
// After this call the client should clear sheetInfo from localStorage so the
// app returns to the sheet-setup flow on next load.
//
// Fields cleared from KV:
//   provisionedSheetId, provisionedAt, provisionVersion,
//   provisioningMethod, connectionMethod
//
// If the KV record becomes empty after clearing, it is deleted entirely.
//
// Body: { } (empty — user identity comes from the session)
//
// Returns: { ok: true, message: string }

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
