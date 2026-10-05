// Asks before a merge adds sets for lifts the sheet already has those days.
//
// The duplicate check (src/lib/import/dedupe.js) cannot safely match a session
// the lifter also typed into their sheet under their own exercise names,
// loads and set counts, but it can see that the sets left over are for lifts
// already logged that day. Those are most likely the same training twice, and
// a merge writes them into the lifter's own sheet, so the first press of a
// merge button explains and the second goes ahead.
//
// Every place a merge can start uses this, so they all ask the same way.

import { useCallback, useRef } from "react";

import { useToast } from "@/hooks/use-toast";
import { describeOverlappingSets } from "@/lib/import/dedupe";

/**
 * @returns {(comparison: { overlapCount: number, newCount: number,
 *   formatId?: string }) => boolean} Call it with what the duplicate check
 *   found. True means go ahead: there was nothing to ask, or the lifter has
 *   already been asked about this same comparison. False means the question
 *   was just put and the merge should wait for the next press.
 */
export function useMergeOverlapAsk() {
  const { toast } = useToast();
  const askedAboutRef = useRef(null);

  return useCallback(
    ({ overlapCount, newCount, formatId }) => {
      const question = describeOverlappingSets(
        overlapCount,
        newCount,
        formatId,
      );
      if (!question) return true;

      // A different file, or a sheet that has changed since, is asked afresh.
      const comparison = `${formatId}|${newCount}|${overlapCount}`;
      if (askedAboutRef.current === comparison) return true;
      askedAboutRef.current = comparison;

      toast({
        title: "Your sheet may already have these",
        description: `${question} Press merge again to add them.`,
        duration: 20000,
      });
      return false;
    },
    [toast],
  );
}
