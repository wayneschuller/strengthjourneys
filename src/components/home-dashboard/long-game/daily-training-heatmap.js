/**
 * Daily training heatmap renders one calendar-style activity grid for a visible
 * date range and shows per-session lift details in a hover tooltip.
 */

import { cloneElement, memo, useCallback, useMemo, useState } from "react";

import { useRouter } from "next/router";

import { useReducedMotion } from "motion/react";

import CalendarHeatmap from "react-calendar-heatmap";

import { getDisplayWeight } from "@/lib/processing-utils";

import { useAthleteBio } from "@/hooks/use-athlete-biodata";

import { useUserLiftingData } from "@/hooks/use-userlift-data";

import { getReadableDateString } from "@/lib/date-utils";

import { Skeleton } from "@/components/ui/skeleton";

import { LiftTypeIndicator } from "@/components/lift-type-indicator";

import { SessionRow } from "@/components/visualizer/visualizer-utils";

import {
  buildDailyTrainingHeatmapDays,
  parseTrainingDateAsLocalDate,
} from "@/components/home-dashboard/long-game/long-game-training-activity";

const MAX_LIFTS_SHOWN = 6;

export function DailyTrainingHeatmap({
  parsedData,
  startDate,
  endDate,
  isSharing,
  showMonthLabels = true,
}) {
  const { isDemoMode } = useUserLiftingData();
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const heatmapYear = startDate
    ? parseTrainingDateAsLocalDate(startDate).getFullYear()
    : null;
  const currentYear = new Date().getFullYear();
  const shouldAnimateCurrentYear =
    heatmapYear === currentYear && !isSharing && !prefersReducedMotion;
  const [hoveredValue, setHoveredValue] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({
    x: 0,
    y: 0,
    showBelow: false,
  });

  const heatmapData = useMemo(() => {
    if (!Array.isArray(parsedData) || parsedData.length === 0) return null;
    return buildDailyTrainingHeatmapDays(
      parsedData,
      startDate,
      endDate,
      isDemoMode, // This is a clue we have sample data and we will fake the heatmap to impress shallow people
    );
  }, [parsedData, startDate, endDate, isDemoMode]);

  const handleMouseOver = useCallback((e, value) => {
    if (!value || !value.sessionData) return;
    const cellRect = e.target.getBoundingClientRect();
    const x = cellRect.left + cellRect.width / 2;
    const y = cellRect.top;
    const showBelow = y < 200;
    setTooltipPos({
      x: Math.max(140, Math.min(x, window.innerWidth - 140)),
      y: showBelow ? cellRect.bottom + 8 : y - 8,
      showBelow,
    });
    setHoveredValue(value);
  }, []);

  const handleClick = useCallback(
    (value) => {
      if (!value?.dateKey) return;
      router.push({ pathname: "/log", query: { date: value.dateKey } });
    },
    [router],
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredValue(null);
  }, []);

  if (!heatmapData || !startDate || !endDate) {
    return <Skeleton className="h-24 flex-1" />;
  }

  return (
    <div className="relative px-1 py-1">
      <CalendarHeatmap
        startDate={parseTrainingDateAsLocalDate(startDate)}
        endDate={parseTrainingDateAsLocalDate(endDate)}
        values={heatmapData}
        showMonthLabels={showMonthLabels}
        classForValue={(value) => {
          if (!value) return `color-heatmap-0`;
          return `color-heatmap-${value.count}`;
        }}
        titleForValue={() => null}
        onClick={handleClick}
        onMouseOver={handleMouseOver}
        onMouseLeave={handleMouseLeave}
        transformDayElement={(element, value, index) => {
          const dayStyle = value?.dateKey ? { cursor: "pointer" } : {};
          return cloneElement(element, {
            rx: 3,
            ry: 3,
            style: {
              ...element.props.style,
              ...dayStyle,
              ...(shouldAnimateCurrentYear
                ? {
                    animation: "long-game-cell-pop 560ms both",
                    animationDelay: `${Math.min(index * 6, 640)}ms`,
                    transformBox: "fill-box",
                    transformOrigin: "center",
                  }
                : null),
            },
          });
        }}
      />
      {hoveredValue && !isSharing && (
        <div
          className="pointer-events-none fixed z-50"
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y,
            transform: tooltipPos.showBelow
              ? "translate(-50%, 0)"
              : "translate(-50%, -100%)",
          }}
        >
          <DailyTrainingHeatmapTooltip value={hoveredValue} />
        </div>
      )}
    </div>
  );
}

export const MemoizedDailyTrainingHeatmap = memo(DailyTrainingHeatmap);

// Tooltip body for a daily heatmap cell: date, set/lift counts, PR badges (heaviest per lift type),
// and per-lift set breakdowns. Shows up to MAX_LIFTS_SHOWN lift types before truncating.
export function DailyTrainingHeatmapTooltip({ value }) {
  const { sessionData, dateKey } = value;
  const { isMetric } = useAthleteBio();
  if (!sessionData) return null;

  const { totalSets, uniqueLifts, prs, liftsByType } = sessionData;
  const dateLabel = getReadableDateString(dateKey, true);
  const liftTypes = Object.keys(liftsByType);
  const visibleLifts = liftTypes.slice(0, MAX_LIFTS_SHOWN);
  const hiddenCount = liftTypes.length - MAX_LIFTS_SHOWN;

  // Keep only the heaviest PR per lift type
  const bestPrs = Object.values(
    prs.reduce((acc, pr) => {
      if (!acc[pr.liftType] || pr.weight > acc[pr.liftType].weight) {
        acc[pr.liftType] = pr;
      }
      return acc;
    }, {}),
  );

  return (
    <div className="border-border/50 bg-background grid max-w-[20rem] min-w-[10rem] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-bold">{dateLabel}</p>
      <p className="text-muted-foreground">
        {totalSets} {totalSets === 1 ? "set" : "sets"} across {uniqueLifts}{" "}
        {uniqueLifts === 1 ? "lift" : "lifts"}
      </p>

      {bestPrs.length > 0 && (
        <div className="flex flex-col gap-1">
          {bestPrs.map((pr, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="shrink-0 rounded bg-amber-500/20 px-1 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                PR
              </span>
              <LiftTypeIndicator liftType={pr.liftType} />
              <span className="text-muted-foreground">
                {pr.reps}@{getDisplayWeight(pr, isMetric).value}
                {getDisplayWeight(pr, isMetric).unit}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1">
        {visibleLifts.map((liftType) => (
          <div key={liftType}>
            <LiftTypeIndicator liftType={liftType} />
            <SessionRow
              lifts={liftsByType[liftType]}
              showDate={false}
              isMetric={isMetric}
            />
          </div>
        ))}
        {hiddenCount > 0 && (
          <p className="text-muted-foreground">
            +{hiddenCount} more {hiddenCount === 1 ? "lift" : "lifts"}
          </p>
        )}
      </div>
    </div>
  );
}
