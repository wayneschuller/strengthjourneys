import { kv } from "@vercel/kv";
import { getServerSession } from "next-auth/next";
import { estimateE1RM } from "@/lib/estimate-e1rm";
import { normalizeDateInput } from "@/lib/date-utils";
import { devLog } from "@/lib/processing-utils";
import { authOptions, promptDeveloper } from "@/pages/api/auth/[...nextauth]";

export const SAMPLE_TEMPLATE_SSID = "14J9z9iJBCeJksesf3MdmpTUmo2TIckDxIQcTx1CPEO0";
export const PROVISION_VERSION = 2;
const MAX_HEADER_CHECKS = 12;
const MAX_DEEP_ENRICH_CANDIDATES = 6;
const METADATA_SCAN_ROW_CAP = 10000;
const BIG_FOUR_LIFTS = ["Back Squat", "Bench Press", "Deadlift", "Strict Press"];
const PREVIEW_E1RM_TIE_TOLERANCE_RATIO = 0.01;
const REQUIRED_HEADER_CORE = ["date", "lift type", "reps", "weight"];
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

const VALID_INTENTS = new Set(["bootstrap", "recovery", "switch_sheet"]);
const VALID_LINK_MODES = new Set(["select_existing", "create_blank", "create_sample"]);
const isDevEnv =
  process.env.NEXT_PUBLIC_STRENGTH_JOURNEYS_ENV === "development";

export function normalizeIntent(value) {
  return VALID_INTENTS.has(value) ? value : "bootstrap";
}

export function normalizeLinkMode(value) {
  return VALID_LINK_MODES.has(value) ? value : null;
}

export function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function getNameTokens(fullName) {
  if (!fullName) return [];
  return String(fullName)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

export function buildSheetName(fullName) {
  const cleaned = typeof fullName === "string" ? fullName.trim() : "";
  return cleaned ? `${cleaned}'s Strength Journey` : "My Strength Journey";
}

export function createDebug(intent, mode) {
  return {
    intent,
    mode,
    path: [],
    lifecycle: null,
    candidates: [],
    headerChecks: [],
    selected: null,
  };
}

export function withDebug(payload, debug) {
  if (!isDevEnv) return payload;
  return { ...payload, debug };
}

function getRequestLocale(req) {
  const bodyLocale = req?.body?.locale;
  if (typeof bodyLocale === "string" && bodyLocale.trim()) {
    return bodyLocale.trim();
  }

  const acceptLanguage = req?.headers?.["accept-language"];
  if (typeof acceptLanguage === "string" && acceptLanguage.trim()) {
    return acceptLanguage.split(",")[0].trim();
  }

  return "en-US";
}

function formatStarterDateYmd(nowIso) {
  const date = nowIso ? new Date(nowIso) : new Date();
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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
  return !userTokens.includes(possessiveMatch[1]);
}

function scoreCandidate(candidate, userNameTokens) {
  const title = (candidate?.name || "").toLowerCase();
  const modifiedIso = candidate?.modifiedByMeTime || candidate?.modifiedTime;
  const ageDays = daysSince(modifiedIso);
  const rows = candidate?.approxRows || 0;
  const factors = {};

  if (ageDays <= 7) factors.recency = 35;
  else if (ageDays <= 30) factors.recency = 24;
  else if (ageDays <= 90) factors.recency = 14;
  else if (ageDays <= 365) factors.recency = 6;
  else factors.recency = 0;

  factors.rowsLog = Math.min(55, Math.log10(rows + 1) * 20);
  factors.rows300 = rows >= 300 ? 24 : 0;
  factors.rows1000 = rows >= 1000 ? 34 : 0;
  factors.rows5000 = rows >= 5000 ? 18 : 0;
  factors.recentLargeBoost = ageDays <= 7 && rows >= 1000 ? 26 : 0;
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

  return {
    score: Object.values(factors).reduce((sum, n) => sum + n, 0),
    factors,
    ageDays: Number(ageDays.toFixed(2)),
    rows,
  };
}

export function classifyLifecycle({
  existingRecord,
  hadLocalSheetBefore,
  validCandidates,
}) {
  const hasKvRecord = Boolean(
    existingRecord && Object.keys(existingRecord).length > 0,
  );
  const hasDriveRecoveryEvidence =
    Array.isArray(validCandidates) && validCandidates.length > 0;
  const hasAnyRecoveryEvidence =
    Boolean(hadLocalSheetBefore) || hasDriveRecoveryEvidence;
  const isTrueNewUser = !hasKvRecord && !hasAnyRecoveryEvidence;

  return {
    hasKvRecord,
    hasDriveRecoveryEvidence,
    hasAnyRecoveryEvidence,
    isTrueNewUser,
  };
}

export function toClientCandidate(candidate) {
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

export async function requireSheetFlowContext(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    res.status(401).json({ error: "You must be logged in." });
    return null;
  }
  if (!session.accessToken) {
    res.status(400).json({ error: "Auth missing accessToken" });
    return null;
  }
  if (!session.user?.email) {
    res.status(400).json({ error: "Auth missing user email" });
    return null;
  }

  return {
    session,
    headers: { Authorization: `Bearer ${session.accessToken}` },
    kvKey: `sj:user:${session.user.email}`,
    locale: getRequestLocale(req),
  };
}

export async function getExistingRecord(kvKey) {
  return (await kv.get(kvKey)) || {};
}

export async function listRecentSpreadsheetCandidates(headers) {
  const t0 = Date.now();
  const params = new URLSearchParams({
    q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
    orderBy: "modifiedByMeTime desc",
    pageSize: "30",
    fields: "files(id,name,webViewLink,modifiedTime,modifiedByMeTime)",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    { method: "GET", headers },
  );
  if (!response.ok) {
    devLog("[sheet-flow] drive scan failed:", response.status);
    return [];
  }

  const json = await response.json().catch(() => ({}));
  const files = Array.isArray(json?.files) ? json.files : [];
  const ranked = files.sort((a, b) => {
    const aRank = normalizeHeader(a?.name).includes("strength journey") ? 0 : 1;
    const bRank = normalizeHeader(b?.name).includes("strength journey") ? 0 : 1;
    if (aRank !== bRank) return aRank - bRank;
    return toTimestamp(b?.modifiedByMeTime || b?.modifiedTime) -
      toTimestamp(a?.modifiedByMeTime || a?.modifiedTime);
  });

  devLog(
    `[sheet-flow] drive scan returned ${ranked.length} candidates in ${Date.now() - t0}ms`,
  );
  return ranked;
}

export async function readHeaderInfo(ssid, headers) {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${ssid}/values/A1:Z1?dateTimeRenderOption=FORMATTED_STRING`,
    { method: "GET", headers },
  );
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

  return {
    valid: REQUIRED_HEADER_CORE.every((required) => normalized.includes(required)),
    status: response.status,
    sampleHeaders: row.slice(0, 8),
    headerCount: row.length,
    dateColumnIndex: normalized.indexOf("date"),
    repsColumnIndex: normalized.indexOf("reps"),
    weightColumnIndex: normalized.indexOf("weight"),
    liftTypeColumnIndex: normalized.indexOf("lift type"),
  };
}

function parseYmd(value, localeHint) {
  return normalizeDateInput(value, localeHint);
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
  const parsed = parseInt(String(value || "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseWeightAndUnit(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const compact = raw.toLowerCase();
  const hasKg = compact.endsWith("kg");
  const hasLb = compact.endsWith("lb");
  let numericPart = compact.replace(/(kg|lb)$/i, "").trim();
  const hasComma = numericPart.includes(",");
  const hasDot = numericPart.includes(".");
  if (hasComma && hasDot) {
    numericPart =
      numericPart.indexOf(".") < numericPart.indexOf(",")
        ? numericPart.replace(/\./g, "").replace(",", ".")
        : numericPart.replace(/,/g, "");
  } else if (hasComma) {
    const parts = numericPart.split(",");
    numericPart =
      parts.length === 2 && /^\d{1,2}$/.test(parts[1])
        ? `${parts[0]}.${parts[1]}`
        : numericPart.replace(/,/g, "");
  }
  const parsed = parseFloat(numericPart);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return { weight: parsed, unitType: hasKg ? "kg" : hasLb ? "lb" : null };
}

function shouldReplacePreviewSet(current, candidate) {
  if (!current) return true;
  if (candidate.e1rm > current.e1rm) {
    const relativeDelta = (candidate.e1rm - current.e1rm) / Math.max(current.e1rm, 1);
    if (relativeDelta > PREVIEW_E1RM_TIE_TOLERANCE_RATIO) return true;
  }
  const relativeGap = Math.abs(candidate.e1rm - current.e1rm) / Math.max(current.e1rm, 1);
  if (relativeGap <= PREVIEW_E1RM_TIE_TOLERANCE_RATIO) {
    if (candidate.reps < current.reps) return true;
    if (candidate.reps === current.reps && candidate.weight > current.weight) return true;
  }
  return false;
}

export async function enrichCandidateMetadata(
  candidate,
  headers,
  locale,
  dateColumnIndex,
  repsColumnIndex,
  weightColumnIndex,
  liftTypeColumnIndex,
) {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${candidate.id}/values/A2:Z${METADATA_SCAN_ROW_CAP + 1}?dateTimeRenderOption=FORMATTED_STRING`,
    { method: "GET", headers },
  );
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
    Array.isArray(row)
      ? row.some((cell) => String(cell || "").trim() !== "")
      : false,
  );

  const sessions = new Set();
  let approxRows = 0;
  let minDate = null;
  let maxDate = null;
  let previousDate = null;
  let previousLiftType = null;
  const bestByLift = {};

  for (const row of nonEmptyRows) {
    const hasReps =
      repsColumnIndex >= 0 && String(row?.[repsColumnIndex] || "").trim() !== "";
    const hasWeight =
      weightColumnIndex >= 0 &&
      String(row?.[weightColumnIndex] || "").trim() !== "";
    if (!hasReps || !hasWeight) continue;
    approxRows += 1;

    const parsedDate = parseYmd(row?.[dateColumnIndex], locale) || previousDate;
    if (!parsedDate) continue;
    previousDate = parsedDate;

    const normalizedLiftType =
      normalizeLiftTypeForPreview(row?.[liftTypeColumnIndex]) || previousLiftType;
    if (normalizedLiftType) previousLiftType = normalizedLiftType;

    sessions.add(parsedDate);
    if (!minDate || parsedDate < minDate) minDate = parsedDate;
    if (!maxDate || parsedDate > maxDate) maxDate = parsedDate;

    if (!normalizedLiftType || !BIG_FOUR_LIFTS.includes(normalizedLiftType)) continue;

    const reps = parseReps(row?.[repsColumnIndex]);
    const weightInfo = parseWeightAndUnit(row?.[weightColumnIndex]);
    if (!reps || !weightInfo?.weight) continue;

    const e1rm = estimateE1RM(reps, weightInfo.weight, "Brzycki");
    const current = bestByLift[normalizedLiftType];
    if (
      shouldReplacePreviewSet(current, {
        liftType: normalizedLiftType,
        e1rm,
        reps,
        weight: weightInfo.weight,
      })
    ) {
      bestByLift[normalizedLiftType] = {
        liftType: normalizedLiftType,
        e1rm,
        reps,
        weight: weightInfo.weight,
        unitType: weightInfo.unitType,
        date: parsedDate,
      };
    }
  }

  let hasRowsBeyondScanCap = false;
  try {
    const probeStart = METADATA_SCAN_ROW_CAP + 2;
    const probeResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${candidate.id}/values/A${probeStart}:Z${probeStart + 25}?dateTimeRenderOption=FORMATTED_STRING`,
      { method: "GET", headers },
    );
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
    // Best-effort probe only.
  }

  return {
    ...candidate,
    approxRows,
    approxSessions: sessions.size || null,
    dateRangeStart: minDate,
    dateRangeEnd: maxDate,
    bigFourPreview: BIG_FOUR_LIFTS.map((liftType) => bestByLift[liftType]).filter(Boolean),
    metadataSampled:
      nonEmptyRows.length >= METADATA_SCAN_ROW_CAP || hasRowsBeyondScanCap,
  };
}

export function scoreAndSortCandidates(candidates, userNameTokens, debug) {
  const scored = (Array.isArray(candidates) ? candidates : []).map((candidate) => {
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
    return toTimestamp(b.modifiedByMeTime || b.modifiedTime) -
      toTimestamp(a.modifiedByMeTime || a.modifiedTime);
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

export function pickEnrichCandidateIds(candidates, limit = MAX_DEEP_ENRICH_CANDIDATES) {
  const selected = [];
  const seenNames = new Set();
  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    if (!candidate?.id) continue;
    const nameKey = normalizeHeader(candidate?.name || "") || candidate.id;
    if (seenNames.has(nameKey)) continue;
    seenNames.add(nameKey);
    selected.push(candidate.id);
    if (selected.length >= limit) break;
  }
  return selected;
}

export async function discoverValidCandidates(headers, debug) {
  const rankedCandidates = await listRecentSpreadsheetCandidates(headers);
  debug.candidates = rankedCandidates.map((candidate, index) => ({
    rank: index + 1,
    ...toClientCandidate(candidate),
  }));

  const validCandidates = [];
  for (let i = 0; i < Math.min(rankedCandidates.length, MAX_HEADER_CHECKS); i += 1) {
    const candidate = rankedCandidates[i];
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
  return validCandidates;
}

export async function enrichCandidatesByIds({
  candidates,
  candidateIds,
  headers,
  locale,
  debug,
}) {
  const candidateMap = new Map();
  (Array.isArray(candidates) ? candidates : []).forEach((candidate) => {
    if (candidate?.id) candidateMap.set(candidate.id, candidate);
  });
  const ids = (Array.isArray(candidateIds) ? candidateIds : [])
    .filter((id, index, arr) => typeof id === "string" && arr.indexOf(id) === index)
    .slice(0, MAX_DEEP_ENRICH_CANDIDATES);

  const enriched = [];
  for (const candidateId of ids) {
    const candidate = candidateMap.get(candidateId);
    if (!candidate) continue;
    let headerHint = candidate.headerHint;
    if (!headerHint) {
      const headerInfo = await readHeaderInfo(candidate.id, headers);
      debug?.headerChecks.push({
        id: candidate.id,
        name: candidate.name || "unknown",
        valid: headerInfo.valid,
        status: headerInfo.status,
      });
      if (!headerInfo.valid) continue;
      headerHint = {
        dateColumnIndex: headerInfo.dateColumnIndex,
        repsColumnIndex: headerInfo.repsColumnIndex,
        weightColumnIndex: headerInfo.weightColumnIndex,
        liftTypeColumnIndex: headerInfo.liftTypeColumnIndex,
      };
    }
    enriched.push(
      await enrichCandidateMetadata(
        candidate,
        headers,
        locale,
        headerHint.dateColumnIndex,
        headerHint.repsColumnIndex,
        headerHint.weightColumnIndex,
        headerHint.liftTypeColumnIndex,
      ),
    );
  }
  return enriched;
}

export async function fetchDriveMetadata(ssid, headers) {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${ssid}?fields=id,name,trashed,webViewLink,modifiedTime,modifiedByMeTime`,
    { method: "GET", headers },
  );
  if (!response.ok) return null;
  return response.json();
}

export async function inspectProvisionedSheet(ssid, headers) {
  if (!ssid) {
    return {
      state: "unknown",
      httpStatus: null,
      metadata: null,
    };
  }

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${ssid}?fields=id,name,trashed,webViewLink,modifiedTime,modifiedByMeTime`,
    { method: "GET", headers },
  );

  if (response.ok) {
    const metadata = await response.json().catch(() => null);
    return {
      state: metadata?.trashed ? "trashed" : "accessible",
      httpStatus: response.status,
      metadata,
    };
  }

  if (response.status === 404) {
    return {
      state: "missing",
      httpStatus: response.status,
      metadata: null,
    };
  }

  if (response.status === 403) {
    return {
      state: "forbidden",
      httpStatus: response.status,
      metadata: null,
    };
  }

  return {
    state: "unknown",
    httpStatus: response.status,
    metadata: null,
  };
}

export async function validateAndFetchSelectedSheet(ssid, headers, debug) {
  const headerInfo = await readHeaderInfo(ssid, headers);
  debug.headerChecks.push({
    rank: 1,
    id: ssid,
    name: "selected",
    valid: headerInfo.valid,
    status: headerInfo.status,
    headerCount: headerInfo.headerCount,
    sampleHeaders: headerInfo.sampleHeaders,
  });
  if (!headerInfo.valid) {
    throw new Error(
      "Selected sheet does not match required columns (Date, Lift Type, Reps, Weight).",
    );
  }
  const metadata = await fetchDriveMetadata(ssid, headers);
  if (!metadata?.id) {
    throw new Error("Unable to access selected sheet metadata.");
  }
  return metadata;
}

export async function copyTemplate(sheetName, templateSsid, headers) {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${templateSsid}/copy?supportsAllDrives=true&fields=id,name,webViewLink,modifiedTime,modifiedByMeTime`,
    {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: sheetName }),
    },
  );
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error?.message || "Failed to copy template sheet");
  }
  return response.json();
}

async function createSpreadsheet(sheetName, headers) {
  const createResponse = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ properties: { title: sheetName } }),
  });
  if (!createResponse.ok) {
    const body = await createResponse.json().catch(() => ({}));
    throw new Error(body?.error?.message || "Failed to create a new sheet");
  }
  const created = await createResponse.json();
  const ssid = created?.spreadsheetId;
  if (!ssid) throw new Error("Sheet was created but spreadsheetId was missing");
  return { ssid, sheetId: created?.sheets?.[0]?.properties?.sheetId || 0 };
}

export async function createBlankSheet(sheetName, headers) {
  const { ssid } = await createSpreadsheet(sheetName, headers);

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

export async function createBootstrapSheet(
  sheetName,
  headers,
  nowIso,
  {
    preferredUnitType = "lb",
    locale = "en-US",
    starterDateText = null,
  } = {},
) {
  const { ssid, sheetId } = await createSpreadsheet(sheetName, headers);
  const unitType = preferredUnitType === "kg" ? "kg" : "lb";
  const starterWeight = unitType === "kg" ? "20kg" : "45lb";
  const starterDate = formatStarterDateYmd(nowIso);
  const starterRows = [
    ["Date", "Lift Type", "Reps", "Weight", "Notes", "URL"],
    [
      starterDate,
      "Back Squat",
      "5",
      starterWeight,
      "Start each new session by inserting 5-10 new rows at the top.",
      "",
    ],
    ["", "", "5", starterWeight, "Log one set per row as you lift.", ""],
    ["", "", "5", starterWeight, "Leave Date blank on the extra rows for the same session.", ""],
    ["", "", "", "", "Put all your sets here, including warmups.", ""],
  ];

  const valuesResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${ssid}/values/A1:F5?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        range: "A1:F5",
        majorDimension: "ROWS",
        values: starterRows,
      }),
    },
  );
  if (!valuesResponse.ok) {
    const body = await valuesResponse.json().catch(() => ({}));
    throw new Error(body?.error?.message || "Failed to seed bootstrap sheet");
  }

  const formatResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${ssid}:batchUpdate`,
    {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          // Freeze header row
          {
            updateSheetProperties: {
              properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
              fields: "gridProperties.frozenRowCount",
            },
          },
          // Bold + gray background on header row
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.83, green: 0.83, blue: 0.83 },
                  textFormat: { bold: true },
                },
              },
              fields: "userEnteredFormat.backgroundColor,userEnteredFormat.textFormat.bold",
            },
          },
          // Column widths
          {
            updateDimensionProperties: {
              range: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 1 },
              properties: { pixelSize: 110 },
              fields: "pixelSize",
            },
          },
          {
            updateDimensionProperties: {
              range: { sheetId, dimension: "COLUMNS", startIndex: 1, endIndex: 2 },
              properties: { pixelSize: 170 },
              fields: "pixelSize",
            },
          },
          {
            updateDimensionProperties: {
              range: { sheetId, dimension: "COLUMNS", startIndex: 2, endIndex: 3 },
              properties: { pixelSize: 75 },
              fields: "pixelSize",
            },
          },
          {
            updateDimensionProperties: {
              range: { sheetId, dimension: "COLUMNS", startIndex: 3, endIndex: 4 },
              properties: { pixelSize: 90 },
              fields: "pixelSize",
            },
          },
          {
            updateDimensionProperties: {
              range: { sheetId, dimension: "COLUMNS", startIndex: 4, endIndex: 5 },
              properties: { pixelSize: 380 },
              fields: "pixelSize",
            },
          },
          {
            updateDimensionProperties: {
              range: { sheetId, dimension: "COLUMNS", startIndex: 5, endIndex: 6 },
              properties: { pixelSize: 300 },
              fields: "pixelSize",
            },
          },
          // Header cell notes — one per column
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 },
              cell: { note: "Enter the date in YYYY-MM-DD format (e.g. 2026-03-07). Only fill in the date on the first set of each session — leave it blank for additional sets on the same day." },
              fields: "note",
            },
          },
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 1, endColumnIndex: 2 },
              cell: { note: "The name of the exercise (e.g. Back Squat, Deadlift, Bench Press, Strict Press). Use the same spelling every time so Strength Journeys can track your progress correctly." },
              fields: "note",
            },
          },
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 2, endColumnIndex: 3 },
              cell: { note: "The number of repetitions performed in this set (e.g. 5). Enter whole numbers only." },
              fields: "note",
            },
          },
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 3, endColumnIndex: 4 },
              cell: { note: "The weight lifted, including the unit — kg or lb (e.g. 100kg or 225lb). Always include the unit so Strength Journeys knows which system you use." },
              fields: "note",
            },
          },
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 4, endColumnIndex: 5 },
              cell: { note: "Optional free text. Add anything useful — coaching cues, RPE, how the session felt. Great for your own records." },
              fields: "note",
            },
          },
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 5, endColumnIndex: 6 },
              cell: { note: "Optional link to a video of this set — e.g. a YouTube or Google Photos URL. Strength Journeys will make these available so you can review your lifts alongside your data." },
              fields: "note",
            },
          },
          // Column A data rows: date format + bold
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 0, endColumnIndex: 1 },
              cell: {
                userEnteredFormat: {
                  numberFormat: { type: "DATE", pattern: "yyyy-mm-dd" },
                  textFormat: { bold: true },
                },
              },
              fields: "userEnteredFormat.numberFormat,userEnteredFormat.textFormat.bold",
            },
          },
          // Column C (Reps) data rows: right-align
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 2, endColumnIndex: 3 },
              cell: { userEnteredFormat: { horizontalAlignment: "RIGHT" } },
              fields: "userEnteredFormat.horizontalAlignment",
            },
          },
        ],
      }),
    },
  );
  if (!formatResponse.ok) {
    devLog("[sheet-flow] bootstrap formatting failed; continuing with seeded values");
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

export async function persistLinkedSheet({
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
    activationPromptedAt: existingRecord.activationPromptedAt || null,
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

export async function maybePromptActivation({ existingRecord, session, meta }) {
  if (existingRecord.activationPromptedAt) return false;
  await promptDeveloper("activated", session.user, meta);
  return true;
}

export async function markActivationPrompted({ kvKey, existingRecord, nowIso }) {
  await kv.set(kvKey, {
    ...existingRecord,
    activationPromptedAt: nowIso,
  });
}

export function respondLinkExisting(res, metadata, { reason, wasCreated = false, debug }) {
  return res.status(200).json(
    withDebug(
      {
        action: "link_existing",
        reason,
        ssid: metadata.id,
        name: metadata.name || null,
        webViewLink: metadata.webViewLink || null,
        modifiedTime: metadata.modifiedTime || null,
        modifiedByMeTime: metadata.modifiedByMeTime || null,
        wasCreated,
      },
      debug,
    ),
  );
}

export function respondCreateNewUserSheet(
  res,
  metadata,
  debug,
  { reason = "true_new_user" } = {},
) {
  return res.status(200).json(
    withDebug(
      {
        action: "create_new_user_sheet",
        reason,
        ssid: metadata.id,
        name: metadata.name || null,
        webViewLink: metadata.webViewLink || null,
        modifiedTime: metadata.modifiedTime || null,
        modifiedByMeTime: metadata.modifiedByMeTime || null,
        wasCreated: true,
      },
      debug,
    ),
  );
}

export function respondChooseSheet(
  res,
  { intent, candidates, recommendedId, debug },
) {
  return res.status(200).json(
    withDebug(
      {
        action: "choose_sheet",
        intent,
        candidates: candidates.map(toClientCandidate),
        recommendedId,
        enrichCandidateIds: pickEnrichCandidateIds(candidates),
      },
      debug,
    ),
  );
}

export function respondRecoverReturningUser(res, debug) {
  return res.status(200).json(
    withDebug(
      {
        action: "recover_returning_user",
        reason: "no_match",
      },
      debug,
    ),
  );
}
