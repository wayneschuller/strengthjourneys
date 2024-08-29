import { kv } from "@vercel/kv";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { getServerSession } from "next-auth/next";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  const { method } = req;
  const { id } = req.query; // Playlist ID from the dynamic route
  const { action } = req.body; // 'upvote' or 'downvote'

  // Check if user is authenticated
  if (!session) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${method} Not Allowed`);
  }

  if (action !== "upvote" && action !== "downvote") {
    return res
      .status(400)
      .json({ error: "Invalid action. Use 'upvote' or 'downvote'." });
  }

  try {
    // Check if the playlist exists
    const playlist = await kv.hget("playlists", id);
    if (!playlist) {
      return res.status(404).json({ error: "Playlist not found" });
    }

    // Increment or decrement the votes field based on the action
    const voteChange = action === "upvote" ? 1 : -1;
    const newVotes = await kv.hincrby(`playlists:${id}`, "votes", voteChange);

    // Return the updated vote count
    res.status(200).json({ id, votes: newVotes });
  } catch (error) {
    console.error("Error processing vote:", error);
    res.status(500).json({ error: "Error processing vote" });
  }
}
