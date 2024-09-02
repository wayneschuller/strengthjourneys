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
import { useToast } from "@/components/ui/use-toast";
import { fetchPlaylists } from "@/components/playlist-leaderboard/playlist-utils";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { PlaylistCard } from "@/components/playlist-leaderboard/playlist-card";
import { PlaylistCreateEditDialog } from "@/components/playlist-leaderboard/playlist-create-edit";
import { TrendingUp, Clock, Flame, Bookmark, Heart } from "lucide-react";
const translator = shortUUID();

const ITEMS_PER_PAGE = 5;

// ---------------------------------------------------------------------------------------------------
// <GymPlaylistLeaderboard /> - World's best source of lifting music
// ---------------------------------------------------------------------------------------------------
export default function GymPlaylistLeaderboard({ initialPlaylists }) {
  const { data: session, status: authStatus } = useSession();
  const [playlists, setPlaylists] = useState(initialPlaylists);
  const [currentPage, setCurrentPage] = useState(1);

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
  const [savedPlaylists, setSavedPlaylists] = useLocalStorage(
    "SJ_savedPlaylists",
    [],
  );
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

  // Reset to first page when changing tabs or applying filters
  useEffect(() => {
    setCurrentPage(1);
  }, [currentTab, selectedCategories]);

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
          : "New playlist added successfully! Thanks for contributing - please click `Give fast feedback` to help more.",
      });
    } catch (error) {
      console.error(
        isEditMode ? "Error updating playlist:" : "Error adding playlist",
        error,
      );
      toast({
        title: "Error",
        description: error.message,
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
    saved: (a, b) => {
      const scoreA = a.upVotes - a.downVotes;
      const scoreB = b.upVotes - b.downVotes;
      return scoreB - scoreA;
    },
  };

  const toggleSavePlaylist = (playlistId) => {
    setSavedPlaylists((prev) => {
      if (prev.includes(playlistId)) {
        return prev.filter((id) => id !== playlistId);
      } else {
        return [...prev, playlistId];
      }
    });
  };

  const filteredAndSortedPlaylists = playlists
    ? playlists
        .filter(
          (playlist) =>
            selectedCategories.length === 0 ||
            playlist.categories.some((cat) => selectedCategories.includes(cat)),
        )
        .filter((playlist) => {
          if (currentTab === "saved") {
            return savedPlaylists.includes(playlist.id);
          }
          return true;
        })
        .sort(sortFunctions[currentTab] || sortFunctions.top)
    : [];

  const totalPages = Math.ceil(
    filteredAndSortedPlaylists.length / ITEMS_PER_PAGE,
  );

  const paginatedPlaylists = filteredAndSortedPlaylists.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  // devLog(votes);
  // devLog(playlists);
  // devLog(filteredAndSortedPlaylists);

  return (
    <>
      <Head>
        <title>Top Gym Playlists: Barbell Lifting Music Leaderboard</title>
        <meta
          name="description"
          content="Elevate your workouts with top-rated gym playlists. Vote, submit, and discover the best music for weightlifting, powerlifting, and strength training. Join the fitness community!"
        />

        <meta
          name="keywords"
          content="gym playlists, workout music, lifting songs, powerlifting soundtrack, fitness motivation, strength training music"
        />
        <meta name="robots" content="index, follow" />

        <meta
          property="og:title"
          content="Top Gym Playlists: Barbell Lifting Music Leaderboard"
        />
        <meta
          property="og:description"
          content="Elevate your workouts with top-rated gym playlists. Vote, submit, and discover the best music for weightlifting, powerlifting, and strength training. Join the fitness community!"
        />
        <meta property="og:type" content="website" />
        <meta
          property="og:url"
          content="https://www.strengthjourneys.xyz/gym-playlist-leaderboard"
        />
        <meta
          property="og:image"
          content="https://www.strengthjourneys.xyz/strength-journeys-playlist-leaderboard.png"
        />

        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:title"
          content="Top Gym Playlists: Barbell Lifting Music Leaderboard"
        />
        <meta
          name="twitter:description"
          content="Elevate your workouts with top-rated gym playlists. Vote, submit, and discover the best music for weightlifting, powerlifting, and strength training. Join the fitness community!"
        />
        <meta
          name="twitter:image"
          content="https://www.strengthjourneys.xyz/strength-journeys-playlist-leaderboard.png"
        />
      </Head>
      <main className="mx-4 md:mx-10 md:items-center lg:mx-[15vw] xl:mx-[20vw]">
        <div>
          <h1 className="mb-6 text-center text-3xl font-bold">
            Gym Music Playlist Global Leaderboard
          </h1>
          <h2 className="mb-6 text-sm text-muted-foreground">
            Elevate your lifting experience with music playlists curated by the
            fitness community.
            {/* FIXME: consider checking for ssid and loaded data and prompt them here for more vote power */}
            {authStatus !== "authenticated" ? (
              <div>
                Vote for your favorites, with extra weighting for athletes who
                are{" "}
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
                proportional to the quantity of gym sessions in your Google
                Sheet data.
              </div>
            )}
          </h2>

          {/* Side-by-Side Layout for Category Filter and Add Playlist Button */}
          <div className="mb-6 flex flex-col items-center gap-4 md:flex-row md:gap-1">
            <div className="flex-grow pr-4">
              <div className="flex flex-wrap gap-4 md:gap-2">
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
                value="saved"
                className="flex items-center justify-center space-x-2"
              >
                <Heart className="h-4 w-4" />
                <span>Saved</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value={currentTab} className="space-y-4">
              <div ref={parent} className="flex flex-col gap-5">
                {/* <div ref={parent} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2" > */}
                {paginatedPlaylists.map((playlist) => (
                  <PlaylistCard
                    key={playlist.id}
                    playlist={playlist}
                    votes={clientVotes}
                    handleVote={handleVote}
                    isAdmin={isAdmin}
                    onDelete={deletePlaylist}
                    onEdit={openEditDialog}
                    onSave={toggleSavePlaylist}
                    isSaved={savedPlaylists.includes(playlist.id)}
                    className=""
                  />
                ))}
              </div>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </>
  );
}

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
// ISR - Incremental Static Regeneration on Next.js
// Doesn't run on dev but on Vercel it will access the kv store directly to pre-cache page at build
// ---------------------------------------------------------------------------------------------------
export async function getStaticProps() {
  const vercelProPlan = false; // We can dream

  const isLocalDev = !process.env.VERCEL;

  // Dev mode use dummy data to protect my tiny Vercel quota of KV reads
  if (!vercelProPlan && isLocalDev) {
    console.log(
      "Local (non-Vercel) mode detected: Using dummy data instead of KV store",
    );
    return {
      props: { initialPlaylists: dummyPlaylists },
    };
  }

  // If KV quota is full, just let this fail so that the Vercel deploy won't build
  // Then it keeps the last previous working build running for the public
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

// Snapsnot taken 20240831
const dummyPlaylists = [
  {
    title: "Powerlifting Rage Music",
    description: "Motivational lifting openers then some metal",
    url: "https://www.youtube.com/playlist?list=PLZVm1XlK9BkSd5twQN4uDY-y8FUbxkXPM",
    categories: ["rock", "metal", "intense", "motivational", "podcast"],
    id: "eVDDfyth59mHnWWVBFdnZE",
    upVotes: 34,
    downVotes: 16,
    timestamp: 1725006025882,
  },
  {
    title: "Hype - Trap and Bass",
    description: "Aggressive trap and bass for the gym",
    url: "https://open.spotify.com/playlist/37i9dQZF1DX4eRPd9frC1m?si=ce782b11fefc412b",
    categories: ["electronic", "upbeat", "intense", "strength"],
    id: "f8T1QFW9A9bscNjni1G33g",
    upVotes: 1,
    downVotes: 0,
    timestamp: 1725006060415,
  },
  {
    title: "Racconti d'Estate - Original Motion Picture Soundtrack",
    description:
      "There are few World film composers that can boast the prolificacy of Piero Piccioni. ",
    url: "https://music.youtube.com/playlist?list=OLAK5uy_myfYEMJZdnomOl5IBtp2W6AFZIxkF3mxw",
    categories: ["chill", "warm-up", "retro", "weird"],
    id: "rubaiAp7YsB7DK36X5tTbw",
    upVotes: 0,
    downVotes: 0,
    timestamp: 1725011360464,
  },
  {
    title: "Chill the **** Out - Relaxing Vibes",
    description:
      "Just chill the **** out to our mix of relaxing hits. Tune in for tracks from Billie Eilish, Olivia Rodrigo, Taylor Swift and many many more! Chill Pop | Relaxing Pop | Chill Vibes | Lazy Sundays | Chilled Mix \n",
    url: "https://open.spotify.com/playlist/1jelEUwXFe9YeEjdAR3aC8",
    categories: ["pop", "chill"],
    id: "fHtWSBU8i5eUc9pjhnMcu9",
    upVotes: 139,
    downVotes: 35,
    timestamp: 1725005615635,
  },
  {
    title: "new edit",
    description: "sdf",
    url: "sdf",
    categories: [],
    id: "u2mCRXdNprNx1BhQBPhmJQ",
    upVotes: 0,
    downVotes: 0,
    timestamp: 1725006835566,
  },
  {
    title: "2024 Fire after the Jungle",
    description: "Some cool tracks that I like right now ",
    url: "https://music.youtube.com/playlist?list=PLG42MLa3uF3GjSjREOqUhFg786CQKQzhj",
    categories: ["hip-hop", "motivational", "strength", "retro"],
    id: "rXCuYT88sgzo3CAiiK6FMm",
    upVotes: 32,
    downVotes: 7,
    timestamp: 1725005977710,
  },
  {
    title: "Flavour Trip - House Music with Flavour",
    description:
      "'Where spicy grooves and tasty food set the mood' \n\nHi, we're Amii and Jimmi, two slow living DJ's catching as many flavours as possible on our trip.\n\nWe are premiering a new house mix from a different location every 4 weeks on Wednesday at 8pm CEST.",
    url: "https://www.youtube.com/playlist?list=PLfntQsWZoky36OX3Z9-Qy1D9BnwVqWNq9",
    categories: ["electronic", "house", "intense", "warm-up"],
    id: "rkPQLpwp2XUcGDeubzczJE",
    upVotes: 28,
    downVotes: 9,
    timestamp: 1725005984755,
  },
  {
    title: "Lord Of The Rings | Rohan | Ambience & Music | 3 Hours",
    description:
      "Greetings, fellow Middle Earth enthusiasts! This channel is dedicated to showcasing the awe-inspiring beauty of this magical world. Through our carefully crafted videos and immersive soundscapes, I strive to bring you the most captivating visuals and audio edits that capture the essence of Middle Earth.",
    url: "https://youtu.be/OmDPKojNNrg?si=H6OUaZX-4hk48xb7",
    categories: ["motivational", "strength", "warm-up", "weird"],
    id: "vDiTUcgcM2PpPNY83VDSMJ",
    upVotes: 20,
    downVotes: 0,
    timestamp: 1725005713972,
  },
  {
    title: "BeastMode Playlist",
    description: "Get your beast mode on!\n",
    url: "https://open.spotify.com/playlist/37i9dQZF1DX76Wlfdnj7AP?si=28f1d75a5eb042f4",
    categories: ["pop", "hip-hop", "upbeat", "intense", "cardio", "strength"],
    id: "vB2E15w9AaFg735QSL3ks3",
    upVotes: 20,
    downVotes: 0,
    timestamp: 1725005592377,
  },
];

const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  return (
    <div className="mt-4 flex items-center justify-center space-x-2">
      <Button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        Previous
      </Button>
      <span>{`Page ${currentPage} of ${totalPages}`}</span>
      <Button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        Next
      </Button>
    </div>
  );
};
