/**
 * Empty-session start state for the log page.
 * Preview users browse a read-only gallery; linked-sheet users can start a
 * lift block. On today, an athlete with big four history is led by the lift
 * they're due to train, and the gallery follows for everything else.
 */

import { AddLiftButton } from "@/components/log/add-controls";
import { BigFourNextUp } from "@/components/log/big-four-next-up";

export function EmptySessionState({
  addLiftChips,
  nextLiftPlan,
  isAddBlocked,
  isToday,
  onAddLift,
  previewMode,
  previewCta,
  sessionDate,
}) {
  // A past date is back-filling history, where "go for" numbers don't apply.
  const showNextUp = isToday && nextLiftPlan?.lifts.length > 0;

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
      ) : showNextUp ? (
        <>
          <BigFourNextUp
            plan={nextLiftPlan}
            onStart={onAddLift}
            disabled={isAddBlocked}
          />

          <AddLiftButton
            label="Or pick another lift"
            onAddLift={onAddLift}
            chips={addLiftChips}
            excludeLiftTypes={nextLiftPlan.lifts.map(
              ({ liftType }) => liftType,
            )}
            sessionDate={sessionDate}
            isToday={isToday}
            disabled={isAddBlocked}
          />
        </>
      ) : (
        <>
          <div className="space-y-1 text-center">
            <h2 className="text-xl font-semibold">
              {isToday
                ? "Start today's session"
                : "Start a session for this date"}
            </h2>
            <p className="text-muted-foreground text-sm">
              Pick a lift to begin.
            </p>
          </div>

          <AddLiftButton
            label="Log a lift type"
            onAddLift={onAddLift}
            chips={addLiftChips}
            sessionDate={sessionDate}
            isToday={isToday}
            disabled={isAddBlocked}
          />
        </>
      )}
    </div>
  );
}
