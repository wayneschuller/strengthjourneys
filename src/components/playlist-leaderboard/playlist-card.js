import { useState, useEffect } from "react";
import Image from "next/image";
import { PlaylistAdminMenu } from "@/components/playlist-leaderboard/playlist-admin";
import { getPlaylistPlatform } from "@/components/playlist-leaderboard/playlist-utils";
import {
  getPlaylistEmbed,
  PlaylistEmbed,
} from "@/components/playlist-leaderboard/playlist-embed";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowBigUp,
  ArrowBigDown,
  Music,
  ExternalLink,
  Heart,
  Play,
  Pause,
  Flag,
} from "lucide-react";

// Medal treatment for the top three. Deliberately literal colours rather than theme tokens —
// gold/silver/bronze need to read the same in every one of the app's themes.
export const RANK_STYLES = {
  1: {
    text: "text-amber-400",
    ring: "ring-amber-400/70",
    badge: "bg-amber-400 text-black",
    label: "Gold",
  },
  2: {
    text: "text-slate-300",
    ring: "ring-slate-300/70",
    badge: "bg-slate-300 text-black",
    label: "Silver",
  },
  3: {
    text: "text-amber-700",
    ring: "ring-amber-700/70",
    badge: "bg-amber-700 text-white",
    label: "Bronze",
  },
};

export function scoreColor(score) {
  if (score > 0) return "text-green-500";
  if (score < 0) return "text-red-500";
  return "text-muted-foreground";
}

/**
 * Blurred artwork bloom sitting behind a card or tile. Purely decorative — it gives each
 * playlist a colour identity borrowed from its own cover art.
 * @param {Object} props
 * @param {string} props.src - Thumbnail URL to blur.
 */
export function ArtworkBloom({ src, className }) {
  if (!src) return null;

  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 -z-10", className)}
    >
      <Image
        src={src}
        alt=""
        fill
        unoptimized
        sizes="600px"
        className="scale-125 object-cover opacity-20 blur-2xl saturate-150 dark:opacity-30"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-card/50 via-card/70 to-card/85" />
    </div>
  );
}

/**
 * A single up/down vote arrow. Hoisted out of PlaylistCard so it isn't redeclared each render.
 * @param {Object} props
 * @param {boolean} props.isUpvote - Renders the up arrow when true, the down arrow when false.
 * @param {boolean} props.isUserVote - Highlights the arrow the visitor already pressed.
 * @param {boolean} props.inTimeout - Disables the button during the ten minute vote cooldown.
 */
function VoteButton({ isUpvote = true, isUserVote, inTimeout, onClick, className }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={inTimeout}
      onClick={onClick}
      aria-label={isUpvote ? "Upvote" : "Downvote"}
      title={isUpvote ? "Love this!" : "Doesn't vibe"}
      className={cn(
        "transition-all",
        isUserVote && "bg-primary/20 hover:bg-primary/30",
        inTimeout && "opacity-50",
        className,
      )}
    >
      {isUpvote ? <ArrowBigUp className="h-6 w-6" /> : <ArrowBigDown className="h-6 w-6" />}
    </Button>
  );
}

export function PlaylistCard({
  playlist,
  votes,
  handleVote,
  isAdmin,
  onDelete,
  onEdit,
  onRefresh,
  onSave,
  isSaved,
  rank,
  isPlaying,
  onTogglePlay,
  onReport,
  isReported,
  onReviewArt,
  className,
}) {
  const inTimeout = isAdmin ? false : checkTimeout(votes, playlist.id);
  const userVote = votes[playlist.id]?.vote;
  const platform = getPlaylistPlatform(playlist.url);
  const [hasLogoError, setHasLogoError] = useState(false);
  const [hasThumbnailError, setHasThumbnailError] = useState(false);
  const showThumbnail = playlist.thumbnailUrl && !hasThumbnailError;
  const embed = getPlaylistEmbed(playlist.url);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    setHasLogoError(false);
    setHasThumbnailError(false);
  }, [playlist.url]);

  const score = playlist.upVotes - playlist.downVotes;
  const rankStyle = RANK_STYLES[rank];

  const artwork = showThumbnail ? (
    <Image
      src={playlist.thumbnailUrl}
      alt={`${playlist.title} thumbnail`}
      width={112}
      height={112}
      unoptimized
      className="h-24 w-24 rounded-md object-cover md:h-28 md:w-28"
      onError={() => setHasThumbnailError(true)}
    />
  ) : (
    <div className="flex h-24 w-24 items-center justify-center rounded-md bg-muted md:h-28 md:w-28">
      <Music className="h-8 w-8 text-muted-foreground/40" />
    </div>
  );

  const platformBadge = platform.logoUrl && !hasLogoError && (
    <div className="absolute -bottom-1.5 -right-1.5 rounded-full border bg-background p-0.5 shadow-sm">
      <Image
        src={platform.logoUrl}
        alt={platform.name}
        width={16}
        height={16}
        unoptimized
        className="h-4 w-4 rounded-sm"
        onError={() => setHasLogoError(true)}
      />
    </div>
  );

  return (
    <Card
      className={cn(
        "relative isolate flex flex-col gap-3 overflow-hidden bg-muted/60 p-4 transition-shadow hover:shadow-md",
        className,
      )}
    >
      <ArtworkBloom src={showThumbnail ? playlist.thumbnailUrl : null} />

      <div className="flex flex-row gap-3">
        {/* Rank numeral — only rendered on the ranked (Top) tab */}
        {rank ? (
          <div
            className={cn(
              "w-5 shrink-0 self-start pt-1 text-center text-2xl font-black leading-none tabular-nums md:w-7 md:text-3xl",
              rankStyle ? rankStyle.text : "text-muted-foreground/30",
            )}
            aria-label={`Rank ${rank}`}
          >
            {rank}
          </div>
        ) : null}

        {/* Artwork — plays inline where we can frame the platform, otherwise links out */}
        {embed ? (
          <button
            type="button"
            onClick={() => onTogglePlay?.(playlist.id)}
            aria-label={isPlaying ? `Close ${playlist.title} player` : `Play ${playlist.title}`}
            title={isPlaying ? "Close player" : "Play here"}
            className="group relative shrink-0 self-start rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {artwork}
            <span className="absolute inset-0 flex items-center justify-center rounded-md bg-black/35 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 data-[playing=true]:opacity-100" data-playing={isPlaying}>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-black shadow-lg transition-transform group-hover:scale-110">
                {isPlaying ? (
                  <Pause className="h-4 w-4 fill-current" />
                ) : (
                  <Play className="ml-0.5 h-4 w-4 fill-current" />
                )}
              </span>
            </span>
            {platformBadge}
          </button>
        ) : (
          <a
            href={playlist.url}
            target="_blank"
            rel="noopener noreferrer"
            className="relative shrink-0 self-start"
          >
            {artwork}
            {platformBadge}
          </a>
        )}

        {/* Main content */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <a
            href={playlist.url}
            target="_blank"
            rel="noopener noreferrer"
            className="line-clamp-2 font-semibold leading-snug hover:underline"
          >
            {playlist.title}
          </a>

          <a
            href={playlist.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <span>{platform.name}</span>
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>

          <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
            {playlist.description}
          </p>

          {/* Category badges */}
          <div className="mt-auto flex flex-wrap gap-1 pt-3">
            {playlist?.categories?.map((category) => (
              <Badge
                key={`playlist_${category}`}
                variant="secondary"
                className="cursor-default rounded-full px-2 text-xs"
              >
                {category}
              </Badge>
            ))}
          </div>

        </div>

        {/* Vote column */}
        <div className="flex shrink-0 flex-col items-center gap-0.5">
          {isAdmin && (
            <PlaylistAdminMenu
              playlist={playlist}
              onEdit={onEdit}
              onDelete={onDelete}
              onRefresh={onRefresh}
              onReviewArt={onReviewArt}
            />
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSave(playlist.id)}
            title={isSaved ? "Unsave playlist" : "Save for later"}
            className="flex items-center gap-1 text-xs text-muted-foreground"
          >
            <Heart className={cn("h-4 w-4", isSaved && "fill-yellow-400 text-yellow-400")} />
            <span className="hidden md:inline">{isSaved ? "Saved" : "Save"}</span>
          </Button>
          <VoteButton
            isUpvote={true}
            isUserVote={userVote === "upVote"}
            inTimeout={inTimeout}
            onClick={() => handleVote(playlist.id, true)}
          />
          <span className={cn("cursor-default text-sm font-bold tabular-nums", scoreColor(score))}>
            {score}
          </span>
          <VoteButton
            isUpvote={false}
            isUserVote={userVote === "downVote"}
            inTimeout={inTimeout}
            onClick={() => handleVote(playlist.id, false)}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onReport(playlist)}
            disabled={isReported}
            aria-label={isReported ? "Already reported" : "Report this playlist"}
            title={
              isReported
                ? "You've reported this — thanks, we're on it"
                : "Report this playlist"
            }
            className={cn(
              "mt-1 h-6 w-6 text-muted-foreground/50 hover:text-destructive",
              isReported && "text-destructive opacity-70",
            )}
          >
            <Flag className={cn("h-3.5 w-3.5", isReported && "fill-current")} />
          </Button>
        </div>
      </div>

      {/* Inline player */}
      <AnimatePresence initial={false}>
        {isPlaying && embed && (
          <motion.div
            key="player"
            initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <PlaylistEmbed embed={embed} title={playlist.title} />
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// Helper function to see if we are in the 10 minute timeout
function checkTimeout(clientVotes, id) {
  const TEN_MINUTES_IN_MS = 10 * 60 * 1000;
  const vote = clientVotes[id];
  if (!vote || !vote.timestamp) {
    return false;
  }

  const currentTime = Date.now();
  return currentTime - vote.timestamp < TEN_MINUTES_IN_MS;
}
