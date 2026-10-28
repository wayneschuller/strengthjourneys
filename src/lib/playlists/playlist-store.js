/**
 * Reads the gym playlist leaderboard out of KV.
 *
 * SERVER ONLY: import this from API routes or getStaticProps, never from a
 * component. It imports the KV client, and the bundler ships that to the
 * browser for any page or component that imports the file, where `new Redis()`
 * runs with no credentials and warns in the console. fetchPlaylists lived in
 * components/playlist-leaderboard/playlist-utils.js until Oct 2026, and
 * because the leaderboard components import that file for its constants and
 * URL helpers, the page shipped Upstash and a buffer polyfill (~34 KB gzipped).
 * Next drops this import from the page's browser code because only
 * getStaticProps uses it.
 */

import { kv } from "@/lib/kv";
import { parseStoredPlaylist } from "@/components/playlist-leaderboard/playlist-utils";

// Fetch playlists and merge in separate vote data along the way.
// Abstracted to use in both api route and also in ISR getStaticProps build step
export async function fetchPlaylists() {
  try {
    const playlists = (await kv.hgetall("playlists")) || {};
    const reportCounts = (await kv.hgetall("playlist-reports")) || {};

    const playlistsWithVotes = await Promise.all(
      Object.entries(playlists).map(async ([id, storedPlaylist]) => {
        const playlist = parseStoredPlaylist(storedPlaylist);
        const votes = await kv.hmget(`playlists:${id}`, "upVotes", "downVotes");
        const upVotes = parseInt(votes?.upVotes) || 0;
        const downVotes = parseInt(votes?.downVotes) || 0;

        // Cover art only reaches the public page once it is approved. Records written before
        // image moderation existed have no status and stay grandfathered in — the admin
        // banner's sweep is how those get a real verdict.
        const thumbnailStatus = playlist.thumbnailUrl
          ? playlist.thumbnailStatus || "legacy"
          : null;
        const isArtPublic =
          thumbnailStatus === "approved" || thumbnailStatus === "legacy";

        return {
          ...playlist,
          thumbnailUrl: isArtPublic ? playlist.thumbnailUrl : null,
          thumbnailStatus,
          upVotes: upVotes,
          downVotes: downVotes,
          reportCount: parseInt(reportCounts[id]) || 0,
        };
      }),
    );

    return playlistsWithVotes;
  } catch (error) {
    console.error("Error fetching playlist(s):", error);
    throw new Error("Error fetching playlist(s)");
  }
}
