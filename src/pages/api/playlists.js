import { kv } from "@vercel/kv";
import { devLog } from "@/lib/processing-utils";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { getServerSession } from "next-auth/next";
import { fetchPlaylists } from "@/lib/playlist-utils";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  const { method } = req;

  const adminEmails = process.env
    .NEXT_PUBLIC_STRENGTH_JOURNEYS_LEADERBOARD_ADMINS
    ? process.env.NEXT_PUBLIC_STRENGTH_JOURNEYS_LEADERBOARD_ADMINS.split(",")
    : [];

  const isAdmin = adminEmails.includes(session?.user?.email);

  switch (method) {
    case "GET":
      // GET logic for fetching all playlists or a specific playlist - any user can do
      try {
        const result = await fetchPlaylists();
        // devLog(result);
        res.status(200).json(result);
      } catch (error) {
        console.error("Error fetching playlist(s):", error);
        res.status(500).json({ error: "Error fetching playlist(s)" });
      }
      break;

    case "POST":
      // POST logic for creating a new playlist - any user can do
      try {
        const newPlaylist = req.body;
        if (!newPlaylist.id || !newPlaylist.title || !newPlaylist.url) {
          return res.status(400).json({ error: "Invalid playlist data" });
        }
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
      break;

    case "PUT":
      // PUT logic for editing a playlist - only for admins

      if (!isAdmin)
        return res
          .status(401)
          .json({ error: "Not authenticated - only admins can edit" });

      try {
        const updatedPlaylist = req.body;

        if (!updatedPlaylist || !updatedPlaylist.id) {
          return res
            .status(400)
            .json({ error: "Invalid playlist data or missing ID" });
        }

        // Check if the playlist exists
        const existingPlaylist = await kv.hget("playlists", updatedPlaylist.id);
        if (!existingPlaylist) {
          return res.status(404).json({ error: "Playlist not found" });
        }

        // Overwrite the playlist with the entire new object
        await kv.hset("playlists", {
          [updatedPlaylist.id]: JSON.stringify(updatedPlaylist),
        });

        res.status(200).json({
          message: "Playlist updated successfully",
          playlist: updatedPlaylist,
        });
      } catch (error) {
        console.error("Error updating playlist:", error);
        res
          .status(500)
          .json({ error: "Error updating playlist", details: error.message });
      }
      break;

    case "DELETE":
      // DELETE logic for removing a playlist - only for admins
      if (!isAdmin)
        return res
          .status(401)
          .json({ error: "Not authenticated - only admins can delete" });

      try {
        const { id } = req.query;
        const existingPlaylist = await kv.hget("playlists", id);
        if (!existingPlaylist) {
          return res.status(404).json({ error: "Playlist not found" });
        }
        await kv.hdel("playlists", id);
        res.status(200).json({ message: "Playlist deleted successfully" });
      } catch (error) {
        console.error("Error deleting playlist:", error);
        res.status(500).json({ error: "Error deleting playlist" });
      }
      break;

    default:
      res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}
