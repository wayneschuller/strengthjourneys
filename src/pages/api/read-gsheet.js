// Next.js API route support: https://nextjs.org/docs/api-routes/introduction

import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { getServerSession } from "next-auth/next";
import { devLog } from "@/lib/processing-utils";

export default async function handler(req, res) {
  // Start session fetch immediately
  const sessionPromise = getServerSession(req, res, authOptions);

  // Extract ssid from query immediately (synchronous operation)
  const { ssid } = req.query;

  // Validate ssid early (before waiting for session)
  if (!ssid || ssid === "null") {
    res.status(400).json({ error: "Missing ssid parameter" });
    return;
  }

  // Now await session (we've done all synchronous work first)
  const session = await sessionPromise;

  if (!session) {
    res.status(401).json({ error: "You must be logged in." });
    return;
  }

  if (!session.accessToken) {
    res.status(400).json({ error: "Auth missing accessToken" });
    return;
  }

  const headers = {
    Authorization: `Bearer ${session.accessToken}`,
  };

  try {
    const t0 = Date.now();
    const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${ssid}/values/A:Z?dateTimeRenderOption=FORMATTED_STRING`;
    const driveUrl = `https://www.googleapis.com/drive/v3/files/${ssid}?fields=name,webViewLink,modifiedTime,modifiedByMeTime`;

    let sheetsMs = null;
    let driveMs = null;

    const sheetsPromise = fetch(sheetsUrl, { method: "GET", headers }).then(
      (res) => {
        sheetsMs = Date.now() - t0;
        return res;
      },
    );
    const drivePromise = fetch(driveUrl, { method: "GET", headers }).then(
      (res) => {
        driveMs = Date.now() - t0;
        return res;
      },
    );

    const [sheetsRes, driveRes] = await Promise.all([
      sheetsPromise,
      drivePromise,
    ]);

    const totalMs = Date.now() - t0;

    if (driveMs !== null && sheetsMs !== null && driveMs > sheetsMs) {
      devLog(
        `read-gsheet ANOMALY: Drive slower than Sheets (sheets=${sheetsMs}ms, drive=${driveMs}ms, total=${totalMs}ms) - Drive metadata must not be the bottleneck; investigate Drive slowness.`,
      );
    }

    const data = await sheetsRes.json();

    if (!sheetsRes.ok) {
      throw new Error(
        `Non-OK response from Google Sheets API: ${sheetsRes.statusText} (${sheetsRes.status})`,
      );
    }

    if (driveRes.ok) {
      const driveData = await driveRes.json();
      Object.assign(data, {
        name: driveData.name,
        webViewLink: driveData.webViewLink,
        modifiedTime: driveData.modifiedTime,
        modifiedByMeTime: driveData.modifiedByMeTime,
      });
    }

    res.status(200).json(data);
  } catch (error) {
    console.log(error);

    // FIXME: If Google gives 404 propagate to client. All other errors will be sent back to client as 400.
    res.status(400).json({ error: error.message });
  }
}
