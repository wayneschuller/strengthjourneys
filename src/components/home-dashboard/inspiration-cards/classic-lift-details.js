// Shows the compact context line and optional note for a remembered classic lift.
// Keep the date tied to the log page so dashboard nostalgia can jump back into the session.
import Link from "next/link";
import { useState } from "react";
import { format } from "date-fns";

import { STRENGTH_LEVEL_EMOJI } from "@/hooks/use-athlete-biodata";

export function ClassicLiftDetails({ classicLiftMemory }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!classicLiftMemory?.lift) return null;

  const note = classicLiftMemory.lift.notes?.trim() ?? "";
  const hasNote = note.length > 0;
  const maxPreviewChars = 88;
  const isLongNote = note.length > maxPreviewChars;
  const previewNote =
    isLongNote && !isExpanded ? `${note.slice(0, maxPreviewChars).trim()}...` : note;
  const logDateHref = `/log?date=${classicLiftMemory.lift.date}`;

  return (
    <div className="space-y-0.5">
      <div className="line-clamp-1">
        {classicLiftMemory.reasonLabel} ·{" "}
        <Link href={logDateHref} className="hover:text-foreground hover:underline">
          {format(new Date(classicLiftMemory.lift.date), "d MMM yyyy")}
        </Link>
        {classicLiftMemory.strengthRating
          ? ` · ${STRENGTH_LEVEL_EMOJI[classicLiftMemory.strengthRating] ?? ""} ${classicLiftMemory.strengthRating}`
          : ""}
      </div>

      {hasNote && (
        <div className="text-muted-foreground/90">
          <span className={isExpanded ? "whitespace-pre-wrap break-words" : ""}>
            &ldquo;{previewNote}&rdquo;
          </span>
          {isLongNote && (
            <button
              type="button"
              className="ml-1 inline font-medium text-primary hover:underline"
              onClick={() => setIsExpanded((value) => !value)}
            >
              {isExpanded ? "Less" : "More"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
