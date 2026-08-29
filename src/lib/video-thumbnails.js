/**
 * Utility functions for extracting video thumbnails from URLs
 * Supports YouTube and Google Photos links
 */

/**
 * Extract YouTube video ID from various URL formats
 * @param {string} url - YouTube URL in various formats
 * @returns {string|null} - Video ID or null if not a YouTube URL
 */
export function extractYouTubeVideoId(url) {
  if (!url || typeof url !== "string") return null;

  // Remove any query parameters and fragments
  const cleanUrl = url.split("#")[0].split("?")[0];

  // Pattern 1: youtube.com/watch?v=VIDEO_ID
  const watchMatch = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?#]+)/,
  );
  if (watchMatch && watchMatch[1]) {
    return watchMatch[1];
  }

  // Pattern 2: youtu.be/VIDEO_ID
  const shortMatch = url.match(/youtu\.be\/([^&\s?#]+)/);
  if (shortMatch && shortMatch[1]) {
    return shortMatch[1];
  }

  // Pattern 3: youtube.com/embed/VIDEO_ID
  const embedMatch = url.match(/youtube\.com\/embed\/([^&\s?#]+)/);
  if (embedMatch && embedMatch[1]) {
    return embedMatch[1];
  }

  return null;
}

/**
 * Generate YouTube thumbnail URL
 * @param {string} videoId - YouTube video ID
 * @param {string} quality - Thumbnail quality: 'maxresdefault' (highest), 'hqdefault', 'mqdefault', 'sddefault'
 * @returns {string} - Thumbnail URL
 */
export function getYouTubeThumbnailUrl(videoId, quality = "hqdefault") {
  if (!videoId) return null;
  return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
}

/**
 * Detect if URL is YouTube, Google Photos, or other
 * @param {string} url - URL to check
 * @returns {object} - { type: 'youtube'|'google-photos'|'unknown', thumbnailUrl: string|null, videoId: string|null }
 */
export function getVideoThumbnailInfo(url) {
  if (!url || typeof url !== "string") {
    return { type: "unknown", thumbnailUrl: null, videoId: null };
  }

  // Check for YouTube
  const youtubeVideoId = extractYouTubeVideoId(url);
  if (youtubeVideoId) {
    return {
      type: "youtube",
      thumbnailUrl: getYouTubeThumbnailUrl(youtubeVideoId, "maxresdefault"),
      fallbackThumbnailUrl: getYouTubeThumbnailUrl(youtubeVideoId, "hqdefault"),
      videoId: youtubeVideoId,
    };
  }

  // Check for Google Photos
  if (url.includes("photos.google.com") || url.includes("photos.app.goo.gl")) {
    return {
      type: "google-photos",
      thumbnailUrl: null, // Google Photos doesn't have public thumbnail API
      videoId: null,
    };
  }

  return { type: "unknown", thumbnailUrl: null, videoId: null };
}

// Known hosts get a proper name so the log can say where a clip actually
// lives, and a kind so the row can draw that service's own mark.
const VIDEO_SOURCES = [
  {
    kind: "youtube",
    name: "YouTube",
    match: (h) => h === "youtu.be" || h.endsWith("youtube.com"),
  },
  {
    kind: "google-photos",
    name: "Google Photos",
    match: (h) =>
      h.endsWith("photos.google.com") || h.endsWith("photos.app.goo.gl"),
  },
  {
    kind: "google-drive",
    name: "Google Drive",
    match: (h) => h.endsWith("drive.google.com"),
  },
  { kind: "icloud", name: "iCloud", match: (h) => h.endsWith("icloud.com") },
  { kind: "dropbox", name: "Dropbox", match: (h) => h.endsWith("dropbox.com") },
  { kind: "vimeo", name: "Vimeo", match: (h) => h.endsWith("vimeo.com") },
  {
    kind: "instagram",
    name: "Instagram",
    match: (h) => h.endsWith("instagram.com"),
  },
  { kind: "tiktok", name: "TikTok", match: (h) => h.endsWith("tiktok.com") },
  {
    kind: "facebook",
    name: "Facebook",
    match: (h) => h.endsWith("facebook.com") || h.endsWith("fb.watch"),
  },
];

/**
 * Identify the destination behind a stored video link, so a set row can show
 * that service's own mark rather than a generic play button. Hosts we do not
 * recognise still return their hostname, which is enough for the row to fall
 * back to the site's favicon, and a readable name for the tooltip.
 * @param {string} url - The stored set URL.
 * @returns {{kind: string, name: string|null, host: string}|null} Destination descriptor, or null when the value is not a usable http(s) link.
 */
export function getVideoSourceMeta(url) {
  if (!url || typeof url !== "string") return null;

  let parsed;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (!host) return null;

  const known = VIDEO_SOURCES.find(({ match }) => match(host));
  if (known) return { kind: known.kind, name: known.name, host };

  // e.g. clips.example.com -> "Example", which reads better in a tooltip than
  // the full hostname. Anything odd stays nameless and the tooltip goes
  // generic rather than saying something wrong.
  const labels = host.split(".");
  const stem = labels.length > 1 ? labels[labels.length - 2] : labels[0];
  const name = /^[a-z0-9-]{2,16}$/.test(stem)
    ? stem.charAt(0).toUpperCase() + stem.slice(1)
    : null;

  return { kind: "other", name, host };
}
