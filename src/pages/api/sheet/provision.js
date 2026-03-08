// POST /api/sheet/provision
//
// Heavy-duty sheet provisioning: scans the user's Google Drive for existing
// lifting sheets, scores and ranks candidates, and either auto-links the best
// match or creates a new sheet from the Strength Journeys template.
//
// This is an older provisioning path. New users now go through resolve.js →
// link.js instead. provision.js is still used for legacy flows and can be
// called directly with an explicit mode.
//
// Modes (req.body.mode):
//   discover_fast       — quick Drive scan, returns ranked candidates to the UI
//   discover_deep       — full Drive scan with header-level validation
//   enrich_candidates   — fetch rich metadata for specific candidate IDs
//   select_existing     — link a specific sheet chosen by the user
//   create_new          — copy the sample template to create a new sheet
//
// Body: {
//   mode: string,
//   selectedSsid?: string,      // required for select_existing
//   candidateIds?: string[],    // required for enrich_candidates
//   candidates?: Candidate[],   // pre-fetched candidates for enrichment
// }
//
// Returns: varies by mode — either a candidate list for the picker UI or a
//          fully linked sheet record { ssid, url, filename, ... }.
//
// Post-response side effect: updates the KV record and may fire a founder
// activation notification when a new user successfully links their first sheet.

import { getServerSession } from "next-auth/next";
import { kv } from "@vercel/kv";
import { authOptions, promptDeveloper } from "@/pages/api/auth/[...nextauth]";
import { devLog } from "@/lib/processing-utils";
import { estimateE1RM } from "@/lib/estimate-e1rm";

const TEMPLATE_SSID = "14J9z9iJBCeJksesf3MdmpTUmo2TIckDxIQcTx1CPEO0";
const PROVISION_VERSION = 1;
const MAX_HEADER_CHECKS = 12;
const MAX_DEEP_ENRICH_CANDIDATES = 6;
const REQUIRED_HEADERS = [
  "Date",
  "Lift Type",
  "Reps",
  "Weight",
  "Notes",
  "isGoal",
  "Label",
  "URL",
];
const BIG_FOUR_LIFTS = ["Back Squat", "Bench Press", "Deadlift", "Strict Press"];
const REQUIRED_HEADER_CORE = ["date", "lift type", "reps", "weight"];
const isDevEnv =
  process.env.NEXT_PUBLIC_STRENGTH_JOURNEYS_ENV === "development";
const METADATA_SCAN_ROW_CAP = 10000;

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeLiftTypeForPreview(liftTypeRaw) {
  const key = String(liftTypeRaw || "")
    .trim()
    .toLowerCase();

  const map = {
    "back squat": "Back Squat",
    squat: "Back Squat",
    "bench press": "Bench Press",
    bench: "Bench Press",
    deadlift: "Deadlift",
    "strict press": "Strict Press",
    "overhead press": "Strict Press",
    "military press": "Strict Press",
    press: "Strict Press",
    ohp: "Strict Press",
  };
  return map[key] || null;
}

function parseReps(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function parseWeightAndUnit(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const compact = raw.toLowerCase();
  const hasKg = compact.endsWith("kg");
  const hasLb = compact.endsWith("lb");
  const numericPartRaw = compact.replace(/(kg|lb)$/i, "").trim();
  let numericPart = numericPartRaw;

  // Handle both "112,5kg" and "1,125kg" style inputs.
  const hasComma = numericPart.includes(",");
  const hasDot = numericPart.includes(".");
  if (hasComma && hasDot) {
    // If dot appears before comma, treat as EU style (1.125,5 -> 1125.5).
    if (numericPart.indexOf(".") < numericPart.indexOf(",")) {
      numericPart = numericPart.replace(/\./g, "").replace(",", ".");
    } else {
      // Default mixed style: commas are thousands separators.
      numericPart = numericPart.replace(/,/g, "");
    }
  } else if (hasComma) {
    const parts = numericPart.split(",");
    const last = parts[parts.length - 1];
    // Single comma with 1-2 trailing digits is likely decimal comma.
    if (parts.length === 2 && /^\d{1,2}$/.test(last)) {
      numericPart = `${parts[0]}.${last}`;
    } else {
      // Otherwise treat commas as thousands separators.
      numericPart = numericPart.replace(/,/g, "");
    }
  }

  const parsed = parseFloat(numericPart);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;

  return {
    weight: parsed,
    unitType: hasKg ? "kg" : hasLb ? "lb" : null,
  };
}

function getNameTokens(fullName) {
  if (!fullName) return [];
  return String(fullName)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function toTimestamp(iso) {
  const t = new Date(iso || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

function daysSince(iso) {
  const t = toTimestamp(iso);
  if (!t) return 99999;
  return (Date.now() - t) / (24 * 60 * 60 * 1000);
}

function hasLikelyOtherPersonName(title, userTokens) {
  const lower = (title || "").toLowerCase();
  const possessiveMatch = lower.match(/\b([a-z]{3,})'s\b/);
  if (!possessiveMatch) return false;
  const ownerToken = possessiveMatch[1];
  return !userTokens.includes(ownerToken);
}

function scoreCandidate(candidate, userNameTokens) {
  const title = (candidate?.name || "").toLowerCase();
  const modifiedIso = candidate?.modifiedByMeTime || candidate?.modifiedTime;
  const ageDays = daysSince(modifiedIso);
  const rows = candidate?.approxRows || 0;
  const factors = {};

  // Recency: still important, but less dominant than data depth.
  if (ageDays <= 7) factors.recency = 35;
  else if (ageDays <= 30) factors.recency = 24;
  else if (ageDays <= 90) factors.recency = 14;
  else if (ageDays <= 365) factors.recency = 6;
  else factors.recency = 0;

  // Data depth: primary signal.
  factors.rowsLog = Math.min(55, Math.log10(rows + 1) * 20);
  factors.rows300 = rows >= 300 ? 24 : 0;
  factors.rows1000 = rows >= 1000 ? 34 : 0;
  factors.rows5000 = rows >= 5000 ? 18 : 0;

  // Recency x depth synergy: recent + large should rise to the top.
  factors.recentLargeBoost = ageDays <= 7 && rows >= 1000 ? 26 : 0;

  // Naming cues (lightweight, not dominant).
  factors.strengthJourneyTitle = title.includes("strength journey") ? 8 : 0;
  factors.liftingTitle = title.includes("lifting") ? 8 : 0;
  factors.samplePenalty =
    title.includes("sample") || title.includes("demo") ? -28 : 0;
  factors.copyPenalty = title.includes("copy of") ? -12 : 0;

  const containsUserName = userNameTokens.some((token) => title.includes(token));
  factors.userNameBonus = containsUserName ? 10 : 0;
  factors.otherPersonPenalty = hasLikelyOtherPersonName(title, userNameTokens)
    ? -35
    : 0;

  const score = Object.values(factors).reduce((sum, n) => sum + n, 0);
  return {
    score,
    factors,
    ageDays: Number(ageDays.toFixed(2)),
    rows,
  };
}

function buildSheetName(fullName) {
  const cleaned = typeof fullName === "string" ? fullName.trim() : "";
  return cleaned ? `${cleaned}'s Strength Journey` : "My Strength Journey";
}

function toClientCandidate(candidate) {
  return {
    id: candidate.id,
    name: candidate.name || "Untitled sheet",
    webViewLink: candidate.webViewLink || null,
    modifiedTime: candidate.modifiedTime || null,
    modifiedByMeTime: candidate.modifiedByMeTime || null,
    approxRows: candidate.approxRows ?? null,
    approxSessions: candidate.approxSessions ?? null,
    dateRangeStart: candidate.dateRangeStart || null,
    dateRangeEnd: candidate.dateRangeEnd || null,
    metadataSampled: Boolean(candidate.metadataSampled),
    bigFourPreview: Array.isArray(candidate.bigFourPreview)
      ? candidate.bigFourPreview
      : [],
    headerHint:
      candidate?.headerHint &&
      Number.isInteger(candidate.headerHint.dateColumnIndex) &&
      Number.isInteger(candidate.headerHint.repsColumnIndex) &&
      Number.isInteger(candidate.headerHint.weightColumnIndex) &&
      Number.isInteger(candidate.headerHint.liftTypeColumnIndex)
        ? candidate.headerHint
        : null,
  };
}

function withDebug(payload, debug) {
  if (!isDevEnv) return payload;
  return { ...payload, debug };
}

async function fetchDriveMetadata(ssid, headers) {
  const driveUrl = `https://www.googleapis.com/drive/v3/files/${ssid}?fields=id,name,webViewLink,modifiedTime,modifiedByMeTime`;
  const response = await fetch(driveUrl, { method: "GET", headers });
  if (!response.ok) return null;
  return response.json();
}

async function listRecentSpreadsheetCandidates(headers) {
  const t0 = Date.now();
  const params = new URLSearchParams({
    q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
    orderBy: "modifiedByMeTime desc",
    pageSize: "30",
    fields: "files(id,name,webViewLink,modifiedTime,modifiedByMeTime)",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  const url = `https://www.googleapis.com/drive/v3/files?${params.toString()}`;
  const response = await fetch(url, { method: "GET", headers });
  if (!response.ok) {
    devLog("[sheet/provision] drive scan failed:", response.status);
    return [];
  }

  const json = await response.json().catch(() => ({}));
  const files = Array.isArray(json?.files) ? json.files : [];
  const rankByName = (file) =>
    normalizeHeader(file?.name).includes("strength journey") ? 0 : 1;

  const ranked = files.sort((a, b) => {
    const byName = rankByName(a) - rankByName(b);
    if (byName !== 0) return byName;
    const aTime = new Date(
      a?.modifiedByMeTime || a?.modifiedTime || 0,
    ).getTime();
    const bTime = new Date(
      b?.modifiedByMeTime || b?.modifiedTime || 0,
    ).getTime();
    return bTime - aTime;
  });

  devLog(
    `[sheet/provision] drive scan returned ${ranked.length} candidate sheets in ${Date.now() - t0}ms`,
  );
  devLog(
    "[sheet/provision] ranked candidates:",
    ranked.map((file, index) => ({
      rank: index + 1,
      id: file.id,
      name: file.name,
      modifiedByMeTime: file.modifiedByMeTime || null,
      modifiedTime: file.modifiedTime || null,
    })),
  );

  return ranked;
}

async function readHeaderInfo(ssid, headers) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${ssid}/values/A1:Z1?dateTimeRenderOption=FORMATTED_STRING`;
  const response = await fetch(url, { method: "GET", headers });
  if (!response.ok) {
    return {
      valid: false,
      status: response.status,
      sampleHeaders: [],
      headerCount: 0,
    };
  }

  const json = await response.json().catch(() => ({}));
  const row = Array.isArray(json?.values?.[0]) ? json.values[0] : [];
  const normalized = row.map(normalizeHeader);
  const valid = REQUIRED_HEADER_CORE.every((required) =>
    normalized.includes(required),
  );
  const dateColumnIndex = normalized.indexOf("date");
  const repsColumnIndex = normalized.indexOf("reps");
  const weightColumnIndex = normalized.indexOf("weight");
  const liftTypeColumnIndex = normalized.indexOf("lift type");

  return {
    valid,
    status: response.status,
    sampleHeaders: row.slice(0, 8),
    headerCount: row.length,
    dateColumnIndex,
    repsColumnIndex,
    weightColumnIndex,
    liftTypeColumnIndex,
  };
}

function parseYmd(value) {
  if (!value) return null;
  const str = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const d = new Date(`${str}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return str;
}

async function enrichCandidateMetadata(
  candidate,
  headers,
  dateColumnIndex,
  repsColumnIndex,
  weightColumnIndex,
  liftTypeColumnIndex,
) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${candidate.id}/values/A2:Z${METADATA_SCAN_ROW_CAP + 1}?dateTimeRenderOption=FORMATTED_STRING`;
  const response = await fetch(url, { method: "GET", headers });
  if (!response.ok) {
    return {
      ...candidate,
      approxRows: null,
      approxSessions: null,
      dateRangeStart: null,
      dateRangeEnd: null,
      metadataSampled: false,
    };
  }

  const json = await response.json().catch(() => ({}));
  const rows = Array.isArray(json?.values) ? json.values : [];
  const nonEmptyRows = rows.filter((row) =>
    Array.isArray(row) ? row.some((cell) => String(cell || "").trim() !== "") : false,
  );

  const sessions = new Set();
  let approxRows = 0;
  let minDate = null;
  let maxDate = null;
  const safeDateCol = dateColumnIndex >= 0 ? dateColumnIndex : 0;
  const safeRepsCol = repsColumnIndex >= 0 ? repsColumnIndex : -1;
  const safeWeightCol = weightColumnIndex >= 0 ? weightColumnIndex : -1;
  const safeLiftTypeCol = liftTypeColumnIndex >= 0 ? liftTypeColumnIndex : -1;
  let previousDate = null;
  let previousLiftType = null;
  const bestByLift = {};

  for (const row of nonEmptyRows) {
    const hasReps =
      safeRepsCol >= 0 && String(row?.[safeRepsCol] || "").trim() !== "";
    const hasWeight =
      safeWeightCol >= 0 && String(row?.[safeWeightCol] || "").trim() !== "";
    if (!hasReps || !hasWeight) continue;
    approxRows += 1;

    const parsed = parseYmd(row?.[safeDateCol]) || previousDate;
    if (!parsed) continue;
    previousDate = parsed;

    const normalizedLiftType =
      normalizeLiftTypeForPreview(row?.[safeLiftTypeCol]) || previousLiftType;
    if (normalizedLiftType) previousLiftType = normalizedLiftType;
    sessions.add(parsed);
    if (!minDate || parsed < minDate) minDate = parsed;
    if (!maxDate || parsed > maxDate) maxDate = parsed;

    if (!normalizedLiftType || !BIG_FOUR_LIFTS.includes(normalizedLiftType)) {
      continue;
    }

    const reps = parseReps(row?.[safeRepsCol]);
    const weightInfo = parseWeightAndUnit(row?.[safeWeightCol]);
    if (!reps || !weightInfo?.weight) continue;

    const e1rm = estimateE1RM(reps, weightInfo.weight, "Brzycki");
    const current = bestByLift[normalizedLiftType];
    if (!current || e1rm > current.e1rm) {
      bestByLift[normalizedLiftType] = {
        liftType: normalizedLiftType,
        e1rm,
        reps,
        weight: weightInfo.weight,
        unitType: weightInfo.unitType,
        date: parsed,
      };
    }
  }

  const bigFourPreview = BIG_FOUR_LIFTS.map((liftType) => bestByLift[liftType]).filter(
    Boolean,
  );

  let hasRowsBeyondScanCap = false;
  try {
    const probeStart = METADATA_SCAN_ROW_CAP + 2;
    const probeEnd = probeStart + 25;
    const probeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${candidate.id}/values/A${probeStart}:Z${probeEnd}?dateTimeRenderOption=FORMATTED_STRING`;
    const probeResponse = await fetch(probeUrl, { method: "GET", headers });
    if (probeResponse.ok) {
      const probeJson = await probeResponse.json().catch(() => ({}));
      const probeRows = Array.isArray(probeJson?.values) ? probeJson.values : [];
      hasRowsBeyondScanCap = probeRows.some((row) =>
        Array.isArray(row)
          ? row.some((cell) => String(cell || "").trim() !== "")
          : false,
      );
    }
  } catch {
    // Metadata probe is best-effort only.
  }

  return {
    ...candidate,
    approxRows,
    approxSessions: sessions.size || null,
    dateRangeStart: minDate,
    dateRangeEnd: maxDate,
    bigFourPreview,
    metadataSampled:
      nonEmptyRows.length >= METADATA_SCAN_ROW_CAP || hasRowsBeyondScanCap,
  };
}

function scoreAndSortCandidates(candidates, userNameTokens, debug) {
  const scored = candidates.map((candidate) => {
    const result = scoreCandidate(candidate, userNameTokens);
    return {
      ...candidate,
      __score: result.score,
      __scoreFactors: result.factors,
      __ageDays: result.ageDays,
      __rowsForScore: result.rows,
    };
  });

  scored.sort((a, b) => {
    if (a.__score !== b.__score) return b.__score - a.__score;
    const aTime = toTimestamp(a.modifiedByMeTime || a.modifiedTime);
    const bTime = toTimestamp(b.modifiedByMeTime || b.modifiedTime);
    return bTime - aTime;
  });

  if (debug) {
    debug.scores = scored.map((candidate, index) => ({
      rank: index + 1,
      id: candidate.id,
      name: candidate.name,
      score: candidate.__score,
      ageDays: candidate.__ageDays,
      rows: candidate.__rowsForScore,
      factors: candidate.__scoreFactors,
    }));
    devLog("[sheet/provision] candidate score breakdown:", debug.scores);
  }

  return scored.map((candidate) => {
    const copy = { ...candidate };
    delete copy.__score;
    delete copy.__scoreFactors;
    delete copy.__ageDays;
    delete copy.__rowsForScore;
    return copy;
  });
}

function pickEnrichCandidateIds(candidates, limit = MAX_DEEP_ENRICH_CANDIDATES) {
  const seenNames = new Set();
  const selected = [];

  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    const id = candidate?.id;
    if (!id) continue;
    const normalizedName = normalizeHeader(candidate?.name || "");
    const nameKey = normalizedName || id;
    if (seenNames.has(nameKey)) continue;

    seenNames.add(nameKey);
    selected.push(id);
    if (selected.length >= limit) break;
  }

  return selected;
}

async function discoverValidCandidates(headers, debug) {
  const rankedCandidates = await listRecentSpreadsheetCandidates(headers);

  debug.candidates = rankedCandidates.map((candidate, index) => ({
    rank: index + 1,
    ...toClientCandidate(candidate),
  }));

  if (!rankedCandidates.length) return [];

  const maxChecks = Math.min(rankedCandidates.length, MAX_HEADER_CHECKS);
  const validCandidates = [];

  for (let i = 0; i < maxChecks; i += 1) {
    const candidate = rankedCandidates[i];
    if (!candidate?.id) continue;

    const headerInfo = await readHeaderInfo(candidate.id, headers);
    const checkResult = {
      rank: i + 1,
      id: candidate.id,
      name: candidate.name,
      valid: headerInfo.valid,
      status: headerInfo.status,
      headerCount: headerInfo.headerCount,
      sampleHeaders: headerInfo.sampleHeaders,
    };
    debug.headerChecks.push(checkResult);

    devLog("[sheet/provision] header check:", checkResult);

    if (headerInfo.valid) {
      validCandidates.push({
        ...candidate,
        headerHint: {
          dateColumnIndex: headerInfo.dateColumnIndex,
          repsColumnIndex: headerInfo.repsColumnIndex,
          weightColumnIndex: headerInfo.weightColumnIndex,
          liftTypeColumnIndex: headerInfo.liftTypeColumnIndex,
        },
      });
    }
  }

  devLog(
    `[sheet/provision] valid candidate count after header checks: ${validCandidates.length}`,
  );
  return validCandidates.map((candidate) => {
    const copy = { ...candidate };
    return copy;
  });
}

async function enrichCandidatesByIds({
  candidates,
  candidateIds,
  headers,
  debug,
}) {
  const candidateMap = new Map();
  (Array.isArray(candidates) ? candidates : []).forEach((candidate) => {
    if (candidate?.id) candidateMap.set(candidate.id, candidate);
  });

  const selectedIds = (Array.isArray(candidateIds) ? candidateIds : [])
    .filter((id) => typeof id === "string" && id.trim().length > 0)
    .filter((id, index, arr) => arr.indexOf(id) === index)
    .slice(0, MAX_DEEP_ENRICH_CANDIDATES);

  const enriched = [];
  for (const candidateId of selectedIds) {
    const candidate = candidateMap.get(candidateId);
    if (!candidate) continue;

    const hinted = candidate?.headerHint;
    const hasHeaderHint =
      hinted &&
      Number.isInteger(hinted.dateColumnIndex) &&
      Number.isInteger(hinted.repsColumnIndex) &&
      Number.isInteger(hinted.weightColumnIndex) &&
      Number.isInteger(hinted.liftTypeColumnIndex);

    let headerInfo = null;
    if (!hasHeaderHint) {
      headerInfo = await readHeaderInfo(candidate.id, headers);
      const checkResult = {
        id: candidate.id,
        name: candidate.name || "unknown",
        valid: headerInfo.valid,
        status: headerInfo.status,
        headerCount: headerInfo.headerCount,
        sampleHeaders: headerInfo.sampleHeaders,
      };
      debug?.headerChecks.push(checkResult);
      if (!headerInfo.valid) continue;
    } else {
      debug?.headerChecks.push({
        id: candidate.id,
        name: candidate.name || "unknown",
        valid: true,
        status: "hint",
      });
    }

    const candidateWithMeta = await enrichCandidateMetadata(
      candidate,
      headers,
      hasHeaderHint ? hinted.dateColumnIndex : headerInfo.dateColumnIndex,
      hasHeaderHint ? hinted.repsColumnIndex : headerInfo.repsColumnIndex,
      hasHeaderHint ? hinted.weightColumnIndex : headerInfo.weightColumnIndex,
      hasHeaderHint ? hinted.liftTypeColumnIndex : headerInfo.liftTypeColumnIndex,
    );
    enriched.push(candidateWithMeta);
  }

  return enriched;
}

async function copyTemplate(sheetName, headers) {
  const url = `https://www.googleapis.com/drive/v3/files/${TEMPLATE_SSID}/copy?supportsAllDrives=true&fields=id,name,webViewLink,modifiedTime,modifiedByMeTime`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: sheetName }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error?.message || "Failed to copy template sheet");
  }
  return response.json();
}

async function createBlankSheet(sheetName, headers) {
  const createResponse = await fetch(
    "https://sheets.googleapis.com/v4/spreadsheets",
    {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: { title: sheetName },
      }),
    },
  );

  if (!createResponse.ok) {
    const body = await createResponse.json().catch(() => ({}));
    throw new Error(body?.error?.message || "Failed to create a new sheet");
  }

  const created = await createResponse.json();
  const ssid = created?.spreadsheetId;
  if (!ssid) throw new Error("Sheet was created but spreadsheetId was missing");

  const headerResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${ssid}/values/A1:H1?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        range: "A1:H1",
        majorDimension: "ROWS",
        values: [REQUIRED_HEADERS],
      }),
    },
  );

  if (!headerResponse.ok) {
    const body = await headerResponse.json().catch(() => ({}));
    throw new Error(body?.error?.message || "Failed to seed sheet headers");
  }

  const metadata = await fetchDriveMetadata(ssid, headers);
  return {
    id: ssid,
    name: metadata?.name || sheetName,
    webViewLink: metadata?.webViewLink || null,
    modifiedTime: metadata?.modifiedTime || null,
    modifiedByMeTime: metadata?.modifiedByMeTime || null,
  };
}

async function persistLinkedSheet({
  kvKey,
  existingRecord,
  nowIso,
  metadata,
  connectionMethod,
  provisioningMethod,
}) {
  const nextRecord = {
    ...existingRecord,
    connectedAt: existingRecord.connectedAt || nowIso,
    activationPromptedAt: existingRecord.activationPromptedAt || nowIso,
    connectionMethod,
    provisionedSheetId: metadata.id,
    provisionedAt: existingRecord.provisionedAt || nowIso,
    provisionVersion: PROVISION_VERSION,
    provisioningMethod,
    lastSeenAt: nowIso,
  };

  await kv.set(kvKey, nextRecord);
  return nextRecord;
}

async function maybePromptActivation({ existingRecord, session, meta }) {
  if (existingRecord.activationPromptedAt) return;
  await promptDeveloper("activated", session.user, meta);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    res.status(401).json({ error: "You must be logged in." });
    return;
  }
  if (!session.accessToken) {
    res.status(400).json({ error: "Auth missing accessToken" });
    return;
  }
  if (!session.user?.email) {
    res.status(400).json({ error: "Auth missing user email" });
    return;
  }

  const mode = req.body?.mode || "discover_fast";
  const selectedSsid = req.body?.selectedSsid || null;
  const candidateIds = Array.isArray(req.body?.candidateIds)
    ? req.body.candidateIds
    : [];
  const providedCandidates = Array.isArray(req.body?.candidates)
    ? req.body.candidates
    : [];
  const headers = { Authorization: `Bearer ${session.accessToken}` };
  const kvKey = `sj:user:${session.user.email}`;
  const nowIso = new Date().toISOString();
  const sheetName = buildSheetName(session.user.name);

  const debug = {
    mode,
    path: [],
    candidates: [],
    headerChecks: [],
    selected: null,
  };

  try {
    const existingRecord = (await kv.get(kvKey)) || {};
    const userNameTokens = getNameTokens(session.user.name);

    if (mode === "enrich_candidates") {
      debug.path.push("enrich_candidates:start");
      const enriched = await enrichCandidatesByIds({
        candidates: providedCandidates,
        candidateIds,
        headers,
        debug,
      });

      debug.path.push("enrich_candidates:done");
      res.status(200).json(
        withDebug(
          {
            enrichedCandidates: enriched.map(toClientCandidate),
          },
          debug,
        ),
      );
      return;
    }

    if (mode === "select_existing") {
      if (!selectedSsid) {
        res.status(400).json({ error: "Missing selectedSsid" });
        return;
      }

      debug.path.push("select_existing:start");
      const headerInfo = await readHeaderInfo(selectedSsid, headers);
      debug.headerChecks.push({
        rank: 1,
        id: selectedSsid,
        name: "selected",
        valid: headerInfo.valid,
        status: headerInfo.status,
        headerCount: headerInfo.headerCount,
        sampleHeaders: headerInfo.sampleHeaders,
      });

      if (!headerInfo.valid) {
        res.status(400).json(
          withDebug(
            {
              error:
                "Selected sheet does not match required columns (Date, Lift Type, Reps, Weight).",
            },
            debug,
          ),
        );
        return;
      }

      const metadata = await fetchDriveMetadata(selectedSsid, headers);
      if (!metadata?.id) {
        res.status(400).json(
          withDebug(
            { error: "Unable to access selected sheet metadata." },
            debug,
          ),
        );
        return;
      }

      await persistLinkedSheet({
        kvKey,
        existingRecord,
        nowIso,
        metadata,
        connectionMethod: "onboarding_selection",
        provisioningMethod: "sheet_chooser",
      });

      await maybePromptActivation({
        existingRecord,
        session,
        meta: {
          connectionMethod: "onboarding_selection",
          provisioningMethod: "sheet_chooser",
          sheetName: metadata.name || sheetName,
        },
      });

      debug.path.push("select_existing:linked");
      debug.selected = {
        source: "sheet_chooser",
        ssid: metadata.id,
        name: metadata.name || sheetName,
      };

      res.status(200).json(
        withDebug(
          {
            ssid: metadata.id,
            name: metadata.name || sheetName,
            webViewLink: metadata.webViewLink || null,
            modifiedTime: metadata.modifiedTime || null,
            modifiedByMeTime: metadata.modifiedByMeTime || null,
            wasCreated: false,
          },
          debug,
        ),
      );
      return;
    }

    if (mode === "create_sample" || mode === "create_blank") {
      debug.path.push(`${mode}:start`);
      const created =
        mode === "create_sample"
          ? await copyTemplate(sheetName, headers)
          : await createBlankSheet(sheetName, headers);

      await persistLinkedSheet({
        kvKey,
        existingRecord,
        nowIso,
        metadata: created,
        connectionMethod: "auto_provision",
        provisioningMethod:
          mode === "create_sample" ? "template_copy" : "blank_seeded",
      });

      await maybePromptActivation({
        existingRecord,
        session,
        meta: {
          connectionMethod: "auto_provision",
          provisioningMethod:
            mode === "create_sample" ? "template_copy" : "blank_seeded",
          sheetName: created.name || sheetName,
        },
      });

      debug.path.push(`${mode}:created`);
      debug.selected = {
        source: "auto_provision",
        ssid: created.id,
        name: created.name || sheetName,
        provisioningMethod:
          mode === "create_sample" ? "template_copy" : "blank_seeded",
      };

      res.status(200).json(
        withDebug(
          {
            ssid: created.id,
            name: created.name || sheetName,
            webViewLink: created.webViewLink || null,
            modifiedTime: created.modifiedTime || null,
            modifiedByMeTime: created.modifiedByMeTime || null,
            wasCreated: true,
          },
          debug,
        ),
      );
      return;
    }

    // Discovery mode (fast path): drive scan + header checks only.
    if (mode !== "discover" && mode !== "discover_fast") {
      res.status(400).json({ error: "Invalid provisioning mode." });
      return;
    }

    debug.path.push("discover:start");
    const validCandidates = await discoverValidCandidates(headers, debug);

    if (validCandidates.length > 1) {
      const ranked = scoreAndSortCandidates(validCandidates, userNameTokens, debug);
      const enrichCandidateIds = pickEnrichCandidateIds(
        ranked,
        MAX_DEEP_ENRICH_CANDIDATES,
      );

      debug.path.push("discover:multiple_candidates");
      debug.enrichCandidateIds = enrichCandidateIds;
      res.status(200).json(
        withDebug(
          {
            needsSelection: true,
            candidates: ranked.map(toClientCandidate),
            enrichCandidateIds,
            recommendedId: ranked[0]?.id || null,
            wasCreated: false,
          },
          debug,
        ),
      );
      return;
    }

    if (validCandidates.length === 1) {
      const selected = validCandidates[0];
      debug.path.push("discover:single_candidate");
      await persistLinkedSheet({
        kvKey,
        existingRecord,
        nowIso,
        metadata: selected,
        connectionMethod: "auto_relink",
        provisioningMethod: "drive_scan",
      });

      await maybePromptActivation({
        existingRecord,
        session,
        meta: {
          connectionMethod: "auto_relink",
          provisioningMethod: "drive_scan",
          sheetName: selected.name || sheetName,
        },
      });

      debug.selected = {
        source: "drive_scan",
        ssid: selected.id,
        name: selected.name || sheetName,
      };

      res.status(200).json(
        withDebug(
          {
            ssid: selected.id,
            name: selected.name || sheetName,
            webViewLink: selected.webViewLink || null,
            modifiedTime: selected.modifiedTime || null,
            modifiedByMeTime: selected.modifiedByMeTime || null,
            wasCreated: false,
          },
          debug,
        ),
      );
      return;
    }

    // No drive matches - fallback to KV hint (if any)
    const existingSsid = existingRecord?.provisionedSheetId;
    if (existingSsid) {
      debug.path.push("discover:kv_hint_start");
      const kvHeaderInfo = await readHeaderInfo(existingSsid, headers);
      if (kvHeaderInfo.valid) {
        const metadata = await fetchDriveMetadata(existingSsid, headers);
        if (metadata?.id) {
          debug.path.push("discover:kv_hint_hit");
          await persistLinkedSheet({
            kvKey,
            existingRecord,
            nowIso,
            metadata,
            connectionMethod: "kv_relink",
            provisioningMethod: "kv_hint",
          });

          await maybePromptActivation({
            existingRecord,
            session,
            meta: {
              connectionMethod: "kv_relink",
              provisioningMethod: "kv_hint",
              sheetName: metadata.name || sheetName,
            },
          });

          debug.selected = {
            source: "kv_hint",
            ssid: metadata.id,
            name: metadata.name || sheetName,
          };

          res.status(200).json(
            withDebug(
              {
                ssid: metadata.id,
                name: metadata.name || sheetName,
                webViewLink: metadata.webViewLink || null,
                modifiedTime: metadata.modifiedTime || null,
                modifiedByMeTime: metadata.modifiedByMeTime || null,
                wasCreated: false,
              },
              debug,
            ),
          );
          return;
        }
      }
      debug.path.push("discover:kv_hint_miss");
    }

    // Final fallback: create a sample-based sheet automatically.
    debug.path.push("discover:fallback_create_sample");
    const created = await copyTemplate(sheetName, headers);

    await persistLinkedSheet({
      kvKey,
      existingRecord,
      nowIso,
      metadata: created,
      connectionMethod: "auto_provision",
      provisioningMethod: "template_copy",
    });

    await maybePromptActivation({
      existingRecord,
      session,
      meta: {
        connectionMethod: "auto_provision",
        provisioningMethod: "template_copy",
        sheetName: created.name || sheetName,
      },
    });

    debug.selected = {
      source: "auto_provision",
      ssid: created.id,
      name: created.name || sheetName,
      provisioningMethod: "template_copy",
    };

    res.status(200).json(
      withDebug(
        {
          ssid: created.id,
          name: created.name || sheetName,
          webViewLink: created.webViewLink || null,
          modifiedTime: created.modifiedTime || null,
          modifiedByMeTime: created.modifiedByMeTime || null,
          wasCreated: true,
        },
        debug,
      ),
    );
  } catch (error) {
    res.status(500).json({ error: error.message || "Provisioning failed" });
  }
}
