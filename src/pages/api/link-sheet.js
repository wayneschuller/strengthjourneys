import { devLog } from "@/lib/processing-utils";
import {
  SAMPLE_TEMPLATE_SSID,
  buildSheetName,
  classifyLifecycle,
  copyTemplate,
  createBlankSheet,
  createDebug,
  getExistingRecord,
  markActivationPrompted,
  maybePromptActivation,
  normalizeIntent,
  normalizeLinkMode,
  persistLinkedSheet,
  requireSheetFlowContext,
  respondCreateNewUserSheet,
  respondLinkExisting,
  validateAndFetchSelectedSheet,
} from "@/lib/sheet-flow";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const base = await requireSheetFlowContext(req, res);
  if (!base) return;

  const intent = normalizeIntent(req.body?.intent);
  const mode = normalizeLinkMode(req.body?.mode);
  const selectedSsid = req.body?.selectedSsid || null;
  const hadLocalSheetBefore = Boolean(req.body?.hadLocalSheetBefore);
  const debug = createDebug(intent, mode || "link");
  const existingRecord = await getExistingRecord(base.kvKey);
  const sheetName = buildSheetName(base.session.user.name);
  const lifecycle = classifyLifecycle({
    existingRecord,
    hadLocalSheetBefore,
    validCandidates: [],
  });

  if (!mode) {
    res.status(400).json({ error: "Invalid link mode." });
    return;
  }

  try {
    let metadata;
    let connectionMethod = "sheet_selection";
    let provisioningMethod = "sheet_selection";
    let reason = "user_selection";
    let wasCreated = false;

    devLog("[sheet-flow] link:start", {
      intent,
      mode,
      selectedSsid,
      hadLocalSheetBefore,
      lifecycle,
    });

    if (mode === "select_existing") {
      if (!selectedSsid) {
        res.status(400).json({ error: "Missing selectedSsid" });
        return;
      }
      metadata = await validateAndFetchSelectedSheet(selectedSsid, base.headers, debug);
      connectionMethod =
        intent === "switch_sheet"
          ? "switch_sheet_selection"
          : lifecycle.isTrueNewUser
            ? "onboarding_selection"
            : "recovery_selection";
      provisioningMethod = "sheet_selection";
      reason = "user_selection";
    }

    if (mode === "create_blank") {
      metadata = await createBlankSheet(sheetName, base.headers);
      connectionMethod =
        intent === "switch_sheet" ? "switch_sheet_selection" : "user_created_blank";
      provisioningMethod = "blank_seeded";
      reason = "created_blank";
      wasCreated = true;
    }

    if (mode === "create_sample") {
      metadata = await copyTemplate(sheetName, SAMPLE_TEMPLATE_SSID, base.headers);
      connectionMethod =
        intent === "switch_sheet" ? "switch_sheet_selection" : "user_created_sample";
      provisioningMethod = "template_copy";
      reason = "created_sample";
      wasCreated = true;
    }

    if (!metadata?.id) {
      throw new Error("Link flow produced no sheet metadata");
    }

    const nowIso = new Date().toISOString();
    await persistLinkedSheet({
      kvKey: base.kvKey,
      existingRecord,
      nowIso,
      metadata,
      connectionMethod,
      provisioningMethod,
    });
    debug.selected = {
      ssid: metadata.id,
      name: metadata.name,
      connectionMethod,
      provisioningMethod,
    };
    devLog("[sheet-flow] link:persisted", debug.selected);

    const shouldNotifyActivation =
      intent === "bootstrap" &&
      lifecycle.isTrueNewUser &&
      !existingRecord.activationPromptedAt;
    if (shouldNotifyActivation) {
      const prompted = await maybePromptActivation({
        existingRecord,
        session: base.session,
        meta: {
          connectionMethod,
          provisioningMethod,
          sheetName: metadata.name || sheetName,
        },
      });
      if (prompted) {
        await markActivationPrompted({
          kvKey: base.kvKey,
          existingRecord: {
            ...existingRecord,
            connectedAt: nowIso,
            connectionMethod,
            provisionedSheetId: metadata.id,
            provisioningMethod,
            lastSeenAt: nowIso,
          },
          nowIso,
        });
      }
      devLog("[sheet-flow] founder activation after link", {
        prompted,
        connectionMethod,
        provisioningMethod,
      });
    }

    if (reason === "true_new_user") {
      return respondCreateNewUserSheet(res, metadata, debug);
    }

    return respondLinkExisting(res, metadata, {
      reason,
      wasCreated,
      debug,
    });
  } catch (error) {
    console.error("[sheet-flow] link failed:", error);
    res.status(500).json({ error: error.message || "Sheet linking failed" });
  }
}
