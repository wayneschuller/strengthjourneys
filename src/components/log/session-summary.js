import Link from "next/link";
import { Check, Loader2, X } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getReadableDateString } from "@/lib/processing-utils";
import { getLiftAnchorId } from "@/components/log/utils";

export function getSessionSidebarSummary(
  sessionLiftsWithPending,
  perLiftTonnageStats,
  fallbackUnit,
) {
  const liftNames = Object.keys(sessionLiftsWithPending ?? {});
  if (liftNames.length === 0) {
    return {
      liftCount: 0,
      setCount: 0,
      repCount: 0,
      volume: 0,
      unit: fallbackUnit,
      lifts: [],
    };
  }

  let setCount = 0;
  let repCount = 0;
  let volume = 0;
  let unit = fallbackUnit;

  const lifts = liftNames.map((liftType) => {
    const sets = sessionLiftsWithPending[liftType] ?? [];
    const nativeUnit = sets[0]?.unitType ?? fallbackUnit;
    if (!unit && nativeUnit) unit = nativeUnit;
    setCount += sets.length;
    repCount += sets.reduce((total, set) => total + (set.reps ?? 0), 0);
    if (nativeUnit === unit) {
      volume += perLiftTonnageStats?.[liftType]?.currentLiftTonnage ?? 0;
    }

    return {
      liftType,
      setCount: sets.length,
    };
  });

  return {
    liftCount: liftNames.length,
    setCount,
    repCount,
    volume,
    unit,
    lifts,
  };
}

function formatCompactVolume(value, unit) {
  if (!value) return `0 ${unit}`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k ${unit}`;
  return `${Math.round(value)} ${unit}`;
}

function getPrimarySessionHighlight(summary, perLiftTonnageStats) {
  const topLift = summary?.lifts
    ?.slice()
    ?.sort((a, b) => {
      const aVolume = perLiftTonnageStats?.[a.liftType]?.currentLiftTonnage ?? 0;
      const bVolume = perLiftTonnageStats?.[b.liftType]?.currentLiftTonnage ?? 0;
      return bVolume - aVolume;
    })?.[0];

  if (!topLift) return null;

  const tonnageStats = perLiftTonnageStats?.[topLift.liftType];
  if (!tonnageStats) return null;

  return `💪 Biggest lift today: ${topLift.liftType} - ${formatCompactVolume(
    tonnageStats.currentLiftTonnage,
    tonnageStats.unitType ?? summary.unit,
  )}`;
}

function RailStat({ label, value }) {
  return (
    <div className="rounded-md border border-border/30 bg-background/55 px-3 py-2 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-foreground/90">{value}</p>
    </div>
  );
}

export function SessionSidebarRail({
  sessionDate,
  isToday,
  hasSession,
  summary,
  perLiftTonnageStats,
}) {
  return (
    <>
      <Card className="border-border/35 bg-muted/8 shadow-sm">
        <CardHeader className="space-y-2 px-4 pb-0 pt-4">
          <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Session pulse
          </CardTitle>
          <p className="text-sm text-foreground/90">
            {isToday ? "Today" : getReadableDateString(sessionDate, true)}
          </p>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-4 pt-4">
          {hasSession ? (
            <>
              {getPrimarySessionHighlight(summary, perLiftTonnageStats) ? (
                <div className="rounded-md border border-border/35 bg-background/70 px-3 py-3">
                  <p className="text-sm font-medium text-foreground/90">
                    {getPrimarySessionHighlight(summary, perLiftTonnageStats)}
                  </p>
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <RailStat label="Lifts" value={summary.liftCount} />
                <RailStat label="Sets" value={summary.setCount} />
                <RailStat label="Reps" value={summary.repCount} />
                <RailStat
                  label="Volume"
                  value={formatCompactVolume(summary.volume, summary.unit)}
                />
              </div>
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  In this session
                </p>
                <div className="space-y-2">
                  {summary.lifts.map(({ liftType, setCount }) => (
                    <Link
                      key={liftType}
                      href={`#${getLiftAnchorId(liftType)}`}
                      className="flex items-start justify-between gap-3 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
                    >
                      <span className="min-w-0">{liftType}</span>
                      <span className="shrink-0 text-xs uppercase tracking-wide text-muted-foreground/80">
                        {setCount} sets
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm leading-6 text-muted-foreground">
              No sets logged yet for this date. Start in the center column and
              this rail will update as the session takes shape.
            </p>
          )}
        </CardContent>
      </Card>

      {hasSession ? (
        <Card className="border-border/30 bg-transparent shadow-sm">
          <CardContent className="space-y-2 px-4 py-4 text-xs leading-6 text-muted-foreground">
            <p>
              Average sets per lift:{" "}
              <span className="text-foreground/80">
                {(summary.setCount / Math.max(summary.liftCount, 1)).toFixed(1)}
              </span>
            </p>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}

export function LogSessionSkeleton() {
  return (
    <div className="mt-6">
      <div className="overflow-hidden rounded-xl border border-border/50 bg-card/70 shadow-sm">
        <div className="space-y-3 border-b border-border/40 px-5 py-5">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-3 w-36" />
        </div>
        <div className="space-y-5 px-5 py-5">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-9 w-14" />
                <Skeleton className="h-4 w-3" />
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-4 w-6" />
              </div>
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-4 shrink-0 rounded-full" />
            </div>
          ))}
          <div className="border-t border-border/40 pt-5">
            <Skeleton className="h-12 w-full rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SyncIndicator({ state }) {
  if (state === "idle") return <div className="w-8" />;
  return (
    <div className="flex w-8 items-center justify-center">
      {state === "saving" && (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      )}
      {state === "saved" && (
        <Check className="h-4 w-4 text-green-500" />
      )}
      {state === "error" && (
        <X className="h-4 w-4 text-destructive" />
      )}
    </div>
  );
}
