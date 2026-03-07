import { kv } from "@vercel/kv";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { parseStoredPlaylist } from "@/components/playlist-leaderboard/playlist-utils";
import { getRequestClientIp, isValidPlaylistId, isLeaderboardAdminEmail } from "@/lib/playlist-security";

const VOTE_THROTTLE_SECONDS = 10 * 60;

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  const { id, voteType } = req.body || {};

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  if (!isValidPlaylistId(id) || !voteType) {
    return res.status(400).json({ message: "Missing required parameters" });
  }

  try {
    let field;

    if (voteType === "upVote") {
      field = "upVotes";
    } else if (voteType === "downVote") {
      field = "downVotes";
    } else {
      return res.status(400).json({ message: "Invalid voteType parameter" });
    }

    const existingPlaylist = parseStoredPlaylist(await kv.hget("playlists", id));
    if (!existingPlaylist) {
      return res.status(404).json({ message: "Playlist not found" });
    }

    const isAdmin = isLeaderboardAdminEmail(session?.user?.email);

    if (!isAdmin) {
      const voteSubject =
        session?.user?.email?.trim().toLowerCase() || getRequestClientIp(req);
      const voteLock = await kv.set(`playlist-vote:${voteSubject}:${id}`, Date.now(), {
        ex: VOTE_THROTTLE_SECONDS,
        nx: true,
      });

      if (voteLock === null) {
        return res.status(429).json({
          message: "Vote already recorded recently. Please try again later.",
        });
      }
    }

    // Update the votes count in Redis
    const newVotes = await kv.hincrby(`playlists:${id}`, field, 1);

    res.status(200).json({ id, [field]: newVotes });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
}

