import { useState, useEffect } from "react";
import { PlaylistAdminTools } from "./playlist-admin";
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
  Bookmark,
  BookmarkCheck,
  Heart,
} from "lucide-react";

import { useIsClient } from "usehooks-ts";

// ---------------------------------------------------------------------------------------------------
// <PlaylistCard /> - Upvotable info card about a good gym music playlist
// ---------------------------------------------------------------------------------------------------
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
  const isClient = useIsClient();

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

  if (!isClient) return; // Workaround because of hydration mismatch on localstorage isSaved

  return (
    <Card
      className={cn("flex flex-col gap-2 bg-muted/60 md:flex-row", className)}
    >
      <div className="flex-1">
        <CardHeader className="">
          <CardTitle className="">
            <div className="flex flex-row items-center gap-2 font-semibold">
              <Music className="h-5 w-5 text-primary" />
              <a
                href={playlist.url}
                target="_blank"
                rel="noopener noreferrer"
                className="line-clamp-2 text-balance text-lg hover:underline"
              >
                {playlist.title}
              </a>
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
