import { useState } from "react";
import {
  Edit,
  Trash,
  FolderSync,
  RefreshCw,
  MoreVertical,
  ShieldCheck,
  Flag,
  ImageOff,
  ScanEye,
  Unlink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Page-level admin strip for the playlist leaderboard. Site-wide actions live here rather than
 * being stamped onto every card — revalidation applies to the whole page, not one playlist.
 * @param {Object} props
 * @param {number} props.playlistCount - How many playlists are currently loaded.
 * @param {number} props.reportCount - Total visitor reports across all playlists.
 */
export function PlaylistAdminBanner({
  playlistCount,
  reportCount,
  withheldArtCount,
  brokenLinkCount,
  className,
}) {
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [isSweeping, setIsSweeping] = useState(false);

  const handleSweep = async () => {
    if (
      !confirm(
        "Run the health sweep? This re-checks every playlist link and re-moderates every cover image.",
      )
    ) {
      return;
    }

    setIsSweeping(true);
    try {
      const response = await fetch("/api/playlist-health", { method: "POST" });
      const data = await response.json();

      if (response.ok) {
        const s = data.summary;
        alert(
          `Health sweep complete.\n\nLinks checked: ${s.checked}\n  live: ${s.live}\n  unreachable: ${s.unreachable}\n  no verdict: ${s.unknown}\n  newly broken: ${s.newlyBroken}\n  recovered: ${s.recovered}\n\nCover art re-checked: ${s.artRechecked}\n  blocked: ${s.artBlocked}\n\nReload to see the updated page.`,
        );
      } else {
        alert(data?.error || "Sweep failed");
      }
    } catch (error) {
      console.error("Error running health sweep:", error);
      alert("Sweep failed");
    } finally {
      setIsSweeping(false);
    }
  };

  const handleRevalidate = async () => {
    setIsRevalidating(true);
    try {
      // This api route will check server side for an admin auth account
      const response = await fetch("/api/revalidate-leaderboard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
    <div
      className={cn(
        "mb-6 flex flex-col gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <span className="font-semibold">Admin mode</span>
        <span className="text-muted-foreground">
          {playlistCount} playlist{playlistCount === 1 ? "" : "s"}
        </span>
        {reportCount > 0 && (
          <Badge variant="destructive" className="gap-1">
            <Flag className="h-3 w-3" />
            {reportCount} report{reportCount === 1 ? "" : "s"}
          </Badge>
        )}
        {brokenLinkCount > 0 && (
          <Badge variant="destructive" className="gap-1">
            <Unlink className="h-3 w-3" />
            {brokenLinkCount} broken link{brokenLinkCount === 1 ? "" : "s"}
          </Badge>
        )}
        {withheldArtCount > 0 && (
          <Badge variant="secondary" className="gap-1">
            <ImageOff className="h-3 w-3" />
            {withheldArtCount} art withheld
          </Badge>
        )}
        <span className="text-xs text-muted-foreground">
          Per-playlist tools are in the ⋮ menu on each card.
        </span>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSweep}
          disabled={isSweeping}
          className="flex items-center"
        >
          <ScanEye className={cn("mr-1 h-4 w-4", isSweeping && "animate-pulse")} />
          {isSweeping ? "Sweeping..." : "Run health sweep"}
        </Button>
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
      </div>
    </div>
  );
}

/**
 * Per-playlist admin actions, collapsed into a single overflow menu so the card doesn't carry a
 * toolbar. Only rendered when the signed-in user matches the admin Google email set in
 * environment variables.
 * @param {Object} props
 * @param {Object} props.playlist - The playlist data object passed through to the edit and delete callbacks.
 * @param {Function} props.onEdit - Callback invoked with the playlist object when Edit is chosen.
 * @param {Function} props.onDelete - Callback invoked with the playlist ID when Delete is chosen.
 * @param {Function} props.onRefresh - Callback invoked with the refreshed playlist after a metadata pull.
 */
export function PlaylistAdminMenu({
  playlist,
  onEdit,
  onDelete,
  onRefresh,
  onReviewArt,
  className,
}) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const reportCount = playlist.reportCount || 0;
  const artStatus = playlist.thumbnailStatus;
  const needsArtReview = artStatus === "pending" || artStatus === "rejected";

  const handleRefreshMetadata = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch(`/api/playlists?id=${playlist.id}`, {
        method: "PATCH",
      });
      if (response.ok) {
        const data = await response.json();
        onRefresh?.(data.playlist);
      } else {
        alert("Metadata refresh failed");
      }
    } catch (error) {
      console.error("Error refreshing metadata:", error);
      alert("Metadata refresh failed");
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Admin tools for this playlist"
          title="Admin tools"
          className={cn("relative h-7 w-7 text-muted-foreground", className)}
        >
          <MoreVertical className="h-4 w-4" />
          {reportCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
              {reportCount}
            </span>
          )}
          {reportCount === 0 && needsArtReview && (
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-500" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Admin tools
        </DropdownMenuLabel>
        {reportCount > 0 && (
          <DropdownMenuLabel className="flex items-center gap-2 pt-0 text-xs font-normal text-destructive">
            <Flag className="h-3 w-3" />
            {reportCount} visitor report{reportCount === 1 ? "" : "s"}
          </DropdownMenuLabel>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onReviewArt(playlist)}>
          <ScanEye className="mr-2 h-4 w-4" />
          Review cover art
          {artStatus && artStatus !== "approved" && (
            <span className="ml-auto text-xs text-muted-foreground">
              {artStatus === "legacy" ? "unchecked" : artStatus}
            </span>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onEdit(playlist)}>
          <Edit className="mr-2 h-4 w-4" />
          Edit playlist
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isRefreshing}
          onSelect={(event) => {
            event.preventDefault();
            handleRefreshMetadata();
          }}
        >
          <RefreshCw className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")} />
          {isRefreshing ? "Refreshing..." : "Refresh metadata"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={() => onDelete(playlist.id)}
        >
          <Trash className="mr-2 h-4 w-4" />
          Delete playlist
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
