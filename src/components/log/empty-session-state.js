/**
 * Empty-session start state for the log page.
 * Preview users browse a read-only gallery; linked-sheet users can start a
 * lift block.
 */

import { AddLiftButton } from "@/components/log/add-controls";

export function EmptySessionState({
  addLiftChips,
  isStructuralSaving,
  isToday,
  onAddLift,
  previewMode,
  previewCta,
  sessionDate,
}) {
  return (
    <div className="mt-6 flex flex-col items-center gap-6">
      {previewMode ? (
        <>
          <div className="space-y-1 text-center">
            <h2 className="text-xl font-semibold">No session on this date</h2>
            <p className="text-muted-foreground text-sm">
              Use the arrows to browse other training days.
            </p>
          </div>

          <AddLiftButton
            readOnly
            readOnlyCta={previewCta}
            chips={addLiftChips}
            sessionDate={sessionDate}
            isToday={isToday}
          />
        </>
      ) : (
        <>
          <div className="space-y-1 text-center">
            <h2 className="text-xl font-semibold">
              {isToday ? "Start today's session" : "Start a session for this date"}
            </h2>
            <p className="text-muted-foreground text-sm">Pick a lift to begin.</p>
          </div>

          <AddLiftButton
            label="Log a lift type"
            onAddLift={onAddLift}
            chips={addLiftChips}
            sessionDate={sessionDate}
            isToday={isToday}
            disabled={isStructuralSaving}
          />
        </>
      )}
    </div>
  );
}
