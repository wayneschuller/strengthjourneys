import { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import { devLog } from "@/lib/processing-utils";
import { cn } from "@/lib/utils";
import shortUUID from "short-uuid";
import { useLocalStorage } from "usehooks-ts";
import { useSession, signIn } from "next-auth/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

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
  Edit,
  Trash,
} from "lucide-react";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import useSWR, { mutate } from "swr";

const fetcher = (...args) => fetch(...args).then((res) => res.json());

// Create a translator object
const translator = shortUUID();

export default function GymPlaylistLeaderboard() {
  const { data: session, status: authStatus } = useSession();
  const { data: playlistsData, error } = useSWR("/api/playlists", fetcher);
  const [playlists, setPlaylists] = useState([]);

  const [currentPlaylist, setCurrentPlaylist] = useState({
    id: "",
    title: "",
    description: "",
    url: "",
    categories: [],
    votes: 0,
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [votes, setVotes] = useLocalStorage("SJ_playlistVotes", {});
  const [currentTab, setCurrentTab] = useState("top");
  const [selectedCategories, setSelectedCategories] = useState([]);

  const { toast } = useToast();
  const [parent] = useAutoAnimate();
  const adminEmails = process.env
    .NEXT_PUBLIC_STRENGTH_JOURNEYS_LEADERBOARD_ADMINS
    ? process.env.NEXT_PUBLIC_STRENGTH_JOURNEYS_LEADERBOARD_ADMINS.split(",")
    : [];

  const isAdmin = adminEmails.includes(session?.user?.email);

  useEffect(() => {
    if (
      playlistsData &&
      typeof playlistsData === "object" &&
      !Array.isArray(playlistsData)
    ) {
      // Convert object of objects to array
      const playlistsArray = Object.entries(playlistsData).map(
        ([id, playlist]) => ({
          ...playlist,
          id,
        }),
      );
      setPlaylists(playlistsArray);
    }
  }, [playlistsData]);

  if (error || playlists?.error) {
    if (error) devLog(error);
    if (playlists?.error) devLog(playlists);
    return <div>Failed to load playlists</div>;
  }
  if (!playlists) return <div>Loading...</div>;

  if (!playlists.length) return <div>Loading...</div>;

  const categories = [
    // Genres
    "rock",
    "pop",
    "hip-hop",
    "electronic",
    "r&b",
    "metal",
    "house",
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
    "podcast",
    "weird",
  ];

  // devLog(votes);

  const openAddDialog = () => {
    setIsEditMode(false);
    setCurrentPlaylist({
      id: "",
      title: "",
      description: "",
      url: "",
      categories: [],
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (playlist) => {
    setIsEditMode(true);
    setCurrentPlaylist(playlist);
    setIsDialogOpen(true);
  };

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
      return newVotes;
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

  // --------------------------------------------------------------------------
  // Form handler for Add/Edit playlist dialog
  // --------------------------------------------------------------------------
  const handlePlaylistAction = async (playlistData) => {
    devLog(`handlePlaylistAction dialog activity:`);
    devLog(playlistData);

    let playlistToAdd;

    try {
      let response;
      if (isEditMode) {
        response = await fetch(`/api/playlists?id=${currentPlaylist.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(playlistData),
        });
      } else {
        playlistToAdd = {
          ...playlistData,
          id: shortUUID.generate(),
          votes: 0,
          timestamp: Date.now(),
        };
        response = await fetch("/api/playlists", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(playlistToAdd),
        });
      }

      if (!response.ok) {
        throw new Error(
          isEditMode ? "Failed to update playlist" : "Failed to add playlist",
        );
      }

      setPlaylists((prevPlaylists) => {
        if (isEditMode) {
          return prevPlaylists.map((playlist) =>
            playlist.id === currentPlaylist.id
              ? { ...playlist, ...playlistData }
              : playlist,
          );
        } else {
          return [...prevPlaylists, playlistToAdd];
        }
      });

      setIsDialogOpen(false);
      mutate("/api/playlists");

      toast({
        title: "Success",
        description: isEditMode
          ? "Playlist updated successfully!"
          : "New playlist added successfully!",
      });
    } catch (error) {
      console.error(
        isEditMode ? "Error updating playlist:" : "Error adding playlist:",
        error,
      );
      toast({
        title: "Error",
        description: isEditMode
          ? "Failed to update playlist. Please try again."
          : "Failed to add playlist. Please try again.",
        variant: "destructive",
      });
    }
  };

  const deletePlaylist = async (id) => {
    try {
      const response = await fetch(`/api/playlists?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete playlist");
      }
      // Update the local state by removing the deleted playlist
      setPlaylists((prevPlaylists) =>
        prevPlaylists.filter((playlist) => playlist.id !== id),
      );

      // Revalidate the SWR cache
      mutate("/api/playlists");

      // Show a success message
      // FIXME: Undo button would be nice
      toast({
        title: "Success",
        description: "Playlist deleted successfully!",
      });
    } catch (error) {
      console.error("Error deleting playlist:", error);
      // Show an error message
      toast({
        title: "Error",
        description: "Failed to delete playlist. Please try again.",
        variant: "destructive",
      });
    }
  };

  const toggleCategory = (category) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category],
    );
  };

  // Used in the dialog for suggesting a new playlist
  const toggleNewPlaylistCategory = (category) => {
    setNewPlaylist((prev) => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter((c) => c !== category)
        : [...prev.categories, category],
    }));
  };

  const sortFunctions = {
    top: (a, b) => b.votes - a.votes,
    new: (a, b) => b.timestamp - a.timestamp,
    rising: (a, b) =>
      b.votes / (Date.now() - b.timestamp) -
      a.votes / (Date.now() - a.timestamp),
  };

  const filteredAndSortedPlaylists = playlists
    ? playlists
        .filter(
          (playlist) =>
            selectedCategories.length === 0 ||
            playlist.categories.some((cat) => selectedCategories.includes(cat)),
        )
        .sort(sortFunctions[currentTab])
    : [];

  const sortedPlaylists = [...playlists].sort(sortFunctions[currentTab]);

  const handleTabChange = (value) => {
    setCurrentTab(value);
  };

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
      <Head>
        <title>Gym Music Playlist Leaderboard</title>
        <meta
          name="description"
          content="Discover the best gym music for lifting barbells. Upvote and submit your playlists for other strength barbell lifters"
        />
      </Head>

      <h1 className="mb-6 text-center text-3xl font-bold">
        Gym Music Playlist Global Leaderboard
      </h1>
      <h2 className="mb-6 text-left text-sm text-muted-foreground">
        Elevate your lifting experience with music playlists curated by the
        fitness community.
        {/* FIXME: consider checking for ssid and loaded data and prompt them here for more vote power */}
        {authStatus !== "authenticated" ? (
          <div>
            Vote for your favorites, with extra weighting for athletes who are{" "}
            <button
              onClick={() => signIn("google")}
              className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
            >
              signed in via Google.
            </button>
          </div>
        ) : (
          <div>
            As a signed in athlete, your votes will get extra weighting
            proportional to the quantity of gym sessions in your Google Sheet
            data.
          </div>
        )}
      </h2>

      {/* Side-by-Side Layout for Category Filter and Add Playlist Button */}
      <div className="mb-6 flex flex-col items-center gap-4 md:flex-row md:gap-1">
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
          <Button onClick={openAddDialog} className="w-full">
            Suggest New Playlist
          </Button>
        </div>
      </div>

      <PlaylistDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        isEditMode={isEditMode}
        currentPlaylist={currentPlaylist}
        onSubmit={handlePlaylistAction}
        categories={categories}
      />

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
              <PlaylistCard
                key={playlist.id}
                playlist={playlist}
                votes={votes}
                handleVote={handleVote}
                isAdmin={isAdmin}
                onDelete={deletePlaylist}
                onEdit={openEditDialog}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------
// <PlaylistCard /> - Upvotable info card about a good gym music playlist
// ---------------------------------------------------------------------------------------------------
const PlaylistCard = ({
  playlist,
  votes,
  handleVote,
  isAdmin,
  onDelete,
  onEdit,
}) => {
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
    <div className="mb-4 rounded-lg bg-muted p-4">
      <div className="flex items-start justify-between">
        <div className="mr-4 flex-grow">
          <div className="flex items-center space-x-2">
            <Music className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">
              <a
                href={playlist.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {playlist.title}
              </a>
            </h3>
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
            {playlist?.categories?.map((category) => (
              <Badge key={`playlist_${category}`}>{category}</Badge>
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
      {isAdmin && (
        <div className="mt-4 flex justify-end space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(playlist)}
            className="flex items-center"
          >
            <Edit className="mr-1 h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onDelete(playlist.id)}
            className="flex items-center"
          >
            <Trash className="mr-1 h-4 w-4" />
            Delete
          </Button>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------------------------------
// <PlaylistDialog /> - Create/Edit a playlist for the leaderboard
// ---------------------------------------------------------------------------------------------------
const PlaylistDialog = ({
  isOpen,
  onOpenChange,
  isEditMode,
  currentPlaylist,
  onSubmit,
  categories,
}) => {
  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const playlistData = {
      title: formData.get("title"),
      description: formData.get("description"),
      url: formData.get("url"),
      categories: formData.getAll("categories"),
      id: currentPlaylist.id,
      votes: currentPlaylist.votes,
    };
    onSubmit(playlistData);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Edit Playlist" : "Add New Playlist"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Edit the playlist details below."
              : "Fill out the form below to add a new playlist to the leaderboard."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            name="title"
            placeholder="Playlist Title"
            required
            defaultValue={currentPlaylist.title}
          />
          <Textarea
            name="description"
            placeholder="Playlist Description"
            required
            defaultValue={currentPlaylist.description}
          />
          <Input
            name="url"
            placeholder="Playlist URL"
            required
            defaultValue={currentPlaylist.url}
          />
          <div>
            <p className="mb-2 text-sm font-medium">Categories:</p>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <label key={category} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    name="categories"
                    value={category}
                    className="form-checkbox"
                    defaultChecked={
                      currentPlaylist?.categories?.includes(category) || false
                    }
                  />
                  <span>{category}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-between space-x-2 pt-5">
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit">
              {isEditMode ? "Update Playlist" : "Add Playlist"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
