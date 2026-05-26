/**
 * Delete-session confirmation controls for linked-sheet log sessions.
 */

import { Loader2, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";

export function DeleteSessionControls({
  isStructuralSaving,
  onCancel,
  onConfirm,
  onRequestConfirm,
  sessionDate,
  showConfirm,
}) {
  return (
    <div className="flex justify-center pt-2">
      {!showConfirm ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive gap-2"
          onClick={onRequestConfirm}
        >
          <Trash2 className="h-4 w-4" />
          Delete this session
        </Button>
      ) : (
        <div className="border-destructive/30 bg-destructive/5 flex items-center gap-3 rounded-lg border px-4 py-3">
          <p className="text-muted-foreground text-sm">
            {isStructuralSaving
              ? "Finish the current sheet change, then delete this session."
              : `Delete all rows for ${sessionDate}?`}
          </p>
          <Button
            size="sm"
            variant="destructive"
            onClick={onConfirm}
            disabled={isStructuralSaving}
          >
            {isStructuralSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Waiting...
              </>
            ) : (
              "Delete"
            )}
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
