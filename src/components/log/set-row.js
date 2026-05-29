/**
 * Editable persisted set row for the session log.
 * Keeps local draft and optimistic state while sheet writes settle.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { motion } from "motion/react";
import { Link2, Loader2, PlayCircle, Trash2 } from "lucide-react";

import { getCelebrationStyles } from "@/lib/celebration";
import { getSetIdentityKey } from "@/lib/pr-ranking";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getLiftDetailUrl } from "@/components/lift-type-indicator";
import {
  getEditableSetFields,
  parseWeightInput,
} from "@/components/log/sheet-snapshot-utils";
import { CelebrationReveal } from "@/components/log/celebration-reveal";
import { UnitLabel } from "@/components/log/unit-label";

// --- Set row (click-to-edit) ---
// Layout: [reps] @ [weight][unit]  [notes flex-1]  [PR]

export function SetRow({
  set,
  isMetric,
  prMeta,
  celebration,
  isActiveCelebration,
  shouldPassiveAnimate,
  passiveDelay = 0,
  onOptimisticFieldsChange,
  onUpdate,
  onDelete,
  isDeleteDisabled = false,
  strengthBadge,
  usedSessionUrls,
  onSessionUrlAccepted,
}) {
  const isLocked = Boolean(set._pending);
  const isReadOnly = !onUpdate;
  const [editingReps, setEditingReps] = useState(false);
  const [editingWeight, setEditingWeight] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [draftReps, setDraftReps] = useState(String(set.reps ?? ""));
  const [draftWeight, setDraftWeight] = useState(String(set.weight ?? ""));
  const [draftNotes, setDraftNotes] = useState(set.notes ?? "");
  const [draftUrl, setDraftUrl] = useState(set.URL ?? "");
  const urlInputRef = useRef(null);
  const prefUnit = isMetric ? "kg" : "lb";
  const unitMismatch = set.unitType && set.unitType !== prefUnit;

  // Optimistic display: holds committed value until parsedData catches up
  const [pendingReps, setPendingReps] = useState(null);
  const [pendingWeight, setPendingWeight] = useState(null);
  const [pendingNotes, setPendingNotes] = useState(null);
  const [pendingUrl, setPendingUrl] = useState(null);
  const latestFieldsRef = useRef(getEditableSetFields(set));

  // Debounced update: coalesce rapid changes (spinner arrows, keyboard arrows)
  // into a single API call. Each commit merges into latestFieldsRef so a quick
  // reps-then-weight edit still sends the final combined snapshot.
  const updateTimerRef = useRef(null);
  const scheduleUpdate = useCallback(
    (update) => {
      latestFieldsRef.current = update.nextFields;
      if (updateTimerRef.current) clearTimeout(updateTimerRef.current);
      updateTimerRef.current = setTimeout(() => {
        updateTimerRef.current = null;
        onUpdate(update);
      }, 800);
    },
    [onUpdate],
  );
  const flushUpdate = useCallback(
    (update) => {
      latestFieldsRef.current = update.nextFields;
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
        updateTimerRef.current = null;
      }
      onUpdate(update);
    },
    [onUpdate],
  );
  // Flush any pending debounced update on unmount
  useEffect(
    () => () => {
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
        updateTimerRef.current = null;
      }
    },
    [],
  );

  // Keep drafts in sync if SWR refreshes parsedData
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- draft state intentionally tracks external SWR refreshes
    setDraftReps(String(set.reps ?? ""));
  }, [set.reps]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- draft state intentionally tracks external SWR refreshes
    setDraftWeight(String(set.weight ?? ""));
  }, [set.weight]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- draft state intentionally tracks external SWR refreshes
    setDraftNotes(set.notes ?? "");
  }, [set.notes]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- draft state intentionally tracks external SWR refreshes
    setDraftUrl(set.URL ?? "");
  }, [set.URL]);

  // Clear pending once parsedData reflects the committed value
  useEffect(() => {
    if (pendingReps !== null && set.reps === pendingReps) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- optimistic local state clears when server data catches up
      setPendingReps(null);
    }
  }, [set.reps, pendingReps]);
  useEffect(() => {
    if (pendingWeight !== null && set.weight === pendingWeight) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- optimistic local state clears when server data catches up
      setPendingWeight(null);
    }
  }, [set.weight, pendingWeight]);
  useEffect(() => {
    if (pendingNotes !== null && (set.notes ?? "") === pendingNotes) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- optimistic local state clears when server data catches up
      setPendingNotes(null);
    }
  }, [set.notes, pendingNotes]);
  useEffect(() => {
    if (pendingUrl !== null && (set.URL ?? "") === pendingUrl) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- optimistic local state clears when server data catches up
      setPendingUrl(null);
    }
  }, [set.URL, pendingUrl]);
  useEffect(() => {
    latestFieldsRef.current = {
      reps: pendingReps ?? set.reps,
      weight: pendingWeight ?? set.weight,
      unitType: set.unitType ?? "",
      notes: pendingNotes ?? set.notes ?? "",
      url: pendingUrl ?? set.URL ?? "",
    };
  }, [
    set.reps,
    set.weight,
    set.unitType,
    set.notes,
    set.URL,
    pendingReps,
    pendingWeight,
    pendingNotes,
    pendingUrl,
  ]);

  const displayReps = pendingReps !== null ? pendingReps : set.reps;
  const displayWeight = pendingWeight !== null ? pendingWeight : set.weight;
  const displayNotes = pendingNotes !== null ? pendingNotes : (set.notes ?? "");
  const displayUrl = pendingUrl !== null ? pendingUrl : (set.URL ?? "");
  const prToneClass =
    prMeta?.status === "lifetime"
      ? "text-amber-600"
      : prMeta?.status === "yearly"
        ? "text-blue-500"
        : "text-muted-foreground/45";
  const rankingSummary = prMeta?.message ?? null;
  const celebrationStyles = getCelebrationStyles({
    ...celebration,
    scope: prMeta?.scope ?? null,
  });
  const rowKey = getSetIdentityKey(set);
  const optimisticFields = useMemo(() => {
    const hasOptimisticOverride =
      pendingReps !== null || pendingWeight !== null || pendingNotes !== null || pendingUrl !== null;

    if (!hasOptimisticOverride) return null;

    return {
      reps: pendingReps ?? set.reps,
      weight: pendingWeight ?? set.weight,
      unitType: set.unitType ?? "",
      notes: pendingNotes ?? set.notes ?? "",
      url: pendingUrl ?? set.URL ?? "",
    };
  }, [
    pendingReps,
    pendingWeight,
    pendingNotes,
    pendingUrl,
    set.reps,
    set.weight,
    set.unitType,
    set.notes,
    set.URL,
  ]);

  useEffect(() => {
    if (!onOptimisticFieldsChange) return undefined;
    onOptimisticFieldsChange(rowKey, optimisticFields);
    return () => onOptimisticFieldsChange(rowKey, null);
  }, [rowKey, optimisticFields, onOptimisticFieldsChange]);

  function commitReps() {
    if (isLocked) return;
    setEditingReps(false);
    const parsed = parseInt(draftReps, 10);
    if (!isNaN(parsed) && parsed !== latestFieldsRef.current.reps) {
      const beforeFields = latestFieldsRef.current;
      const nextFields = { ...beforeFields, reps: parsed };
      setPendingReps(parsed);
      scheduleUpdate({
        field: "reps",
        beforeFields,
        nextFields,
      });
    }
  }

  function commitWeight() {
    if (isLocked) return;
    setEditingWeight(false);
    const num = parseWeightInput(draftWeight);
    if (!isNaN(num) && num !== latestFieldsRef.current.weight) {
      const beforeFields = latestFieldsRef.current;
      const nextFields = { ...beforeFields, weight: num };
      setPendingWeight(num);
      scheduleUpdate({
        field: "weight",
        beforeFields,
        nextFields,
      });
    }
  }

  function commitNotes() {
    if (isLocked) return;
    const trimmed = draftNotes.trim();
    if (trimmed !== (latestFieldsRef.current.notes ?? "").trim()) {
      const beforeFields = latestFieldsRef.current;
      const nextFields = { ...beforeFields, notes: trimmed };
      setPendingNotes(trimmed);
      flushUpdate({
        field: "notes",
        beforeFields,
        nextFields,
      });
    }
  }

  function commitUrl() {
    if (isLocked) return;
    const trimmed = draftUrl.trim();
    if (trimmed !== (latestFieldsRef.current.url ?? "").trim()) {
      const beforeFields = latestFieldsRef.current;
      const nextFields = { ...beforeFields, url: trimmed };
      setPendingUrl(trimmed);
      onSessionUrlAccepted?.(trimmed);
      flushUpdate({
        field: "url",
        beforeFields,
        nextFields,
      });
    }
  }

  function closeNotesEdit() {
    setEditingNotes(false);
    commitNotes();
    commitUrl();
  }

  function openNotesEdit() {
    setEditingNotes(true);
    // Try to pre-fill URL from clipboard if the field is currently empty
    // and the URL hasn't already been assigned to another set this session.
    if (!draftUrl && navigator?.clipboard?.readText) {
      navigator.clipboard.readText().then((text) => {
        const trimmed = text?.trim() ?? "";
        if (isHttpUrl(trimmed)) {
          if (!usedSessionUrls?.has(trimmed)) {
            setDraftUrl(trimmed);
          }
        }
      }).catch(() => {});
    }
  }

  const hasBadges = !set._pending && Boolean(strengthBadge);
  const metaBadgeClassName = "h-8 rounded-full px-3 text-xs font-semibold";
  const prBadgeHref = getLogPRBadgeHref(set.liftType);
  const prBadgeTooltip = getLogPRBadgeTooltip(set.liftType);

  return (
    <motion.div
      className={cn("group py-3", celebrationStyles.rowClassName)}
      initial={shouldPassiveAnimate ? { opacity: 0, y: 12 } : false}
      animate={{
        opacity: 1,
        y: 0,
        boxShadow: isActiveCelebration
          ? [
              "0 0 0 rgba(0,0,0,0)",
              prMeta?.scope === "lifetime"
                ? "0 0 0 2px rgba(251,191,36,0.35), 0 18px 40px -22px rgba(245,158,11,0.8)"
                : "0 0 0 2px rgba(96,165,250,0.28), 0 18px 40px -22px rgba(59,130,246,0.75)",
              "0 0 0 rgba(0,0,0,0)",
            ]
          : "0 0 0 rgba(0,0,0,0)",
      }}
      transition={{
        opacity: shouldPassiveAnimate
          ? { duration: 0.28, delay: passiveDelay, ease: "easeOut" }
          : { duration: 0.18, ease: "easeOut" },
        y: shouldPassiveAnimate
          ? { duration: 0.32, delay: passiveDelay, ease: "easeOut" }
          : { duration: 0.18, ease: "easeOut" },
        boxShadow: { duration: 0.6, ease: "easeOut" },
      }}
    >
      {/* Main row: reps@weight + notes + desktop meta rail */}
      <div className="flex items-center gap-4">
        {/* Reps @ Weight unit — tight visual unit.
            Reps right-aligned in w-7 (enough for 1–2 digits), weight auto-width.
            min-w keeps notes aligned across rows with different weight widths. */}
        <div className="flex min-w-[7.5rem] items-center">
          <div className="w-7">
            {editingReps && !isReadOnly ? (
              <input
                type="number"
                className="border-primary w-10 rounded border px-1 py-0.5 text-right text-xl font-semibold tabular-nums focus:outline-none"
                value={draftReps}
                disabled={isLocked}
                onChange={(e) => setDraftReps(e.target.value)}
                onBlur={commitReps}
                onKeyDown={(e) => e.key === "Enter" && commitReps()}
                autoFocus
              />
            ) : isLocked || isReadOnly ? (
              <div className="text-foreground/80 w-full py-0.5 text-right text-xl font-semibold tabular-nums">
                {displayReps}
              </div>
            ) : (
              <button
                className="hover:bg-muted/60 w-full rounded py-0.5 text-right text-xl font-semibold tabular-nums"
                onClick={() => setEditingReps(true)}
              >
                {displayReps}
              </button>
            )}
          </div>
          <span className="text-muted-foreground mx-0.5 text-base">@</span>
          {editingWeight && !isReadOnly ? (
            <input
              type="text"
              inputMode="decimal"
              className="border-primary w-20 rounded border px-1 py-0.5 text-xl font-semibold tabular-nums focus:outline-none"
              value={draftWeight}
              disabled={isLocked}
              onChange={(e) => setDraftWeight(e.target.value)}
              onBlur={commitWeight}
              onKeyDown={(e) => e.key === "Enter" && commitWeight()}
              autoFocus
            />
          ) : isLocked || isReadOnly ? (
            <div className="text-foreground/80 py-0.5 text-left text-xl font-semibold tabular-nums">
              {displayWeight}
            </div>
          ) : (
            <button
              className="hover:bg-muted/60 rounded py-0.5 text-left text-xl font-semibold tabular-nums"
              onClick={() => setEditingWeight(true)}
            >
              {displayWeight}
            </button>
          )}
          <UnitLabel unitType={set.unitType} mismatch={unitMismatch} />
        </div>

        {/* Notes + URL — flex-1, tap to edit */}
        <div className="min-w-0 flex-1 md:max-w-[calc(100%-18rem)]">
          {editingNotes && !isReadOnly ? (
            <div className="space-y-1">
              <input
                type="text"
                className="border-input text-muted-foreground focus:border-primary w-full border-b bg-transparent py-0.5 text-xs focus:outline-none"
                value={draftNotes}
                disabled={isLocked}
                onChange={(e) => setDraftNotes(e.target.value)}
                onBlur={(e) => {
                  commitNotes();
                  // Only close if focus isn't moving to the URL input
                  if (e.relatedTarget !== urlInputRef.current) {
                    setEditingNotes(false);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    urlInputRef.current?.focus();
                  } else if (e.key === "Escape") {
                    closeNotesEdit();
                  }
                }}
                placeholder="notes..."
                autoFocus
              />
              <div className="flex items-center gap-1">
                <Link2 className="text-muted-foreground/40 h-3 w-3 shrink-0" />
                <input
                  ref={urlInputRef}
                  type="url"
                  className="border-input text-muted-foreground focus:border-primary min-w-0 flex-1 border-b bg-transparent py-0.5 text-xs focus:outline-none"
                  value={draftUrl}
                  disabled={isLocked}
                  onChange={(e) => setDraftUrl(e.target.value)}
                  onBlur={() => { commitUrl(); setEditingNotes(false); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "Escape") {
                      closeNotesEdit();
                    }
                  }}
                  placeholder="video link..."
                />
              </div>
            </div>
          ) : (
            <div className="space-y-0.5">
              {isLocked || isReadOnly ? (
                <div className="text-muted-foreground/50 w-full text-left text-xs italic">
                  {displayNotes || (isReadOnly ? "" : "notes...")}
                </div>
              ) : (
                <button
                  className="text-muted-foreground/50 hover:text-muted-foreground w-full text-left text-xs italic"
                  onClick={openNotesEdit}
                >
                  {displayNotes || "notes..."}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Video link — only shown when URL is populated */}
        {displayUrl && (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={displayUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground/50 hover:text-foreground shrink-0 rounded p-1 transition-colors"
                  aria-label="Watch video"
                >
                  <PlayCircle className="h-4 w-4" />
                </a>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Watch video</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <div className="hidden w-[17rem] shrink-0 items-center justify-end gap-2 md:flex">
          {set._pending ? (
            <Loader2 className="text-muted-foreground/50 h-3 w-3 animate-spin" />
          ) : (
            <>
              <div className="ml-auto flex items-center gap-2">
                {strengthBadge && (
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex">{strengthBadge}</span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p>View detailed strength levels</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {rankingSummary && (
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link href={prBadgeHref} className="inline-flex">
                          <CelebrationReveal
                            animationKey={`desktop-rank-${set.rowIndex ?? set._tempId ?? "pending"}-${rankingSummary}`}
                          >
                            <Badge
                              variant="outline"
                              className={cn(
                                metaBadgeClassName,
                                "max-w-[10.5rem]",
                                prToneClass,
                              )}
                            >
                              <span className="truncate">{rankingSummary}</span>
                            </Badge>
                          </CelebrationReveal>
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p>{prBadgeTooltip}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              {onDelete && (
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        className="text-muted-foreground/30 hover:text-destructive disabled:text-muted-foreground/20 disabled:hover:text-muted-foreground/20 rounded p-1 transition-colors disabled:cursor-not-allowed md:opacity-0 md:group-hover:opacity-100 disabled:md:opacity-35"
                        onClick={onDelete}
                        disabled={isDeleteDisabled}
                        aria-label="Delete set"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>Delete set</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile: badges + ranking + trash on second row */}
      {(hasBadges || rankingSummary || onDelete || set._pending) && (
        <div className="mt-1 flex items-center gap-2 pl-7 md:hidden">
          {set._pending ? (
            <Loader2 className="text-muted-foreground/50 h-3 w-3 animate-spin" />
          ) : (
            <>
              {strengthBadge && (
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">{strengthBadge}</span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>View detailed strength levels</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {rankingSummary && (
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link href={prBadgeHref} className="inline-flex">
                        <CelebrationReveal
                          animationKey={`mobile-rank-${set.rowIndex ?? set._tempId ?? "pending"}-${rankingSummary}`}
                        >
                          <Badge
                            variant="outline"
                            className={cn(
                              metaBadgeClassName,
                              "max-w-[11rem]",
                              prToneClass,
                            )}
                          >
                            <span className="truncate">{rankingSummary}</span>
                          </Badge>
                        </CelebrationReveal>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>{prBadgeTooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <div className="flex-1" />
              {onDelete && (
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        className="text-muted-foreground/30 hover:text-destructive disabled:text-muted-foreground/20 disabled:hover:text-muted-foreground/20 rounded p-1 transition-colors disabled:cursor-not-allowed"
                        onClick={onDelete}
                        disabled={isDeleteDisabled}
                        aria-label="Delete set"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>Delete set</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </>
          )}
        </div>
      )}
    </motion.div>
  );
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function getLogPRBadgeHref(liftType) {
  return getLiftDetailUrl(liftType, "#lift-prs");
}

function getLogPRBadgeTooltip(liftType) {
  if (!liftType) return "Open lift details";
  return `Open ${liftType} details`;
}
