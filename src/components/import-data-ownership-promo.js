/**
 * Reusable owned-data promo for SEO tool pages.
 * Keeps the import/merge pitch off the homepage hero while still surfacing it
 * where calculator visitors are likely to have old app history worth importing.
 */

import Link from "next/link";
import { LineChart, Layers, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const OWNED_DATA_POINTS = [
  {
    title: "Rescue the messy past",
    description:
      "Drop exports from Hevy, Strong, StrongLifts, Wodify, BTWB, TurnKey, or old spreadsheets.",
    IconComponent: Upload,
  },
  {
    title: "Normalize the whole timeline",
    description:
      "Strength Journeys cleans lift names, detects PRs, skips duplicates, and stitches sessions together.",
    IconComponent: Layers,
  },
  {
    title: "Keep the source of truth",
    description:
      "Save the merged history to a Google Sheet in your Drive, then keep using it with every analysis tool here.",
    IconComponent: LineChart,
  },
];

const DEFAULT_DESCRIPTION =
  "If your lifting history is split across apps, exports, and old spreadsheets, you do not have to rebuild it by hand. Import each file, merge the clean data into one editable Sheet, and let Strength Journeys turn the whole archive into PRs, standards, timelines, and training insight.";

export function ImportDataOwnershipPromo({
  className,
  title = "Turn app-hopping into one Google Sheet you own.",
  description = DEFAULT_DESCRIPTION,
  cta = "Merge Your App History",
}) {
  return (
    <section
      className={cn(
        "rounded-lg border bg-card/80 p-5 shadow-sm md:p-6",
        className,
      )}
    >
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <Badge variant="secondary" className="mb-3">
            Data ownership, not app lock-in
          </Badge>
          <h2 className="text-2xl font-semibold leading-tight">{title}</h2>
          <p className="text-muted-foreground mt-3 text-sm leading-6">
            {description}
          </p>
          <Link
            href="/import"
            className="bg-primary text-primary-foreground hover:bg-primary/90 mt-5 inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors"
          >
            <Upload className="mr-2 h-4 w-4" />
            {cta}
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          {OWNED_DATA_POINTS.map(
            ({
              title: pointTitle,
              description: pointDescription,
              IconComponent,
            }) => (
              <div key={pointTitle} className="flex items-start gap-3">
                <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-md">
                  <IconComponent className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">{pointTitle}</h3>
                  <p className="text-muted-foreground mt-1 text-sm leading-6">
                    {pointDescription}
                  </p>
                </div>
              </div>
            ),
          )}
        </div>
      </div>
    </section>
  );
}
