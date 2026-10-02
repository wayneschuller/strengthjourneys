/**
 * Editable persisted set row for the session log.
 * Keeps local draft and optimistic state while sheet writes settle.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { motion, useReducedMotion } from "motion/react";
import { Link2, Loader2, Trash2 } from "lucide-react";

import { getCelebrationStyles } from "@/lib/celebration";
import { getVideoSourceMeta } from "@/lib/video-thumbnails";
import { getSetIdentityKey } from "@/lib/pr-ranking";
import { getDisplayWeight } from "@/lib/processing-utils";
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
import { VideoLinkButton } from "@/components/log/video-link-button";
import { VideoSourceIcon } from "@/components/log/video-source-icon";
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
  strengthTooltip = null,
  progressionBadge = null,
  usedSessionUrls,
  onSessionUrlAccepted,
  reserveVideoSlot = false,
}) {
  const isLocked = Boolean(set._pending);
  const isReadOnly = !onUpdate;
  const [editingReps, setEditingReps] = useState(false);
  const [editingWeight, setEditingWeight] = useState(false);
  // false, or which field takes focus as the editor opens: "notes" or "url".
  const [editingNotes, setEditingNotes] = useState(false);
  const [draftReps, setDraftReps] = useState(String(set.reps ?? ""));
  const [draftWeight, setDraftWeight] = useState(String(set.weight ?? ""));
  const [draftNotes, setDraftNotes] = useState(set.notes ?? "");
  const [draftUrl, setDraftUrl] = useState(set.URL ?? "");
  const urlInputRef = useRef(null);
  const isHoveredRef = useRef(false);
  // A video link found on the clipboard while the pointer rests on this row.
  const [offeredUrl, setOfferedUrl] = useState(null);
  const [justAttached, setJustAttached] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const cancelledEditRef = useRef(false);
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
  const rankingSummary = prMeta?.message ?? null;
  const rankingBadges = prMeta?.badges?.length
    ? prMeta.badges
    : rankingSummary
      ? [
          {
            scope: prMeta?.scope ?? prMeta?.status ?? null,
            message: rankingSummary,
          },
        ]
      : [];
  const hasRankingBadges = rankingBadges.length > 0;
  const rankingBadgeMaxClass = "max-w-[10.5rem]";
  const celebrationStyles = getCelebrationStyles({
    ...celebration,
    scope: prMeta?.scope ?? null,
  });
  const rowKey = getSetIdentityKey(set);
  const optimisticFields = useMemo(() => {
    const hasOptimisticOverride =
      pendingReps !== null ||
      pendingWeight !== null ||
      pendingNotes !== null ||
      pendingUrl !== null;

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
    if (cancelledEditRef.current) return;
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
    if (cancelledEditRef.current) return;
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

  function commitUrl(value = draftUrl) {
    if (isLocked) return;
    const trimmed = value.trim();
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

  // Tab walks one row as a single form: reps, weight, notes, video link, each
  // field saving as it is left. Without this, Tab from an open field landed on
  // the next field's idle button and needed Enter to open it.
  function cancelNumberEdit() {
    // Some browsers fire blur as the input unmounts, which would save the
    // very edit being abandoned.
    cancelledEditRef.current = true;
    setDraftReps(String(displayReps ?? ""));
    setDraftWeight(String(displayWeight ?? ""));
    setEditingReps(false);
    setEditingWeight(false);
  }

  function closeNotesEdit() {
    setEditingNotes(false);
    commitNotes();
    commitUrl();
  }

  // One tap attaches the link sitting on the clipboard, which is where a
  // video's share link lands. Anything else on the clipboard, a link already
  // used this session, or a browser that keeps the clipboard to itself, opens
  // the link field to type or paste into.
  async function attachCopiedLink() {
    if (isLocked) return;
    let copied = "";
    try {
      copied = (await navigator.clipboard.readText())?.trim() ?? "";
    } catch {
      copied = "";
    }
    if (
      copied &&
      !/\s/.test(copied) &&
      isHttpUrl(copied) &&
      !usedSessionUrls?.has(copied)
    ) {
      setDraftUrl(copied);
      commitUrl(copied);
      setJustAttached(true);
      return;
    }
    setEditingNotes("url");
  }

  // Hovering a set with no video looks at the clipboard and, if a video link
  // is waiting there, offers to attach it. Only where clipboard access is
  // already granted (Chrome and Edge, after the first paste here): a hover
  // must never raise a permission prompt, so other browsers stay quiet and
  // keep the link icon.
  async function offerCopiedLinkOnHover() {
    isHoveredRef.current = true;
    if (isReadOnly || isLocked || displayUrl || editingNotes) return;
    // A tap fires mouseenter too, and the offer is drawn for a pointer.
    if (!window.matchMedia("(hover: hover) and (min-width: 768px)").matches)
      return;
    try {
      const permission = await navigator.permissions.query({
        name: "clipboard-read",
      });
      if (permission.state !== "granted") return;
      const copied = (await navigator.clipboard.readText())?.trim() ?? "";
      const source = /\s/.test(copied) ? null : getVideoSourceMeta(copied);
      // An unrecognised host is not worth interrupting for.
      const qualifies =
        source && source.kind !== "other" && !usedSessionUrls?.has(copied);
      if (isHoveredRef.current) setOfferedUrl(qualifies ? copied : null);
    } catch {
      // No clipboard access here; the link icon still works.
    }
  }

  function endHoverOffer() {
    isHoveredRef.current = false;
    setOfferedUrl(null);
  }

  function acceptOfferedUrl() {
    if (!offeredUrl) return;
    setDraftUrl(offeredUrl);
    commitUrl(offeredUrl);
    setOfferedUrl(null);
    setJustAttached(true);
  }

  function openNotesEdit() {
    setEditingNotes("notes");
    // Try to pre-fill URL from clipboard if the field is currently empty
    // and the URL hasn't already been assigned to another set this session.
    if (!draftUrl && navigator?.clipboard?.readText) {
      navigator.clipboard
        .readText()
        .then((text) => {
          const trimmed = text?.trim() ?? "";
          if (isHttpUrl(trimmed)) {
            if (!usedSessionUrls?.has(trimmed)) {
              setDraftUrl(trimmed);
            }
          }
        })
        .catch(() => {});
    }
  }

  const videoSource = useMemo(
    () => getVideoSourceMeta(displayUrl),
    [displayUrl],
  );
  const showVideoSlot = reserveVideoSlot || Boolean(videoSource);
  const hasBadges =
    !set._pending && (Boolean(strengthBadge) || Boolean(progressionBadge));
  const offeredSource =
    offeredUrl && !displayUrl && !editingNotes
      ? getVideoSourceMeta(offeredUrl)
      : null;
  // The copied link's own mark, shown faint and swaying in the spot the real
  // one will take, with the instruction held open beside it.
  const offerGhost = offeredSource ? (
    <TooltipProvider delayDuration={0}>
      <Tooltip open>
        <TooltipTrigger asChild>
          <motion.button
            type="button"
            className="border-primary/60 bg-card hover:bg-accent hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed shadow-sm md:inline-flex"
            animate={
              prefersReducedMotion
                ? { rotate: 0 }
                : { rotate: [-9, 9, -9], scale: [1, 1.06, 1] }
            }
            transition={{ duration: 1.3, ease: "easeInOut", repeat: Infinity }}
            onClick={acceptOfferedUrl}
            aria-label={`Save the ${offeredSource.name} link you copied to this set`}
          >
            <VideoSourceIcon
              source={offeredSource}
              className="h-[18px] w-[18px] opacity-55"
            />
          </motion.button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>{`Click to save the ${offeredSource.name} link you copied to this set`}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : null;
  const attachButton =
    !isReadOnly && !isLocked && !displayUrl && !editingNotes ? (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="text-muted-foreground/60 hover:text-foreground rounded p-2 transition-colors focus-visible:opacity-100 md:p-1 md:opacity-0 md:group-hover:opacity-100"
              onClick={attachCopiedLink}
              aria-label="Attach the video link you copied"
            >
              <Link2 className="h-4 w-4 md:h-3.5 md:w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Attach the video link you copied</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ) : null;
  const metaBadgeClassName = "h-8 rounded-full px-3 text-xs font-semibold";

  return (
    <motion.div
      className={cn("group py-3", celebrationStyles.rowClassName)}
      onMouseEnter={offerCopiedLinkOnHover}
      onMouseLeave={endHoverOffer}
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
            Every part of this cluster is a fixed width, so the notes column
            starts at the same x on every row. min-w is not enough: a wide
            value like 132.5 outgrows it and drags that row's notes right. */}
        <div className="flex shrink-0 items-center">
          <div className="w-7">
            {editingReps && !isReadOnly ? (
              <input
                type="number"
                className="border-primary w-10 rounded border px-1 py-0.5 text-right text-xl font-semibold tabular-nums focus:outline-none"
                value={draftReps}
                disabled={isLocked}
                onChange={(e) => setDraftReps(e.target.value)}
                onBlur={commitReps}
                onFocus={(e) => {
                  cancelledEditRef.current = false;
                  e.currentTarget.select();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    commitReps();
                  } else if (e.key === "Tab" && !e.shiftKey) {
                    e.preventDefault();
                    commitReps();
                    setEditingWeight(true);
                  } else if (e.key === "Escape") {
                    cancelNumberEdit();
                  }
                }}
                autoFocus
              />
            ) : isLocked || isReadOnly ? (
              <div className="text-foreground/80 w-full py-0.5 text-right text-xl font-semibold tabular-nums">
                {displayReps}
              </div>
            ) : (
              <button
                className="hover:bg-muted/60 w-full rounded py-0.5 text-right text-xl font-semibold tabular-nums"
                onClick={() => {
                  cancelledEditRef.current = false;
                  setEditingReps(true);
                }}
              >
                {displayReps}
              </button>
            )}
          </div>
          <span className="text-muted-foreground mx-0.5 text-base">@</span>
          {/* Weight and unit share one fixed box, wide enough for a four digit
              weight with a decimal. The unit still hugs the number rather than
              floating at the far edge. */}
          <div className="flex w-[5.5rem] shrink-0 items-center">
            {editingWeight && !isReadOnly ? (
              <input
                type="text"
                inputMode="decimal"
                className="border-primary w-20 rounded border px-1 py-0.5 text-xl font-semibold tabular-nums focus:outline-none"
                value={draftWeight}
                disabled={isLocked}
                onChange={(e) => setDraftWeight(e.target.value)}
                onBlur={commitWeight}
                onFocus={(e) => {
                  cancelledEditRef.current = false;
                  e.currentTarget.select();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    commitWeight();
                  } else if (e.key === "Tab") {
                    e.preventDefault();
                    commitWeight();
                    if (e.shiftKey) setEditingReps(true);
                    else openNotesEdit();
                  } else if (e.key === "Escape") {
                    cancelNumberEdit();
                  }
                }}
                autoFocus
              />
            ) : isLocked || isReadOnly ? (
              <div className="text-foreground/80 py-0.5 text-left text-xl font-semibold tabular-nums">
                {displayWeight}
              </div>
            ) : (
              <button
                className="hover:bg-muted/60 rounded py-0.5 text-left text-xl font-semibold tabular-nums"
                onClick={() => {
                  cancelledEditRef.current = false;
                  setEditingWeight(true);
                }}
              >
                {displayWeight}
              </button>
            )}
            <UnitLabel unitType={set.unitType} mismatch={unitMismatch} />
          </div>

          {/* Video mark — the clip belongs to the set, so it rides with the
              numbers rather than crowding the badge rail on the right. The
              slot is reserved for every row of a lift that has any video at
              all, which keeps the marks in one clean vertical line and stops
              notes reflowing between filmed and unfilmed sets. */}
          {showVideoSlot && (
            <div className="flex w-8 shrink-0 justify-center">
              {offeredSource ? (
                offerGhost
              ) : (
                <motion.div
                  // A link that has just landed gets a small happy wobble.
                  animate={
                    justAttached && !prefersReducedMotion
                      ? { rotate: [0, -16, 13, -9, 5, 0], scale: [1, 1.3, 1] }
                      : { rotate: 0, scale: 1 }
                  }
                  transition={{ duration: 0.7, ease: "easeOut" }}
                  onAnimationComplete={() => setJustAttached(false)}
                >
                  <VideoLinkButton url={displayUrl} source={videoSource} />
                </motion.div>
              )}
            </div>
          )}
          {/* A lift with no video yet has no slot reserved. The offer still
              sits where the slot will open once the link is saved, laid over
              the gap so the row holds still. */}
          {!showVideoSlot && offeredSource && (
            <div className="relative w-0">
              <div className="absolute top-1/2 left-0 -translate-y-1/2">
                {offerGhost}
              </div>
            </div>
          )}
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
                    // Saves the note and whatever link is showing, so a link
                    // picked up from the clipboard needs no second step. Tab
                    // still reaches the link field to change it.
                    e.preventDefault();
                    closeNotesEdit();
                  } else if (e.key === "Tab" && e.shiftKey) {
                    e.preventDefault();
                    closeNotesEdit();
                    setEditingWeight(true);
                  } else if (e.key === "Escape") {
                    closeNotesEdit();
                  }
                }}
                onPaste={(e) => {
                  // A link pasted into the note is the video for this set.
                  // File it as the link and save it at once, unless the set
                  // already has one, where a paste stays a plain paste.
                  const pasted = e.clipboardData?.getData("text")?.trim() ?? "";
                  if (draftUrl.trim() && draftUrl.trim() !== pasted) return;
                  if (/\s/.test(pasted) || !isHttpUrl(pasted)) return;
                  e.preventDefault();
                  setDraftUrl(pasted);
                  commitUrl(pasted);
                }}
                placeholder="notes..."
                autoFocus={editingNotes !== "url"}
              />
              <div className="flex items-center gap-1">
                <Link2 className="text-muted-foreground/60 h-3 w-3 shrink-0" />
                <input
                  ref={urlInputRef}
                  type="url"
                  className="border-input text-muted-foreground focus:border-primary min-w-0 flex-1 border-b bg-transparent py-0.5 text-xs focus:outline-none"
                  value={draftUrl}
                  disabled={isLocked}
                  onChange={(e) => setDraftUrl(e.target.value)}
                  onBlur={() => {
                    commitUrl();
                    setEditingNotes(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "Escape") {
                      closeNotesEdit();
                    }
                  }}
                  placeholder="video link..."
                  autoFocus={editingNotes === "url"}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-0.5">
              {isLocked || isReadOnly ? (
                <div className="text-muted-foreground w-full text-left text-[13px]">
                  {displayNotes || (isReadOnly ? "" : "notes...")}
                </div>
              ) : (
                <button
                  className="text-muted-foreground hover:text-foreground w-full text-left text-[13px]"
                  onClick={openNotesEdit}
                >
                  {displayNotes || "notes..."}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="hidden w-[17rem] shrink-0 items-center justify-end gap-2 md:flex">
          {set._pending ? (
            <Loader2 className="text-muted-foreground/70 h-3 w-3 animate-spin" />
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
                        {strengthTooltip}
                        <p
                          className={
                            strengthTooltip ? "mt-1 opacity-70" : undefined
                          }
                        >
                          Click for {set.liftType} strength levels
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <span className="inline-flex flex-col items-end gap-1">
                  {hasRankingBadges &&
                    rankingBadges.map((badge) => (
                      <PrRankBadge
                        key={`${badge.scope}-${badge.message}`}
                        badge={badge}
                        liftType={set.liftType}
                        animationKey={`desktop-rank-${set.rowIndex ?? set._tempId ?? "pending"}-${badge.message}`}
                        className={cn(metaBadgeClassName, rankingBadgeMaxClass)}
                      />
                    ))}
                  {progressionBadge && (
                    <ProgressionBadge
                      badge={progressionBadge}
                      liftType={set.liftType}
                      isMetric={isMetric}
                      className={cn(metaBadgeClassName, rankingBadgeMaxClass)}
                    />
                  )}
                </span>
              </div>
              {attachButton}
              {onDelete && (
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        className="text-muted-foreground/60 hover:text-destructive disabled:text-muted-foreground/40 disabled:hover:text-muted-foreground/40 rounded p-1 transition-colors disabled:cursor-not-allowed md:opacity-0 md:group-hover:opacity-100 disabled:md:opacity-35"
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
      {(hasBadges ||
        hasRankingBadges ||
        onDelete ||
        attachButton ||
        set._pending) && (
        <div className="mt-1 flex items-center gap-2 pl-7 md:hidden">
          {set._pending ? (
            <Loader2 className="text-muted-foreground/70 h-3 w-3 animate-spin" />
          ) : (
            <>
              {strengthBadge && (
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">{strengthBadge}</span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {strengthTooltip}
                      <p
                        className={
                          strengthTooltip ? "mt-1 opacity-70" : undefined
                        }
                      >
                        Click for {set.liftType} strength levels
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {hasRankingBadges && (
                <span className="inline-flex flex-col items-start gap-1">
                  {rankingBadges.map((badge) => (
                    <PrRankBadge
                      key={`${badge.scope}-${badge.message}`}
                      badge={badge}
                      liftType={set.liftType}
                      animationKey={`mobile-rank-${set.rowIndex ?? set._tempId ?? "pending"}-${badge.message}`}
                      className={cn(metaBadgeClassName, "max-w-[11rem]")}
                    />
                  ))}
                </span>
              )}
              {progressionBadge && (
                <ProgressionBadge
                  badge={progressionBadge}
                  liftType={set.liftType}
                  isMetric={isMetric}
                  className={cn(metaBadgeClassName, "max-w-[11rem]")}
                />
              )}
              <div className="flex-1" />
              {attachButton}
              {onDelete && (
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        className="text-muted-foreground/60 hover:text-destructive disabled:text-muted-foreground/40 disabled:hover:text-muted-foreground/40 rounded p-1 transition-colors disabled:cursor-not-allowed"
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

// A PR badge opens the lift's rep PRs; its tooltip carries the record it
// passed or the one it is chasing.
function PrRankBadge({ badge, liftType, animationKey, className }) {
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={getLogPRBadgeHref(liftType, badge)}
            className="inline-flex"
          >
            <CelebrationReveal animationKey={animationKey}>
              <Badge
                variant="outline"
                className={cn(className, getPrToneClass(badge.scope))}
              >
                <span className="truncate">{badge.message}</span>
              </Badge>
            </CelebrationReveal>
          </Link>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[16rem]">
          {badge.detail && <p>{badge.detail}</p>}
          <p className={badge.detail ? "mt-1 opacity-70" : undefined}>
            {getLogPRBadgeTooltip(liftType)}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Says which set this one moved past, and opens the lift's progress chart.
function ProgressionBadge({ badge, liftType, isMetric, className }) {
  const { previousSet, previousDate } = badge;
  const { value, unit } = getDisplayWeight(previousSet, isMetric);
  const dateLabel = new Date(`${previousDate}T00:00:00`).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric" },
  );
  const href = getLiftDetailUrl(liftType, "#progress-chart");
  const pill = (
    <Badge
      variant="outline"
      className={cn(className, "text-emerald-600 dark:text-emerald-400")}
    >
      <span className="truncate">{badge.message}</span>
    </Badge>
  );

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          {href ? (
            <Link href={href} className="inline-flex">
              {pill}
            </Link>
          ) : (
            <span className="inline-flex">{pill}</span>
          )}
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[18rem]">
          <p>
            Beats {previousSet.reps}@{value}
            {unit} from {dateLabel}
          </p>
          {badge.streak >= 2 && (
            <p className="mt-1">
              Up {badge.streak} sessions running:{" "}
              {formatProgressionChain(badge.chain, isMetric)}
            </p>
          )}
          {href && (
            <p className="mt-1 opacity-70">
              Click for the {liftType} progress chart
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// The staircase, newest last. A long run keeps its latest steps.
const CHAIN_STEPS_SHOWN = 6;

function formatProgressionChain(chain, isMetric) {
  const steps = chain.slice(-CHAIN_STEPS_SHOWN).map((entry) => {
    const { value, unit } = getDisplayWeight(entry, isMetric);
    return { text: `${entry.reps}@${value}`, unit };
  });
  const lastUnit = steps.at(-1)?.unit ?? "";
  const body = steps.map(({ text }) => text).join(" → ");
  return `${chain.length > CHAIN_STEPS_SHOWN ? "… → " : ""}${body}${lastUnit}`;
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function getLogPRBadgeHref(liftType, badge) {
  return getLiftDetailUrl(liftType, "#lift-prs", {
    prScope: badge?.scope,
    prReps: badge?.reps,
  });
}

function getLogPRBadgeTooltip(liftType) {
  if (!liftType) return "Click for rep PRs";
  return `Click for ${liftType} rep PRs`;
}

function getPrToneClass(scope) {
  if (scope === "lifetime") return "text-amber-600";
  if (scope === "yearly") return "text-blue-500";
  return "text-muted-foreground";
}
