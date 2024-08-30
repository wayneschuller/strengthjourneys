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

import { ArrowBigUp, ArrowBigDown, Music, ExternalLink } from "lucide-react";

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
}) {
  const inTimeout = isAdmin ? false : checkTimeout(votes, playlist.id);
  const userVote = votes[playlist.id]?.vote;

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
        XXclassName={cn(
          "transition-all hover:bg-accent hover:text-accent-foreground hover:outline",
          inTimeout && isUserVote && "ring-2 ring-primary",
          className,
        )}
        className={cn(
          "relative transition-all",
          isUserVote && "bg-primary/20 hover:bg-primary/30",
          inTimeout && "opacity-50",
          className,
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
    <Card className="flex flex-row gap-2 bg-muted/30">
      <div className="flex-1">
        <CardHeader className="">
          <CardTitle className="flex items-center justify-start gap-2 text-lg">
            <Music className="h-5 w-5 text-primary" />
            <div className="font-semibold">
              <a
                href={playlist.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-wrap hover:underline"
              >
                {playlist.title}
              </a>
            </div>
          </CardTitle>
          <CardDescription className="flex w-64 items-center md:w-96">
            <a
              href={playlist.url}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-sm text-muted-foreground hover:underline"
            >
              {playlist.url}
            </a>
            <ExternalLink className="ml-1 h-3 w-3 flex-shrink-0" />
          </CardDescription>
          <div></div>
        </CardHeader>
        <CardContent>{playlist.description}</CardContent>
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
      <div className="flex flex-col items-center space-y-1 pr-4 pt-6">
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
