/**
 * Shared log utilities for anchor IDs, video previews, and barbell defaults.
 * Keep bar-weight decisions here so suggestions, draft rows, and sheet writes
 * do not drift apart when athlete bio or warm-up preferences change.
 */

import {
  extractYouTubeVideoId,
  getYouTubeThumbnailUrl,
} from "@/lib/video-thumbnails";

export function getDefaultLogBarWeight({ isMetric, sex, storedBarType }) {
  const usesWomensBar =
    storedBarType === "womens" || (!storedBarType && sex === "female");

  if (isMetric) return usesWomensBar ? 15 : 20;
  return usesWomensBar ? 35 : 45;
}

export function getLiftAnchorId(liftType) {
  if (typeof liftType !== "string") return "lift";
  return `lift-${liftType.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

export function getYouTubeWatchHref(videoUrl) {
  if (typeof videoUrl !== "string") return null;
  const embedPrefix = "https://www.youtube.com/embed/";
  if (videoUrl.startsWith(embedPrefix)) {
    return `https://www.youtube.com/watch?v=${videoUrl.slice(embedPrefix.length)}`;
  }
  return videoUrl;
}

export function getYouTubeThumbnailSrc(videoUrl) {
  const videoId = extractYouTubeVideoId(videoUrl);
  return videoId ? getYouTubeThumbnailUrl(videoId, "hqdefault") : null;
}
