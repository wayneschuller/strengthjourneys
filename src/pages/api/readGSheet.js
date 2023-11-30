// Next.js API route support: https://nextjs.org/docs/api-routes/introduction

import { authOptions } from "@/pages/api/auth/[...nextauth].js";
import { getServerSession } from "next-auth/next";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    res.status(401).json({ error: "You must be logged in." });
    return;
  }

  // console.log(`serverside...`);
  // console.log(session);

  const { ssid } = req.query;

  // console.log(`/api/readGSheet ssid: ${ssid}`);

  // Check that query has ssid parameter - should not happen ever.
  // Fortunately doesn't happen often.
  if (!ssid || ssid === "null") {
    // FIXME:  this return point is not being triggered and we keep passing null ssid to google
    // console.log(`ssid null check happening`);
    res.status(400).json({ error: "Missing ssid parameter" });
    return;
  }

  const googleAPIKey = process.env.REACT_APP_GOOGLE_API_KEY;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${ssid}/values/A%3AZ?dateTimeRenderOption=FORMATTED_STRING&key=${googleAPIKey}`;

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
    // Handle the data as needed
    res.status(200).json(data);
  } catch (error) {
    console.error("/api/readGSheet API Error:");
    console.log(error);
    res.status(500).json({ error: error.message });
  }
}
