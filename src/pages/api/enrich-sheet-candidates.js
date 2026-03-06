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
    devLog("[sheet-flow] enrich:start", {
      intent,
      candidateCount: candidates.length,
      enrichCount: candidateIds.length,
    });
    const enriched = await enrichCandidatesByIds({
      candidates,
      candidateIds,
      headers: base.headers,
      debug,
    });
    devLog("[sheet-flow] enrich:done", {
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
    console.error("[sheet-flow] enrich failed:", error);
    res.status(500).json({ error: error.message || "Candidate enrichment failed" });
  }
}
