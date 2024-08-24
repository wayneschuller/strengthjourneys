import { kv } from "@vercel/kv";
import { devLog } from "@/lib/processing-utils";

export default async function handler(req, res) {
  if (req.method === "GET") {
    try {
      // Fetch all playlists from the Redis hash
      const playlists = await kv.hgetall("playlists");

      res.status(200).json(playlists);
    } catch (error) {
      console.error("Error fetching playlists:", error);
      res.status(500).json({ error: "Error fetching playlists" });
    }
  } else if (req.method === "POST") {
    try {
      const newPlaylist = req.body;

      // Validate the new playlist data
      if (!newPlaylist.id || !newPlaylist.title) {
        return res.status(400).json({ error: "Invalid playlist data" });
      }

      // Add the new playlist to the Redis hash
      await kv.hset("playlists", {
        [newPlaylist.id]: JSON.stringify(newPlaylist),
      });

      res.status(201).json({
        message: "Playlist added successfully",
        playlist: newPlaylist,
      });
    } catch (error) {
      console.error("Error adding new playlist:", error);
      res.status(500).json({ error: "Error adding new playlist" });
    }
  } else {
    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
