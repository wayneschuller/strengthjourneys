import { getServerSession } from "next-auth/next";
import { kv } from "@vercel/kv";
import { authOptions, promptDeveloper } from "@/pages/api/auth/[...nextauth]";
import { devLog } from "@/lib/processing-utils";

const TEMPLATE_SSID = "14J9z9iJBCeJksesf3MdmpTUmo2TIckDxIQcTx1CPEO0";
const PROVISION_VERSION = 1;
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
const REQUIRED_HEADER_CORE = ["date", "lift type", "reps", "weight"];
const isDevEnv = process.env.NEXT_PUBLIC_STRENGTH_JOURNEYS_ENV === "development";

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function buildSheetName(fullName) {
  const cleaned = typeof fullName === "string" ? fullName.trim() : "";
  return cleaned ? `${cleaned}'s Strength Journey` : "My Strength Journey";
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
    devLog("[provision-sheet] drive scan failed:", response.status);
    return [];
  }
  const json = await response.json().catch(() => ({}));
  const files = Array.isArray(json?.files) ? json.files : [];
  const rankByName = (file) =>
    normalizeHeader(file?.name).includes("strength journey") ? 0 : 1;
  const ranked = files.sort((a, b) => {
    const byName = rankByName(a) - rankByName(b);
    if (byName !== 0) return byName;
    const aTime = new Date(a?.modifiedByMeTime || a?.modifiedTime || 0).getTime();
    const bTime = new Date(b?.modifiedByMeTime || b?.modifiedTime || 0).getTime();
    return bTime - aTime;
  });
  devLog(
    `[provision-sheet] drive scan returned ${ranked.length} candidate sheets in ${Date.now() - t0}ms`,
  );
  devLog(
    "[provision-sheet] ranked candidates:",
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

async function hasRequiredHeaders(ssid, headers) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${ssid}/values/A1:Z1?dateTimeRenderOption=FORMATTED_STRING`;
  const response = await fetch(url, { method: "GET", headers });
  if (!response.ok) {
    devLog(`[provision-sheet] header check failed for ${ssid}:`, response.status);
    return false;
  }
  const json = await response.json().catch(() => ({}));
  const row = Array.isArray(json?.values?.[0]) ? json.values[0] : [];
  if (!row.length) {
    devLog(`[provision-sheet] header check empty row for ${ssid}`);
    return false;
  }

  const normalized = row.map(normalizeHeader);
  const hasCoreHeaders = REQUIRED_HEADER_CORE.every((required) =>
    normalized.includes(required),
  );
  devLog("[provision-sheet] header check:", {
    ssid,
    headerCount: row.length,
    sampleHeaders: row.slice(0, 8),
    hasCoreHeaders,
  });
  return hasCoreHeaders;
}

async function findExistingSheetViaDriveScan(headers, debug = null) {
  const candidates = await listRecentSpreadsheetCandidates(headers);
  if (debug) {
    debug.candidates = candidates.map((candidate, index) => ({
      rank: index + 1,
      id: candidate.id,
      name: candidate.name,
      modifiedByMeTime: candidate.modifiedByMeTime || null,
      modifiedTime: candidate.modifiedTime || null,
    }));
  }
  if (!candidates.length) return null;

  // Limit header validation calls to keep first-load latency reasonable.
  const maxChecks = Math.min(candidates.length, 8);
  for (let i = 0; i < maxChecks; i += 1) {
    const candidate = candidates[i];
    if (!candidate?.id) continue;
    const valid = await hasRequiredHeaders(candidate.id, headers);
    if (debug) {
      debug.headerChecks.push({
        rank: i + 1,
        id: candidate.id,
        name: candidate.name,
        valid,
      });
    }
    if (valid) {
      devLog("[provision-sheet] selected candidate via drive scan:", {
        rank: i + 1,
        id: candidate.id,
        name: candidate.name,
      });
      return candidate;
    }
  }
  devLog("[provision-sheet] no valid sheet found via drive scan");
  return null;
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

  const headers = { Authorization: `Bearer ${session.accessToken}` };
  const kvKey = `sj:user:${session.user.email}`;
  const nowIso = new Date().toISOString();
  const sheetName = buildSheetName(session.user.name);
  const debug = {
    path: [],
    candidates: [],
    headerChecks: [],
    selected: null,
  };

  try {
    const existingRecord = (await kv.get(kvKey)) || {};
    debug.path.push("drive_scan:start");
    const driveMatch = await findExistingSheetViaDriveScan(headers, debug);
    if (driveMatch?.id) {
      debug.path.push("drive_scan:hit");
      const nextRecord = {
        ...existingRecord,
        connectedAt: existingRecord.connectedAt || nowIso,
        connectionMethod: "auto_relink",
        provisionedSheetId: driveMatch.id,
        provisionedAt: existingRecord.provisionedAt || nowIso,
        provisionVersion: PROVISION_VERSION,
        provisioningMethod: "drive_scan",
        lastSeenAt: nowIso,
      };
      await kv.set(kvKey, nextRecord);
      debug.selected = {
        source: "drive_scan",
        ssid: driveMatch.id,
        name: driveMatch.name || sheetName,
      };
      res.status(200).json({
        ssid: driveMatch.id,
        name: driveMatch.name || sheetName,
        webViewLink: driveMatch.webViewLink || null,
        modifiedTime: driveMatch.modifiedTime || null,
        modifiedByMeTime: driveMatch.modifiedByMeTime || null,
        wasCreated: false,
        ...(isDevEnv ? { debug } : {}),
      });
      return;
    }
    debug.path.push("drive_scan:miss");

    const existingSsid = existingRecord?.provisionedSheetId;
    if (existingSsid) {
      debug.path.push("kv_hint:start");
      const metadata = await fetchDriveMetadata(existingSsid, headers);
      if (metadata?.id) {
        debug.path.push("kv_hint:hit");
        await kv.set(kvKey, {
          ...existingRecord,
          lastSeenAt: nowIso,
        });
        debug.selected = {
          source: "kv_hint",
          ssid: metadata.id,
          name: metadata.name || sheetName,
        };
        res.status(200).json({
          ssid: metadata.id,
          name: metadata.name || sheetName,
          webViewLink: metadata.webViewLink || null,
          modifiedTime: metadata.modifiedTime || null,
          modifiedByMeTime: metadata.modifiedByMeTime || null,
          wasCreated: false,
          ...(isDevEnv ? { debug } : {}),
        });
        return;
      }
      debug.path.push("kv_hint:miss");
    }

    let created = null;
    let provisioningMethod = "template_copy";
    try {
      debug.path.push("create:template_copy");
      created = await copyTemplate(sheetName, headers);
    } catch {
      debug.path.push("create:blank_seeded");
      provisioningMethod = "blank_seeded";
      created = await createBlankSheet(sheetName, headers);
    }

    const nextRecord = {
      ...existingRecord,
      connectedAt: existingRecord.connectedAt || nowIso,
      activationPromptedAt: existingRecord.activationPromptedAt || nowIso,
      connectionMethod: "auto_provision",
      provisionedSheetId: created.id,
      provisionedAt: nowIso,
      provisionVersion: PROVISION_VERSION,
      provisioningMethod,
      lastSeenAt: nowIso,
    };

    await kv.set(kvKey, nextRecord);
    debug.selected = {
      source: "auto_provision",
      ssid: created.id,
      name: created.name || sheetName,
      provisioningMethod,
    };

    if (!existingRecord.activationPromptedAt) {
      await promptDeveloper("activated", session.user, {
        connectionMethod: "auto_provision",
        provisioningMethod,
        sheetName: created.name || sheetName,
      });
    }

    res.status(200).json({
      ssid: created.id,
      name: created.name || sheetName,
      webViewLink: created.webViewLink || null,
      modifiedTime: created.modifiedTime || null,
      modifiedByMeTime: created.modifiedByMeTime || null,
      wasCreated: true,
      ...(isDevEnv ? { debug } : {}),
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Provisioning failed" });
  }
}
