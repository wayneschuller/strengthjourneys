/**
 * Inline draft row for entering a custom log set before it is inserted.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { Check, X } from "lucide-react";

import {
  isBodyweightLoadLiftName,
  isValidLiftWeight,
} from "@/lib/data-sources/parser-utilities";
import { parseWeightInput } from "@/components/log/sheet-snapshot-utils";
import { UnitLabel } from "@/components/log/unit-label";

export function CustomSetDraftRow({
  liftType,
  unitType,
  defaultWeight,
  defaultNotes,
  onCommit,
  onCancel,
  disabled = false,
}) {
  const repsInputRef = useRef(null);
  const weightInputRef = useRef(null);
  const notesInputRef = useRef(null);
  const [draftReps, setDraftReps] = useState("");
  const [draftWeight, setDraftWeight] = useState("");
  const [draftNotes, setDraftNotes] = useState(defaultNotes ?? "");
  const shouldPlaceNotesCaretRef = useRef(false);

  useEffect(() => {
    if (disabled) return;
    repsInputRef.current?.focus();
    repsInputRef.current?.select?.();
  }, [disabled]);

  const parsedReps = Number.parseInt(draftReps, 10);
  const parsedWeight = parseWeightInput(draftWeight);
  const hasValidReps = Number.isInteger(parsedReps) && parsedReps > 0;
  const hasValidWeight = isValidLiftWeight(liftType, parsedWeight);
  const weightPlaceholder = isBodyweightLoadLiftName(liftType)
    ? "0"
    : String(defaultWeight ?? (unitType === "kg" ? 20 : 45));
  const canSubmit = !disabled && hasValidReps && hasValidWeight;

  const moveToWeight = useCallback(() => {
    if (!hasValidReps || disabled) return;
    weightInputRef.current?.focus();
    weightInputRef.current?.select?.();
  }, [disabled, hasValidReps]);

  const moveToNotes = useCallback(() => {
    if (!hasValidWeight || disabled) return;
    shouldPlaceNotesCaretRef.current = true;
    const notesInput = notesInputRef.current;
    if (!notesInput) return;
    notesInput.focus();
    const caretPosition = (defaultNotes ?? "").length;
    notesInput.setSelectionRange(caretPosition, caretPosition);
  }, [defaultNotes, disabled, hasValidWeight]);

  const handleNotesFocus = useCallback(() => {
    if (!shouldPlaceNotesCaretRef.current) return;
    shouldPlaceNotesCaretRef.current = false;
    const notesInput = notesInputRef.current;
    if (!notesInput) return;
    const caretPosition = (defaultNotes ?? "").length;
    notesInput.setSelectionRange(caretPosition, caretPosition);
  }, [defaultNotes]);

  const commitDraft = useCallback(() => {
    if (!canSubmit) return;
    onCommit({
      reps: parsedReps,
      weight: parsedWeight,
      unitType,
      notes: draftNotes,
    });
  }, [canSubmit, draftNotes, onCommit, parsedReps, parsedWeight, unitType]);

  return (
    <div className="border-primary/35 bg-primary/5 rounded-lg border border-dashed px-2 py-3">
      <div className="flex items-start gap-4">
        <div className="flex items-center">
          <input
            ref={repsInputRef}
            type="number"
            inputMode="numeric"
            className="border-primary w-10 rounded border px-1 py-0.5 text-right text-xl font-semibold tabular-nums focus:outline-none"
            value={draftReps}
            disabled={disabled}
            placeholder="5"
            onChange={(e) => setDraftReps(e.target.value)}
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
          <span className="text-muted-foreground mx-0.5 text-base">@</span>
          <input
            ref={weightInputRef}
            type="text"
            inputMode="decimal"
            className="border-primary w-20 rounded border px-1 py-0.5 text-xl font-semibold tabular-nums focus:outline-none"
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
          <input
            ref={notesInputRef}
            type="text"
            className="border-input text-muted-foreground focus:border-primary w-full border-b bg-transparent py-0.5 text-xs italic focus:outline-none"
            value={draftNotes}
            disabled={disabled}
            placeholder="notes..."
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
            className="text-muted-foreground/45 hover:text-foreground rounded p-1 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onCancel}
            aria-label="Cancel custom set"
          >
            <X className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            className="text-primary hover:text-primary/80 disabled:text-muted-foreground/35 rounded p-1 transition-colors disabled:cursor-not-allowed"
            onClick={commitDraft}
            aria-label="Add custom set"
          >
            <Check className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-end gap-1 md:hidden">
        <button
          type="button"
          disabled={disabled}
          className="text-muted-foreground/45 hover:text-foreground rounded p-1 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onCancel}
          aria-label="Cancel custom set"
        >
          <X className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={!canSubmit}
          className="text-primary hover:text-primary/80 disabled:text-muted-foreground/35 rounded p-1 transition-colors disabled:cursor-not-allowed"
          onClick={commitDraft}
          aria-label="Add custom set"
        >
          <Check className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
