/**
 * The row of actions that closes out a log session: ask the AI coach about it,
 * head back to the dashboard, or delete the day.
 *
 * The delete path keeps its two-step confirm and the confirm panel renders
 * below the row rather than inside it, so the destructive question gets the
 * full width and never sits a thumb-width from the AI button on a phone.
 */

import Link from "next/link";
import { Bot, LayoutDashboard, Loader2, Trash2, X } from "lucide-react";

import { getLongReadableDateString } from "@/lib/date-utils";
import { stashAiAssistantPrompt } from "@/lib/ai-review-prompts";
import { Button } from "@/components/ui/button";

export function SessionFooterActions({
  aiReviewLink,
  isToday,
  isStructuralSaving,
  onCancel,
  onConfirm,
  onRequestConfirm,
  previewMode,
  sessionDate,
  showConfirm,
}) {
  const canDelete = !previewMode;

  return (
    <div className="border-border/40 mt-4 space-y-3 border-t pt-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        {aiReviewLink && (
          <Button asChild variant="outline" className="flex-1 gap-2">
            <Link
              href={aiReviewLink.href}
              onClick={() => stashAiAssistantPrompt(aiReviewLink)}
            >
              <Bot className="h-4 w-4" />
              <span>
                {isToday
                  ? "Review today with AI"
                  : "Review this session with AI"}
              </span>
            </Link>
          </Button>
        )}

        <Button asChild variant="outline" className="flex-1 gap-2">
          <Link href="/">
            <LayoutDashboard className="h-4 w-4" />
            <span>Back to your dashboard</span>
          </Link>
        </Button>

        {canDelete && !showConfirm && (
          <Button
            variant="destructive"
            className="flex-1 gap-2"
            onClick={onRequestConfirm}
          >
            <Trash2 className="h-4 w-4" />
            <span>Delete this session</span>
          </Button>
        )}
      </div>

      {canDelete && showConfirm && (
        <div className="border-destructive/30 bg-destructive/5 flex flex-wrap items-center justify-center gap-3 rounded-lg border px-4 py-3">
          <p className="text-muted-foreground text-sm">
            {isStructuralSaving
              ? "Finish the current sheet change, then delete this session."
              : `Delete all rows for ${getLongReadableDateString(sessionDate) ?? sessionDate}?`}
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
