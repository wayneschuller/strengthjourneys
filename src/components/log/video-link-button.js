/**
 * The link out to a set's video clip.
 *
 * One control, wherever a filmed set appears: the destination's own mark in a
 * round hover target, captioned with where the clip actually lives. A generic
 * play triangle would be a smaller promise — it says a video exists, while the
 * mark says "this is on your Photos" or "this is the YouTube one", which is
 * what someone deciding whether to click wants to know.
 *
 * Sizes are fixed rather than free-form so the small one keeps its place in the
 * log's vertical rail of marks and the large one can carry a headline.
 */

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { VideoSourceIcon } from "@/components/log/video-source-icon";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: { button: "h-8 w-8", icon: "h-[18px] w-[18px]" },
  lg: { button: "h-12 w-12", icon: "h-7 w-7" },
};

/**
 * @param {Object} props
 * @param {string} props.url - The video link as logged.
 * @param {{kind: string, host: string, name?: string}|null} props.source - Result of getVideoSourceMeta().
 * @param {"sm"|"lg"} [props.size="sm"] - Rail-sized, or headline-sized.
 * @param {string} [props.fallbackLabel] - Caption when the host has no known name.
 * @param {string} [props.className] - Spacing from the caller's layout only.
 */
export function VideoLinkButton({
  url,
  source,
  size = "sm",
  fallbackLabel = "Open the video link",
  className,
}) {
  if (!url || !source) return null;

  const tooltip = source.name ? `Watch on ${source.name}` : fallbackLabel;
  const { button, icon } = SIZES[size] ?? SIZES.sm;

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "hover:bg-muted focus-visible:ring-ring inline-flex shrink-0 items-center justify-center rounded-full opacity-85 transition hover:opacity-100 focus-visible:ring-2 focus-visible:outline-none",
              button,
              className,
            )}
            aria-label={`${tooltip} (opens in a new tab)`}
          >
            <VideoSourceIcon source={source} className={icon} />
          </a>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{tooltip} — opens in a new tab</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
