/**
 * Empty-session start state for the log page.
 * Preview users can only browse; linked-sheet users can start a lift block.
 */

import Image from "next/image";

import { AddLiftButton } from "@/components/log/add-controls";

export function EmptySessionState({
  addLiftChips,
  isStructuralSaving,
  isToday,
  onAddLift,
  parsedData,
  previewMode,
  starterLifts,
}) {
  return (
    <div className="mt-6 flex flex-col items-center gap-6">
      {previewMode ? (
        <div className="space-y-1 text-center">
          <h2 className="text-xl font-semibold">No session on this date</h2>
          <p className="text-muted-foreground text-sm">
            Use the arrows to browse other training days.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-1 text-center">
            <h2 className="text-xl font-semibold">
              {isToday ? "Start today's session" : "Start a session for this date"}
            </h2>
            <p className="text-muted-foreground text-sm">Pick a lift to begin.</p>
          </div>

          <div className="grid w-full grid-cols-2 gap-4 sm:grid-cols-4">
            {starterLifts.map(({ name, icon }) => (
              <button
                key={name}
                title={`Start with ${name}`}
                onClick={() => onAddLift(name)}
                className="border-border bg-card hover:border-primary hover:bg-muted/40 flex flex-col items-center gap-4 rounded-xl border px-4 py-6 shadow-sm transition-colors active:scale-95 md:gap-5 md:py-8"
              >
                <Image
                  src={icon}
                  alt={name}
                  width={80}
                  height={80}
                  className="h-20 w-20 md:h-28 md:w-28"
                />
                <span className="text-sm leading-tight font-medium">
                  {name}
                </span>
              </button>
            ))}
          </div>

          <AddLiftButton
            parsedData={parsedData}
            onAddLift={onAddLift}
            chips={addLiftChips}
            label="Add other lift type"
            disabled={isStructuralSaving}
          />
        </>
      )}
    </div>
  );
}
