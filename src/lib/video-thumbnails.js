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
// lives. Keyed by hostname suffix, matched after stripping "www.".
const VIDEO_SOURCE_NAMES = [
  {
    match: (h) => h === "youtu.be" || h.endsWith("youtube.com"),
    label: "YouTube",
    name: "YouTube",
  },
  {
    match: (h) =>
      h.endsWith("photos.google.com") || h.endsWith("photos.app.goo.gl"),
    label: "Photos",
    name: "Google Photos",
  },
  {
    match: (h) => h.endsWith("drive.google.com"),
    label: "Drive",
    name: "Google Drive",
  },
  { match: (h) => h.endsWith("icloud.com"), label: "iCloud", name: "iCloud" },
  {
    match: (h) => h.endsWith("dropbox.com"),
    label: "Dropbox",
    name: "Dropbox",
  },
  { match: (h) => h.endsWith("vimeo.com"), label: "Vimeo", name: "Vimeo" },
  {
    match: (h) => h.endsWith("instagram.com"),
    label: "Instagram",
    name: "Instagram",
  },
  { match: (h) => h.endsWith("tiktok.com"), label: "TikTok", name: "TikTok" },
  {
    match: (h) => h.endsWith("facebook.com") || h.endsWith("fb.watch"),
    label: "Facebook",
    name: "Facebook",
  },
];

/**
 * Name the destination behind a stored video link, so a lifter can tell at a
 * glance whether a set's clip is on YouTube, in their own Google Photos, or
 * somewhere else entirely. Unknown hosts fall back to their own domain name
 * where that reads cleanly, and to a plain "Video" where it does not.
 * @param {string} url - The stored set URL.
 * @returns {{label: string, tooltip: string}|null} Short chip label and its tooltip sentence, or null when the value is not a usable http(s) link.
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
  const known = VIDEO_SOURCE_NAMES.find(({ match }) => match(host));
  if (known) return { label: known.label, tooltip: `Watch on ${known.name}` };

  // e.g. clips.example.com -> "Example". Anything long or unsplittable stays
  // generic rather than stretching the chip across the row.
  const labels = host.split(".");
  const stem = labels.length > 1 ? labels[labels.length - 2] : labels[0];
  if (stem && /^[a-z0-9-]{2,12}$/.test(stem)) {
    const pretty = stem.charAt(0).toUpperCase() + stem.slice(1);
    return { label: pretty, tooltip: `Watch on ${pretty}` };
  }

  return { label: "Video", tooltip: "Open the video link" };
}
