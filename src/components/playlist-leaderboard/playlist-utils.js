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
export async function fetchPlaylists() {
  try {
    const playlists = (await kv.hgetall("playlists")) || {};

    const playlistsWithVotes = await Promise.all(
      Object.entries(playlists).map(async ([id, storedPlaylist]) => {
        const playlist = parseStoredPlaylist(storedPlaylist);
        const votes = await kv.hmget(
          `playlists:${id}`,
          "upVotes",
          "downVotes",
        );
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

export const PLAYLIST_CATEGORIES = [
  "rock",
  "pop",
  "hip-hop",
  "electronic",
  "r&b",
  "metal",
  "house",
  "upbeat",
  "intense",
  "chill",
  "motivational",
  "cardio",
  "strength",
  "warm-up",
  "retro",
  "podcast",
  "weird",
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

export function getPlaylistPlatform(url) {
  const fallback = {
    name: "Music Platform",
    logoUrl: null,
  };

  try {
    const hostname = new URL(url).hostname.toLowerCase();

    if (hostname.includes("spotify.com")) {
      return {
        name: "Spotify",
        logoUrl: "https://open.spotifycdn.com/cdn/images/favicon32.b64ecc03.png",
      };
    }

    if (hostname.includes("music.youtube.com")) {
      return {
        name: "YouTube Music",
        logoUrl: "https://music.youtube.com/favicon.ico",
      };
    }

    if (hostname === "youtube.com" || hostname.endsWith(".youtube.com")) {
      return {
        name: "YouTube",
        logoUrl: "https://www.youtube.com/favicon.ico",
      };
    }

    if (hostname.includes("music.apple.com")) {
      return {
        name: "Apple Music",
        logoUrl: "https://music.apple.com/favicon.ico",
      };
    }

    if (hostname.includes("soundcloud.com")) {
      return {
        name: "SoundCloud",
        logoUrl: "https://soundcloud.com/favicon.ico",
      };
    }

    if (hostname.includes("tidal.com")) {
      return {
        name: "TIDAL",
        logoUrl: "https://tidal.com/favicon.ico",
      };
    }

    return {
      name: hostname.replace(/^www\./, ""),
      logoUrl: `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`,
    };
  } catch {
    return fallback;
  }
}

export function sanitizeText(text, isServer = false) {
  const value = typeof text === "string" ? text.trim() : "";

  if (isServer) {
    // Simple server-side sanitization
    return value.replace(/[<>&'"]/g, (char) => {
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
    return DOMPurify.sanitize(value, { ALLOWED_TAGS: [] });
  }
}

export function validateAndProcessPlaylist(playlistData, isServer = false) {
  const errors = [];

  const rawTitle =
    typeof playlistData?.title === "string" ? playlistData.title : "";
  const rawDescription =
    typeof playlistData?.description === "string" ? playlistData.description : "";
  const rawUrl = typeof playlistData?.url === "string" ? playlistData.url : "";

  if (!rawTitle || !rawDescription || !rawUrl) {
    errors.push("Missing required fields");
  }

  if (rawTitle.length > 120) {
    errors.push("Title must be 120 characters or fewer");
  }

  if (rawDescription.length > 500) {
    errors.push("Description must be 500 characters or fewer");
  }

  if (!validateUrl(rawUrl)) {
    errors.push("Invalid URL");
  }

  const normalizedUrl = sanitizeAndNormalizeUrl(rawUrl);

  if (!isWhitelistedUrl(normalizedUrl)) {
    errors.push("URL is not from an approved music streaming platform");
  }

  const categoryValues = Array.isArray(playlistData?.categories)
    ? playlistData.categories
    : [];
  const normalizedCategories = [...new Set(categoryValues)]
    .filter((category) => typeof category === "string")
    .map((category) => category.trim().toLowerCase())
    .filter(Boolean);

  if (normalizedCategories.length === 0) {
    errors.push("Select at least one category");
  }

  if (normalizedCategories.length > 5) {
    errors.push("Select no more than 5 categories");
  }

  if (
    normalizedCategories.some(
      (category) => !PLAYLIST_CATEGORIES.includes(category),
    )
  ) {
    errors.push("One or more categories are invalid");
  }

  const sanitizedTitle = sanitizeText(rawTitle, isServer);
  const sanitizedDescription = sanitizeText(rawDescription, isServer);

  if (errors.length > 0) {
    return { errors };
  }

  return {
    validatedPlaylist: {
      title: sanitizedTitle,
      description: sanitizedDescription,
      url: normalizedUrl,
      categories: normalizedCategories,
    },
  };
}

const OEMBED_ENDPOINTS = {
  "spotify.com": (url) =>
    `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`,
  "youtube.com": (url) =>
    `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
  "youtu.be": (url) =>
    `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
  "soundcloud.com": (url) =>
    `https://soundcloud.com/oembed?url=${encodeURIComponent(url)}&format=json`,
};

export async function fetchPlaylistOembedData(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    const match = Object.keys(OEMBED_ENDPOINTS).find((domain) =>
      hostname.endsWith(domain),
    );
    if (!match) return null;

    const oembedUrl = OEMBED_ENDPOINTS[match](url);
    const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;

    const data = await res.json();
    return {
      thumbnailUrl: data.thumbnail_url || null,
      title: data.title || null,
    };
  } catch {
    return null;
  }
}

export function parseStoredPlaylist(playlist) {
  if (!playlist) return null;
  if (typeof playlist === "string") {
    try {
      return JSON.parse(playlist);
    } catch {
      console.error("Failed to parse stored playlist JSON");
      return null;
    }
  }
  return playlist;
}
