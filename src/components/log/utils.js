import {
  extractYouTubeVideoId,
  getYouTubeThumbnailUrl,
} from "@/lib/video-thumbnails";

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
