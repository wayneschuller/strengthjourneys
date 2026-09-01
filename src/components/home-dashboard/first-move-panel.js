/**
 * The first thing a brand-new lifter sees on the home dashboard.
 *
 * At `starter_sample` every card below this one is a promise rather than a
 * payoff: the week card is empty, the heatmap is dormant, the month card is a
 * plan. That is the right shape for those cards, but it means the intro
 * dashboard asks the user to imagine the app instead of showing it, and the
 * two things that end that wait are unequally presented - logging gets four
 * lift buttons, importing gets one dashed link two thirds of the way down a
 * card, and the prominent import banner is switched off for this stage
 * entirely.
 *
 * So this band puts both pathways at the top, at equal weight, and says what
 * each one actually does to the page underneath.
 */

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { FileUp, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BIG_FOUR_LIFT_META } from "@/lib/big-four-lifts";
import { gaTrackStarterFirstMove } from "@/lib/analytics";

// Named apps rather than "supported formats": recognising your own tracker is
// what makes an import feel possible. The full list lives on /import.
const IMPORT_SOURCE_NAMES = ["Hevy", "Strong", "StrongLifts", "a spreadsheet"];

function buildLogHref(liftType) {
  const anchor = `lift-${liftType
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
  return `/log?startLift=${encodeURIComponent(liftType)}#${encodeURIComponent(anchor)}`;
}

/**
 * @param {object} props
 * @param {string} props.dashboardStage
 * @param {number} props.sessionCount
 */
export function FirstMovePanel({ dashboardStage, sessionCount }) {
  const trackedRef = useRef(false);

  useEffect(() => {
    if (trackedRef.current) return;
    trackedRef.current = true;
    gaTrackStarterFirstMove({
      action: "impression",
      dashboardStage,
      sessionCount,
    });
  }, [dashboardStage, sessionCount]);

  const track = (cta) => () =>
    gaTrackStarterFirstMove({
      action: "click",
      cta,
      dashboardStage,
      sessionCount,
    });

  return (
    <Card className="mb-6 overflow-hidden">
      <CardContent className="p-5 md:p-6">
        <div className="mb-5 text-center md:mb-6">
          <h2 className="text-foreground text-xl font-bold md:text-2xl">
            Let&apos;s fill this page with your training
          </h2>
          <p className="text-muted-foreground mt-1.5 text-sm">
            The cards below are waiting on data. Here are the two ways to give
            them some.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Import first: it is the shorter road to a populated dashboard,
              and until now it was the harder one to find. */}
          <div className="border-primary/30 bg-primary/5 flex flex-col rounded-xl border p-4">
            <div className="mb-3 flex items-center gap-2.5">
              <FileUp className="text-primary h-5 w-5 shrink-0" />
              <p className="text-foreground font-semibold">
                Bring your history across
              </p>
            </div>
            <p className="text-muted-foreground mb-3 text-sm leading-relaxed">
              Already tracking in {IMPORT_SOURCE_NAMES[0]},{" "}
              {IMPORT_SOURCE_NAMES[1]}, {IMPORT_SOURCE_NAMES[2]} or{" "}
              {IMPORT_SOURCE_NAMES[3]}? Import the file and every card on this
              page fills in with your real history, today.
            </p>
            <Button asChild className="mt-auto w-full gap-2">
              <Link
                href="/import?source=home-dashboard-first-move"
                onClick={track("import")}
              >
                <FileUp className="h-4 w-4" />
                Import your training history
              </Link>
            </Button>
          </div>

          {/* Logging is the slower road but the one everybody can take. */}
          <div className="border-border bg-muted/20 flex flex-col rounded-xl border p-4">
            <div className="mb-3 flex items-center gap-2.5">
              <Plus className="text-foreground h-5 w-5 shrink-0" strokeWidth={2.5} />
              <p className="text-foreground font-semibold">
                Start from today
              </p>
            </div>
            <p className="text-muted-foreground mb-3 text-sm leading-relaxed">
              No history to bring? Log one set and the week card wakes up
              immediately. Pick a lift to open today&apos;s log.
            </p>
            <div className="mb-3 grid grid-cols-2 gap-2">
              {BIG_FOUR_LIFT_META.map(({ liftType, iconSrc }) => (
                <Link
                  key={liftType}
                  href={buildLogHref(liftType)}
                  onClick={track(`log_${liftType.toLowerCase().replace(/\s+/g, "_")}`)}
                  className="border-border bg-card hover:border-primary hover:bg-muted/40 flex items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors"
                >
                  <Image
                    src={iconSrc}
                    alt=""
                    width={28}
                    height={28}
                    className="h-7 w-7 shrink-0"
                  />
                  <span className="text-xs leading-tight font-medium">
                    {liftType}
                  </span>
                </Link>
              ))}
            </div>
            <Button asChild variant="outline" className="mt-auto w-full gap-2">
              <Link href="/log" onClick={track("log_any")}>
                <Plus className="h-4 w-4" strokeWidth={2.5} />
                Log any lift
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
