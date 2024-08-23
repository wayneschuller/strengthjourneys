import { useState } from "react";
import { devLog } from "@/lib/processing-utils";
import { cn } from "@/lib/utils";
import { useLocalStorage } from "usehooks-ts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import {
  ArrowBigUp,
  ArrowBigDown,
  Music,
  ExternalLink,
  TrendingUp,
  Clock,
  Flame,
} from "lucide-react";

// Dummy data
const initialPlaylists = [
  {
    id: 1,
    title: "Ultimate Workout Mix",
    description: "High-energy tracks for intense workouts",
    url: "https://example.com/playlist1",
    votes: 10,
    timestamp: Date.now() - 100000,
    categories: ["rock", "pop"],
  },
  {
    id: 2,
    title: "Cardio Boost",
    description: "Perfect for running and cardio sessions",
    url: "https://example.com/playlist2",
    votes: 8,
    timestamp: Date.now() - 200000,
    categories: ["techno", "house"],
  },
  {
    id: 3,
    title: "Strength Training Beats",
    description: "Heavy beats for lifting heavy weights",
    url: "https://example.com/playlist3",
    votes: 12,
    timestamp: Date.now() - 300000,
    categories: ["rock", "metal"],
  },
];

export default function GymPlaylistLeaderboard() {
  const [playlists, setPlaylists] = useState(initialPlaylists);
  const [newPlaylist, setNewPlaylist] = useState({
    title: "",
    description: "",
    url: "",
    categories: [],
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [votes, setVotes] = useLocalStorage("SJ_playlistVotes", {});

  const categories = ["rock", "techno", "house", "pop", "metal"];

  // devLog(votes);

  const handleVote = (id, isUpvote) => {
    setVotes((prevVotes) => {
      const newVotes = { ...prevVotes };
      if (newVotes[id] === (isUpvote ? "up" : "down")) {
        // Undo the vote if clicking the same button
        delete newVotes[id];
      } else {
        // Set new vote
        newVotes[id] = isUpvote ? "up" : "down";
      }

      // Update playlists based on the new vote state
      setPlaylists((prevPlaylists) =>
        prevPlaylists.map((playlist) => {
          if (playlist.id === id) {
            let voteChange = 0;
            if (prevVotes[id] === "up" && newVotes[id] !== "up")
              voteChange = -1;
            else if (prevVotes[id] === "down" && newVotes[id] !== "down")
              voteChange = 1;
            else if (newVotes[id] === "up") voteChange = 1;
            else if (newVotes[id] === "down") voteChange = -1;
            return { ...playlist, votes: playlist.votes + voteChange };
          }
          return playlist;
        }),
      );

      return newVotes;
    });
  };

  const addPlaylist = (e) => {
    e.preventDefault();
    if (newPlaylist.title && newPlaylist.description && newPlaylist.url) {
      const addedPlaylist = {
        id: playlists.length + 1,
        ...newPlaylist,
        votes: 0,
        timestamp: Date.now(),
      };
      setPlaylists([...playlists, addedPlaylist]);
      setNewPlaylist({ title: "", description: "", url: "", categories: [] });
      setIsDialogOpen(false);
    }
  };

  const toggleCategory = (category) => {
    setNewPlaylist((prev) => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter((c) => c !== category)
        : [...prev.categories, category],
    }));
  };

  const sortedPlaylists = {
    top: [...playlists].sort((a, b) => b.votes - a.votes),
    new: [...playlists].sort((a, b) => b.timestamp - a.timestamp),
    rising: [...playlists].sort(
      (a, b) =>
        b.votes / (Date.now() - b.timestamp) -
        a.votes / (Date.now() - a.timestamp),
    ),
  };

  const VoteButton = ({ isUpvote, isVoted, onClick, className }) => (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      aria-label={isUpvote ? "Upvote" : "Downvote"}
      className={cn(
        "transition-all",
        isVoted
          ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
          : "hover:bg-accent hover:text-accent-foreground",
        isVoted && "scale-110",
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

  return (
    <div className="container mx-auto max-w-2xl p-4">
      <h1 className="mb-6 text-center text-3xl font-bold">
        Gym Music Playlist Leaderboard
      </h1>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button className="mb-6">Add Playlist</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Playlist</DialogTitle>
            <DialogDescription>
              Fill out the form below to add a new playlist to the leaderboard.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={addPlaylist} className="space-y-4">
            <Input
              placeholder="Playlist Title"
              value={newPlaylist.title}
              onChange={(e) =>
                setNewPlaylist({ ...newPlaylist, title: e.target.value })
              }
            />
            <Textarea
              placeholder="Playlist Description"
              value={newPlaylist.description}
              onChange={(e) =>
                setNewPlaylist({ ...newPlaylist, description: e.target.value })
              }
            />
            <Input
              placeholder="Playlist URL"
              value={newPlaylist.url}
              onChange={(e) =>
                setNewPlaylist({ ...newPlaylist, url: e.target.value })
              }
            />
            <div>
              <p className="mb-2 text-sm font-medium">Categories:</p>
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <Badge
                    key={category}
                    variant={
                      newPlaylist.categories.includes(category)
                        ? "default"
                        : "outline"
                    }
                    className="cursor-pointer"
                    onClick={() => toggleCategory(category)}
                  >
                    {category}
                  </Badge>
                ))}
              </div>
            </div>
            <Button type="submit">Add Playlist</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="top" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger
            value="top"
            className="flex items-center justify-center space-x-2"
          >
            <TrendingUp className="h-4 w-4" />
            <span>Top</span>
          </TabsTrigger>
          <TabsTrigger
            value="new"
            className="flex items-center justify-center space-x-2"
          >
            <Clock className="h-4 w-4" />
            <span>New</span>
          </TabsTrigger>
          <TabsTrigger
            value="rising"
            className="flex items-center justify-center space-x-2"
          >
            <Flame className="h-4 w-4" />
            <span>Rising</span>
          </TabsTrigger>
        </TabsList>
        {Object.entries(sortedPlaylists).map(([key, value]) => (
          <TabsContent key={key} value={key} className="space-y-4">
            {value.map((playlist) => (
              <div
                key={playlist.id}
                className="flex items-start justify-between rounded-lg bg-muted p-4"
              >
                <div className="mr-4 flex-grow">
                  <div className="flex items-center space-x-2">
                    <Music className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">{playlist.title}</h3>
                  </div>
                  <a
                    href={playlist.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 flex items-center text-sm text-muted-foreground hover:underline"
                  >
                    {playlist.url}
                    <ExternalLink className="ml-1 h-3 w-3" />
                  </a>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {playlist.description}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {playlist.categories.map((category) => (
                      <Badge key={category}>{category}</Badge>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-center space-y-1">
                  <VoteButton
                    isUpvote={true}
                    isVoted={votes[playlist.id] === "up"}
                    onClick={() => handleVote(playlist.id, true)}
                  />
                  <span className="font-bold">{playlist.votes}</span>
                  <VoteButton
                    isUpvote={false}
                    isVoted={votes[playlist.id] === "down"}
                    onClick={() => handleVote(playlist.id, false)}
                  />
                </div>
              </div>
            ))}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
