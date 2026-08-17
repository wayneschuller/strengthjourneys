/**
 * Lift-detail panel for Lift Explorer.
 * Mirrors the authenticated layout from /progress-guide/[lift] minus the
 * big-four-only cards (strength standards, strength circles, editorial copy)
 * so any lift the user has logged gets the same set of analytical tools.
 */

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { getLiftDetailUrl } from "@/components/lift-type-indicator";
import { LiftJourneyCard } from "@/components/visualizer/lift-journey-card";
import { LiftLogCta } from "@/components/lift-explorer/lift-log-cta";
import { LiftTypeRepPRsDisplay } from "@/components/lift-explorer/lift-type-prs-display";
import { StrengthPotentialBarChart } from "@/components/visualizer/strength-potential-bar-chart";
import { MostRecentSessionCard } from "@/components/lift-explorer/most-recent-session-card";
import { VisualizerMini } from "@/components/visualizer/visualizer-mini";
import { TonnageChart } from "@/components/visualizer/visualizer-tonnage";

/**
 * Detail panel shown when a lift is selected in the lift list.
 * @param {Object} props
 * @param {string|null} props.liftType - The selected lift type to display details for.
 */
export function LiftDetailPanel({ liftType }) {
  if (!liftType) return null;

  // Only the big four have an editorial guide page; every other lift resolves
  // back to this explorer, so link out only when there is somewhere new to go.
  // This is the destination the sidebar rows used to compete with.
  const guideUrl = getLiftDetailUrl(liftType);
  const hasGuidePage = guideUrl && !guideUrl.startsWith("/lift-explorer");

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 2xl:max-w-[1180px]">
      {hasGuidePage && (
        <div className="-mb-2 flex justify-end">
          <Link
            href={guideUrl}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline"
          >
            Full {liftType} guide
            <ArrowUpRight className="size-4" />
          </Link>
        </div>
      )}
      <LiftJourneyCard
        liftType={liftType}
        asCard={false}
        chartDensity="dense"
      />
      <LiftLogCta liftType={liftType} />
      <MostRecentSessionCard
        key={liftType}
        liftType={liftType}
        defaultVisibleCount={5}
      />
      <VisualizerMini liftType={liftType} />
      <TonnageChart liftType={liftType} />
      <StrengthPotentialBarChart liftType={liftType} />
      <div id="lift-prs">
        <LiftTypeRepPRsDisplay liftType={liftType} />
      </div>
    </div>
  );
}
