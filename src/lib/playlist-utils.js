import { kv } from "@vercel/kv";
import { devLog } from "@/lib/processing-utils";

// Fetch playlists and merge in separate vote data along the way.
// Abstracted to use in both api route and also in ISR getStaticProps build step
export async function fetchPlaylists(id = null) {
  try {
    if (id) {
      // Fetch a specific playlist - we don't use this FIXME DELETE path?
      // FIXME: needs to incorporate the votes
      const playlist = await kv.hget("playlists", id);
      if (!playlist) {
        throw new Error("Playlist not found");
      }
      return JSON.parse(playlist);
    } else {
      // Fetch all playlists
      console.log(`Getting kvstore data for getStaticProps`);
      const playlists = await kv.hgetall("playlists");

      // Map through all the playlists and add in the upvotes/downvotes
      const playlistsWithVotes = await Promise.all(
        Object.entries(playlists).map(async ([id, playlist]) => {
          const votes = await kv.hmget(
            `playlists:${id}`,
            "upVotes",
            "downVotes",
          );
          // devLog(votes);
          // If kv.hmget returns null, initialize counts to 0
          const upVotes = parseInt(votes?.upVotes) || 0;
          const downVotes = parseInt(votes?.downVotes) || 0;

          return {
            ...playlist,
            upVotes: upVotes,
            downVotes: downVotes,
          };
        }),
      );

      return playlistsWithVotes;
    }
  } catch (error) {
    console.error("Error fetching playlist(s):", error);
    throw new Error("Error fetching playlist(s)");
  }
}
