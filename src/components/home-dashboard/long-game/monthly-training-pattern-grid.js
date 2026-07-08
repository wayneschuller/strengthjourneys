/**
 * Monthly training pattern grid groups a lifter's history by month and compares
 * each active month against the rest of the lifter's own training history.
 */

import { format } from "date-fns";

import { useCallback, useMemo, useState } from "react";

import { useUserLiftingData } from "@/hooks/use-userlift-data";

import { parseYmdUtc } from "@/lib/date-utils";

import { buildMonthlyTrainingActivityByYear } from "@/components/home-dashboard/long-game/long-game-training-activity";

const MONTHLY_GAP = 5;

const LONG_GAME_YEAR_LABEL_WIDTH = 48;

const MONTH_NAMES = [
  { narrow: "J", short: "Jan" },
  { narrow: "F", short: "Feb" },
  { narrow: "M", short: "Mar" },
  { narrow: "A", short: "Apr" },
  { narrow: "M", short: "May" },
  { narrow: "J", short: "Jun" },
  { narrow: "J", short: "Jul" },
  { narrow: "A", short: "Aug" },
  { narrow: "S", short: "Sep" },
  { narrow: "O", short: "Oct" },
  { narrow: "N", short: "Nov" },
  { narrow: "D", short: "Dec" },
];

function getMonthlyShade(level) {
  const clampedLevel = Math.max(1, Math.min(level, 6));
  if (clampedLevel >= 6) return "var(--heatmap-4)";
  if (clampedLevel >= 4) return "var(--heatmap-3)";
  if (clampedLevel >= 2) return "var(--heatmap-2)";
  return "var(--heatmap-1)";
}

function getMonthlyCellStyles(level, isFuture, isSharing = false) {
  if (isFuture) {
    return {
      backgroundColor: "transparent",
      border: "1px solid transparent",
    };
  }

  if (level === 0) {
    return {
      backgroundColor: "var(--heatmap-0)",
      opacity: 0.44,
      border: "1px solid rgba(15,23,42,0.05)",
      // Drop inset highlight during capture — html2canvas-pro renders inset
      // shadows as offset shapes that visually "double up" the tile.
      boxShadow: isSharing ? "none" : "inset 0 1px 0 rgba(255,255,255,0.35)",
    };
  }

  if (isSharing) {
    // Clean flat fill for capture: no box-shadow (inset highlight + 1px outer
    // ring both rasterize as misaligned rectangles in html2canvas-pro,
    // producing the double-tile look we saw in the exported PNG).
    return {
      backgroundColor: getMonthlyShade(level),
      border: "1px solid transparent",
    };
  }

  return {
    backgroundColor: getMonthlyShade(level),
    border: "1px solid rgba(15,23,42,0.08)",
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.28), 0 6px 14px rgba(15,23,42,0.05)",
    filter: level >= 5 ? "saturate(0.96) brightness(1.02)" : "none",
  };
}

function buildMonthlyRelativeLevels(monthlyData, years) {
  const months = [];

  years.forEach((year) => {
    Object.entries(monthlyData[year] ?? {}).forEach(([month, data]) => {
      if ((data?.totalSessions ?? 0) > 0) {
        months.push({
          year,
          month: Number(month),
          totalSessions: data.totalSessions,
        });
      }
    });
  });

  if (months.length === 0) return {};

  const sorted = [...months].sort((a, b) => a.totalSessions - b.totalSessions);
  const relativeLevels = {};

  sorted.forEach((entry, index) => {
    const percentile =
      sorted.length === 1 ? 1 : index / Math.max(sorted.length - 1, 1);
    const level = 1 + Math.round(percentile * 5);
    if (!relativeLevels[entry.year]) relativeLevels[entry.year] = {};
    relativeLevels[entry.year][entry.month] = level;
  });

  return relativeLevels;
}

// All-years monthly grid: one row per year, 12 cells per row (one per month).
// Cell color encodes active weeks that month: 0 = blank, 1–3 = graduated intensity, 4+ = full.
// Future months render invisible; past months with zero activity render at low opacity.
export function MonthlyTrainingPatternGrid({
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

  const monthlyData = useMemo(
    () =>
      buildMonthlyTrainingActivityByYear(
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
  const relativeLevels = useMemo(
    () => buildMonthlyRelativeLevels(monthlyData, years),
    [monthlyData, years],
  );

  const todayDate = new Date();
  const currentYear = todayDate.getFullYear();
  const currentMonth = todayDate.getMonth() + 1;

  const handleMouseOver = useCallback((e, year, month, data) => {
    const cellRect = e.target.getBoundingClientRect();
    const x = cellRect.left + cellRect.width / 2;
    const y = cellRect.top;
    const showBelow = y < 200;
    setTooltipPos({
      x: Math.max(100, Math.min(x, window.innerWidth - 100)),
      y: showBelow ? cellRect.bottom + 8 : y - 8,
      showBelow,
    });
    setHoveredValue({ year, month, ...(data ?? {}) });
  }, []);

  const handleMouseLeave = useCallback(() => setHoveredValue(null), []);

  const cellGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(12, 1fr)",
    gap: MONTHLY_GAP,
    flex: 1,
  };

  return (
    <div
      className={
        isSharing
          ? "relative w-full rounded-xl bg-white px-2 py-2"
          : "from-background via-background to-muted/25 relative w-full rounded-xl bg-gradient-to-b px-2 py-2"
      }
    >
      {/* Month name header */}
      <div className="border-border/15 mb-1 flex w-full items-end border-b pb-0.5">
        <div
          className="shrink-0"
          style={{ width: LONG_GAME_YEAR_LABEL_WIDTH }}
        />
        <div style={cellGridStyle}>
          {MONTH_NAMES.map(({ narrow, short }, index) => (
            <span
              key={`${short}-${index}`}
              className="text-muted-foreground/80 text-center text-[9px] tracking-[0.04em] lg:text-[10px] 2xl:text-xs"
            >
              <span className="sm:hidden">{narrow}</span>
              <span className="hidden sm:inline">{short}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Year rows */}
      <div className="flex w-full flex-col gap-1">
        {years.map((year) => (
          <div
            key={year}
            className={`flex w-full items-center ${year === currentYear ? "bg-muted/25 rounded-md py-0.5" : ""}`}
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
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                const isFuture =
                  year > currentYear ||
                  (year === currentYear && month > currentMonth);
                const data = monthlyData[year]?.[month];
                const relativeLevel =
                  data?.totalSessions > 0
                    ? (relativeLevels[year]?.[month] ?? 1)
                    : 0;
                const cellStyle = getMonthlyCellStyles(
                  relativeLevel,
                  isFuture,
                  isSharing,
                );
                return (
                  <div
                    key={month}
                    className={`relative overflow-hidden rounded-[8px] ${isSharing ? "" : "transition-transform duration-150"} ${!isFuture && relativeLevel > 0 && !isSharing ? "hover:scale-[1.03]" : ""}`}
                    style={{
                      height: 28,
                      ...cellStyle,
                    }}
                    onMouseOver={
                      !isFuture
                        ? (e) => handleMouseOver(e, year, month, data)
                        : undefined
                    }
                    onMouseLeave={!isFuture ? handleMouseLeave : undefined}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="text-muted-foreground mt-3 flex flex-col gap-1 text-[10px]">
        <span className="font-medium">Relative monthly activity</span>
        <div className="flex items-center gap-3">
          {[
            { level: 1, label: "Low" },
            { level: 3, label: "Mid" },
            { level: 6, label: "High" },
          ].map(({ level, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div
                className="shrink-0 rounded-[4px]"
                style={{
                  width: 14,
                  height: 14,
                  backgroundColor: getMonthlyShade(level),
                  boxShadow: isSharing
                    ? "none"
                    : "inset 0 1px 0 rgba(255,255,255,0.22)",
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
          <MonthlyTrainingPatternTooltip value={hoveredValue} />
        </div>
      )}
    </div>
  );
}

// Maps a weekly session count to an emoji for monthly tooltip week rows.
function weekEmoji(sessions) {
  if (sessions >= 3) return "🏆";
  if (sessions === 2) return "💪";
  if (sessions === 1) return "✅";
  return "💩";
}

function getSparklineHeight(sessions) {
  if (sessions >= 4) return 26;
  if (sessions === 3) return 21;
  if (sessions === 2) return 16;
  if (sessions === 1) return 10;
  return 4;
}

function MonthlyWeekSparkline({ weekBreakdown }) {
  if (!weekBreakdown?.length) return null;

  return (
    <div
      className="bg-muted/40 border-border/40 mt-0.5 flex h-9 items-end gap-1 rounded-md border px-1.5 py-1"
      aria-hidden="true"
    >
      {weekBreakdown.map(({ sessions, weekKey }, index) => (
        <span
          key={weekKey ?? index}
          className="bg-primary/75 min-w-[10px] flex-1 rounded-t-sm"
          style={{ height: getSparklineHeight(sessions) }}
        />
      ))}
    </div>
  );
}

// Tooltip body for a monthly cell: shows month/year heading and a per-week session breakdown.
function MonthlyTrainingPatternTooltip({ value }) {
  const { year, month, weekBreakdown } = value;
  return (
    <div className="border-border/50 bg-background grid max-w-[18rem] min-w-[10rem] items-start gap-1 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-bold">
        {MONTH_NAMES[month - 1].short} {year}
      </p>
      {weekBreakdown?.length > 0 ? (
        <>
          <MonthlyWeekSparkline weekBreakdown={weekBreakdown} />
          <div className="flex flex-col gap-0.5">
            {weekBreakdown.map(({ sessions, weekKey }, i) => (
              <p key={weekKey ?? i} className="text-muted-foreground">
                <span className="text-foreground font-semibold">
                  Week of{" "}
                  {weekKey
                    ? format(parseYmdUtc(weekKey), "MMM d")
                    : `Week ${i + 1}`}
                  :
                </span>{" "}
                {sessions} {sessions === 1 ? "session" : "sessions"}{" "}
                {weekEmoji(sessions)}
              </p>
            ))}
          </div>
        </>
      ) : (
        <p className="text-muted-foreground">No training sessions 💩</p>
      )}
    </div>
  );
}

// Single-year calendar heatmap (Jan–Dec) using react-calendar-heatmap.
// Cell color reflects session intensity and PR status via getDailyTrainingHeatmapIntensity.
