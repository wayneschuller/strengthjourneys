import { kv } from "@vercel/kv";
import { devLog } from "@/lib/processing-utils";
import validator from "validator";
import { sanitizeUrl } from "@braintree/sanitize-url";
import normalizeUrl from "normalize-url";

// Only import DOMPurify in client-side environment
let DOMPurify;
if (typeof window !== "undefined") {
  DOMPurify = require("dompurify");
}

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
// Whitelist of acceptable music sites

export const WHITELISTED_SITES = [
  "spotify.com", // Leading music streaming platform
  "music.apple.com", // Apple Music service
  "music.youtube.com", // YouTube Music
  "youtube.com", // YouTube platform
  "soundcloud.com", // Independent music sharing
  "tidal.com", // High-fidelity music streaming
  "deezer.com", // Music streaming service
  "pandora.com", // Internet radio and music streaming
  "mixcloud.com", // DJ mixes and radio shows
  "bandcamp.com", // Independent artists' platform
  "audiomack.com", // Free music streaming for artists
  "reverbnation.com", // Music promotion and sharing
  "napster.com", // Online music streaming service
  "last.fm", // Music discovery and streaming
  "iheartradio.com", // Streaming radio and custom playlists
  "boomplay.com", // African music streaming service
];

// Shared functions for playlist validation and sanitization

export function validateUrl(url) {
  return validator.isURL(url, {
    protocols: ["https"],
    require_protocol: true,
  });
}

export function sanitizeAndNormalizeUrl(url) {
  const sanitizedUrl = sanitizeUrl(url);
  return normalizeUrl(sanitizedUrl, {
    defaultProtocol: "https:",
    stripAuthentication: true,
    stripWWW: true,
  });
}

export function isWhitelistedUrl(url) {
  try {
    const hostname = new URL(url).hostname;
    return WHITELISTED_SITES.some((site) => hostname.endsWith(site));
  } catch {
    return false;
  }
}

export function sanitizeText(text, isServer = false) {
  if (isServer) {
    // Simple server-side sanitization
    return text.replace(/[<>&'"]/g, (char) => {
      switch (char) {
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case "&":
          return "&amp;";
        case "'":
          return "&#39;";
        case '"':
          return "&quot;";
        default:
          return char;
      }
    });
  } else {
    // Client-side sanitization using DOMPurify
    return DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
  }
}

export function validateAndProcessPlaylist(playlistData, isServer = false) {
  const errors = [];

  if (!playlistData.title || !playlistData.description || !playlistData.url) {
    errors.push("Missing required fields");
  }

  if (!validateUrl(playlistData.url)) {
    errors.push("Invalid URL");
  }

  const normalizedUrl = sanitizeAndNormalizeUrl(playlistData.url);

  if (!isWhitelistedUrl(normalizedUrl)) {
    errors.push("URL is not from an approved music streaming platform");
  }

  const sanitizedTitle = sanitizeText(playlistData.title, isServer);
  const sanitizedDescription = sanitizeText(playlistData.description, isServer);

  if (errors.length > 0) {
    return { errors };
  }

  return {
    validatedPlaylist: {
      ...playlistData,
      title: sanitizedTitle,
      description: sanitizedDescription,
      url: normalizedUrl,
    },
  };
}
