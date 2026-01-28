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
  const watchMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?#]+)/);
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

