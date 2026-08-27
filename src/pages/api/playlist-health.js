import { kv } from "@/lib/kv";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { parseStoredPlaylist } from "@/components/playlist-leaderboard/playlist-utils";
import {
  isLeaderboardAdminEmail,
  moderateThumbnail,
  thumbnailStatusFromVerdict,
} from "@/lib/playlist-security";
import { checkPlaylistLink } from "@/lib/playlist-link-health";
import { notifyPlaylistModeration } from "@/lib/playlist-moderation-mail";

/*
 * Scheduled health sweep: re-checks every playlist link and re-moderates every cover image.
 *
 * Runnable two ways — by Vercel Cron with the CRON_SECRET bearer token, or by a signed-in admin
 * from the leaderboard banner.
 *
 * A link is only marked broken after CONSECUTIVE_FAILURES_TO_BREAK checks in a row have said so.
 * Platforms rate-limit and throw interstitials at server-side fetches, and a single bad reading
 * should never take a working playlist off the board.
 */

const CONSECUTIVE_FAILURES_TO_BREAK = 3;

function isAuthorisedCron(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.authorization === `Bearer ${secret}`;
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  const isAdmin = isLeaderboardAdminEmail(session?.user?.email);

  if (!isAdmin && !isAuthorisedCron(req)) {
    return res.status(401).json({ error: "Not authorised" });
  }

  const summary = {
    checked: 0,
    live: 0,
    unreachable: 0,
    unknown: 0,
    newlyBroken: 0,
    recovered: 0,
    artRechecked: 0,
    artBlocked: 0,
  };

  try {
    const stored = (await kv.hgetall("playlists")) || {};

    for (const [id, entry] of Object.entries(stored)) {
      const playlist = parseStoredPlaylist(entry);
      if (!playlist?.url) continue;

      summary.checked += 1;
      const result = await checkPlaylistLink(playlist.url);
      summary[result.status] += 1;

      const previousFailures = playlist.linkFailureCount || 0;
      const failureCount =
        result.status === "unreachable" ? previousFailures + 1 : 0;
      const linkStatus =
        failureCount >= CONSECUTIVE_FAILURES_TO_BREAK ? "broken" : "ok";

      if (linkStatus === "broken" && playlist.linkStatus !== "broken") {
        summary.newlyBroken += 1;
      }
      if (playlist.linkStatus === "broken" && linkStatus === "ok") {
        summary.recovered += 1;
      }

      const updated = {
        ...playlist,
        id,
        linkStatus,
        linkFailureCount: failureCount,
        linkCheckedAt: Date.now(),
        linkDetail: result.detail,
      };

      // Cover art is editable on the source platform after we approve it, so the sweep is also
      // where a swapped-out image gets caught.
      if (playlist.thumbnailUrl) {
        const verdict = await moderateThumbnail(playlist.thumbnailUrl);
        const status = thumbnailStatusFromVerdict(verdict);
        summary.artRechecked += 1;

        if (status === "rejected") {
          summary.artBlocked += 1;
          if (playlist.thumbnailStatus !== "rejected") {
            await notifyPlaylistModeration({
              event: "image-rejected",
              playlist: updated,
              detail: verdict.reason || "flagged during health sweep",
              source: "scheduled health sweep",
              imageUrl: playlist.thumbnailUrl,
            });
          }
        }

        // Never quietly downgrade art an admin approved by hand just because a check timed out.
        if (status !== "pending" || playlist.thumbnailStatus !== "approved") {
          updated.thumbnailStatus = status;
        }
      }

      await kv.hset("playlists", { [id]: JSON.stringify(updated) });
    }

    try {
      await res.revalidate("/gym-playlist-leaderboard");
    } catch (error) {
      console.error("Revalidation after health sweep failed:", error);
    }

    console.log("Playlist health sweep:", JSON.stringify(summary));
    return res.status(200).json({ message: "Health sweep complete", summary });
  } catch (error) {
    console.error("Playlist health sweep failed:", error);
    return res.status(500).json({ error: "Health sweep failed", summary });
  }
}
