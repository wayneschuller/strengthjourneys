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

  // I used to pass the API key here but it doesn't require it as long as we have a good oauth access token
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${ssid}/values/A%3AZ?dateTimeRenderOption=FORMATTED_STRING`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    });

    const data = await response.json();

    devLog(response);

    if (response.statusText !== "OK") {
      throw new Error(
        `Non-OK reponse during readGSheet API. Status: ${resonse.statusText} (${response.status}) (ssid: ${ssid})`,
      );
    }

    res.status(200).json(data);
  } catch (error) {
    const date = new Date().toLocaleString();

    console.error(`/api/readGSheet API Error: Time is: ${date}...`);
    console.log(error);

    res.status(400).json({ error: error.message });
  }
}
