/**
 * Lift-detail panel for Lift Explorer.
 * Mirrors the authenticated layout from /progress-guide/[lift] minus the
 * big-four-only cards (strength standards, strength circles, editorial copy)
 * so any lift the user has logged gets the same set of analytical tools.
 */

import { LiftJourneyCard } from "@/components/visualizer/lift-journey-card";
import { LiftTypeRepPRsDisplay } from "@/components/lift-explorer/lift-type-prs-display";
import { StrengthPotentialBarChart } from "@/components/visualizer/strength-potential-bar-chart";
import { MostRecentSessionCard } from "@/components/lift-explorer/most-recent-session-card";
import { VisualizerMini } from "@/components/visualizer/visualizer-mini";
import { TonnageChart } from "@/components/visualizer/visualizer-tonnage";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";

/**
 * Detail panel shown when a lift is selected in the lift list.
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
      <MostRecentSessionCard
        key={liftType}
        liftType={liftType}
        defaultVisibleCount={5}
      />
      <VisualizerMini
        liftType={liftType}
        timeRangeStorageKey={LOCAL_STORAGE_KEYS.LIFT_EXPLORER_TIME_RANGE}
        defaultTimeRange="MAX"
      />
      <TonnageChart
        liftType={liftType}
        timeRangeStorageKey={LOCAL_STORAGE_KEYS.LIFT_EXPLORER_TIME_RANGE}
        defaultTimeRange="MAX"
      />
      <StrengthPotentialBarChart liftType={liftType} />
      <LiftTypeRepPRsDisplay liftType={liftType} />
    </div>
  );
}
