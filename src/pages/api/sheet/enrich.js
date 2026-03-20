// POST /api/sheet/enrich
//
// Enriches a set of Google Drive sheet candidates with full metadata so the
// sheet-picker UI can display meaningful detail (row count, lift types, last
// modified, etc.) for each option before the user selects one.
//
// Called by the sheet-setup dialog after resolve.js returns a "choose" response
// with a list of candidate sheet IDs. The UI may call this in two passes:
//   1. Fast pass — enriches top candidates immediately shown in the list.
//   2. Lazy pass — enriches remaining candidates as the user scrolls.
//
// Body: {
//   intent: "bootstrap" | "recovery" | "switch_sheet",
//   candidateIds: string[],    // Drive file IDs to fetch full metadata for
//   candidates: Candidate[],   // already-known candidate objects (from resolve)
// }
//
// Returns: { enrichedCandidates: ClientCandidate[] }

import { devLog } from "@/lib/processing-utils";
import {
  createDebug,
  enrichCandidatesByIds,
  getExistingRecord,
  normalizeIntent,
  requireSheetFlowContext,
  toClientCandidate,
  withDebug,
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
  const candidateIds = Array.isArray(req.body?.candidateIds) ? req.body.candidateIds : [];
  const candidates = Array.isArray(req.body?.candidates) ? req.body.candidates : [];
  const debug = createDebug(intent, "enrich_candidates");
  await getExistingRecord(base.kvKey);

  try {
    devLog("[sheet/enrich] enrich:start", {
      intent,
      candidateCount: candidates.length,
      enrichCount: candidateIds.length,
    });
    const enriched = await enrichCandidatesByIds({
      candidates,
      candidateIds,
      headers: base.headers,
      locale: base.locale,
      debug,
    });
    devLog("[sheet/enrich] enrich:done", {
      intent,
      enrichedCount: enriched.length,
    });
    res.status(200).json(
      withDebug(
        {
          enrichedCandidates: enriched.map(toClientCandidate),
        },
        debug,
      ),
    );
  } catch (error) {
    console.error("[sheet/enrich] enrich failed:", error);
    res.status(500).json({ error: error.message || "Candidate enrichment failed" });
  }
}
