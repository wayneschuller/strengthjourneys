// Next.js API route support: https://nextjs.org/docs/api-routes/introduction

import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { getServerSession } from "next-auth/next";
import { devLog } from "@/lib/processing-utils";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    res.status(401).json({ error: "You must be logged in." });
    return;
  }

  const { ssid } = req.query;

  // res.status(400).json({ error: "Fake failure for testing purposes" });

  // Check that query has ssid parameter - should not happen ever.
  // Fortunately doesn't happen often.
  if (!ssid || ssid === "null") {
    res.status(400).json({ error: "Missing ssid parameter" });
    return;
  }

  if (!session.accessToken) {
    res.status(400).json({ error: "Auth missing accessToken" });
    return;
  }

  // No API key required here - everything is authorized via temporary oauth token unique to user
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${ssid}/values/A:Z?dateTimeRenderOption=FORMATTED_STRING`;

  try {
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

    //FIXME: If Google gives 404 we propogate to client. All other errors will be sent back to client as 400.
    res.status(400).json({ error: error.message });
  }
}
