import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { getVoteWeight } from "@/lib/playlist-security";

/*
 * The leaderboard has weighted voting — anonymous visitors count 1x, and a signed-in lifter with
 * a long-linked sheet counts up to 11x. None of that was visible anywhere, which made the
 * "sign in for extra weight" copy an unsupported claim. This tells the page what to say.
 */

const TIERS = [
  { weight: 1, label: "Anonymous", blurb: "Sign in with Google to vote with more weight." },
  { weight: 3, label: "Signed in", blurb: "Link a Google Sheet of your lifts to count for more." },
  { weight: 5, label: "Lifter", blurb: "Keep training — your weight grows with your history." },
  { weight: 8, label: "Veteran", blurb: "Six months of logged lifting behind your vote." },
  { weight: 11, label: "Iron veteran", blurb: "A year of logged lifting. Top voting weight." },
];

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    const weight = await getVoteWeight(session?.user?.email);
    const tier = TIERS.find((entry) => entry.weight === weight) || TIERS[0];

    // Cache per-user, briefly: tenure changes on the scale of days, not requests.
    res.setHeader("Cache-Control", "private, max-age=300");

    return res.status(200).json({
      weight,
      label: tier.label,
      blurb: tier.blurb,
      isTopTier: weight === 11,
      signedIn: Boolean(session?.user?.email),
    });
  } catch (error) {
    console.error("Error resolving vote weight:", error);
    return res.status(200).json({ weight: 1, label: "Anonymous", blurb: "", signedIn: false });
  }
}
