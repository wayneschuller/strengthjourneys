import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  getPlaylistEmbed,
  PlaylistEmbed,
} from "@/components/playlist-leaderboard/playlist-embed";
import { RANK_STYLES, scoreColor } from "@/components/playlist-leaderboard/playlist-card";
import { getPlaylistPlatform } from "@/components/playlist-leaderboard/playlist-utils";
import {
  ArrowBigUp,
  ArrowBigDown,
  Crown,
  Heart,
  Music,
  Play,
  Pause,
} from "lucide-react";

// Left-to-right display order for a classic podium: silver, gold, bronze.
const PODIUM_ORDER = [2, 1, 3];

/**
 * One podium tile: big square cover art with the medal, an inline play toggle and compact voting.
 * @param {Object} props
 * @param {Object} props.playlist - The playlist being shown.
 * @param {number} props.rank - 1, 2 or 3.
 */
function PodiumTile({
  playlist,
  rank,
  votes,
  handleVote,
  isAdmin,
  onSave,
  isSaved,
  isPlaying,
  onTogglePlay,
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
    <div className="flex flex-col gap-2">
      <ArtTag
        {...artProps}
        className={cn(
          "group relative block aspect-square w-full overflow-hidden rounded-xl ring-2 ring-offset-2 ring-offset-background transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-ring",
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
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <Music className="h-8 w-8 text-muted-foreground/40" />
          </div>
        )}

        {/* Medal */}
        <span
          className={cn(
            "absolute left-1.5 top-1.5 flex h-6 items-center gap-1 rounded-full px-2 text-xs font-black shadow-sm",
            style.badge,
          )}
        >
          {rank === 1 && <Crown className="h-3 w-3 fill-current" />}
          {rank}
        </span>

        {/* Play affordance */}
        {embed && (
          <span
            data-playing={isPlaying}
            className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 data-[playing=true]:opacity-100"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-black shadow-lg transition-transform group-hover:scale-110">
              {isPlaying ? (
                <Pause className="h-5 w-5 fill-current" />
              ) : (
                <Play className="ml-0.5 h-5 w-5 fill-current" />
              )}
            </span>
          </span>
        )}
      </ArtTag>

      <div className="min-w-0 text-center">
        <a
          href={playlist.url}
          target="_blank"
          rel="noopener noreferrer"
          className="line-clamp-2 text-xs font-semibold leading-snug hover:underline sm:text-sm"
        >
          {playlist.title}
        </a>
        <p className="truncate text-[11px] text-muted-foreground">
          {platform.name}
        </p>
      </div>

      {/* Compact vote row */}
      <div className="flex items-center justify-center gap-0.5">
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
        <span className={cn("min-w-6 text-center text-sm font-bold tabular-nums", scoreColor(score))}>
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
          aria-label={isSaved ? `Unsave ${playlist.title}` : `Save ${playlist.title}`}
          title={isSaved ? "Unsave playlist" : "Save for later"}
          className="h-7 w-7"
        >
          <Heart className={cn("h-4 w-4", isSaved && "fill-yellow-400 text-yellow-400")} />
        </Button>
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
}) {
  const prefersReducedMotion = useReducedMotion();

  if (!playlists || playlists.length < 3) return null;

  const podiumPlaying = playlists.find((playlist) => playlist.id === playingId);
  const podiumEmbed = podiumPlaying ? getPlaylistEmbed(podiumPlaying.url) : null;

  return (
    <div className="mb-8">
      <div className="grid grid-cols-[1fr_1.25fr_1fr] items-end gap-3 sm:gap-5">
        {PODIUM_ORDER.map((rank) => {
          const playlist = playlists[rank - 1];
          return (
            <PodiumTile
              key={playlist.id}
              playlist={playlist}
              rank={rank}
              votes={votes}
              handleVote={handleVote}
              isAdmin={isAdmin}
              onSave={onSave}
              isSaved={savedPlaylists.includes(playlist.id)}
              isPlaying={playingId === playlist.id}
              onTogglePlay={onTogglePlay}
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
            exit={prefersReducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.25, ease: "easeOut" }}
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
