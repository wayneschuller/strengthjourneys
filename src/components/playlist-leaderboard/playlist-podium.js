import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  getPlaylistEmbed,
  PlaylistEmbed,
} from "@/components/playlist-leaderboard/playlist-embed";
import {
  RANK_STYLES,
  scoreColor,
} from "@/components/playlist-leaderboard/playlist-card";
import { getPlaylistPlatform } from "@/components/playlist-leaderboard/playlist-utils";
import { PlaylistAdminMenu } from "@/components/playlist-leaderboard/playlist-admin";
import {
  ArrowBigUp,
  ArrowBigDown,
  Crown,
  Flag,
  Heart,
  Music,
  Play,
  Pause,
} from "lucide-react";

// Stacked in rank order on mobile; CSS reorders to silver-gold-bronze once there are
// three columns to play with.
const PODIUM_RANKS = [1, 2, 3];

const DESKTOP_ORDER = {
  1: "sm:order-2",
  2: "sm:order-1",
  3: "sm:order-3",
};

/**
 * One podium tile: big square cover art with the medal, an inline play toggle and compact voting.
 * @param {Object} props
 * @param {Object} props.playlist - The playlist being shown.
 * @param {number} props.rank - 1, 2 or 3.
 */
function PodiumTile({
  playlist,
  rank,
  isFirst,
  votes,
  handleVote,
  isAdmin,
  onSave,
  isSaved,
  isPlaying,
  onTogglePlay,
  onReport,
  isReported,
  onReviewArt,
  onEdit,
  onDelete,
  onRefresh,
}) {
  const [hasThumbnailError, setHasThumbnailError] = useState(false);
  const showThumbnail = playlist.thumbnailUrl && !hasThumbnailError;
  const embed = getPlaylistEmbed(playlist.url);
  const platform = getPlaylistPlatform(playlist.url);
  const style = RANK_STYLES[rank];
  const score = playlist.upVotes - playlist.downVotes;
  const inTimeout = isAdmin ? false : checkPodiumTimeout(votes, playlist.id);
  const userVote = votes[playlist.id]?.vote;

  const ArtTag = embed ? "button" : "a";
  const artProps = embed
    ? {
        type: "button",
        onClick: () => onTogglePlay(playlist.id),
        "aria-label": isPlaying
          ? `Close ${playlist.title} player`
          : `Play ${playlist.title}`,
        title: isPlaying ? "Close player" : "Play here",
      }
    : {
        href: playlist.url,
        target: "_blank",
        rel: "noopener noreferrer",
      };

  return (
    <div
      className={cn(
        // Single column on mobile: the winner keeps a full-width square, the runners-up
        // drop to compact rows so the podium doesn't eat three screens of scroll.
        "relative flex min-w-0 gap-3 sm:flex-col sm:gap-2",
        isFirst && "flex-col",
        DESKTOP_ORDER[rank],
      )}
    >
      <ArtTag
        {...artProps}
        className={cn(
          "group ring-offset-background focus-visible:ring-ring relative block aspect-square shrink-0 overflow-hidden rounded-xl ring-2 ring-offset-2 transition-transform hover:scale-[1.02] focus-visible:outline-none sm:w-full",
          isFirst ? "w-full" : "w-24",
          style.ring,
        )}
      >
        {showThumbnail ? (
          <Image
            src={playlist.thumbnailUrl}
            alt={`${playlist.title} cover art`}
            fill
            unoptimized
            sizes="(min-width: 768px) 320px, 33vw"
            className="object-cover"
            onError={() => setHasThumbnailError(true)}
          />
        ) : (
          <div className="bg-muted flex h-full w-full items-center justify-center">
            <Music className="text-muted-foreground/40 h-8 w-8" />
          </div>
        )}

        {/* Medal */}
        <span
          className={cn(
            "absolute top-1.5 left-1.5 flex h-6 items-center gap-1 rounded-full px-2 text-xs font-black shadow-sm",
            style.badge,
          )}
        >
          {isFirst && <Crown className="h-3 w-3 fill-current" />}
          {rank}
        </span>

        {/* Play affordance */}
        {embed && (
          <span
            data-playing={isPlaying}
            className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 data-[playing=true]:opacity-100"
          >
            <span
              className={cn(
                "flex items-center justify-center rounded-full bg-white/95 text-black shadow-lg transition-transform group-hover:scale-110",
                isFirst ? "h-11 w-11" : "h-9 w-9 sm:h-11 sm:w-11",
              )}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5 fill-current" />
              ) : (
                <Play className="ml-0.5 h-5 w-5 fill-current" />
              )}
            </span>
          </span>
        )}
      </ArtTag>

      {isAdmin && (
        <div className="absolute right-1 top-1 rounded-full bg-background/80 backdrop-blur-sm">
          <PlaylistAdminMenu
            playlist={playlist}
            onEdit={onEdit}
            onDelete={onDelete}
            onRefresh={onRefresh}
            onReviewArt={onReviewArt}
          />
        </div>
      )}

      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col justify-center gap-1 sm:block sm:flex-none",
          isFirst ? "text-center" : "text-left sm:text-center",
        )}
      >
        <a
          href={playlist.url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "line-clamp-2 leading-snug font-semibold hover:underline sm:text-sm",
            isFirst ? "text-sm" : "text-sm sm:text-sm",
          )}
        >
          {playlist.title}
        </a>
        <p className="text-muted-foreground truncate text-[11px]">
          {platform.name}
        </p>

        {/* Compact vote row — travels with the text beside a runner-up tile */}
        <div
          className={cn(
            "flex items-center gap-0.5 sm:justify-center sm:pt-1",
            isFirst ? "justify-center" : "justify-start",
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            disabled={inTimeout}
            onClick={() => handleVote(playlist.id, true)}
            aria-label={`Upvote ${playlist.title}`}
            title="Love this!"
            className={cn(
              "h-7 w-7",
              userVote === "upVote" && "bg-primary/20 hover:bg-primary/30",
              inTimeout && "opacity-50",
            )}
          >
            <ArrowBigUp className="h-4 w-4" />
          </Button>
          <span
            className={cn(
              "min-w-6 text-center text-sm font-bold tabular-nums",
              scoreColor(score),
            )}
          >
            {score}
          </span>
          <Button
            variant="ghost"
            size="icon"
            disabled={inTimeout}
            onClick={() => handleVote(playlist.id, false)}
            aria-label={`Downvote ${playlist.title}`}
            title="Doesn't vibe"
            className={cn(
              "h-7 w-7",
              userVote === "downVote" && "bg-primary/20 hover:bg-primary/30",
              inTimeout && "opacity-50",
            )}
          >
            <ArrowBigDown className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onSave(playlist.id)}
            aria-label={
              isSaved ? `Unsave ${playlist.title}` : `Save ${playlist.title}`
            }
            title={isSaved ? "Unsave playlist" : "Save for later"}
            className="h-7 w-7"
          >
            <Heart
              className={cn(
                "h-4 w-4",
                isSaved && "fill-yellow-400 text-yellow-400",
              )}
            />
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * The top three playlists, shown as a medal podium above the ranked list.
 * Only rendered on page one of the Top tab, where the ranking actually means something.
 * @param {Object} props
 * @param {Array} props.playlists - Exactly the first three playlists of the current sort/filter.
 * @param {string|null} props.playingId - Id of the playlist whose inline player is open, if any.
 */
export function PlaylistPodium({
  playlists,
  votes,
  handleVote,
  isAdmin,
  onSave,
  savedPlaylists,
  playingId,
  onTogglePlay,
  onReport,
  reportedPlaylists,
  onReviewArt,
  onEdit,
  onDelete,
  onRefresh,
}) {
  const prefersReducedMotion = useReducedMotion();

  if (!playlists || playlists.length < 3) return null;

  const podiumPlaying = playlists.find((playlist) => playlist.id === playingId);
  const podiumEmbed = podiumPlaying
    ? getPlaylistEmbed(podiumPlaying.url)
    : null;

  return (
    <div className="mb-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1.25fr_1fr] sm:items-end sm:gap-5">
        {PODIUM_RANKS.map((rank) => {
          const playlist = playlists[rank - 1];
          return (
            <PodiumTile
              key={playlist.id}
              playlist={playlist}
              rank={rank}
              isFirst={rank === 1}
              votes={votes}
              handleVote={handleVote}
              isAdmin={isAdmin}
              onSave={onSave}
              isSaved={savedPlaylists.includes(playlist.id)}
              isPlaying={playingId === playlist.id}
              onTogglePlay={onTogglePlay}
              onReport={onReport}
              isReported={reportedPlaylists.includes(playlist.id)}
              onReviewArt={onReviewArt}
              onEdit={onEdit}
              onDelete={onDelete}
              onRefresh={onRefresh}
            />
          );
        })}
      </div>

      <AnimatePresence initial={false}>
        {podiumPlaying && podiumEmbed && (
          <motion.div
            key={podiumPlaying.id}
            initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={
              prefersReducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }
            }
            transition={{
              duration: prefersReducedMotion ? 0 : 0.25,
              ease: "easeOut",
            }}
            className="overflow-hidden"
          >
            <div className="pt-4">
              <PlaylistEmbed embed={podiumEmbed} title={podiumPlaying.title} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Same ten minute client-side vote cooldown the cards use.
function checkPodiumTimeout(clientVotes, id) {
  const TEN_MINUTES_IN_MS = 10 * 60 * 1000;
  const vote = clientVotes[id];
  if (!vote || !vote.timestamp) return false;
  return Date.now() - vote.timestamp < TEN_MINUTES_IN_MS;
}
