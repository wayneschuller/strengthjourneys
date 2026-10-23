/**
 * Inline draft row for entering a custom log set before it is inserted, and on
 * a phone for editing a logged one (given its values and a "Save set" label).
 * Reps, weight and notes run as one Tab or Enter sequence, and a weight far
 * past the lifter's best asks for a second confirm before it reaches the sheet.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { Check, X } from "lucide-react";

import {
  isBodyweightLoadLiftName,
  isValidLiftWeight,
} from "@/lib/import/parsers/parser-utilities";
import { parseWeightInput } from "@/components/log/sheet-snapshot-utils";
import { UnitLabel } from "@/components/log/unit-label";

export function CustomSetDraftRow({
  liftType,
  unitType,
  defaultWeight,
  defaultNotes,
  heaviestWeight = null,
  onCommit,
  onCancel,
  disabled = false,
  initialReps = "",
  initialWeight = "",
  focusField = "reps",
  submitLabel = "Add set",
}) {
  const weightHintId = useId();
  const repsInputRef = useRef(null);
  const weightInputRef = useRef(null);
  const notesInputRef = useRef(null);
  const [draftReps, setDraftReps] = useState(String(initialReps));
  const [draftWeight, setDraftWeight] = useState(String(initialWeight));
  const [draftNotes, setDraftNotes] = useState(defaultNotes ?? "");
  const notesPointerFocusRef = useRef(false);
  const panelRef = useRef(null);
  // The weight string the lifter has already been asked about once.
  const [queriedWeight, setQueriedWeight] = useState(null);

  // Opening for an edit lands on the field the lifter tapped.
  useEffect(() => {
    if (disabled) return;
    const input = {
      reps: repsInputRef,
      weight: weightInputRef,
      notes: notesInputRef,
    }[focusField]?.current;
    // preventScroll: the row opens right where the lifter tapped, so the
    // browser hauling the page to the field is only a jump.
    input?.focus({ preventScroll: true });
    if (focusField !== "notes") input?.select?.();
    // Only on opening; a later focusField change must not steal the caret.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  useKeepPanelAboveKeyboard(panelRef);

  const parsedReps = Number.parseInt(draftReps, 10);
  const parsedWeight = parseWeightInput(draftWeight);
  const hasValidReps = Number.isInteger(parsedReps) && parsedReps > 0;
  const hasValidWeight = isValidLiftWeight(liftType, parsedWeight);
  const weightPlaceholder = isBodyweightLoadLiftName(liftType)
    ? "0"
    : String(defaultWeight ?? (unitType === "kg" ? 20 : 45));
  const canSubmit = !disabled && hasValidReps && hasValidWeight;
  const weightCeiling = getPlausibleWeightCeiling(heaviestWeight, unitType);
  const isSuspectWeight = hasValidWeight && parsedWeight > weightCeiling;
  const wasQueried = isSuspectWeight && queriedWeight === draftWeight;

  const moveToWeight = useCallback(() => {
    if (!hasValidReps || disabled) return;
    weightInputRef.current?.focus();
    weightInputRef.current?.select?.();
  }, [disabled, hasValidReps]);

  const moveToNotes = useCallback(() => {
    if (!hasValidWeight || disabled) return;
    notesInputRef.current?.focus();
  }, [disabled, hasValidWeight]);

  // Arriving by Tab or Enter, the browser would select the whole note and the
  // next keystroke would wipe the time stamp. Put the caret after it instead,
  // ready to type. A click keeps the caret wherever it landed.
  const handleNotesFocus = useCallback(() => {
    if (notesPointerFocusRef.current) return;
    const placeCaret = () => {
      const notesInput = notesInputRef.current;
      if (!notesInput || document.activeElement !== notesInput) return;
      const end = notesInput.value.length;
      notesInput.setSelectionRange(end, end);
    };
    placeCaret();
    // Safari applies its select-all after the focus event.
    requestAnimationFrame(placeCaret);
  }, []);

  const commitDraft = useCallback(() => {
    if (!canSubmit) return;
    if (isSuspectWeight && !wasQueried) {
      setQueriedWeight(draftWeight);
      return;
    }
    onCommit({
      reps: parsedReps,
      weight: parsedWeight,
      unitType,
      notes: draftNotes,
    });
  }, [
    canSubmit,
    draftNotes,
    draftWeight,
    isSuspectWeight,
    onCommit,
    parsedReps,
    parsedWeight,
    unitType,
    wasQueried,
  ]);

  return (
    // data-no-swipe: a flick across a half-typed set must not turn the log
    // to another session and take the draft with it.
    <div
      ref={panelRef}
      data-no-swipe=""
      className="border-primary/35 bg-primary/5 rounded-lg border border-dashed px-2 py-3"
    >
      {/* Phone: numbers, then notes, each full width and thumb sized. From md
          up they share one line. */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:gap-4">
        <div className="flex items-center">
          <input
            ref={repsInputRef}
            // Text, not number: a number input spends half this box on
            // spinner arrows and clips a two digit rep count.
            type="text"
            inputMode="numeric"
            aria-label="Reps"
            className="border-primary h-14 w-20 rounded-sm border px-2 py-0.5 text-right text-3xl font-semibold tabular-nums focus:outline-none md:h-auto md:w-12 md:px-1 md:text-xl"
            value={draftReps}
            disabled={disabled}
            placeholder="5"
            onChange={(e) =>
              setDraftReps(e.target.value.replace(/\D/g, "").slice(0, 3))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                moveToWeight();
              } else if (e.key === "Escape") {
                e.preventDefault();
                onCancel();
              }
            }}
          />
          <span className="text-muted-foreground mx-2 text-xl md:mx-0.5 md:text-base">
            @
          </span>
          <input
            ref={weightInputRef}
            type="text"
            inputMode="decimal"
            aria-label="Weight"
            aria-describedby={isSuspectWeight ? weightHintId : undefined}
            className={`h-14 w-32 rounded-sm border px-2 py-0.5 text-3xl font-semibold tabular-nums focus:outline-none md:h-auto md:w-20 md:px-1 md:text-xl ${
              isSuspectWeight ? "border-amber-500" : "border-primary"
            }`}
            value={draftWeight}
            disabled={disabled}
            placeholder={weightPlaceholder}
            onChange={(e) => setDraftWeight(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                moveToNotes();
              } else if (e.key === "Escape") {
                e.preventDefault();
                onCancel();
              }
            }}
          />
          <UnitLabel unitType={unitType} mismatch={false} />
        </div>

        <div className="min-w-0 flex-1">
          {/* Two lines on a phone so a longer note can be read while it is
              written, growing as it fills where the browser can size a field
              to its content. Enter still saves: a note is one sheet cell. */}
          <textarea
            ref={notesInputRef}
            rows={2}
            // 16px on a phone: smaller and iOS zooms the page on focus.
            className="border-input text-muted-foreground focus:border-primary field-sizing-content max-h-40 min-h-16 w-full resize-none rounded-sm border bg-transparent px-2 py-2 text-base italic focus:outline-none md:max-h-none md:min-h-0 md:rounded-none md:border-0 md:border-b md:px-0 md:py-0.5 md:text-xs"
            value={draftNotes}
            disabled={disabled}
            placeholder="notes..."
            onPointerDown={() => {
              notesPointerFocusRef.current = true;
            }}
            onBlur={() => {
              notesPointerFocusRef.current = false;
            }}
            onFocus={handleNotesFocus}
            onChange={(e) => setDraftNotes(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitDraft();
              } else if (e.key === "Escape") {
                e.preventDefault();
                onCancel();
              }
            }}
          />
        </div>

        <div className="hidden w-[12.5rem] shrink-0 items-start justify-end gap-1 md:flex">
          <button
            type="button"
            disabled={disabled}
            className="text-muted-foreground/60 hover:text-foreground rounded-sm p-1 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onCancel}
            aria-label="Cancel custom set"
          >
            <X className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            className="text-primary hover:text-primary/80 disabled:text-muted-foreground/50 rounded-sm p-1 transition-colors disabled:cursor-not-allowed"
            onClick={commitDraft}
            aria-label="Add custom set"
          >
            <Check className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isSuspectWeight && (
        <p
          id={weightHintId}
          role="status"
          className="mt-2 text-sm text-amber-600 md:text-xs dark:text-amber-400"
        >
          {wasQueried ? (
            <>
              {`Still ${parsedWeight}${unitType}? `}
              {/* A phone has the labelled button; a desktop the tick and Enter. */}
              <span className="md:hidden">{`Tap ${submitLabel} again to keep it.`}</span>
              <span className="hidden md:inline">
                Press Enter or the tick again to keep it.
              </span>
            </>
          ) : heaviestWeight > 0 ? (
            `${parsedWeight}${unitType} is a long way past your ${heaviestWeight}${unitType} best. Worth a glance at the digits.`
          ) : (
            `${parsedWeight}${unitType} is a huge ${liftType}. Worth a glance at the digits.`
          )}
        </p>
      )}

      <div className="mt-3 flex items-center gap-3 md:hidden">
        <button
          type="button"
          disabled={disabled}
          className="border-input text-muted-foreground active:bg-muted flex h-12 w-24 items-center justify-center gap-1 rounded-md border text-base transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onCancel}
        >
          <X className="h-5 w-5" />
          Cancel
        </button>
        <button
          type="button"
          disabled={!canSubmit}
          className="bg-primary text-primary-foreground active:bg-primary/80 disabled:bg-muted disabled:text-muted-foreground flex h-12 flex-1 items-center justify-center gap-1 rounded-md text-base font-semibold transition-colors disabled:cursor-not-allowed"
          onClick={commitDraft}
        >
          <Check className="h-5 w-5" />
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

// A phone keyboard covers the lower part of the screen, and the browser only
// scrolls the focused field into view, leaving Cancel and Save set behind the
// keys (Android Chrome most of all). While a field in the panel has focus,
// lift the page until the panel's foot clears the keyboard, never so far that
// the field being typed in goes off the top.
function useKeepPanelAboveKeyboard(panelRef) {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    let frame = null;

    const reveal = () => {
      const panel = panelRef.current;
      const active = document.activeElement;
      if (!panel || !active || !panel.contains(active)) return;
      const margin = 8;
      const visibleTop = viewport.offsetTop;
      const visibleBottom = viewport.offsetTop + viewport.height;
      const overflow =
        panel.getBoundingClientRect().bottom + margin - visibleBottom;
      if (overflow <= 0) return;
      const room = active.getBoundingClientRect().top - margin - visibleTop;
      const distance = Math.min(overflow, room);
      if (distance > 0) window.scrollBy({ top: distance, behavior: "smooth" });
    };
    // The keyboard is still opening when focus lands; wait for the viewport
    // to settle on its new size before measuring.
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(reveal);
    };

    const panel = panelRef.current;
    viewport.addEventListener("resize", schedule);
    panel?.addEventListener("focusin", schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", schedule);
      panel?.removeEventListener("focusin", schedule);
    };
  }, [panelRef]);
}

// A slipped extra digit multiplies the weight by about ten, so anything past
// three times the lifter's best on this lift is far likelier a typo than a PR,
// while a real jump never comes near it. With no history for the lift, fall
// back to a weight almost nobody moves.
function getPlausibleWeightCeiling(heaviestWeight, unitType) {
  if (heaviestWeight > 0) return heaviestWeight * 3;
  return unitType === "kg" ? 500 : 1100;
}
