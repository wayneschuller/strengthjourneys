import { kv } from "@/lib/kv";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { parseStoredPlaylist } from "@/components/playlist-leaderboard/playlist-utils";
import {
  isLeaderboardAdminEmail,
  isValidPlaylistId,
  moderateThumbnail,
  thumbnailStatusFromVerdict,
} from "@/lib/playlist-security";

/*
 * Admin-only cover art moderation.
 *
 * The public page never receives unapproved art, so this route is the only way to look at it.
 * Everything here is gated on the admin email allow-list.
 */

async function revalidateLeaderboard(res) {
  try {
    await res.revalidate("/gym-playlist-leaderboard");
  } catch (error) {
    console.error("Revalidation after art moderation failed:", error);
  }
}

async function writeStatus(id, playlist, status) {
  const updated = { ...playlist, id, thumbnailStatus: status };
  await kv.hset("playlists", { [id]: JSON.stringify(updated) });
  return updated;
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);

  if (!isLeaderboardAdminEmail(session?.user?.email)) {
    return res.status(401).json({ error: "Admins only" });
  }

  if (req.method === "GET") {
    const rawId = typeof req.query.id === "string" ? req.query.id : null;
    if (!isValidPlaylistId(rawId)) {
      return res.status(400).json({ error: "Invalid playlist id" });
    }

    const playlist = parseStoredPlaylist(await kv.hget("playlists", rawId));
    if (!playlist) {
      return res.status(404).json({ error: "Playlist not found" });
    }

    return res.status(200).json({
      id: rawId,
      title: playlist.title,
      url: playlist.url,
      thumbnailUrl: playlist.thumbnailUrl || null,
      thumbnailStatus: playlist.thumbnailUrl
        ? playlist.thumbnailStatus || "legacy"
        : null,
    });
  }

  if (req.method === "POST") {
    const { id, action } = req.body || {};

    if (action !== "approve" && action !== "reject" && action !== "recheck") {
      return res.status(400).json({ error: "Invalid action" });
    }

    if (!isValidPlaylistId(id)) {
      return res.status(400).json({ error: "Invalid playlist id" });
    }

    try {
      const playlist = parseStoredPlaylist(await kv.hget("playlists", id));
      if (!playlist) {
        return res.status(404).json({ error: "Playlist not found" });
      }

      if (!playlist.thumbnailUrl) {
        return res.status(400).json({ error: "This playlist has no cover art" });
      }

      let status;
      let verdictReason = null;

      if (action === "recheck") {
        const verdict = await moderateThumbnail(playlist.thumbnailUrl);
        status = thumbnailStatusFromVerdict(verdict);
        verdictReason = verdict.reason;
      } else {
        status = action === "approve" ? "approved" : "rejected";
      }

      const updated = await writeStatus(id, playlist, status);
      await revalidateLeaderboard(res);

      console.log(
        `Cover art ${action} by ${session.user.email} for playlist ${id} -> ${status}${verdictReason ? ` (${verdictReason})` : ""}`,
      );

      return res.status(200).json({
        message: `Cover art ${status}`,
        playlist: {
          ...updated,
          // Mirror the public shape so the page state stays honest after an admin action.
          thumbnailUrl: status === "approved" ? updated.thumbnailUrl : null,
          thumbnailStatus: status,
        },
      });
    } catch (error) {
      console.error("Error moderating playlist art:", error);
      return res.status(500).json({ error: "Could not update cover art" });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Method Not Allowed" });
}
