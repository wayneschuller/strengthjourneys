import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogDescription,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { PLAYLIST_REPORT_REASONS } from "@/components/playlist-leaderboard/playlist-utils";

/**
 * Report dialog for a single playlist. Automated moderation can't be trusted on borderline
 * cover art, so this is how a visitor tells us about something that slipped through.
 * @param {Object} props
 * @param {Object|null} props.playlist - The playlist being reported; null closes the dialog.
 * @param {Function} props.onOpenChange - Called with false when the dialog should close.
 * @param {Function} props.onReported - Called with the playlist id once a report is accepted.
 */
export function PlaylistReportDialog({ playlist, onOpenChange, onReported }) {
  const [reason, setReason] = useState(PLAYLIST_REPORT_REASONS[0].value);
  const [note, setNote] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);

  const handleOpenChange = (open) => {
    if (!open) {
      setReason(PLAYLIST_REPORT_REASONS[0].value);
      setNote("");
      setError(null);
    }
    onOpenChange(open);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!playlist) return;

    setIsSending(true);
    setError(null);

    try {
      const response = await fetch("/api/report-playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: playlist.id, reason, note }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Could not send the report");
      }

      onReported(playlist.id);
      handleOpenChange(false);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={Boolean(playlist)} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report this playlist</DialogTitle>
          <DialogDescription>
            {playlist
              ? `Tell us what's wrong with "${playlist.title}" and it goes straight to the site owner.`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <RadioGroup value={reason} onValueChange={setReason} className="gap-2">
            {PLAYLIST_REPORT_REASONS.map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <RadioGroupItem value={option.value} id={`reason-${option.value}`} />
                <Label htmlFor={`reason-${option.value}`} className="font-normal">
                  {option.label}
                </Label>
              </div>
            ))}
          </RadioGroup>

          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={500}
            placeholder="Anything else we should know? (optional)"
          />

          {error && <p className="text-sm text-red-500">{error}</p>}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={isSending}>
              {isSending ? "Sending..." : "Send report"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
