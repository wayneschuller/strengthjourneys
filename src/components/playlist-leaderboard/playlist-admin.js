import { useState, useEffect } from "react";
import { Edit, Trash, FolderSync } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------------------------------
// <PlaylistAdminTools /> stuff for maintenance. To use: add a Google email to .env or Vercel env settings
// ---------------------------------------------------------------------------------------------------
export function PlaylistAdminTools({ playlist, onEdit, onDelete, className }) {
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
    <div className={cn("mt-4", className)}>
      <Separator />
      <div className="mt-2 flex flex-wrap items-center gap-2 md:justify-end">
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
}
