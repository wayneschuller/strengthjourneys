/**
 * Lift-detail panel for Lift Explorer.
 * Keep the single-lift strength-potential chart directly above the PR block so
 * the progression story stays in one vertical flow for the selected movement.
 */

import { LiftJourneyCard } from "@/components/visualizer/lift-journey-card";
import { LiftTypeRepPRsDisplay } from "@/components/lift-explorer/lift-type-prs-display";
import { StrengthPotentialBarChart } from "@/components/visualizer/strength-potential-bar-chart";

/**
 * Email-style detail panel shown when a lift is selected in the pie card table.
 * Renders LiftJourneyCard and LiftTypeRepPRsDisplay side by side at 50/50.
 *
 * @param {Object} props
 * @param {string|null} props.liftType - The selected lift type to display details for.
 */
export function LiftDetailPanel({ liftType }) {
  if (!liftType) return null;

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 2xl:max-w-[1180px]">
      <LiftJourneyCard
        liftType={liftType}
        asCard={false}
        chartDensity="dense"
      />
      <div id="strength-potential">
        <StrengthPotentialBarChart liftType={liftType} />
      </div>
      <div id="lift-prs">
        <LiftTypeRepPRsDisplay liftType={liftType} />
      </div>
    </div>
  );
}
