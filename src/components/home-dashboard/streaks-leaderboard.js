/**
 * Ranked streak-bar view for The Long Game card.
 *
 * A bar's length is the streak's length in weeks. Inside it, one segment per week
 * shaded on the same heatmap scale the daily view uses, so a grinding three-a-week
 * run and a run with several six-session weeks no longer draw identically. Bar
 * thickness still carries average weekly tonnage, over a deliberately narrow range —
 * enough to feel the difference between a heavy block and a light one without the
 * list looking ragged.
 */
import { useMemo, useState } from "react";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { useHasCoarsePointer } from "@/hooks/use-has-coarse-pointer";
import { getDisplayWeight } from "@/lib/processing-utils";
import {
  MIN_SESSIONS_PER_WEEK,
  MIN_STREAK_WEEKS,
  PR_TIER_STILL_STANDING,
  PR_TIER_LIFETIME_AT_TIME,
  PR_TIER_TWELVE_MONTH_AT_TIME,
} from "@/lib/home-dashboard/streak-leaderboard-metrics";
import { cn } from "@/lib/utils";

const TIER_META = {
  [PR_TIER_STILL_STANDING]: { emoji: "⭐", label: "still stands" },
  [PR_TIER_LIFETIME_AT_TIME]: { emoji: "\u{1F3C6}", label: "lifetime PR then" },
  [PR_TIER_TWELVE_MONTH_AT_TIME]: {
    emoji: "\u{1F538}",
    label: "12-mo PR then",
  },
};

const MAX_VISIBLE_STREAKS = 8;
const MIN_BAR_HEIGHT_PX = 20;
const MAX_BAR_HEIGHT_PX = 34;

// A streak week is 3+ sessions by definition, so the scale starts there and tops
// out at six. Fixed thresholds rather than per-user relative ones: a five-session
// week should look the same shade on everybody's dashboard.
function getWeekHeatLevel(sessions) {
  if (sessions >= 6) return 4;
  if (sessions === 5) return 3;
  if (sessions === 4) return 2;
  return 1;
}

function formatStreakRange(startWeek, endWeek) {
  const s = parseISO(startWeek);
  const e = parseISO(endWeek);
  if (s.getFullYear() === e.getFullYear()) {
    return `${format(s, "MMM")} → ${format(e, "MMM yyyy")}`;
  }
  return `${format(s, "MMM yyyy")} → ${format(e, "MMM yyyy")}`;
}

export function StreaksLeaderboard({
  streaks,
  firstSessionDate = null,
  isSharing = false,
}) {
  const { isMetric } = useAthleteBio();
  const prefersReducedMotion = useReducedMotion();
  const hasCoarsePointer = useHasCoarsePointer();
  const [showAll, setShowAll] = useState(false);
  // One open row at a time — several expanded details would shunt the list around.
  const [expandedKey, setExpandedKey] = useState(null);

  const ranked = useMemo(() => {
    if (!streaks?.length) return [];
    return [...streaks].sort((a, b) => {
      if (b.weeks !== a.weeks) return b.weeks - a.weeks;
      if ((b.avgWeeklyTonnage || 0) !== (a.avgWeeklyTonnage || 0)) {
        return (b.avgWeeklyTonnage || 0) - (a.avgWeeklyTonnage || 0);
      }
      // tiebreak: more recent first
      return b.endWeek.localeCompare(a.endWeek);
    });
  }, [streaks]);

  const stats = useMemo(() => {
    if (!ranked.length) return null;
    const maxWeeks = ranked[0].weeks;
    // Bar thickness encodes avg weekly tonnage so it's comparable across
    // streaks of different lengths (otherwise long streaks always look fat).
    const weeklyTonnages = ranked.map((s) => s.avgWeeklyTonnage || 0);
    const minT = Math.min(...weeklyTonnages);
    const maxT = Math.max(...weeklyTonnages);
    const range = Math.max(maxT - minT, 1);

    const weeksOnStreak = ranked.reduce((total, s) => total + s.weeks, 0);
    // "305 weeks on streak" means nothing without knowing how many weeks of
    // training it is drawn from, so the denominator travels with it.
    const trainingWeeks = firstSessionDate
      ? Math.max(
          weeksOnStreak,
          Math.ceil(
            (differenceInCalendarDays(new Date(), parseISO(firstSessionDate)) +
              1) /
              7,
          ),
        )
      : null;
    const streakShare = trainingWeeks
      ? Math.round((weeksOnStreak / trainingWeeks) * 100)
      : null;

    return { maxWeeks, minT, range, weeksOnStreak, trainingWeeks, streakShare };
  }, [ranked, firstSessionDate]);

  if (!ranked.length) {
    return (
      <div className="text-muted-foreground py-8 text-center text-xs">
        No streaks yet. A streak is {MIN_STREAK_WEEKS}+ consecutive weeks with{" "}
        {MIN_SESSIONS_PER_WEEK}+ sessions each.
      </div>
    );
  }

  const visible =
    showAll && !isSharing ? ranked : ranked.slice(0, MAX_VISIBLE_STREAKS);
  const hidden = ranked.length - visible.length;

  return (
    <TooltipProvider delayDuration={120}>
      <div className="flex flex-col gap-2 px-1 pb-2">
        {isSharing && (
          <div className="mb-1 flex items-baseline justify-between gap-2 border-b pb-1">
            <h3 className="text-foreground text-sm font-semibold">
              Training Streaks
            </h3>
            <span className="text-muted-foreground text-[10px]">
              {MIN_STREAK_WEEKS}+ weeks · {MIN_SESSIONS_PER_WEEK}+ sessions/week
            </span>
          </div>
        )}

        <StreakSummaryLine
          streakCount={ranked.length}
          longestWeeks={stats.maxWeeks}
          weeksOnStreak={stats.weeksOnStreak}
          trainingWeeks={stats.trainingWeeks}
          streakShare={stats.streakShare}
        />

        {visible.map((s, index) => {
          const lengthPct = (s.weeks / stats.maxWeeks) * 100;
          const heightPx =
            MIN_BAR_HEIGHT_PX +
            Math.round(
              (((s.avgWeeklyTonnage || 0) - stats.minT) / stats.range) *
                (MAX_BAR_HEIGHT_PX - MIN_BAR_HEIGHT_PX),
            );
          const key = `${s.startWeek}-${s.endWeek}`;
          return (
            <StreakBar
              key={key}
              streak={s}
              lengthPct={lengthPct}
              heightPx={heightPx}
              isMetric={isMetric}
              isSharing={isSharing}
              animationIndex={Math.min(index, MAX_VISIBLE_STREAKS)}
              shouldAnimate={!isSharing && !prefersReducedMotion}
              hasCoarsePointer={hasCoarsePointer}
              isExpanded={expandedKey === key}
              onToggle={() =>
                setExpandedKey((previous) => (previous === key ? null : key))
              }
            />
          );
        })}

        {!isSharing && (hidden > 0 || showAll) && (
          <button
            type="button"
            onClick={() => setShowAll((previous) => !previous)}
            className="text-muted-foreground/70 hover:text-foreground focus-visible:ring-ring rounded pt-1 text-center text-[10px] transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            {showAll
              ? "Show fewer"
              : `+${hidden} more ${hidden === 1 ? "streak" : "streaks"}`}
          </button>
        )}
        {isSharing && hidden > 0 && (
          <div className="text-muted-foreground/70 pt-1 text-center text-[10px]">
            +{hidden} more {hidden === 1 ? "streak" : "streaks"}
          </div>
        )}

        <StreakLegend />
      </div>
    </TooltipProvider>
  );
}

// One quiet line of context above the bars. For a lifter with years of history the
// share of training life spent on a streak is the most interesting number here, so
// it goes last where the eye lands.
function StreakSummaryLine({
  streakCount,
  longestWeeks,
  weeksOnStreak,
  trainingWeeks,
  streakShare,
}) {
  return (
    <div className="text-muted-foreground mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11px] leading-tight">
      <span>
        <span className="text-foreground font-semibold tabular-nums">
          {streakCount}
        </span>{" "}
        {streakCount === 1 ? "streak" : "streaks"}
      </span>
      <span aria-hidden>·</span>
      <span>
        longest{" "}
        <span className="text-foreground font-semibold tabular-nums">
          {longestWeeks}
        </span>{" "}
        weeks
      </span>
      <span aria-hidden>·</span>
      <span>
        <span className="text-foreground font-semibold tabular-nums">
          {weeksOnStreak}
        </span>
        {trainingWeeks !== null && (
          <>
            {" of "}
            <span className="tabular-nums">{trainingWeeks}</span>
          </>
        )}{" "}
        weeks on streak
        {streakShare !== null && (
          <span className="text-foreground font-semibold">
            {" "}
            ({streakShare}%)
          </span>
        )}
      </span>
    </div>
  );
}

// Shaded week blocks invite the question "why is that one darker?", so the scale
// gets named once at the foot of the list alongside the rule for what counts as a
// streak at all. Cheaper than a tooltip on every block and it does not move layout.
function StreakLegend() {
  return (
    <div className="text-muted-foreground/80 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pt-1 text-[10px] leading-none">
      <span>
        Streak = {MIN_STREAK_WEEKS}+ weeks in a row at {MIN_SESSIONS_PER_WEEK}+
        sessions
      </span>
      <span className="flex items-center gap-1">
        <span>Each block is a week ·</span>
        <span className="tabular-nums">{MIN_SESSIONS_PER_WEEK}</span>
        <span className="flex items-center gap-px" aria-hidden>
          {[1, 2, 3, 4].map((level) => (
            <span
              key={`legend-${level}`}
              className="h-2 w-2 rounded-[1px]"
              style={{ backgroundColor: `var(--heatmap-${level})` }}
            />
          ))}
        </span>
        <span className="tabular-nums">6+</span>
        <span>sessions</span>
      </span>
    </div>
  );
}

function StreakBar({
  streak,
  lengthPct,
  heightPx,
  isMetric,
  isSharing,
  animationIndex,
  shouldAnimate,
  hasCoarsePointer,
  isExpanded,
  onToggle,
}) {
  const dateLabel = formatStreakRange(streak.startWeek, streak.endWeek);
  const weekCounts = streak.weekCounts?.length
    ? streak.weekCounts
    : Array.from({ length: streak.weeks }, () => 3);

  // mask-image is unsupported by html2canvas-pro, so skip the active-streak
  // fade-trail during capture — the bar would otherwise still get the mask
  // computed-style and the captured image would clip the right edge.
  const barStyle = {
    width: `${lengthPct}%`,
    height: `${heightPx}px`,
    ...(streak.isActive && !isSharing
      ? {
          maskImage: "linear-gradient(to right, black 88%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to right, black 88%, transparent 100%)",
        }
      : null),
  };

  const RowTag = isSharing ? motion.div : motion.button;
  const rowInteractionProps = isSharing
    ? {}
    : {
        type: "button",
        onClick: onToggle,
        "aria-expanded": isExpanded,
        "aria-label": `${dateLabel}, ${streak.weeks} week streak`,
      };

  const row = (
    <RowTag
      {...rowInteractionProps}
      className={cn(
        "flex w-full items-center gap-2 rounded text-left",
        isSharing
          ? "cursor-default"
          : "focus-visible:ring-ring cursor-pointer focus-visible:ring-2 focus-visible:outline-none",
      )}
      initial={shouldAnimate ? { opacity: 0, y: 6 } : false}
      animate={shouldAnimate ? { opacity: 1, y: 0 } : undefined}
      transition={
        shouldAnimate
          ? {
              duration: 0.3,
              delay: animationIndex * 0.05,
              ease: [0.22, 1, 0.36, 1],
            }
          : undefined
      }
    >
      <span
        className={cn(
          "w-[86px] shrink-0 truncate text-[10px] leading-none sm:w-[104px]",
          streak.isActive
            ? "text-foreground font-semibold"
            : "text-muted-foreground",
        )}
      >
        {dateLabel}
      </span>

      <div className="min-w-0 flex-1">
        {/* Clip-wipe rather than a width tween so the week segments keep their
            shape while the bar reveals. */}
        <motion.div
          className="flex items-stretch gap-px overflow-hidden rounded-[3px]"
          style={barStyle}
          initial={shouldAnimate ? { clipPath: "inset(0 100% 0 0)" } : false}
          animate={shouldAnimate ? { clipPath: "inset(0 0% 0 0)" } : undefined}
          transition={
            shouldAnimate
              ? {
                  duration: 0.65,
                  delay: animationIndex * 0.05 + 0.08,
                  ease: [0.16, 1, 0.3, 1],
                }
              : undefined
          }
        >
          {weekCounts.map((sessions, weekIndex) => (
            <span
              key={`${streak.startWeek}-week-${weekIndex}`}
              className="min-w-px flex-1"
              style={{
                backgroundColor: `var(--heatmap-${getWeekHeatLevel(sessions)})`,
              }}
            />
          ))}
        </motion.div>
      </div>

      {/* Fixed width so every bar ends at the same x and lengths stay comparable. */}
      <span
        className={cn(
          "w-[38px] shrink-0 text-right text-sm leading-none font-semibold tabular-nums",
          streak.isActive ? "text-primary" : "text-foreground",
        )}
      >
        {streak.weeks}
        <span className="text-muted-foreground ml-0.5 text-[10px] font-normal">
          wk
        </span>
      </span>
    </RowTag>
  );

  if (isSharing) {
    return (
      <div className="flex flex-col gap-1">
        {row}
        <StreakInlineSummary streak={streak} isMetric={isMetric} />
      </div>
    );
  }

  const detail = (
    <StreakDetail streak={streak} dateLabel={dateLabel} isMetric={isMetric} />
  );

  return (
    <div className="flex flex-col">
      {/* Hover gets a tooltip because it must not disturb the list while the
          pointer travels down it. A tap has no hover to fall back on, so the same
          detail opens inline underneath — and clicking pins it open on desktop too. */}
      {hasCoarsePointer ? (
        row
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>{row}</TooltipTrigger>
          <TooltipContent side="top" align="start" className="max-w-[18rem]">
            {detail}
          </TooltipContent>
        </Tooltip>
      )}

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="streak-detail"
            className="overflow-hidden"
            initial={shouldAnimate ? { height: 0, opacity: 0 } : false}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="border-border/50 mt-2 ml-[94px] border-l pb-1 pl-3 sm:ml-[112px]">
              {detail}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StreakInlineSummary({ streak, isMetric }) {
  const avgWeekly = Math.round((streak.avgWeeklyTonnage || 0) / 1000);
  const topPrs = (streak.prs || []).slice(0, 3);
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 pl-1 text-[10px] leading-tight">
      <span>~{avgWeekly.toLocaleString()}k/wk</span>
      {topPrs.map((pr, idx) => {
        const w = getDisplayWeight(pr, isMetric);
        const meta = TIER_META[pr.tier] || TIER_META[3];
        return (
          <span
            key={`${pr.date}-${pr.liftType}-${pr.reps}-${idx}`}
            className="text-foreground/80"
          >
            <span aria-hidden>{meta.emoji}</span> {pr.liftType} {pr.reps}@
            {w.value}
            {w.unit}
          </span>
        );
      })}
      {streak.prCount > topPrs.length && (
        <span className="italic">
          +{streak.prCount - topPrs.length} more PR
          {streak.prCount - topPrs.length === 1 ? "" : "s"}
        </span>
      )}
    </div>
  );
}

// Shared by the desktop hover tooltip and the inline tap disclosure.
function StreakDetail({ streak, dateLabel, isMetric }) {
  const avgWeekly = Math.round((streak.avgWeeklyTonnage || 0) / 1000);
  const bestWeek = streak.weekCounts?.length
    ? Math.max(...streak.weekCounts)
    : null;
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
        Avg weekly tonnage: ~{avgWeekly.toLocaleString()}k
        {bestWeek !== null && ` · best week: ${bestWeek} sessions`}
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
