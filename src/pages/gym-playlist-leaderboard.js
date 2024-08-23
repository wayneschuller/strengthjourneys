import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ArrowBigUp, ArrowBigDown, Music, ExternalLink } from "lucide-react"

// Dummy data
const initialPlaylists = [
  { id: 1, title: "Ultimate Workout Mix", description: "High-energy tracks for intense workouts", url: "https://example.com/playlist1", votes: 10, timestamp: Date.now() - 100000 },
  { id: 2, title: "Cardio Boost", description: "Perfect for running and cardio sessions", url: "https://example.com/playlist2", votes: 8, timestamp: Date.now() - 200000 },
  { id: 3, title: "Strength Training Beats", description: "Heavy beats for lifting heavy weights", url: "https://example.com/playlist3", votes: 12, timestamp: Date.now() - 300000 },
]

export default function GymPlaylistLeaderboard() {
  const [playlists, setPlaylists] = useState(initialPlaylists)
  const [newPlaylist, setNewPlaylist] = useState({ title: "", description: "", url: "" })
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const handleVote = (id, increment) => {
    setPlaylists(playlists.map(playlist => {
      if (playlist.id === id) {
        // If upvoting and already upvoted, remove the vote
        if (increment === 1 && playlist.votes === playlist.initialVotes + 1) {
          return { ...playlist, votes: playlist.initialVotes, initialVotes: undefined }
        }
        // If not yet upvoted, add the vote and store the initial vote count
        if (increment === 1 && playlist.initialVotes === undefined) {
          return { ...playlist, votes: playlist.votes + 1, initialVotes: playlist.votes }
        }
        // For downvotes, just decrement normally
        if (increment === -1) {
          return { ...playlist, votes: playlist.votes - 1, initialVotes: undefined }
        }
      }
      return playlist
    }))
  }

  const addPlaylist = (e) => {
    e.preventDefault()
    if (newPlaylist.title && newPlaylist.description && newPlaylist.url) {
      const addedPlaylist = {
        id: playlists.length + 1,
        ...newPlaylist,
        votes: 0,
        timestamp: Date.now()
      }
      setPlaylists([...playlists, addedPlaylist])
      setNewPlaylist({ title: "", description: "", url: "" })
      setIsDialogOpen(false)
    }
  }

  const sortedPlaylists = {
    top: [...playlists].sort((a, b) => b.votes - a.votes),
    new: [...playlists].sort((a, b) => b.timestamp - a.timestamp),
    rising: [...playlists].sort((a, b) => (b.votes / (Date.now() - b.timestamp)) - (a.votes / (Date.now() - a.timestamp)))
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-3xl font-bold text-center mb-6">Gym Music Playlist Leaderboard</h1>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button className="mb-6">Add Playlist</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Playlist</DialogTitle>
          </DialogHeader>
          <form onSubmit={addPlaylist} className="space-y-4">
            <Input
              placeholder="Playlist Title"
              value={newPlaylist.title}
              onChange={(e) => setNewPlaylist({...newPlaylist, title: e.target.value})}
            />
            <Textarea
              placeholder="Playlist Description"
              value={newPlaylist.description}
              onChange={(e) => setNewPlaylist({...newPlaylist, description: e.target.value})}
            />
            <Input
              placeholder="Playlist URL"
              value={newPlaylist.url}
              onChange={(e) => setNewPlaylist({...newPlaylist, url: e.target.value})}
            />
            <Button type="submit">Add Playlist</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="top" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="top">Top</TabsTrigger>
          <TabsTrigger value="new">New</TabsTrigger>
          <TabsTrigger value="rising">Rising</TabsTrigger>
        </TabsList>
        {Object.entries(sortedPlaylists).map(([key, value]) => (
          <TabsContent key={key} value={key} className="space-y-4">
            {value.map((playlist) => (
              <div key={playlist.id} className="flex items-start justify-between bg-muted p-4 rounded-lg">
                <div className="flex-grow mr-4">
                  <div className="flex items-center space-x-2">
                    <Music className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">{playlist.title}</h3>
                  </div>
                  <a 
                    href={playlist.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-sm text-muted-foreground hover:underline flex items-center mt-1"
                  >
                    {playlist.url}
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </a>
                  <p className="text-sm text-muted-foreground mt-1">{playlist.description}</p>
                </div>
                <div className="flex flex-col items-center space-y-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleVote(playlist.id, 1)}
                    aria-label="Upvote"
                    className={playlist.votes === playlist.initialVotes + 1 ? "text-primary" : ""}
                  >
                    <ArrowBigUp className="h-6 w-6" />
                  </Button>
                  <span className="font-bold">{playlist.votes}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleVote(playlist.id, -1)}
                    aria-label="Downvote"
                  >
                    <ArrowBigDown className="h-6 w-6" />
                  </Button>
                </div>
              </div>
            ))}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}