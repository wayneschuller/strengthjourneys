import { getServerSession } from "next-auth/next";
import { kv } from "@vercel/kv";
import { authOptions, promptDeveloper } from "@/pages/api/auth/[...nextauth]";
import { devLog } from "@/lib/processing-utils";

const TEMPLATE_SSID = "14J9z9iJBCeJksesf3MdmpTUmo2TIckDxIQcTx1CPEO0";
const PROVISION_VERSION = 1;
const MAX_HEADER_CHECKS = 12;
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
const isDevEnv =
  process.env.NEXT_PUBLIC_STRENGTH_JOURNEYS_ENV === "development";

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

function toClientCandidate(candidate) {
  return {
    id: candidate.id,
    name: candidate.name || "Untitled sheet",
    webViewLink: candidate.webViewLink || null,
    modifiedTime: candidate.modifiedTime || null,
    modifiedByMeTime: candidate.modifiedByMeTime || null,
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
    const aTime = new Date(
      a?.modifiedByMeTime || a?.modifiedTime || 0,
    ).getTime();
    const bTime = new Date(
      b?.modifiedByMeTime || b?.modifiedTime || 0,
    ).getTime();
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

  return {
    valid,
    status: response.status,
    sampleHeaders: row.slice(0, 8),
    headerCount: row.length,
  };
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

    devLog("[provision-sheet] header check:", checkResult);

    if (headerInfo.valid) {
      validCandidates.push(candidate);
    }
  }

  devLog(
    `[provision-sheet] valid candidate count after header checks: ${validCandidates.length}`,
  );

  return validCandidates;
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

  const mode = req.body?.mode || "discover";
  const selectedSsid = req.body?.selectedSsid || null;
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

    // Default discovery mode
    debug.path.push("discover:start");
    const validCandidates = await discoverValidCandidates(headers, debug);

    if (validCandidates.length > 1) {
      debug.path.push("discover:multiple_candidates");
      res.status(200).json(
        withDebug(
          {
            needsSelection: true,
            candidates: validCandidates.map(toClientCandidate),
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
