import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { getDisplayWeight } from "@/lib/processing-utils";
import {
  PR_TIER_STILL_STANDING,
  PR_TIER_LIFETIME_AT_TIME,
  PR_TIER_TWELVE_MONTH_AT_TIME,
} from "@/lib/home-dashboard/streak-leaderboard-metrics";

const TIER_META = {
  [PR_TIER_STILL_STANDING]: { emoji: "⭐", label: "still stands" },
  [PR_TIER_LIFETIME_AT_TIME]: { emoji: "\u{1F3C6}", label: "lifetime PR then" },
  [PR_TIER_TWELVE_MONTH_AT_TIME]: { emoji: "\u{1F538}", label: "12-mo PR then" },
};

const MAX_VISIBLE_STREAKS = 8;
const MIN_BAR_HEIGHT_PX = 16;
const MAX_BAR_HEIGHT_PX = 24;

function formatStreakRange(startWeek, endWeek) {
  const s = parseISO(startWeek);
  const e = parseISO(endWeek);
  if (s.getFullYear() === e.getFullYear()) {
    return `${format(s, "MMM")} → ${format(e, "MMM yyyy")}`;
  }
  return `${format(s, "MMM yyyy")} → ${format(e, "MMM yyyy")}`;
}

export function StreaksLeaderboard({ streaks }) {
  const { isMetric } = useAthleteBio();

  const ranked = useMemo(() => {
    if (!streaks?.length) return [];
    return [...streaks].sort((a, b) => {
      if (b.weeks !== a.weeks) return b.weeks - a.weeks;
      // tiebreak: more recent first
      return b.endWeek.localeCompare(a.endWeek);
    });
  }, [streaks]);

  const stats = useMemo(() => {
    if (!ranked.length) return null;
    const maxWeeks = ranked[0].weeks;
    const tonnages = ranked.map((s) => s.tonnage || 0);
    const minT = Math.min(...tonnages);
    const maxT = Math.max(...tonnages);
    const range = Math.max(maxT - minT, 1);
    return { maxWeeks, minT, range };
  }, [ranked]);

  if (!ranked.length) {
    return (
      <div className="text-muted-foreground py-8 text-center text-xs">
        No streaks yet. A streak is 3+ consecutive weeks with 3+ sessions each.
      </div>
    );
  }

  const visible = ranked.slice(0, MAX_VISIBLE_STREAKS);
  const hidden = ranked.length - visible.length;

  return (
    <TooltipProvider delayDuration={120}>
      <div className="flex flex-col gap-2 px-1 pb-2">
        {visible.map((s) => {
          const lengthPct = (s.weeks / stats.maxWeeks) * 100;
          const heightPx =
            MIN_BAR_HEIGHT_PX +
            Math.round(
              (((s.tonnage || 0) - stats.minT) / stats.range) *
                (MAX_BAR_HEIGHT_PX - MIN_BAR_HEIGHT_PX),
            );
          return (
            <StreakBar
              key={`${s.startWeek}-${s.endWeek}`}
              streak={s}
              lengthPct={lengthPct}
              heightPx={heightPx}
              isMetric={isMetric}
            />
          );
        })}
        {hidden > 0 && (
          <div className="text-muted-foreground/70 pt-1 text-center text-[10px]">
            +{hidden} more {hidden === 1 ? "streak" : "streaks"}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

function StreakBar({ streak, lengthPct, heightPx, isMetric }) {
  const dateLabel = formatStreakRange(streak.startWeek, streak.endWeek);

  const barClass = streak.isActive
    ? "bg-primary"
    : "bg-muted-foreground/40";
  const barStyle = {
    width: `${lengthPct}%`,
    height: `${heightPx}px`,
    borderRadius: "3px",
    ...(streak.isActive
      ? {
          maskImage:
            "linear-gradient(to right, black 65%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to right, black 65%, transparent 100%)",
        }
      : null),
  };
  const labelClass = streak.isActive
    ? "text-primary-foreground"
    : "text-foreground/85";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex cursor-default items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <div
              className={`${barClass} relative flex items-center overflow-hidden`}
              style={barStyle}
            >
              <span
                className={`truncate px-2 text-[10px] leading-none font-medium ${labelClass}`}
              >
                {dateLabel}
              </span>
            </div>
          </div>
          <span
            className={`shrink-0 text-[10px] tabular-nums ${
              streak.isActive
                ? "text-foreground font-semibold"
                : "text-muted-foreground/80"
            }`}
          >
            {streak.weeks}wk
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" align="start" className="max-w-[18rem]">
        <StreakTooltipContent
          streak={streak}
          dateLabel={dateLabel}
          isMetric={isMetric}
        />
      </TooltipContent>
    </Tooltip>
  );
}

function StreakTooltipContent({ streak, dateLabel, isMetric }) {
  const tonnage = Math.round((streak.tonnage || 0) / 1000);
  return (
    <div className="space-y-1.5 text-xs">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold">
          {streak.weeks}-week streak
          {streak.isActive ? " (active)" : ""}
        </span>
        <span className="text-muted-foreground text-[10px]">{dateLabel}</span>
      </div>
      <div className="text-muted-foreground">
        Tonnage during streak: ~{tonnage.toLocaleString()}k
      </div>
      {streak.prs?.length > 0 ? (
        <ul className="space-y-0.5">
          {streak.prs.map((pr, idx) => {
            const w = getDisplayWeight(pr, isMetric);
            const meta = TIER_META[pr.tier] || TIER_META[3];
            return (
              <li
                key={`${pr.date}-${pr.liftType}-${pr.reps}-${idx}`}
                className="flex items-center gap-1.5"
              >
                <span aria-hidden>{meta.emoji}</span>
                <span className="font-medium">
                  {pr.liftType} {pr.reps}@{w.value}
                  {w.unit}
                </span>
                <span className="text-muted-foreground ml-auto text-[10px]">
                  {meta.label}
                </span>
              </li>
            );
          })}
          {streak.prCount > streak.prs.length && (
            <li className="text-muted-foreground text-[10px] italic">
              +{streak.prCount - streak.prs.length} more PRs
            </li>
          )}
        </ul>
      ) : (
        <div className="text-muted-foreground italic">
          Showed up. No PRs landed during this run.
        </div>
      )}
    </div>
  );
}
