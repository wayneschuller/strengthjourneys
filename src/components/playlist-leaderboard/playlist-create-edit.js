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

// Whitelist of acceptable music sites
const WHITELISTED_SITES = [
  "spotify.com", // Leading music streaming platform
  "music.apple.com", // Apple Music service
  "music.youtube.com", // YouTube Music
  "youtube.com", // YouTube platform
  "soundcloud.com", // Independent music sharing
  "tidal.com", // High-fidelity music streaming
  "deezer.com", // Music streaming service
  "pandora.com", // Internet radio and music streaming
  "mixcloud.com", // DJ mixes and radio shows
  "bandcamp.com", // Independent artists' platform
  "audiomack.com", // Free music streaming for artists
  "reverbnation.com", // Music promotion and sharing
  "napster.com", // Online music streaming service
  "last.fm", // Music discovery and streaming
  "iheartradio.com", // Streaming radio and custom playlists
  "boomplay.com", // African music streaming service
];

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
  const [urlError, setUrlError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const submittedUrl = formData.get("url");

    // Reset error state
    setUrlError("");

    // URL validation
    if (
      !validator.isURL(submittedUrl, {
        protocols: ["https"],
        require_protocol: true,
      })
    ) {
      setUrlError("Please enter a valid URL");

      return;
    }

    // URL sanitization and normalization
    const sanitizedUrl = sanitizeUrl(submittedUrl);
    const normalizedUrl = normalizeUrl(sanitizedUrl, {
      defaultProtocol: "https:",
      stripAuthentication: true,
      stripWWW: true,
    });

    // Check if the normalized URL is from a whitelisted site
    if (!isWhitelistedUrl(normalizedUrl)) {
      setUrlError(
        "Please enter a URL from an approved music streaming platform",
      );
      return;
    }

    const sanitizedTitle = DOMPurify.sanitize(formData.get("title"), {
      ALLOWED_TAGS: [],
    });
    const sanitizedDescription = DOMPurify.sanitize(
      formData.get("description"),
      { ALLOWED_TAGS: [] },
    );

    const playlistData = {
      title: sanitizedTitle,
      description: sanitizedDescription,
      url: normalizedUrl,
      categories: formData.getAll("categories"),
      id: currentPlaylist.id,
      upVotes: currentPlaylist.upVotes || 0,
      downVotes: currentPlaylist.downVotes || 0,
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

  const handleUrlChange = (e) => {
    // Clear error when user starts typing
    if (urlError) {
      setUrlError("");
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    setUrlError("");
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
            onChange={handleUrlChange}
          />
          {urlError && <p className="mt-1 text-sm text-red-500">{urlError}</p>}

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
