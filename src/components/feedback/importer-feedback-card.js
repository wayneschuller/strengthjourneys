import { MessageCircleHeart, ThumbsUp, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function dispatchFeedback(detail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("open-feedback", { detail }));
}

function slugify(appName) {
  return String(appName || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Inline feedback card for the import pages.
 *
 * Built because the developer doesn't have personal access to every fitness app
 * to test exports — these buttons explicitly invite users who just attempted an
 * import to confirm it worked or to flag a problem. Both buttons open the
 * existing FeedbackWidget dialog via the `open-feedback` event, pre-seeded with
 * sentiment and a categorised triggerLabel so incoming feedback can be filtered.
 *
 * @param {{ appName?: string }} props If provided, used in copy and trigger labels.
 */
export function ImporterFeedbackCard({ appName }) {
  const label = appName ? `the ${appName} importer` : "our importers";
  const slug = appName ? slugify(appName) : "any";

  return (
    <Card className="border-amber-300/60 bg-amber-50/40 dark:border-amber-500/30 dark:bg-amber-500/5">
      <CardContent className="flex flex-col gap-4 py-6 md:flex-row md:items-center">
        <MessageCircleHeart className="hidden h-8 w-8 shrink-0 text-amber-600 md:block dark:text-amber-400" />
        <div className="flex-1">
          <h3 className="font-semibold">Help us improve {label}</h3>
          <p className="text-muted-foreground mt-1 text-sm leading-6">
            Strength Journeys is built by one person who doesn&apos;t own every
            fitness app. If your import worked, the parser just passed a real
            test. If anything looked wrong or missing, please tell us so we can
            fix it.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 md:flex-nowrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              dispatchFeedback({
                sentiment: "positive",
                triggerLabel: `importer-${slug}-worked`,
              })
            }
          >
            <ThumbsUp className="mr-1.5 h-4 w-4" /> It worked
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              dispatchFeedback({
                sentiment: "negative",
                triggerLabel: `importer-${slug}-problem`,
              })
            }
          >
            <AlertCircle className="mr-1.5 h-4 w-4" /> Report a problem
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
