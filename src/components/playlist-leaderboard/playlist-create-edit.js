import { Button } from "@/components/ui/button";
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

// ---------------------------------------------------------------------------------------------------
// <PlaylistCreateEditDialog /> - Create/Edit a playlist for the leaderboard
// ---------------------------------------------------------------------------------------------------
export function PlaylistCreateEditDialog({
  isOpen,
  onOpenChange,
  isEditMode,
  currentPlaylist,
  onSubmit,
  categories,
}) {
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
}
