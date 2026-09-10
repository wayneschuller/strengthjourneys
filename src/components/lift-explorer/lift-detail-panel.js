/**
 * Lift-detail panel for Lift Explorer.
 * Mirrors the authenticated layout from /progress-guide/[lift] minus the
 * big-four-only cards (strength standards, strength circles, editorial copy)
 * so any lift the user has logged gets the same set of analytical tools.
 */

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { getLiftDetailUrl } from "@/components/lift-type-indicator";
import { LiftArtwork } from "@/components/lift-artwork-image";
import { getLiftArtwork } from "@/lib/lift-artwork";
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

  // A lift earns a guide link once it has an editorial page of its own. Today
  // that is the big four, and everything else resolves back to this explorer,
  // so link out only when there is somewhere new to go. Adding a guide for
  // another lift lights this up on its own, with no change needed here.
  const guideUrl = getLiftDetailUrl(liftType);
  const hasGuidePage = guideUrl && !guideUrl.startsWith("/lift-explorer");

  // Artwork and guide page are independent: a lift can have either, both, or
  // neither. The header carries whatever exists and collapses when nothing
  // does, so drawing a new diagram is the only step needed to show one here.
  const hasArtwork = Boolean(getLiftArtwork(liftType));

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 2xl:max-w-[1180px]">
      {(hasArtwork || hasGuidePage) && (
        <div className="-mb-2 flex items-center gap-4">
          {/* Renders nothing when the lift has no diagram. */}
          <LiftArtwork liftType={liftType} size="md" animate={false} />
          {hasGuidePage && (
            <Link
              href={guideUrl}
              className="text-muted-foreground hover:text-foreground ml-auto inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline"
            >
              Full {liftType} guide
              <ArrowUpRight className="size-4" />
            </Link>
          )}
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
