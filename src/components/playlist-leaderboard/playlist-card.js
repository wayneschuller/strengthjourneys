import { useState, useEffect } from "react";
import Image from "next/image";
import { PlaylistAdminTools } from "./playlist-admin";
import { getPlaylistPlatform } from "./playlist-utils";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  ArrowBigUp,
  ArrowBigDown,
  Music,
  ExternalLink,
  Heart,
} from "lucide-react";

/**
 * Upvotable info card displaying details about a gym music playlist, including title, URL, description, category badges, and vote controls.
 * Enforces a 10-minute cooldown between votes and shows admin edit/delete tools when isAdmin is true.
 * @param {Object} props
 * @param {Object} props.playlist - The playlist data object (id, title, url, description, categories, upVotes, downVotes).
 * @param {Object} props.votes - Map of playlist IDs to the user's local vote state ({ vote, timestamp }).
 * @param {Function} props.handleVote - Callback invoked with (playlistId, isUpvote) when a vote button is clicked.
 * @param {boolean} props.isAdmin - When true, renders admin edit and delete tools below the card content.
 * @param {Function} props.onDelete - Callback invoked with the playlist ID when the admin delete button is clicked.
 * @param {Function} props.onEdit - Callback invoked with the playlist object when the admin edit button is clicked.
 * @param {Function} props.onSave - Callback invoked with the playlist ID when the save/unsave heart button is clicked.
 * @param {boolean} props.isSaved - Whether the playlist is currently saved by the user; controls the filled/unfilled heart icon.
 * @param {string} [props.className] - Additional CSS classes applied to the root Card element.
 */
export function PlaylistCard({
  playlist,
  votes,
  handleVote,
  isAdmin,
  onDelete,
  onEdit,
  onSave,
  isSaved,
  className, // We put this at the top level div last, so the parent can override defaults
}) {
  const inTimeout = isAdmin ? false : checkTimeout(votes, playlist.id);
  const userVote = votes[playlist.id]?.vote;
  const platform = getPlaylistPlatform(playlist.url);
  const [hasLogoError, setHasLogoError] = useState(false);

  useEffect(() => {
    setHasLogoError(false);
  }, [playlist.url]);

  // Internal up/down vote button with active-state highlighting and disabled state during cooldown.
  const VoteButton = ({ isUpvote = true, onClick, className }) => {
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
          "relative transition-all",
          isUserVote && "bg-primary/20 hover:bg-primary/30",
          inTimeout && "opacity-50",
          className, // Here it is - so parent can override
        )}
      >
        {isUpvote ? (
          <ArrowBigUp className="h-6 w-6" />
        ) : (
          <ArrowBigDown className="h-6 w-6" />
        )}
      </Button>
    );
  };

  return (
    <Card
      className={cn("flex flex-col gap-2 bg-muted/60 md:flex-row", className)}
    >
      <div className="flex-1">
        <CardHeader className="">
          <CardTitle className="">
            <div className="flex flex-row items-center gap-2 font-semibold">
              {platform.logoUrl && !hasLogoError ? (
                <Image
                  src={platform.logoUrl}
                  alt={`${platform.name} logo`}
                  width={20}
                  height={20}
                  unoptimized
                  className="h-5 w-5 rounded-sm object-cover"
                  onError={() => setHasLogoError(true)}
                />
              ) : (
                <Music className="h-5 w-5 text-primary" />
              )}
              <a
                href={playlist.url}
                target="_blank"
                rel="noopener noreferrer"
                className="line-clamp-2 text-balance text-lg hover:underline"
              >
                {playlist.title}
              </a>
              <Badge variant="secondary" className="ml-1 hidden sm:inline-flex">
                {platform.name}
              </Badge>
            </div>
          </CardTitle>
          <CardDescription className="flex flex-row items-center gap-1">
            <a
              href={playlist.url}
              target="_blank"
              rel="noopener noreferrer"
              className="line-clamp-1 break-all text-sm text-muted-foreground hover:underline"
            >
              {playlist.url}
            </a>
            <ExternalLink className="ml-1 h-3 w-3 flex-shrink-0" />
          </CardDescription>
          <div></div>
        </CardHeader>
        <CardContent>
          <div className="line-clamp-4">{playlist.description}</div>
        </CardContent>
        <CardFooter className="flex flex-col">
          <div className="mt-2 flex flex-1 flex-wrap gap-2">
            {playlist?.categories?.map((category) => (
              <Badge
                key={`playlist_${category}`}
                className="cursor-default"
                variant="outline"
              >
                {category}
              </Badge>
            ))}
          </div>
          <div>
            {isAdmin && (
              <PlaylistAdminTools
                playlist={playlist}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            )}
          </div>
        </CardFooter>
      </div>
      <div className="flex flex-row items-center justify-center gap-1 py-2 md:flex-col md:justify-start md:pr-4 md:pt-6">
        <Button
          variant="ghost"
          size="lg"
          onClick={() => onSave(playlist.id)}
          title={isSaved ? "Unsave playlist" : "Save playlist"}
        >
          {isSaved ? (
            <Heart className="fill-yellow-400" />
          ) : (
            <Heart className="" />
          )}
        </Button>
        <div className="mr-2 md:hidden">Good vibes? Vote for it!</div>
        <VoteButton
          isUpvote={true}
          onClick={() => handleVote(playlist.id, true)}
        />
        <span className="cursor-default font-bold">
          {playlist.upVotes - playlist.downVotes}
        </span>
        <VoteButton
          isUpvote={false}
          onClick={() => handleVote(playlist.id, false)}
        />
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
