/**
 * The row of actions that closes out a log session: ask the AI coach about it,
 * head back to the dashboard, or delete the day.
 *
 * The main actions are tall and share the row. Delete stays red and only as
 * wide as its label, with the confirm step on its own line underneath so the
 * destructive question never sits a thumb-width from the AI button.
 */

import Link from "next/link";
import { Bot, LayoutDashboard, Loader2, Trash2, X } from "lucide-react";

import { getLongReadableDateString } from "@/lib/date-utils";
import { stashAiAssistantPrompt } from "@/lib/ai-review-prompts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Shared with the collapsed "Add a lift" control so the row under a session
// reads as one set of actions: tall, card-like, and the same height.
export const logFatActionClass =
  "h-14 w-full justify-center gap-2.5 rounded-xl bg-card px-5 shadow-sm";

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
  embedded = false,
}) {
  const canDelete = !previewMode;
  const reviewLabel = isToday
    ? "Review today with AI"
    : "Review this session with AI";

  const review = aiReviewLink ? (
    <Button
      asChild
      variant="outline"
      className={cn(
        logFatActionClass,
        !embedded && "sm:flex-1",
        embedded && "sm:col-start-2 sm:row-start-1",
      )}
    >
      <Link
        href={aiReviewLink.href}
        onClick={() => stashAiAssistantPrompt(aiReviewLink)}
      >
        <Bot />
        <span>{reviewLabel}</span>
      </Link>
    </Button>
  ) : null;

  const dashboard = (
    <Button
      asChild
      variant="outline"
      className={cn(
        logFatActionClass,
        !embedded && "sm:flex-1",
        embedded &&
          (aiReviewLink
            ? "sm:col-start-3 sm:row-start-1"
            : "sm:col-start-2 sm:row-start-1"),
      )}
    >
      <Link href="/">
        <LayoutDashboard />
        <span>Back to your dashboard</span>
      </Link>
    </Button>
  );

  // Hug the label. The other actions fill the row; this one stays a
  // smaller red control so deleting a day is available without dominating it.
  const deleteButton =
    canDelete && !showConfirm ? (
      <div className={cn("flex justify-end", embedded && "sm:col-span-full")}>
        <Button
          variant="destructive"
          className="h-12 gap-2 rounded-xl px-5 shadow-sm"
          onClick={onRequestConfirm}
        >
          <Trash2 />
          <span>Delete this session</span>
        </Button>
      </div>
    ) : null;

  const confirm =
    canDelete && showConfirm ? (
      <div
        className={cn(
          "border-destructive/30 bg-destructive/5 flex flex-wrap items-center justify-center gap-3 rounded-xl border px-4 py-3",
          embedded && "sm:col-span-full",
        )}
      >
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
    ) : null;

  if (embedded) {
    return (
      <>
        {review}
        {dashboard}
        {deleteButton}
        {confirm}
      </>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        {review}
        {dashboard}
      </div>
      {deleteButton}
      {confirm}
    </div>
  );
}
