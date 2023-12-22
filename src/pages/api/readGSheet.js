// Next.js API route support: https://nextjs.org/docs/api-routes/introduction

import { authOptions } from "@/pages/api/auth/[...nextauth].js";
import { getServerSession } from "next-auth/next";
import { devLog } from "@/lib/processing-utils";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    res.status(401).json({ error: "You must be logged in." });
    return;
  }

  // I think when you use nextauth in offline mode you lose backend access to the token in the session
  // When we had nextauth use google provider in online mode then the backend had the token without being passed in the query
  // So what we are doing now is leaky, we are meant to use a database backend for the tokens server side.
  const { ssid, token } = req.query;

  // Check that query has ssid parameter - should not happen ever.
  // Fortunately doesn't happen often.
  if (!ssid || ssid === "null") {
    res.status(400).json({ error: "Missing ssid parameter" });
    return;
  }

  // I used to pass the API key here but it doesn't require it as long as we have a good oauth access token
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${ssid}/values/A%3AZ?dateTimeRenderOption=FORMATTED_STRING`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
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
