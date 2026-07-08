/**
 * Long Game starter states render the early-lifter versions of the dashboard
 * card before there is enough history for the full heatmap experience.
 */

import { format } from "date-fns";

import { Fragment, useMemo } from "react";

import Link from "next/link";

import { gaTrackHomeImportNudge } from "@/lib/analytics";

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

export function StarterLongGameState({ parsedData, sessionCount = 0 }) {
  const litDayIndexes = useMemo(() => {
    const nonGoalDates = Array.isArray(parsedData)
      ? Array.from(
          new Set(
            parsedData
              .filter((entry) => !entry?.isGoal && entry?.date)
              .map((entry) => entry.date),
          ),
        ).sort()
      : [];
    const anchorDateStr =
      nonGoalDates[nonGoalDates.length - 1] || format(new Date(), "yyyy-MM-dd");
    const anchorDate = new Date(`${anchorDateStr}T00:00:00`);
    const dayOfWeek = anchorDate.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startOfWeek = new Date(anchorDate);
    startOfWeek.setDate(anchorDate.getDate() - mondayOffset);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const dayIndexes = new Set();
    nonGoalDates.forEach((dateStr) => {
      const entryDate = new Date(`${dateStr}T00:00:00`);
      if (entryDate < startOfWeek || entryDate > endOfWeek) return;
      const mondayBasedIndex = (entryDate.getDay() + 6) % 7;
      dayIndexes.add(mondayBasedIndex);
    });

    if (dayIndexes.size === 0) {
      dayIndexes.add(sessionCount > 0 ? (anchorDate.getDay() + 6) % 7 : 0);
    }

    return dayIndexes;
  }, [parsedData, sessionCount]);
  const days = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <div className="flex h-full flex-col justify-center gap-5">
      <div className="bg-muted/10 rounded-xl border p-5">
        <div className="flex items-center justify-between gap-3">
          {days.map((label, index) => (
            <div
              key={`${label}-${index}`}
              className="flex flex-col items-center gap-2"
            >
              <div
                className={`h-5 w-5 rounded-full border ${
                  litDayIndexes.has(index)
                    ? "border-primary/40 bg-primary"
                    : "border-border/70 bg-muted/30"
                }`}
              />
              <span className="text-muted-foreground text-[10px]">{label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <StarterLongGameNote
          title="Week 1"
          body="Each day you train lights another dot."
        />
        <StarterLongGameNote
          title="Month 1"
          body="A few solid weeks turn dots into a real pattern."
        />
        <StarterLongGameNote
          title="Long term"
          body="Weekly and monthly views unlock once you have more history."
        />
      </div>
      <p className="text-muted-foreground text-sm">
        Right now the story is just one week wide. That is normal. Keep logging
        and the timeline grows with you.
      </p>
    </div>
  );
}

function StarterLongGameNote({ title, body }) {
  return (
    <div className="bg-background/80 rounded-lg border px-3 py-3">
      <p className="text-foreground text-sm font-semibold">{title}</p>
      <p className="text-muted-foreground mt-1 text-sm">{body}</p>
    </div>
  );
}

export function FirstMonthLongGameState({ parsedData }) {
  const { weekdayLabels, weekRows, activeDays } = useMemo(() => {
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

    const anchorDateStr = nonGoalDates[0] || format(new Date(), "yyyy-MM-dd");
    const anchorDate = new Date(`${anchorDateStr}T00:00:00`);
    const dayOfWeek = anchorDate.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const firstWeekStart = new Date(anchorDate);
    firstWeekStart.setDate(anchorDate.getDate() - mondayOffset);
    firstWeekStart.setHours(0, 0, 0, 0);

    const activeDays = new Set();
    nonGoalDates.forEach((dateStr) => {
      const entryDate = new Date(`${dateStr}T00:00:00`);
      const diffDays = Math.floor(
        (entryDate.getTime() - firstWeekStart.getTime()) / 86400000,
      );
      if (diffDays < 0 || diffDays >= 35) return;
      activeDays.add(diffDays);
    });

    const weekRows = Array.from({ length: 5 }, (_, weekIndex) => ({
      label: `W${weekIndex + 1}`,
      days: Array.from(
        { length: 7 },
        (_, dayIndex) => weekIndex * 7 + dayIndex,
      ),
    }));

    return { weekdayLabels, weekRows, activeDays };
  }, [parsedData]);

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="bg-muted/10 rounded-xl border p-5">
        <div className="grid grid-cols-[1.25rem_repeat(7,1.55rem)] justify-center gap-x-1.5 gap-y-1.5 sm:grid-cols-[1.5rem_repeat(7,1.75rem)] sm:gap-x-2 sm:gap-y-2">
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
            <Fragment key={week.label}>
              <span className="text-muted-foreground self-center text-[10px] font-medium">
                {week.label}
              </span>
              {week.days.map((dayNumber) => (
                <div
                  key={`${week.label}-${dayNumber}`}
                  className={`h-6 w-6 rounded-[0.65rem] border transition-colors sm:h-7 sm:w-7 ${
                    activeDays.has(dayNumber)
                      ? "border-primary/18 bg-primary/70"
                      : "border-border/45 bg-muted/18"
                  }`}
                />
              ))}
            </Fragment>
          ))}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <StarterLongGameNote
          title="Week by week"
          body="The first month should start to look like a repeatable rhythm."
        />
        <StarterLongGameNote
          title="Build the pattern"
          body="A few training days each week are enough to make the grid come alive."
        />
        <StarterLongGameNote
          title="Long term"
          body="Richer daily, weekly, and monthly views unlock once you have more history."
        />
      </div>
    </div>
  );
}
