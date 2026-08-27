import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { getVoteWeightInfo } from "@/lib/playlist-security";
import { MAX_VOTE_WEIGHT } from "@/lib/rewards/vote-weight";

/*
 * The leaderboard has weighted voting — anonymous visitors count 1x, and a signed-in lifter with
 * a long-linked sheet counts up to 11x. None of that was visible anywhere, which made the
 * "sign in for extra weight" copy an unsupported claim. This tells the page what to say.
 */

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    const ssid = typeof req.query.ssid === "string" ? req.query.ssid : undefined;
    const info = await getVoteWeightInfo(session, ssid);

    // Cache per-user, briefly: training volume moves on the scale of days, not requests.
    res.setHeader("Cache-Control", "private, max-age=300");

    return res.status(200).json({ ...info, maxWeight: MAX_VOTE_WEIGHT });
  } catch (error) {
    console.error("Error resolving vote weight:", error);
    return res
      .status(200)
      .json({ weight: 1, label: "Anonymous", blurb: "", signedIn: false });
  }
}
