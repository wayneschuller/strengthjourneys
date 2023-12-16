// Next.js API route support: https://nextjs.org/docs/api-routes/introduction

import { authOptions } from "@/pages/api/auth/[...nextauth].js";
import { getServerSession } from "next-auth/next";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    res.status(401).json({ error: "You must be logged in." });
    return;
  }

  const { ssid } = req.query;

  // Check that query has ssid parameter - should not happen ever.
  // Fortunately doesn't happen often.
  if (!ssid || ssid === "null") {
    res.status(400).json({ error: "Missing ssid parameter" });
    return;
  }

  // I used to pass the API key here but it doesn't require it as long as we have a good oauth token via nextauth session
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${ssid}/values/A%3AZ?dateTimeRenderOption=FORMATTED_STRING`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(
        `HTTP error in readGSheet API! Status: ${response.status}`,
      );
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error("/api/readGSheet API Error:");
    console.log(error);
    res.status(400).json({ error: error.message });
  }
}
