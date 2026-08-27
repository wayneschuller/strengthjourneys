import { useState, useEffect } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { validateAndProcessPlaylist } from "@/components/playlist-leaderboard/playlist-utils";
import { Music, Check, ArrowLeft } from "lucide-react";

const MAX_CATEGORIES = 5;
const MAX_TITLE_LENGTH = 120;

/**
 * Add or edit a playlist.
 *
 * Adding is URL-first: paste a link, we resolve the title and cover art from the platform, and
 * all that's left is picking a tag or two. The old form asked for a title and a description that
 * we could mostly derive ourselves, and almost nobody finished it.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Controls whether the dialog is visible.
 * @param {Function} props.onOpenChange - Callback invoked with the new open state.
 * @param {boolean} props.isEditMode - Admin editing an existing entry, which keeps the full form.
 * @param {Object} props.currentPlaylist - Playlist pre-populating the form in edit mode.
 * @param {Function} props.onSubmit - Callback invoked with the validated playlist object.
 * @param {string[]} props.categories - Available category strings.
 */
export function PlaylistCreateEditDialog({
  isOpen,
  onOpenChange,
  isEditMode,
  currentPlaylist,
  onSubmit,
  categories,
}) {
  const [errors, setErrors] = useState([]);
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState(null);
  const [isResolving, setIsResolving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState([]);

  // Edit mode starts fully populated; add mode starts from an empty URL field.
  useEffect(() => {
    if (!isOpen) return;

    if (isEditMode) {
      setPreview({ resolved: true, thumbnailUrl: currentPlaylist.thumbnailUrl });
      setUrl(currentPlaylist.url || "");
      setTitle(currentPlaylist.title || "");
      setDescription(currentPlaylist.description || "");
      setSelected(currentPlaylist.categories || []);
    } else {
      setPreview(null);
      setUrl("");
      setTitle("");
      setDescription("");
      setSelected([]);
    }
    setErrors([]);
  }, [isOpen, isEditMode, currentPlaylist]);

  const resolveUrl = async (event) => {
    event.preventDefault();
    if (!url.trim()) return;

    setIsResolving(true);
    setErrors([]);

    try {
      const response = await fetch("/api/playlist-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();

      if (!response.ok) {
        setErrors([data.error || "Could not read that link"]);
        return;
      }

      if (data.duplicate) {
        setErrors([`"${data.title}" is already on the leaderboard — go vote for it instead.`]);
        return;
      }

      setPreview({ resolved: true, ...data });
      setUrl(data.url);
      setTitle(data.title || "");
    } catch {
      setErrors(["Could not reach the server. Try again in a moment."]);
    } finally {
      setIsResolving(false);
    }
  };

  const toggleCategory = (category) => {
    setSelected((prev) => {
      if (prev.includes(category)) return prev.filter((c) => c !== category);
      if (prev.length >= MAX_CATEGORIES) return prev;
      return [...prev, category];
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const { errors: validationErrors, validatedPlaylist } =
      validateAndProcessPlaylist({ title, description, url, categories: selected });

    if (validationErrors) {
      setErrors(validationErrors);
      return;
    }

    onSubmit(validatedPlaylist);
    setErrors([]);
  };

  const showFullForm = isEditMode || preview?.resolved;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Edit playlist" : "Add a playlist"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Edit the playlist details below."
              : showFullForm
                ? "Nearly there — pick a tag or two and it's on the board."
                : "Paste a link from Spotify, YouTube Music, Apple Music, SoundCloud or Tidal. We'll fetch the rest."}
          </DialogDescription>
        </DialogHeader>

        {!showFullForm ? (
          <form onSubmit={resolveUrl} className="min-w-0 space-y-4">
            <Input
              autoFocus
              name="url"
              inputMode="url"
              placeholder="https://open.spotify.com/playlist/..."
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />

            {errors.length > 0 && (
              <div className="text-sm text-red-500">
                {errors.map((error, index) => (
                  <p key={index}>{error}</p>
                ))}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isResolving || !url.trim()}>
              {isResolving ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Reading that link...
                </>
              ) : (
                "Continue"
              )}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="min-w-0 space-y-4">
            {/* What we found. Platform titles run long — everything here has to be able to
                shrink, or the row pushes its way out of the dialog. */}
            <div className="flex min-w-0 items-start gap-3 overflow-hidden rounded-lg border bg-muted/50 p-3">
              {preview?.thumbnailUrl ? (
                <Image
                  src={preview.thumbnailUrl}
                  alt=""
                  width={56}
                  height={56}
                  unoptimized
                  className="h-14 w-14 shrink-0 rounded-md object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-muted">
                  <Music className="h-6 w-6 text-muted-foreground/40" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <Textarea
                  name="title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Playlist title"
                  maxLength={MAX_TITLE_LENGTH}
                  rows={2}
                  className="min-h-0 w-full resize-none border-0 bg-transparent p-0 font-semibold shadow-none focus-visible:ring-0"
                />
                <p className="mt-1 truncate text-xs text-muted-foreground" title={url}>
                  {url}
                </p>
              </div>
              {!isEditMode && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  title="Use a different link"
                  onClick={() => {
                    setPreview(null);
                    setErrors([]);
                  }}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <p className="text-sm font-medium">
                  Tags <span className="text-muted-foreground">(pick at least one)</span>
                </p>
                <span className="text-xs text-muted-foreground">
                  {selected.length}/{MAX_CATEGORIES}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {categories.map((category) => {
                  const isSelected = selected.includes(category);
                  const isFull = selected.length >= MAX_CATEGORIES && !isSelected;
                  return (
                    <Badge
                      key={category}
                      variant={isSelected ? "default" : "secondary"}
                      onClick={() => !isFull && toggleCategory(category)}
                      className={cn(
                        "cursor-pointer select-none gap-1 rounded-full",
                        isFull && "cursor-not-allowed opacity-40",
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                      {category}
                    </Badge>
                  );
                })}
              </div>
            </div>

            <Textarea
              name="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={500}
              placeholder="Why is it good? (optional)"
              rows={2}
            />

            {errors.length > 0 && (
              <div className="text-sm text-red-500">
                {errors.map((error, index) => (
                  <p key={index}>{error}</p>
                ))}
              </div>
            )}

            <div className="flex justify-between gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={selected.length === 0}>
                {isEditMode ? "Save changes" : "Add to leaderboard"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
