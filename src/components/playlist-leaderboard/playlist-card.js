import { useState, useEffect } from "react";
import Image from "next/image";
import { PlaylistAdminTools } from "./playlist-admin";
import { getPlaylistPlatform } from "./playlist-utils";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowBigUp, ArrowBigDown, Music, ExternalLink, Heart } from "lucide-react";

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
  className,
}) {
  const inTimeout = isAdmin ? false : checkTimeout(votes, playlist.id);
  const userVote = votes[playlist.id]?.vote;
  const platform = getPlaylistPlatform(playlist.url);
  const [hasLogoError, setHasLogoError] = useState(false);
  const [hasThumbnailError, setHasThumbnailError] = useState(false);
  const showThumbnail = playlist.thumbnailUrl && !hasThumbnailError;

  useEffect(() => {
    setHasLogoError(false);
    setHasThumbnailError(false);
  }, [playlist.url]);

  const score = playlist.upVotes - playlist.downVotes;

  const VoteButton = ({ isUpvote = true, onClick, className: btnClassName }) => {
    const isUserVote =
      (isUpvote && userVote === "upVote") ||
      (!isUpvote && userVote === "downVote");
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
          btnClassName,
        )}
      >
        {isUpvote ? <ArrowBigUp className="h-6 w-6" /> : <ArrowBigDown className="h-6 w-6" />}
      </Button>
    );
  };

  return (
    <Card className={cn("flex flex-row gap-3 bg-muted/60 p-4", className)}>

      {/* Thumbnail with platform logo badge */}
      <a
        href={playlist.url}
        target="_blank"
        rel="noopener noreferrer"
        className="relative shrink-0 self-start"
      >
        {showThumbnail ? (
          <Image
            src={playlist.thumbnailUrl}
            alt={`${playlist.title} thumbnail`}
            width={96}
            height={96}
            unoptimized
            className="h-24 w-24 rounded-md object-cover"
            onError={() => setHasThumbnailError(true)}
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-md bg-muted">
            <Music className="h-8 w-8 text-muted-foreground/40" />
          </div>
        )}
        {/* Platform logo badge — secondary position, bottom-right of thumbnail */}
        {platform.logoUrl && !hasLogoError && (
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
        )}
      </a>

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

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>{platform.name}</span>
          <ExternalLink className="h-3 w-3 shrink-0" />
        </div>

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

        {isAdmin && (
          <PlaylistAdminTools
            playlist={playlist}
            onEdit={onEdit}
            onDelete={onDelete}
            onRefresh={onRefresh}
          />
        )}
      </div>

      {/* Vote column */}
      <div className="flex shrink-0 flex-col items-center gap-0.5">
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
        <VoteButton isUpvote={true} onClick={() => handleVote(playlist.id, true)} />
        <span className={cn(
          "cursor-default text-sm font-bold",
          score > 0 && "text-green-500",
          score === 0 && "text-muted-foreground",
        )}>
          {score}
        </span>
        <VoteButton isUpvote={false} onClick={() => handleVote(playlist.id, false)} />
      </div>

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
