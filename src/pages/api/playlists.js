import { kv } from "@vercel/kv";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { getServerSession } from "next-auth/next";
import shortUUID from "short-uuid";
import {
  parseStoredPlaylist,
  validateAndProcessPlaylist,
  fetchPlaylistThumbnail,
} from "@/components/playlist-leaderboard/playlist-utils";
import {
  getRequestClientIp,
  isLeaderboardAdminEmail,
  isValidPlaylistId,
} from "@/lib/playlist-security";
import { RegExpMatcher, englishDataset } from "obscenity";

// Initialize obscenity matcher
const matcher = new RegExpMatcher({ ...englishDataset.build() });
const translator = shortUUID();

// Helper function to check for profanity
function containsProfanity(text) {
  return matcher.hasMatch(text);
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  const { method } = req;
  const isAdmin = isLeaderboardAdminEmail(session?.user?.email);

  switch (method) {
    case "GET":
      return res.status(400).json({ error: "Not available to the hoi polloi" });

    case "POST":
      // POST logic for creating a new playlist - any user can do
      const newPlaylist = req.body;
      const clientIp = getRequestClientIp(req);

      // IP throttle the hoi polloi
      if (!isAdmin && (await isThrottled(`playlist-create:${clientIp}`))) {
        return res
          .status(429)
          .json({ error: "Too many requests. Please try again later." });
      }

      try {
        // Validate and process the new playlist
        const { errors, validatedPlaylist } = validateAndProcessPlaylist(
          newPlaylist,
          true,
        );

        if (errors) {
          return res.status(400).json({ errors });
        }

        const thumbnailUrl = await fetchPlaylistThumbnail(validatedPlaylist.url);
        const playlistRecord = {
          ...validatedPlaylist,
          id: translator.generate(),
          timestamp: Date.now(),
          ...(thumbnailUrl && { thumbnailUrl }),
        };

        // Check for profanity in title and description
        if (
          containsProfanity(playlistRecord.title) ||
          containsProfanity(playlistRecord.description)
        ) {
          // Silently reject the submission without adding to the database
          console.log(
            `Profanity detected in new playlist submission. ID: ${playlistRecord.id} (IP: ${clientIp})`,
          );

          // Return a success response to the client
          return res.status(201).json({
            message: "Playlist added successfully",
            playlist: playlistRecord,
          });
        }

        // Normal case - good playlist gets added to the KV store.
        await kv.hset("playlists", {
          [playlistRecord.id]: JSON.stringify({
            ...playlistRecord,
            upVotes: 0,
            downVotes: 0,
          }),
        });
        await kv.hset(`playlists:${playlistRecord.id}`, {
          upVotes: 0,
          downVotes: 0,
        });
        res.status(201).json({
          message: "Playlist added successfully",
          playlist: {
            ...playlistRecord,
            upVotes: 0,
            downVotes: 0,
          },
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
        const rawId = typeof req.query.id === "string" ? req.query.id : null;
        if (!isValidPlaylistId(rawId)) {
          return res
            .status(400)
            .json({ error: "Invalid playlist data or missing ID" });
        }

        // Check if the playlist exists
        const existingPlaylist = parseStoredPlaylist(
          await kv.hget("playlists", rawId),
        );
        if (!existingPlaylist) {
          return res.status(404).json({ error: "Playlist not found" });
        }

        const { errors, validatedPlaylist } = validateAndProcessPlaylist(
          req.body,
          true,
        );
        if (errors) {
          return res.status(400).json({ errors });
        }

        const updatedPlaylist = {
          ...existingPlaylist,
          ...validatedPlaylist,
          id: existingPlaylist.id,
          timestamp: existingPlaylist.timestamp || Date.now(),
          upVotes: Number(existingPlaylist.upVotes) || 0,
          downVotes: Number(existingPlaylist.downVotes) || 0,
        };

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
        const rawId = req.query.id;
        const id = Array.isArray(rawId) ? rawId[0] : rawId;
        if (!isValidPlaylistId(id)) {
          return res.status(400).json({ error: "Missing or invalid playlist ID" });
        }

        const existingPlaylist = await kv.hget("playlists", id);
        if (!existingPlaylist) {
          return res.status(404).json({ error: "Playlist not found" });
        }
        await kv.hdel("playlists", id);
        await kv.del(`playlists:${id}`);
        res.status(200).json({ message: "Playlist deleted successfully" });
      } catch (error) {
        console.error("Error deleting playlist:", error);
        res.status(500).json({ error: "Error deleting playlist" });
      }
      break;

    case "PATCH":
      // PATCH logic for refreshing playlist metadata (thumbnail, etc.) - admin only
      if (!isAdmin)
        return res
          .status(401)
          .json({ error: "Not authenticated - only admins can refresh" });

      try {
        const rawId = typeof req.query.id === "string" ? req.query.id : null;
        if (!isValidPlaylistId(rawId)) {
          return res.status(400).json({ error: "Missing or invalid playlist ID" });
        }

        const existingPlaylist = parseStoredPlaylist(
          await kv.hget("playlists", rawId),
        );
        if (!existingPlaylist) {
          return res.status(404).json({ error: "Playlist not found" });
        }

        const thumbnailUrl = await fetchPlaylistThumbnail(existingPlaylist.url);
        const refreshedPlaylist = {
          ...existingPlaylist,
          ...(thumbnailUrl ? { thumbnailUrl } : {}),
        };

        await kv.hset("playlists", {
          [rawId]: JSON.stringify(refreshedPlaylist),
        });

        res.status(200).json({
          message: "Playlist metadata refreshed",
          playlist: refreshedPlaylist,
        });
      } catch (error) {
        console.error("Error refreshing playlist metadata:", error);
        res.status(500).json({ error: "Error refreshing playlist metadata" });
      }
      break;

    default:
      res.setHeader("Allow", ["GET", "POST", "PUT", "PATCH", "DELETE"]);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}

const THROTTLE_TIME = 10 * 60 * 1000; // 10 minutes in milliseconds

async function isThrottled(subject) {
  const result = await kv.set(`throttle:${subject}`, Date.now(), {
    ex: Math.floor(THROTTLE_TIME / 1000),
    nx: true,
  });
  return result === null;
}

