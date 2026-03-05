import { getServerSession } from "next-auth/next";
import { kv } from "@vercel/kv";
import { authOptions, promptDeveloper } from "@/pages/api/auth/[...nextauth]";

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

  try {
    const existingRecord = (await kv.get(kvKey)) || {};
    const existingSsid = existingRecord?.provisionedSheetId;

    if (existingSsid) {
      const metadata = await fetchDriveMetadata(existingSsid, headers);
      if (metadata?.id) {
        await kv.set(kvKey, {
          ...existingRecord,
          lastSeenAt: nowIso,
        });
        res.status(200).json({
          ssid: metadata.id,
          name: metadata.name || sheetName,
          webViewLink: metadata.webViewLink || null,
          modifiedTime: metadata.modifiedTime || null,
          modifiedByMeTime: metadata.modifiedByMeTime || null,
          wasCreated: false,
        });
        return;
      }
    }

    let created = null;
    let provisioningMethod = "template_copy";
    try {
      created = await copyTemplate(sheetName, headers);
    } catch {
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
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Provisioning failed" });
  }
}
