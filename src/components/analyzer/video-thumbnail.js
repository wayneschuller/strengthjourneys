
import { useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";
import { getVideoThumbnailInfo } from "@/lib/video-thumbnails";
import { cn } from "@/lib/utils";

/**
 * Renders a clickable video thumbnail with a play button overlay. For YouTube URLs it fetches
 * the actual thumbnail image; for Google Photos and other links it shows a generic play placeholder.
 *
 * @param {Object} props
 * @param {string} props.url - Video URL (YouTube or Google Photos). Required; renders nothing if falsy.
 * @param {string} [props.className] - Additional Tailwind classes applied to the container div.
 * @param {function} [props.onClick] - Custom click handler. When omitted, opens the URL in a new tab.
 */
export function VideoThumbnail({ url, className, onClick }) {
  const [imageError, setImageError] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  if (!url) return null;

  const thumbnailInfo = getVideoThumbnailInfo(url);

  // Handle click - open video in new tab
  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onClick) {
      onClick();
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  // YouTube thumbnail
  if (thumbnailInfo.type === "youtube" && thumbnailInfo.thumbnailUrl) {
    const thumbnailUrl = useFallback
      ? thumbnailInfo.fallbackThumbnailUrl
      : thumbnailInfo.thumbnailUrl;

    return (
      <div
        className={cn(
          "relative aspect-video w-full cursor-pointer overflow-hidden rounded-lg bg-muted transition-all hover:scale-[1.02] hover:opacity-90",
          className,
        )}
        onClick={handleClick}
      >
        {thumbnailUrl ? (
          <>
            <Image
              src={thumbnailUrl}
              alt="Video thumbnail"
              fill
              className={cn(
                "object-cover transition-opacity",
                imageLoaded ? "opacity-100" : "opacity-0",
              )}
              onError={() => {
                if (!useFallback && thumbnailInfo.fallbackThumbnailUrl) {
                  setUseFallback(true);
                  setImageLoaded(false);
                } else {
                  setImageError(true);
                }
              }}
              onLoad={() => setImageLoaded(true)}
              unoptimized // YouTube thumbnails are external, no optimization needed
            />
            {!imageLoaded && !imageError && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            )}
            {/* Play button overlay */}
            {imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors hover:bg-black/30">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-lg transition-transform hover:scale-110">
                  <Play className="ml-1 h-8 w-8 fill-current" />
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center bg-muted">
            <div className="text-center">
              <Play className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">View Video</p>
            </div>
          </div>
        )}
        {imageError && (
          <div className="flex h-full items-center justify-center bg-muted">
            <div className="text-center">
              <Play className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">View Video</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Google Photos or unknown - show placeholder
  return (
    <div
      className={cn(
        "relative flex aspect-video w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-muted transition-all hover:scale-[1.02] hover:opacity-90",
        className,
      )}
      onClick={handleClick}
    >
      <div className="text-center">
        <Play className="mx-auto h-12 w-12 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">View Video</p>
      </div>
    </div>
  );
}

