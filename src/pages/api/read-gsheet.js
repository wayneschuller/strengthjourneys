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

  // Build URL immediately since it only depends on ssid (synchronous)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${ssid}/values/A:Z?dateTimeRenderOption=FORMATTED_STRING`;

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

  try {
    // Fetch from Google Sheets API
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    });

    const data = await response.json();

    // devLog(response);

    if (response.statusText !== "OK") {
      throw new Error(
        `Non-OK response from Google API: ${response.statusText} (${response.status}) (token: ${session.accessToken}).`,
      );
    }

    res.status(200).json(data);
  } catch (error) {
    console.log(error);

    // FIXME: If Google gives 404 propagate to client. All other errors will be sent back to client as 400.
    res.status(400).json({ error: error.message });
  }
}
