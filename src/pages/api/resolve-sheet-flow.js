import { devLog } from "@/lib/processing-utils";
import {
  buildSheetName,
  classifyLifecycle,
  createBootstrapSheet,
  createDebug,
  discoverValidCandidates,
  getExistingRecord,
  getNameTokens,
  markActivationPrompted,
  maybePromptActivation,
  persistLinkedSheet,
  requireSheetFlowContext,
  respondChooseSheet,
  respondCreateNewUserSheet,
  respondLinkExisting,
  respondRecoverReturningUser,
  scoreAndSortCandidates,
} from "@/lib/sheet-flow";

// Lifecycle policy:
// - KV is a lifecycle hint, not the sole proof of whether a user is new.
// - Some legacy users predate KV. If localStorage previously existed or Drive
//   scan finds plausible lifting sheets, treat them as returning/recoverable.
// - True new users are only users with no KV record and no recovery evidence.
// - Automatic provisioning is reserved for true new users only.
// - Returning users with no recoverable sheet go to recovery UI, not silent
//   reprovisioning.
// - switch_sheet is a separate user-directed flow. Ranking is allowed, but
//   auto-linking is not. This matters for cases like a coach with access to
//   multiple client sheets.
// - Founder notifications:
//   1. sign-in notifications may happen on any sign-in
//   2. activation notifications happen once when a true new user first
//      completes bootstrap with a working linked sheet

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const base = await requireSheetFlowContext(req, res);
  if (!base) return;

  const intent = ["bootstrap", "recovery", "switch_sheet"].includes(req.body?.intent)
    ? req.body.intent
    : "bootstrap";
  const hadLocalSheetBefore = Boolean(req.body?.hadLocalSheetBefore);
  const preferredUnitType = req.body?.preferredUnitType === "kg" ? "kg" : "lb";
  const debug = createDebug(intent, "discover");
  const existingRecord = await getExistingRecord(base.kvKey);
  const sheetName = buildSheetName(base.session.user.name);

  try {
    debug.path.push("resolve:start");
    devLog("[sheet-flow] resolve:start", {
      intent,
      hadLocalSheetBefore,
      hasKvRecord: Boolean(Object.keys(existingRecord || {}).length),
    });

    const validCandidates = await discoverValidCandidates(base.headers, debug);
    const rankedCandidates = scoreAndSortCandidates(
      validCandidates,
      getNameTokens(base.session.user.name),
      debug,
    );
    const lifecycle = classifyLifecycle({
      existingRecord,
      hadLocalSheetBefore,
      validCandidates: rankedCandidates,
    });
    debug.lifecycle = lifecycle;
    devLog("[sheet-flow] lifecycle classification", lifecycle);

    if (intent === "switch_sheet") {
      debug.path.push("resolve:choose_sheet:switch");
      devLog("[sheet-flow] resolve:action choose_sheet", {
        intent,
        candidateCount: rankedCandidates.length,
      });
      return respondChooseSheet(res, {
        intent,
        candidates: rankedCandidates,
        recommendedId: rankedCandidates[0]?.id || null,
        debug,
      });
    }

    if (rankedCandidates.length === 1) {
      const candidate = rankedCandidates[0];
      const reason =
        lifecycle.hasKvRecord || intent === "recovery"
          ? "drive_single"
          : "legacy_drive_relink";
      debug.path.push(`resolve:single_candidate:${reason}`);
      devLog("[sheet-flow] resolve:action link_existing", {
        intent,
        reason,
        ssid: candidate.id,
        name: candidate.name,
      });
      await persistLinkedSheet({
        kvKey: base.kvKey,
        existingRecord,
        nowIso: new Date().toISOString(),
        metadata: candidate,
        connectionMethod: reason,
        provisioningMethod: "drive_scan",
      });
      return respondLinkExisting(res, candidate, {
        reason,
        debug,
      });
    }

    if (rankedCandidates.length > 1) {
      debug.path.push("resolve:choose_sheet:multiple");
      devLog("[sheet-flow] resolve:action choose_sheet", {
        intent,
        candidateCount: rankedCandidates.length,
      });
      return respondChooseSheet(res, {
        intent: intent === "switch_sheet" ? "switch_sheet" : "recovery",
        candidates: rankedCandidates,
        recommendedId: rankedCandidates[0]?.id || null,
        debug,
      });
    }

    if (intent === "bootstrap" && lifecycle.isTrueNewUser) {
      debug.path.push("resolve:true_new_user:create_bootstrap");
      devLog("[sheet-flow] resolve:action create_new_user_sheet", {
        sheetName,
        preferredUnitType,
      });
      const nowIso = new Date().toISOString();
      const created = await createBootstrapSheet(
        sheetName,
        base.headers,
        nowIso,
        preferredUnitType,
      );
      await persistLinkedSheet({
        kvKey: base.kvKey,
        existingRecord,
        nowIso,
        metadata: created,
        connectionMethod: "auto_provision",
        provisioningMethod: "bootstrap_sheet_seeded",
      });
      const prompted = await maybePromptActivation({
        existingRecord,
        session: base.session,
        meta: {
          connectionMethod: "auto_provision",
          provisioningMethod: "bootstrap_sheet_seeded",
          sheetName: created.name || sheetName,
        },
      });
      if (prompted) {
        await markActivationPrompted({
          kvKey: base.kvKey,
          existingRecord: {
            ...existingRecord,
            connectedAt: nowIso,
            connectionMethod: "auto_provision",
            provisionedSheetId: created.id,
            provisioningMethod: "bootstrap_sheet_seeded",
            lastSeenAt: nowIso,
          },
          nowIso,
        });
      }
      devLog("[sheet-flow] founder activation after bootstrap template", { prompted });
      return respondCreateNewUserSheet(res, created, debug);
    }

    debug.path.push("resolve:recover_returning_user");
    devLog("[sheet-flow] resolve:action recover_returning_user", {
      intent,
      hadLocalSheetBefore,
    });
    return respondRecoverReturningUser(res, debug);
  } catch (error) {
    console.error("[sheet-flow] resolve failed:", error);
    res.status(500).json({ error: error.message || "Sheet flow resolution failed" });
  }
}
