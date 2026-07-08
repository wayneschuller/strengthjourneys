/**
 * Weekly training pattern grid groups a lifter's history by calendar week and
 * renders one compact 53-column row per year.
 */

import { format } from "date-fns";

import { useCallback, useMemo, useState } from "react";

import { useUserLiftingData } from "@/hooks/use-userlift-data";

import {
  getCalendarYearWeekIndexFromWeekKey,
  getCalendarYearWeekStartFromIndex,
  getWeekKeyFromDateStr,
  parseYmdUtc,
} from "@/lib/date-utils";

import { buildWeeklyTrainingActivityByYear } from "@/components/home-dashboard/long-game/long-game-training-activity";

const WEEKLY_GAP = 2;

const LONG_GAME_YEAR_LABEL_WIDTH = 48;

const MONTH_LABELS = [
  "J",
  "F",
  "M",
  "A",
  "M",
  "J",
  "J",
  "A",
  "S",
  "O",
  "N",
  "D",
];

function buildWeeklyMonthLabels(year) {
  return MONTH_LABELS.map((label, monthIndex) => ({
    label,
    week: getCalendarYearWeekIndexFromWeekKey(
      year,
      getWeekKeyFromDateStr(
        `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`,
      ),
    ),
  })).filter(
    ({ week }, index, labels) =>
      week >= 1 &&
      week <= 53 &&
      labels.findIndex((candidate) => candidate.week === week) === index,
  );
}

// Tooltip body for a weekly cell: shows the week-start date and training day count for that week.
function WeeklyTrainingPatternTooltip({ value }) {
  const { year, weekNum, sessions } = value;
  return (
    <div className="border-border/50 bg-background grid max-w-[16rem] min-w-[8rem] items-start gap-1 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-bold">
        Week of {getWeekStartDate(year, weekNum)}, {year}
      </p>
      <p className="text-muted-foreground">
        {sessions === 0
          ? "No training sessions"
          : `${sessions} training ${sessions === 1 ? "day" : "days"}`}
      </p>
    </div>
  );
}

function getWeekStartDate(year, weekNum) {
  return format(
    parseYmdUtc(getCalendarYearWeekStartFromIndex(year, weekNum)),
    "MMM d",
  );
}

// All-years weekly grid: one row per year, 53 cells per row (one per calendar week).
// Cell color encodes sessions that week: 1 day → level 1, 2 days → level 2, 3+ days → level 4.
// Colors use --heatmap-N CSS variables so all themes work. Future weeks render invisible.
export function WeeklyTrainingPatternGrid({
  parsedData,
  startYear,
  endYear,
  isSharing,
}) {
  const { isDemoMode } = useUserLiftingData();
  const [hoveredValue, setHoveredValue] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({
    x: 0,
    y: 0,
    showBelow: false,
  });

  const weeklyData = useMemo(
    () =>
      buildWeeklyTrainingActivityByYear(
        parsedData,
        startYear,
        endYear,
        isDemoMode,
      ),
    [parsedData, startYear, endYear, isDemoMode],
  );

  const years = useMemo(() => {
    const nextYears = [];
    for (let y = startYear; y <= endYear; y++) nextYears.push(y);
    return nextYears;
  }, [startYear, endYear]);

  // Used to distinguish future weeks (no data yet) from past missed weeks
  const todayDate = new Date();
  const currentYear = todayDate.getFullYear();
  const currentWeekNum = getCalendarYearWeekIndexFromWeekKey(
    currentYear,
    getWeekKeyFromDateStr(format(todayDate, "yyyy-MM-dd")),
  );
  const weeklyMonthLabels = useMemo(
    () => buildWeeklyMonthLabels(currentYear),
    [currentYear],
  );

  const handleMouseOver = useCallback((e, year, weekNum, data) => {
    const cellRect = e.target.getBoundingClientRect();
    const x = cellRect.left + cellRect.width / 2;
    const y = cellRect.top;
    const showBelow = y < 200;
    setTooltipPos({
      x: Math.max(100, Math.min(x, window.innerWidth - 100)),
      y: showBelow ? cellRect.bottom + 8 : y - 8,
      showBelow,
    });
    setHoveredValue({ year, weekNum, ...data });
  }, []);

  const handleMouseLeave = useCallback(() => setHoveredValue(null), []);

  // 53-column grid that fills available width; gap between cells
  const cellGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(53, 1fr)",
    gap: WEEKLY_GAP,
    flex: 1,
  };

  return (
    <div className="relative w-full">
      {/* Month label header — same 53-col grid so columns align with cells */}
      <div className="border-border/15 mb-1 flex w-full items-end border-b pb-0.5">
        <div
          className="shrink-0"
          style={{ width: LONG_GAME_YEAR_LABEL_WIDTH }}
        />
        <div style={cellGridStyle}>
          {weeklyMonthLabels.map(({ label, week }) => (
            <span
              key={week}
              className="text-muted-foreground/80 overflow-visible text-[9px] tracking-[0.04em] whitespace-nowrap lg:text-[11px] 2xl:text-xs"
              style={{ gridColumn: week }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Year rows */}
      <div className="flex w-full flex-col gap-[2px]">
        {years.map((year) => (
          <div
            key={year}
            className={`flex w-full items-center ${year === currentYear ? "bg-muted/25 -mx-1 rounded-md px-1 py-0.5" : ""}`}
          >
            <div
              className="shrink-0 pr-2 text-right text-xs lg:text-sm"
              style={{ width: LONG_GAME_YEAR_LABEL_WIDTH }}
            >
              <div className="flex flex-col items-end gap-0.5">
                <span
                  className={
                    year === currentYear
                      ? "text-foreground text-[13px] font-semibold tabular-nums lg:text-sm"
                      : "text-muted-foreground tabular-nums"
                  }
                >
                  {year}
                </span>
                {year === currentYear && (
                  <span className="text-muted-foreground/60 text-[9px] leading-none">
                    now
                  </span>
                )}
              </div>
            </div>
            <div style={cellGridStyle}>
              {Array.from({ length: 53 }, (_, i) => i + 1).map((weekNum) => {
                const isFuture =
                  year > currentYear ||
                  (year === currentYear && weekNum > currentWeekNum);
                const data = weeklyData[year]?.[weekNum];
                const count = data?.count ?? 0;
                // Future weeks: invisible. Past empty: faint. Training: colored.
                // 3+ sessions uses --heatmap-4 (darkest) for distinct visual weight.
                const cellStyle = isFuture
                  ? { aspectRatio: "1" }
                  : count === 0
                    ? {
                        aspectRatio: "1",
                        backgroundColor: "var(--heatmap-0)",
                        opacity: 0.3,
                      }
                    : {
                        aspectRatio: "1",
                        backgroundColor: `var(--heatmap-${count === 3 ? 4 : count})`,
                      };
                return (
                  <div
                    key={weekNum}
                    className="rounded-sm"
                    style={cellStyle}
                    onMouseOver={
                      data && !isFuture
                        ? (e) => handleMouseOver(e, year, weekNum, data)
                        : undefined
                    }
                    onMouseLeave={
                      data && !isFuture ? handleMouseLeave : undefined
                    }
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="text-muted-foreground mt-3 flex flex-col gap-1 text-[10px]">
        <span className="font-medium">Sessions per week</span>
        <div className="flex items-center gap-3">
          {[
            { count: 1, label: "1" },
            { count: 2, label: "2" },
            { count: 3, label: "3+" },
          ].map(({ count, label }) => (
            <div key={count} className="flex items-center gap-1.5">
              <div
                className="shrink-0 rounded-sm"
                style={{
                  width: 14,
                  height: 14,
                  backgroundColor: `var(--heatmap-${count === 3 ? 4 : count})`,
                }}
              />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tooltip */}
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
          <WeeklyTrainingPatternTooltip value={hoveredValue} />
        </div>
      )}
    </div>
  );
}
