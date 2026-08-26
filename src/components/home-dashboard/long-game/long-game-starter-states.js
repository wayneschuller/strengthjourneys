/**
 * Long Game starter states render the early-lifter versions of the dashboard
 * card before there is enough history for the full heatmap experience.
 *
 * These are the only versions of the card most new users will ever see, so they
 * carry the work the mature card does with heatmaps and rings: mark where today is,
 * count what has been logged, and name the next threshold with a real number
 * attached rather than promising that things unlock eventually.
 */

import { format } from "date-fns";

import { Fragment, useMemo } from "react";

import Link from "next/link";

import { gaTrackHomeImportNudge, gaTrackLongGameLogCta } from "@/lib/analytics";

import { formatMilestoneRemaining } from "@/lib/home-dashboard/long-game-milestones";

export function LongGameImportNudge({ dashboardStage, sessionCount }) {
  const trackClick = () => {
    gaTrackHomeImportNudge({
      action: "click",
      surface: "long_game_card",
      dashboardStage,
      sessionCount,
    });
  };

  return (
    <p
      className="text-muted-foreground text-left text-xs leading-5 sm:text-center"
      data-share-ignore="true"
    >
      Your strength journey did not start here. Bring in lifting history from
      other fitness apps and{" "}
      <Link
        href="/import?source=long-game-card"
        onClick={trackClick}
        className="text-foreground font-medium underline underline-offset-2"
      >
        merge it into this timeline
      </Link>
      .
    </p>
  );
}

// Every early-stage message on this card ends in "go and lift", so the phrase that
// says it is the phrase that takes you there. One component, three registers: the
// day dot, the milestone button, and the closing sentence.
function LogSessionLink({
  cta,
  dashboardStage,
  sessionCount,
  className = "",
  children,
}) {
  return (
    <Link
      href={`/log?source=long-game-${cta}`}
      onClick={() =>
        gaTrackLongGameLogCta({ cta, dashboardStage, sessionCount })
      }
      className={className}
    >
      {children}
    </Link>
  );
}

/**
 * The next threshold, with a bar that moves. Rendered in every pre-established
 * stage, including alongside the mature heatmap at early_base.
 */
export function LongGameMilestone({
  milestone,
  dashboardStage = null,
  sessionCount = 0,
}) {
  if (!milestone) return null;

  const { title, body, current, target } = milestone;
  const progress = Math.max(0, Math.min(1, target > 0 ? current / target : 0));

  return (
    <div
      className="bg-muted/10 rounded-lg border px-4 py-3"
      data-share-ignore="true"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-foreground text-sm font-semibold">
          Next up · {title}
        </p>
        <p className="text-muted-foreground text-xs tabular-nums">
          {formatMilestoneRemaining(milestone)}
        </p>
      </div>
      <div className="bg-muted/40 mt-2 h-1.5 w-full overflow-hidden rounded-full">
        <div
          className="bg-primary h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-muted-foreground text-xs leading-5">{body}</p>
        <LogSessionLink
          cta="milestone"
          dashboardStage={dashboardStage}
          sessionCount={sessionCount}
          className="text-foreground shrink-0 text-xs font-medium whitespace-nowrap underline underline-offset-2"
        >
          Log a session →
        </LogSessionLink>
      </div>
    </div>
  );
}

// "3 sessions logged" is the only number a brand new lifter has. Worth printing.
function LoggedSessionCount({ sessionCount }) {
  return (
    <p className="text-muted-foreground text-xs">
      <span className="text-foreground font-semibold tabular-nums">
        {sessionCount}
      </span>{" "}
      {sessionCount === 1 ? "session" : "sessions"} logged so far
    </p>
  );
}

export function StarterLongGameState({
  parsedData,
  sessionCount = 0,
  milestone = null,
  dashboardStage = null,
}) {
  // Anchored on the current week rather than the week of the last session, so the
  // row always answers "where am I right now" and today has a fixed place on it.
  // The old fallback lit Monday whenever the week was empty, which drew a training
  // day that never happened on a brand new lifter's very first screen.
  const { litDayIndexes, todayIndex } = useMemo(() => {
    const nonGoalDates = Array.isArray(parsedData)
      ? Array.from(
          new Set(
            parsedData
              .filter((entry) => !entry?.isGoal && entry?.date)
              .map((entry) => entry.date),
          ),
        )
      : [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIndex = (today.getDay() + 6) % 7;
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - todayIndex);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const dayIndexes = new Set();
    nonGoalDates.forEach((dateStr) => {
      const entryDate = new Date(`${dateStr}T00:00:00`);
      if (entryDate < startOfWeek || entryDate > endOfWeek) return;
      dayIndexes.add((entryDate.getDay() + 6) % 7);
    });

    return { litDayIndexes: dayIndexes, todayIndex };
  }, [parsedData]);

  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const trainedThisWeek = litDayIndexes.size;

  return (
    <div className="flex h-full flex-col justify-center gap-5">
      <div className="bg-muted/10 rounded-xl border p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-foreground text-sm font-semibold">This week</p>
          <p className="text-muted-foreground text-xs">
            {trainedThisWeek === 0
              ? "No sessions yet this week"
              : `${trainedThisWeek} ${trainedThisWeek === 1 ? "day" : "days"} lit up`}
          </p>
        </div>
        <div className="flex items-center justify-between gap-3">
          {days.map((label, index) => {
            const isLit = litDayIndexes.has(index);
            const isToday = index === todayIndex;
            const dot = (
              <>
                <span
                  className={`h-5 w-5 rounded-full border ${
                    isLit
                      ? "border-primary/40 bg-primary"
                      : isToday
                        ? "border-primary/60 bg-muted/30 group-hover:bg-primary/20 border-dashed"
                        : "border-border/70 bg-muted/30"
                  }`}
                />
                <span
                  className={
                    isToday
                      ? "text-foreground text-[10px] font-semibold"
                      : "text-muted-foreground text-[10px]"
                  }
                >
                  {label}
                </span>
              </>
            );

            // The dashed ring marks today; making it the link means the thing
            // pointing at today is also the thing that lets you fill it in.
            if (isToday) {
              return (
                <LogSessionLink
                  key={`${label}-${index}`}
                  cta="today"
                  dashboardStage={dashboardStage}
                  sessionCount={sessionCount}
                  className="focus-visible:ring-ring group flex flex-col items-center gap-2 rounded transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  <span className="sr-only">
                    {isLit ? "Add to today's session" : "Log today's session"}
                  </span>
                  {dot}
                </LogSessionLink>
              );
            }

            return (
              <div
                key={`${label}-${index}`}
                className="flex flex-col items-center gap-2"
              >
                {dot}
              </div>
            );
          })}
        </div>
      </div>

      {sessionCount > 0 && <LoggedSessionCount sessionCount={sessionCount} />}

      <LongGameMilestone
        milestone={milestone}
        dashboardStage={dashboardStage}
        sessionCount={sessionCount}
      />

      <p className="text-muted-foreground text-sm">
        {sessionCount === 0 ? (
          <>
            Nothing logged yet. The{" "}
            <LogSessionLink
              cta="sentence"
              dashboardStage={dashboardStage}
              sessionCount={sessionCount}
              className="text-foreground font-medium underline underline-offset-2"
            >
              first session you record
            </LogSessionLink>{" "}
            puts the first square on this map.
          </>
        ) : (
          <>
            Right now the story is just one week wide. That is normal.{" "}
            <LogSessionLink
              cta="sentence"
              dashboardStage={dashboardStage}
              sessionCount={sessionCount}
              className="text-foreground font-medium underline underline-offset-2"
            >
              Keep logging
            </LogSessionLink>{" "}
            and the timeline grows with you.
          </>
        )}
      </p>
    </div>
  );
}

export function FirstMonthLongGameState({
  parsedData,
  sessionCount = 0,
  milestone = null,
  dashboardStage = null,
}) {
  // The grid ends on the current week rather than starting at the first session,
  // so today always has a square. A lifter can reach twenty sessions across more
  // than five weeks, and the old anchor would have shown them their first five
  // weeks forever while their recent training fell off the end.
  const { weekdayLabels, weekRows, activeDays, todayIndex } = useMemo(() => {
    const weekdayLabels = ["M", "T", "W", "T", "F", "S", "S"];
    const nonGoalDates = Array.isArray(parsedData)
      ? Array.from(
          new Set(
            parsedData
              .filter((entry) => !entry?.isGoal && entry?.date)
              .map((entry) => entry.date),
          ),
        ).sort()
      : [];

    const startOfWeekFor = (date) => {
      const dayOfWeek = date.getDay();
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - mondayOffset);
      weekStart.setHours(0, 0, 0, 0);
      return weekStart;
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thisWeekStart = startOfWeekFor(today);

    const firstDateStr = nonGoalDates[0] || format(today, "yyyy-MM-dd");
    const firstWeekStart = startOfWeekFor(new Date(`${firstDateStr}T00:00:00`));

    const weeksSinceStart =
      Math.floor(
        (thisWeekStart.getTime() - firstWeekStart.getTime()) / (7 * 86400000),
      ) + 1;
    const weekCount = Math.min(5, Math.max(1, weeksSinceStart));

    const gridStart = new Date(thisWeekStart);
    gridStart.setDate(thisWeekStart.getDate() - (weekCount - 1) * 7);

    const dayCount = weekCount * 7;
    const dayOffsetFor = (date) =>
      Math.floor((date.getTime() - gridStart.getTime()) / 86400000);

    const activeDays = new Set();
    nonGoalDates.forEach((dateStr) => {
      const offset = dayOffsetFor(new Date(`${dateStr}T00:00:00`));
      if (offset < 0 || offset >= dayCount) return;
      activeDays.add(offset);
    });

    const weekRows = Array.from({ length: weekCount }, (_, weekIndex) => {
      const weekStart = new Date(gridStart);
      weekStart.setDate(gridStart.getDate() + weekIndex * 7);
      return {
        key: format(weekStart, "yyyy-MM-dd"),
        label: format(weekStart, "d MMM"),
        days: Array.from(
          { length: 7 },
          (_, dayIndex) => weekIndex * 7 + dayIndex,
        ),
      };
    });

    return {
      weekdayLabels,
      weekRows,
      activeDays,
      todayIndex: dayOffsetFor(today),
    };
  }, [parsedData]);

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="bg-muted/10 rounded-xl border p-5">
        <div className="grid grid-cols-[2.6rem_repeat(7,1.55rem)] justify-center gap-x-1.5 gap-y-1.5 sm:grid-cols-[2.9rem_repeat(7,1.75rem)] sm:gap-x-2 sm:gap-y-2">
          <div />
          {weekdayLabels.map((label, index) => (
            <span
              key={`${label}-${index}`}
              className="text-muted-foreground text-center text-[10px] font-medium"
            >
              {label}
            </span>
          ))}
          {weekRows.map((week) => (
            <Fragment key={week.key}>
              <span className="text-muted-foreground self-center text-right text-[10px] font-medium">
                {week.label}
              </span>
              {week.days.map((dayNumber) => {
                const isActive = activeDays.has(dayNumber);
                const isToday = dayNumber === todayIndex;
                const isFuture = dayNumber > todayIndex;
                return (
                  <div
                    key={`${week.key}-${dayNumber}`}
                    className={`h-6 w-6 rounded-[0.65rem] border transition-colors sm:h-7 sm:w-7 ${
                      isActive
                        ? "border-primary/18 bg-primary/70"
                        : isToday
                          ? "border-primary/60 bg-muted/18 border-dashed"
                          : isFuture
                            ? "border-border/25 bg-muted/5"
                            : "border-border/45 bg-muted/18"
                    }`}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>

      {sessionCount > 0 && <LoggedSessionCount sessionCount={sessionCount} />}

      <LongGameMilestone
        milestone={milestone}
        dashboardStage={dashboardStage}
        sessionCount={sessionCount}
      />

      <p className="text-muted-foreground text-sm">
        A few training days each week is all it takes to turn these squares into
        a rhythm you can see.{" "}
        <LogSessionLink
          cta="sentence"
          dashboardStage={dashboardStage}
          sessionCount={sessionCount}
          className="text-foreground font-medium underline underline-offset-2"
        >
          Log today&apos;s session
        </LogSessionLink>
        .
      </p>
    </div>
  );
}
