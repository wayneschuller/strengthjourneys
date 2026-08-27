import { useState, useEffect } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogDescription,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Eye, EyeOff, Check, Ban, RefreshCw } from "lucide-react";

const STATUS_COPY = {
  approved: {
    label: "Approved",
    variant: "default",
    blurb: "This art is live on the public leaderboard.",
  },
  rejected: {
    label: "Blocked",
    variant: "destructive",
    blurb:
      "Image moderation flagged this. The playlist is live but the art is hidden from visitors.",
  },
  pending: {
    label: "Unreviewed",
    variant: "secondary",
    blurb:
      "Moderation couldn't return a verdict, so the art is withheld until you decide.",
  },
  legacy: {
    label: "Never checked",
    variant: "outline",
    blurb:
      "Stored before image moderation existed. Still shown publicly — re-check it to get a verdict.",
  },
};

/**
 * Admin-only cover art review. The public page never receives unapproved art, so this dialog
 * pulls it from the admin endpoint instead of the page props.
 * @param {Object} props
 * @param {Object|null} props.playlist - Playlist under review; null keeps the dialog closed.
 * @param {Function} props.onOpenChange - Called with false when the dialog should close.
 * @param {Function} props.onUpdated - Called with the updated playlist after an approve/reject.
 */
export function PlaylistArtReviewDialog({ playlist, onOpenChange, onUpdated }) {
  const [art, setArt] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [error, setError] = useState(null);

  const playlistId = playlist?.id;

  useEffect(() => {
    if (!playlistId) return;

    let isCurrent = true;
    setIsLoading(true);
    setError(null);
    setArt(null);
    setIsRevealed(false);

    fetch(`/api/playlist-art?id=${playlistId}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load the cover art");
        return response.json();
      })
      .then((data) => {
        if (!isCurrent) return;
        setArt(data);
        // Art that is already public holds no surprises, so don't make the admin click twice.
        setIsRevealed(data.thumbnailStatus === "approved" || data.thumbnailStatus === "legacy");
      })
      .catch((loadError) => isCurrent && setError(loadError.message))
      .finally(() => isCurrent && setIsLoading(false));

    return () => {
      isCurrent = false;
    };
  }, [playlistId]);

  const runAction = async (action) => {
    setPendingAction(action);
    setError(null);

    try {
      const response = await fetch("/api/playlist-art", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: playlistId, action }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Action failed");

      onUpdated?.(data.playlist);

      if (action === "recheck") {
        setArt((prev) => ({ ...prev, thumbnailStatus: data.playlist.thumbnailStatus }));
      } else {
        onOpenChange(false);
      }
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setPendingAction(null);
    }
  };

  const status = art?.thumbnailStatus;
  const copy = STATUS_COPY[status] || STATUS_COPY.pending;
  const isBusy = Boolean(pendingAction);

  return (
    <Dialog open={Boolean(playlist)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Review cover art</DialogTitle>
          <DialogDescription className="break-words">
            {playlist ? playlist.title : ""}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
            <Spinner className="h-4 w-4" />
            Loading art...
          </div>
        )}

        {!isLoading && art && !art.thumbnailUrl && (
          <p className="py-6 text-center text-muted-foreground">
            This playlist has no cover art stored.
          </p>
        )}

        {!isLoading && art?.thumbnailUrl && (
          <div className="min-w-0 space-y-4">
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => setIsRevealed((prev) => !prev)}
                className="group relative h-48 w-48 overflow-hidden rounded-lg border"
                title={isRevealed ? "Hide" : "Reveal"}
              >
                <Image
                  src={art.thumbnailUrl}
                  alt="Cover art under review"
                  fill
                  unoptimized
                  sizes="192px"
                  className={cn(
                    "object-cover transition-all",
                    !isRevealed && "blur-2xl",
                  )}
                />
                <span className="absolute bottom-1 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-background/90 text-foreground shadow">
                  {isRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </span>
              </button>

              <Badge variant={copy.variant}>{copy.label}</Badge>
              <p className="text-center text-sm text-muted-foreground">{copy.blurb}</p>
            </div>

            {error && <p className="text-center text-sm text-red-500">{error}</p>}

            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isBusy}
                onClick={() => runAction("recheck")}
              >
                <RefreshCw
                  className={cn(
                    "mr-1 h-4 w-4",
                    pendingAction === "recheck" && "animate-spin",
                  )}
                />
                Re-run moderation
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={isBusy || status === "rejected"}
                  onClick={() => runAction("reject")}
                >
                  <Ban className="mr-1 h-4 w-4" />
                  Hide art
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={isBusy || status === "approved"}
                  onClick={() => runAction("approve")}
                >
                  <Check className="mr-1 h-4 w-4" />
                  Approve
                </Button>
              </div>
            </DialogFooter>
          </div>
        )}

        {!isLoading && error && !art && (
          <p className="py-6 text-center text-sm text-red-500">{error}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
