import { useState, useEffect } from "react";
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
import { fetchPlaylists } from "@/lib/playlist-utils";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { Separator } from "@/components/ui/separator";
const translator = shortUUID();

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
  FolderSync,
} from "lucide-react";

// ---------------------------------------------------------------------------------------------------
// <GymPlaylistLeaderboard /> - World's best source of lifting music
// ---------------------------------------------------------------------------------------------------
export default function GymPlaylistLeaderboard({ initialPlaylists }) {
  const { data: session, status: authStatus } = useSession();
  const [playlists, setPlaylists] = useState(initialPlaylists);

  const [currentPlaylist, setCurrentPlaylist] = useState({
    id: "",
    title: "",
    description: "",
    url: "",
    categories: [],
    upVotes: 0,
    downVotes: 0,
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [clientVotes, setClientVotes] = useLocalStorage("SJ_playlistVotes", {}); // Track user votes in client local storage
  const [currentTab, setCurrentTab] = useState("top");
  const [selectedCategories, setSelectedCategories] = useState([]);

  const { toast } = useToast();
  const [parent] = useAutoAnimate();
  const adminEmails = process.env
    .NEXT_PUBLIC_STRENGTH_JOURNEYS_LEADERBOARD_ADMINS
    ? process.env.NEXT_PUBLIC_STRENGTH_JOURNEYS_LEADERBOARD_ADMINS.split(",")
    : [];

  const isAdmin = adminEmails.includes(session?.user?.email);

  // On mount - delete all the localstorage votes older than 10 minutes so the user can vote again
  // FIXME: implement the 10 minute timeout on the server using IP throttling
  useEffect(() => {
    const currentTime = Date.now();
    const tenMinutesInMs = 10 * 60 * 1000;
    const updatedVotes = { ...clientVotes };
    let hasChanges = false;

    Object.keys(updatedVotes).forEach((playlistId) => {
      const vote = updatedVotes[playlistId];
      if (!vote.timestamp || currentTime - vote.timestamp > tenMinutesInMs) {
        delete updatedVotes[playlistId];
        hasChanges = true;
      }
    });

    if (hasChanges) {
      setClientVotes(updatedVotes);
    }
  }, []);

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

  const openAddDialog = () => {
    setIsEditMode(false);
    setCurrentPlaylist({
      id: "",
      title: "",
      description: "",
      url: "",
      categories: [],
      upVotes: 0,
      downVotes: 0,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (playlist) => {
    setIsEditMode(true);
    setCurrentPlaylist(playlist);
    setIsDialogOpen(true);
  };

  // --------------------------------------------------------------------------
  // handleVote - process votes in localstorage (optimistic UI) and API point
  // The api is made to allow withdrawing of votes. e.g.: decrement an upvote
  // But it's too annoying to let people undo votes.
  // --------------------------------------------------------------------------
  const handleVote = async (id, isUpvote) => {
    const updatedClientVotes = { ...clientVotes };
    const currentPlaylist = playlists.find((playlist) => playlist.id === id);

    if (!currentPlaylist) return;

    const voteType = isUpvote ? "upVote" : "downVote";
    const currentVote = updatedClientVotes[id]?.vote;

    // Update vote state with playlist id, vote, and the timestamp
    updatedClientVotes[id] = {
      vote: voteType,
      timestamp: Date.now(),
    };

    const action = "increment"; // In the API you can send decrements, but we are not doing this anymore

    // Set the new state optimistally before the API call
    if (!isAdmin) setClientVotes(updatedClientVotes);
    if (isAdmin) setClientVotes({}); // Just clear votes so UI doesn't get set

    try {
      const result = await sendVote(id, voteType, action);
      devLog(result);

      // Update playlists based on the new vote state
      const updatedPlaylists = playlists.map((playlist) => {
        if (playlist.id === id) {
          if (result.upVotes)
            return {
              ...playlist,
              upVotes: result.upVotes,
            };

          if (result.downVotes)
            return {
              ...playlist,
              downVotes: result.downVotes,
            };

          // Should not happen - but just in case
          return calculateVoteChange(playlist, isUpvote, currentVote);
        }
        return playlist;
      });

      setPlaylists(updatedPlaylists);
    } catch (error) {
      console.error("Error sending vote:", error);
      // Handle error (e.g., revert state, show an error message)
    }
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
          upVotes: 0,
          downVotes: 0,
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
        const errorData = await response.json();
        throw new Error(errorData.error || "An unknown error occurred");
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

      toast({
        title: "Success",
        description: isEditMode
          ? "Playlist updated successfully!"
          : "New playlist added successfully!",
      });
    } catch (error) {
      console.error(
        isEditMode ? "Error updating playlist:" : "Error adding playlist",
        error,
      );
      toast({
        title: "Error",
        description:
          error.message ||
          (isEditMode
            ? "Failed to update playlist. Please try again."
            : "Failed to add playlist. Try again later"),
        variant: "destructive",
      });
    }
    setIsDialogOpen(false);
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

  const sortFunctions = {
    top: (a, b) => {
      const scoreA = a.upVotes - a.downVotes;
      const scoreB = b.upVotes - b.downVotes;
      return scoreB - scoreA;
    },
    new: (a, b) => {
      if (a.timestamp && b.timestamp) {
        return b.timestamp - a.timestamp;
      }
      return 0;
    },
    rising: (a, b) => {
      if (a.timestamp && b.timestamp) {
        const scoreA = (a.upVotes - a.downVotes) / (Date.now() - a.timestamp);
        const scoreB = (b.upVotes - b.downVotes) / (Date.now() - b.timestamp);
        return scoreB - scoreA;
      }
      return b.upVotes - b.downVotes - (a.upVotes - a.downVotes);
    },
  };

  const filteredAndSortedPlaylists = playlists
    ? playlists
        .filter(
          (playlist) =>
            selectedCategories.length === 0 ||
            playlist.categories.some((cat) => selectedCategories.includes(cat)),
        )
        .sort(sortFunctions[currentTab] || sortFunctions.top)
    : [];

  // devLog(votes);
  devLog(playlists);
  // devLog(filteredAndSortedPlaylists);

  return (
    // <div className="container mx-auto max-w-2xl p-4">
    <div className="mx-4 md:mx-10 md:items-center lg:mx-[15vw] xl:mx-[25vw]">
      <Head>
        <title>Gym Music Playlist Leaderboard</title>
        <meta
          name="description"
          content="Discover the best gym music for lifting barbells. Upvote and submit your playlists for other strength barbell lifters"
        />
      </Head>
      <div>
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
                  className="cursor-pointer hover:ring-2"
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

        <PlaylistCreateEditDialog
          isOpen={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          isEditMode={isEditMode}
          currentPlaylist={currentPlaylist}
          onSubmit={handlePlaylistAction}
          categories={categories}
        />

        <Tabs
          value={currentTab}
          onValueChange={(value) => setCurrentTab(value)}
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
            <div ref={parent} className="flex flex-col gap-5">
              {filteredAndSortedPlaylists.map((playlist) => (
                <PlaylistCard
                  key={playlist.id}
                  playlist={playlist}
                  votes={clientVotes}
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
};

// ---------------------------------------------------------------------------------------------------
// <PlaylistCreateEditDialog /> - Create/Edit a playlist for the leaderboard
// ---------------------------------------------------------------------------------------------------
const PlaylistCreateEditDialog = ({
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
      upVotes: currentPlaylist.upVotes || 0,
      downVotes: currentPlaylist.downVotes || 0,
      // timestamp: Date.now(), // Add timestamp for new playlists (but not in edit mode)
    };

    // Handle timestamp logic
    if (!isEditMode) {
      // Adding a new playlist
      playlistData.timestamp = Date.now();
    } else {
      // Editing an existing playlist
      if (currentPlaylist.timestamp) {
        // Keep the old timestamp if it exists
        playlistData.timestamp = currentPlaylist.timestamp;
      } else {
        // Add a new timestamp if it doesn't exist (for backwards compatibility)
        playlistData.timestamp = Date.now();
      }
    }

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

export async function sendVote(id, voteType, action) {
  if (voteType !== "upVote" && voteType !== "downVote") {
    throw new Error('Invalid voteType. Must be "upvote" or "downvote".');
  }

  if (action !== "increment" && action !== "decrement") {
    throw new Error('Invalid action. Must be "increment" or "decrement".');
  }

  try {
    const response = await fetch(
      `/api/vote-playlist?id=${id}&voteType=${voteType}&action=${action}`,
      {
        method: "POST",
      },
    );

    if (!response.ok) {
      throw new Error("Failed to send vote");
    }

    const result = await response.json();
    devLog(`Vote successful: ${JSON.stringify(result)}`);
    return result;
  } catch (error) {
    devLog(`Error: ${error.message}`);
    throw error;
  }
}

const calculateVoteChange = (playlist, isUpvote, currentVote) => {
  let upVotesChange = 0;
  let downVotesChange = 0;

  if (isUpvote) {
    if (currentVote === "upVote") {
      upVotesChange = -1; // Undo previous upvote
    } else {
      upVotesChange = 1; // New upvote
    }
  } else {
    if (currentVote === "downVote") {
      downVotesChange = -1; // Undo previous downvote
    } else {
      downVotesChange = 1; // New downvote
    }
  }

  return {
    ...playlist,
    upVotes: playlist.upVotes + upVotesChange,
    downVotes: playlist.downVotes + downVotesChange,
  };
};

// ---------------------------------------------------------------------------------------------------
// <PlaylistAdminTools /> stuff for maintenance. To use: add a Google email to .env or Vercel env settings
// ---------------------------------------------------------------------------------------------------
const PlaylistAdminTools = ({ playlist, onEdit, onDelete }) => {
  const [isRevalidating, setIsRevalidating] = useState(false);

  const handleRevalidate = async () => {
    setIsRevalidating(true);
    try {
      // This api route will check server side for an admin auth account
      const response = await fetch("/api/revalidate-leaderboard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: process.env.NEXT_PUBLIC_REVALIDATION_TOKEN,
        }),
      });

      if (response.ok) {
        alert("Revalidation successful");
      } else {
        alert("Revalidation failed");
      }
    } catch (error) {
      console.error("Error during revalidation:", error);
      alert("Revalidation failed");
    } finally {
      setIsRevalidating(false);
    }
  };

  return (
    <div className="mt-4">
      <Separator />
      <div className="mt-2 flex items-center justify-end space-x-2">
        <div>Admin Tools: </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRevalidate}
          disabled={isRevalidating}
          className="flex items-center"
        >
          <FolderSync className="mr-1 h-4 w-4" />
          {isRevalidating ? "Revalidating..." : "Revalidate Static Props"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onEdit(playlist)}
          className="flex items-center"
        >
          <Edit className="mr-1 h-4 w-4" />
          Edit Playlist
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => onDelete(playlist.id)}
          className="flex items-center"
        >
          <Trash className="mr-1 h-4 w-4" />
          Delete Playlist
        </Button>
      </div>
    </div>
  );
};

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

// ---------------------------------------------------------------------------------------------------
// ISR - Incremental Static Regeneration on Next.js
// Doesn't run on dev but on Vercel it will access the kv store directly to pre-cache page at build
// ---------------------------------------------------------------------------------------------------
export async function getStaticProps() {
  try {
    // Use console.log here not devLog - so we can see this in the Vercel build logs
    console.log(`getStaticProps: reading kvstore data`);
    const initialPlaylists = await fetchPlaylists();
    console.log(
      `getStaticProps: caching initialPlaylists (length: ${initialPlaylists.length}) `,
    );
    return {
      props: { initialPlaylists },
      revalidate: 600, // Revalidate for everyone every 10 minutes
    };
  } catch (error) {
    console.error("Error fetching playlists:", error);
    return {
      props: { initialPlaylists: [] },
    };
  }
}
