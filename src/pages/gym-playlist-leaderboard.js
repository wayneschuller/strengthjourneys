import { useState, useCallback } from "react";
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

import { useAutoAnimate } from "@formkit/auto-animate/react";

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
  {
    id: 4,
    title: "Yoga Flow Vibes",
    description: "Calm and soothing tracks for yoga sessions",
    url: "https://example.com/playlist4",
    votes: 15,
    timestamp: Date.now() - 50000,
    categories: ["ambient", "electronic"],
  },
  {
    id: 5,
    title: "HIIT Intensity",
    description: "Fast-paced music for high-intensity interval training",
    url: "https://example.com/playlist5",
    votes: 7,
    timestamp: Date.now() - 150000,
    categories: ["electronic", "techno"],
  },
  {
    id: 6,
    title: "Cool Down Classics",
    description: "Relaxing tunes for post-workout stretching",
    url: "https://example.com/playlist6",
    votes: 9,
    timestamp: Date.now() - 250000,
    categories: ["classical", "jazz"],
  },
  {
    id: 7,
    title: "Powerlifting Anthems",
    description: "Motivational rock and metal for heavy lifting",
    url: "https://example.com/playlist7",
    votes: 11,
    timestamp: Date.now() - 180000,
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
  const [currentTab, setCurrentTab] = useState("top");
  const [selectedCategories, setSelectedCategories] = useState([]);

  const [parent] = useAutoAnimate();

  const categories = [
    // Genres
    "rock",
    "pop",
    "hip-hop",
    "electronic",
    "r&b",
    "metal",
    // Descriptive/Mood
    "upbeat",
    "intense",
    "chill",
    "motivational",
    // Workout-specific
    "cardio",
    "strength",
    "warm-up",
    "retro",
    "weird",
  ];

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
            if (prevVotes[id] === "up" && newVotes[id] === "down") {
              voteChange = -2; // Changed from upvote to downvote
            } else if (prevVotes[id] === "down" && newVotes[id] === "up") {
              voteChange = 2; // Changed from downvote to upvote
            } else if (prevVotes[id] === "up" && !newVotes[id]) {
              voteChange = -1; // Removed upvote
            } else if (prevVotes[id] === "down" && !newVotes[id]) {
              voteChange = 1; // Removed downvote
            } else if (newVotes[id] === "up") {
              voteChange = 1; // New upvote
            } else if (newVotes[id] === "down") {
              voteChange = -1; // New downvote
            }
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
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category],
    );
  };

  const sortFunctions = {
    top: (a, b) => b.votes - a.votes,
    new: (a, b) => b.timestamp - a.timestamp,
    rising: (a, b) =>
      b.votes / (Date.now() - b.timestamp) -
      a.votes / (Date.now() - a.timestamp),
  };

  const filteredAndSortedPlaylists = [...playlists]
    .filter(
      (playlist) =>
        selectedCategories.length === 0 ||
        playlist.categories.some((cat) => selectedCategories.includes(cat)),
    )
    .sort(sortFunctions[currentTab]);

  const sortedPlaylists = [...playlists].sort(sortFunctions[currentTab]);

  const handleTabChange = useCallback((value) => {
    setCurrentTab(value);
  }, []);

  const VoteButton = ({ isUpvote, isVoted, onClick, className }) => (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      aria-label={isUpvote ? "Upvote" : "Downvote"}
      className={cn(
        "transition-all hover:outline",
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
        Gym Music Playlist Global Leaderboard
      </h1>

      {/* Side-by-Side Layout for Category Filter and Add Playlist Button */}
      <div className="mb-6 flex items-center">
        <div className="flex-grow pr-4">
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Badge
                key={category}
                variant={
                  selectedCategories.includes(category)
                    ? "default"
                    : "secondary"
                }
                className="cursor-pointer"
                onClick={() => toggleCategory(category)}
              >
                {category}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-center">
          <Button onClick={() => setIsDialogOpen(true)} className="w-full">
            Suggest New Playlist
          </Button>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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

      <Tabs
        value={currentTab}
        onValueChange={handleTabChange}
        className="w-full"
      >
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
        <TabsContent value={currentTab} className="space-y-4">
          <div ref={parent}>
            {filteredAndSortedPlaylists.map((playlist) => (
              <div
                key={playlist.id}
                className="mb-4 flex items-start justify-between rounded-lg bg-muted p-4"
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
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
