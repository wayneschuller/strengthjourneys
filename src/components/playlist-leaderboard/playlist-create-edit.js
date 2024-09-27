import { useState } from "react";
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

// New imports for URL validation and sanitization
import validator from "validator";
import { sanitizeUrl } from "@braintree/sanitize-url";
import normalizeUrl from "normalize-url";
import DOMPurify from "dompurify";
import { WHITELISTED_SITES } from "./playlist-utils";
import { validateAndProcessPlaylist } from "./playlist-utils";

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
  const [errors, setErrors] = useState([]);

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
    };

    // Validate and process the playlist data (including whitelisting)
    const { errors, validatedPlaylist } =
      validateAndProcessPlaylist(playlistData);

    if (errors) {
      setErrors(errors);
      return;
    }
    // Handle timestamp logic
    if (!isEditMode) {
      // Adding a new playlist
      validatedPlaylist.timestamp = Date.now();
    } else {
      // Editing an existing playlist
      validatedPlaylist.timestamp = currentPlaylist.timestamp || Date.now();
    }

    onSubmit(validatedPlaylist);
    setErrors([]);
  };

  const handleCancel = () => {
    onOpenChange(false);
    setErrors([]);
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
            maxLength={500}
            required
            defaultValue={currentPlaylist.description}
          />
          <Input
            name="url"
            placeholder="Playlist URL"
            required
            defaultValue={currentPlaylist.url}
          />

          {errors.length > 0 && (
            <div className="mt-1 text-sm text-red-500">
              {errors.map((error, index) => (
                <p key={index}>{error}</p>
              ))}
            </div>
          )}

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

// Function to check if a URL is from a whitelisted site
const isWhitelistedUrl = (url) => {
  try {
    const hostname = new URL(url).hostname;
    return WHITELISTED_SITES.some((site) => hostname.endsWith(site));
  } catch {
    return false;
  }
};
