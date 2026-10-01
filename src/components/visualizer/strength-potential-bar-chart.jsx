/**
 * Shows, for every rep range from 1 to 10, the athlete's best set against the
 * weight their benchmark set says they can move, as a dumbbell per rep count:
 * a solid dot for the best set, a ring for the potential, a line between. The
 * callout above names the easiest PR to chase, and any rep column can be
 * clicked to make it the target instead. A scope toggle projects from the
 * last 12 months, so an old lifetime best does not set every target.
 */
import { useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLocalStorage, useResizeObserver } from "usehooks-ts";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Crown, Info, LoaderCircle, Target } from "lucide-react";

import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import {
  estimateLiftE1RM,
  estimateLiftWeightForReps,
  isBodyweightLoadLift,
} from "@/lib/estimate-e1rm";
import { getReadableDateString } from "@/lib/date-utils";
import { getDisplayWeight } from "@/lib/processing-utils";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { useLiftColors } from "@/hooks/use-lift-colors";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer } from "@/components/ui/chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DemoModeBadge } from "@/components/demo-mode-badge";
import { AthleteBioInlineSettings } from "@/components/athlete-bio-quick-settings";
import { ScopeButton } from "@/components/lift-explorer/lift-type-prs-display";
import { cn } from "@/lib/utils";

const REP_COUNTS = Array.from({ length: 10 }, (_, i) => i + 1);

const Y_AXIS_WIDTH = 56;
// On a phone every pixel goes to the ten columns: the Y axis goes (the gap
// labels and the callout carry the numbers) and the chart runs into the
// card's side padding.
const COMPACT_MAX_WIDTH = 520;
const COMPACT_BLEED = 16;
const CHART_MARGIN = { top: 28, right: 8, bottom: 4, left: 0 };

// A gap smaller than this share of the potential is rounding noise, not a PR
// worth pointing at, so the suggestion looks elsewhere first.
const MIN_SUGGESTED_GAP_RATIO = 0.025;

function getLogHref(date) {
  return date ? `/log?date=${date}` : "/log";
}

function repsWord(reps) {
  return reps === 1 ? "1 rep" : `${reps} reps`;
}

// Targets are loaded on a real bar, so round down to the smallest jump most
// gyms can make: 2.5kg or 5lb.
function roundDownToLoadable(weight, isMetric) {
  const step = isMetric ? 2.5 : 5;
  return Math.max(0, Math.floor(weight / step + 1e-9) * step);
}

function formatWeight(value) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

// The callout copy varies by rep count, so clicking along the chart reads as a
// conversation rather than the same sentence with the numbers swapped.
const HEADROOM_PHRASES = [
  (reps) => `Your ${repsWord(reps)} best has room to climb.`,
  (reps) => `There is headroom at ${repsWord(reps)}.`,
  (reps) => `Your ${repsWord(reps)} best is ready to move.`,
  (reps) => `At ${repsWord(reps)}, your strength is ahead of your log.`,
  (reps) => `A ${reps} rep PR is well within reach.`,
];

const UNTESTED_PHRASES = [
  (reps) => `A ${reps} rep set is fresh ground, so your first one is a PR.`,
  (reps) =>
    `You have not logged ${repsWord(reps)} yet. The first one sets the record.`,
  (reps) => `${repsWord(reps)} is open territory.`,
  (reps) => `Your ${reps}RM is waiting to be written.`,
  (reps) =>
    `Nothing logged at ${repsWord(reps)} yet, which makes it an easy first PR.`,
];

function capitalise(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Picks the rep count most worth chasing: the tested one furthest below its
 * potential, else the lowest rep count never logged, else the benchmark itself.
 */
function getSuggestedReps(rows) {
  let best = null;
  for (const row of rows) {
    if (!row.isTested || row.isBenchmark || row.potential <= 0) continue;
    const ratio = row.gap / row.potential;
    if (ratio >= MIN_SUGGESTED_GAP_RATIO && (!best || ratio > best.ratio)) {
      best = { reps: row.reps, ratio };
    }
  }
  if (best) return best.reps;
  const untested = rows.find((row) => !row.isTested);
  if (untested) return untested.reps;
  return rows.find((row) => row.isBenchmark)?.reps ?? null;
}

/**
 * Dumbbell chart of best set against projected potential for rep counts 1–10,
 * projected from the best E1RM in the chosen scope.
 *
 * @param {Object} props
 * @param {string} [props.liftType] - Display name of the lift to chart; defaults to "Bench Press".
 */
export function StrengthPotentialBarChart({ liftType = "Bench Press" }) {
  const {
    parsedData,
    topLiftsByTypeAndReps,
    topLiftsByTypeAndRepsLast12Months,
    isValidating,
    isLoading,
    dataSource,
  } = useUserLiftingData();
  const { isMetric, bodyWeight, bodyWeightIsDefault } = useAthleteBio();
  const { getColor } = useLiftColors();
  const [e1rmFormula] = useLocalStorage(LOCAL_STORAGE_KEYS.FORMULA, "Brzycki", {
    initializeWithValue: false,
  });
  const [scopeChoice, setScopeChoice] = useState("lifetime"); // "lifetime" | "yearly"
  // Remember which lift and scope a click belonged to, so moving to another
  // lift or scope falls back to that view's own suggestion.
  const [selection, setSelection] = useState(null);
  const chartId = useId().replace(/:/g, "");

  const colors = useMemo(() => {
    const base = normalizeHex(getColor(liftType)) || "#3b82f6";
    // Pale lift colours vanish as thin rings and small text on a white card.
    const ink = isLightHex(base) ? mixHex(base, "#111827", 0.4) : base;
    return { base, ink };
  }, [getColor, liftType]);

  const hasYearlyData = Boolean(
    topLiftsByTypeAndRepsLast12Months?.[liftType]?.some(
      (repRange) => repRange?.length > 0,
    ),
  );
  const scope = hasYearlyData ? scopeChoice : "lifetime";
  const topLifts = (
    scope === "yearly"
      ? topLiftsByTypeAndRepsLast12Months
      : topLiftsByTypeAndReps
  )?.[liftType];
  const isBodyweightLoadChart = isBodyweightLoadLift(liftType);
  const displayUnit = isMetric ? "kg" : "lb";

  const { rows, bestLift } = useMemo(() => {
    if (!parsedData || !topLifts) return { rows: [], bestLift: null };

    const effectiveBodyWeight = bodyWeightIsDefault ? null : bodyWeight;
    const bodyWeightUnitType = isMetric ? "kg" : "lb";
    let bestE1RMWeight = 0;
    let best = null;
    let bestUnit = "lb";

    for (const reps of REP_COUNTS) {
      const lift = topLifts[reps - 1]?.[0];
      if (!lift) continue;
      const liftUnitType = lift.unitType || "lb";
      const e1rm = estimateLiftE1RM({
        reps,
        weight: lift.weight,
        equation: e1rmFormula,
        liftType,
        bodyWeight: effectiveBodyWeight,
        bodyWeightUnitType,
        liftUnitType,
      });
      if (e1rm > bestE1RMWeight) {
        bestE1RMWeight = e1rm;
        best = lift;
        bestUnit = liftUnitType;
      }
    }

    if (!best) return { rows: [], bestLift: null };

    const data = REP_COUNTS.map((reps) => {
      const lift = topLifts[reps - 1]?.[0] || null;
      const rawPotential = estimateLiftWeightForReps({
        e1rm: bestE1RMWeight,
        reps,
        equation: e1rmFormula,
        liftType,
        bodyWeight: effectiveBodyWeight,
        bodyWeightUnitType,
        liftUnitType: bestUnit,
      });
      // Added load below zero means "bodyweight is already enough", not a
      // number anyone can load.
      const potential = Math.max(
        0,
        Math.round(
          getDisplayWeight(
            { weight: rawPotential, unitType: bestUnit },
            isMetric,
          ).value * 10,
        ) / 10,
      );
      const achieved = lift ? getDisplayWeight(lift, isMetric).value : null;
      const isTested = achieved !== null;
      const low = isTested ? Math.min(achieved, potential) : potential;
      const high = isTested ? Math.max(achieved, potential) : potential;

      return {
        reps,
        lift,
        achieved,
        potential,
        gap: isTested ? Math.max(0, potential - achieved) : 0,
        isTested,
        isBenchmark: lift === best,
        range: [low, high],
      };
    });

    return { rows: data, bestLift: best };
  }, [
    parsedData,
    topLifts,
    e1rmFormula,
    isMetric,
    liftType,
    bodyWeight,
    bodyWeightIsDefault,
  ]);

  const suggestedReps = useMemo(() => getSuggestedReps(rows), [rows]);
  // Only a click picks a rep; with nothing picked the callout follows the
  // suggestion and no column is highlighted.
  const pickedReps =
    selection?.liftType === liftType && selection?.scope === scope
      ? selection.reps
      : null;
  const selectedReps = pickedReps ?? suggestedReps;

  const yDomain = useMemo(() => {
    if (rows.length === 0) return [0, "auto"];
    const values = rows.flatMap((row) =>
      row.isTested ? [row.achieved, row.potential] : [row.potential],
    );
    const min = Math.min(...values);
    const max = Math.max(...values);
    // Zoom in on the band the dumbbells live in: the gaps are the story, and
    // an axis from zero would squash them into a sliver.
    const pad = Math.max((max - min) * 0.2, max * 0.04, 5);
    return [
      Math.max(0, Math.floor((min - pad) / 10) * 10),
      Math.ceil((max + pad) / 10) * 10,
    ];
  }, [rows]);

  const bestDisplay = bestLift ? getDisplayWeight(bestLift, isMetric) : null;
  const bestSetLabel = bestDisplay
    ? `${bestLift.reps}@${formatWeight(bestDisplay.value)}${bestDisplay.unit}`
    : null;

  // CardContent is always mounted, so the observer attaches on the first pass.
  const contentRef = useRef(null);
  const { width: contentWidth = 0 } = useResizeObserver({ ref: contentRef });
  const isCompact = contentWidth > 0 && contentWidth < COMPACT_MAX_WIDTH;
  const yAxisWidth = isCompact ? 0 : Y_AXIS_WIDTH;
  // Work out the column from where the click landed. Recharts' own active
  // index follows hover, and a tap on a phone has no hover before it, so it
  // still names the previously picked column and the tap would let go of it.
  const chartRef = useRef(null);
  const handleChartClick = (event) => {
    const rect = chartRef.current?.getBoundingClientRect();
    if (!rect) return;
    const plotLeft = CHART_MARGIN.left + yAxisWidth;
    const band =
      (rect.width - plotLeft - CHART_MARGIN.right) / REP_COUNTS.length;
    const index = Math.floor((event.clientX - rect.left - plotLeft) / band);
    const reps = REP_COUNTS[index];
    if (!reps) return;
    // A second click on the picked rep lets go of it.
    setSelection(reps === pickedReps ? null : { liftType, scope, reps });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="flex flex-wrap items-center gap-2">
              {dataSource === "demo" && <DemoModeBadge size="sm" />}
              {liftType} Strength Potential By Rep Range
            </CardTitle>
            <CardDescription className="mt-1.5 space-y-1">
              <div>
                {bestLift ? (
                  <>
                    Projected from your best set
                    {scope === "yearly" ? " of the last 12 months" : ""}:{" "}
                    <Link
                      href={getLogHref(bestLift.date)}
                      className="text-foreground hover:text-primary font-medium underline decoration-dotted underline-offset-2 transition-colors"
                    >
                      {bestSetLabel} (
                      {getReadableDateString(bestLift.date, true)})
                    </Link>
                  </>
                ) : (
                  "No data yet"
                )}
                {isValidating && (
                  <LoaderCircle className="ml-3 inline-flex h-5 w-5 animate-spin" />
                )}
              </div>
              {isBodyweightLoadChart && (
                <div className="flex max-w-3xl items-start gap-2 text-xs leading-relaxed">
                  <Info
                    className="text-foreground/70 mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <p>
                    {bodyWeightIsDefault
                      ? "Set your bodyweight to calculate potential from total system load. "
                      : "This chart treats logged weight as added load. It adds your bodyweight for the E1RM formula, then subtracts bodyweight again to show projected added load. "}
                    Bodyweight-only sets should be logged as 0{displayUnit}.
                  </p>
                </div>
              )}
            </CardDescription>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2 self-end sm:ml-4 sm:self-start">
            {hasYearlyData && (
              <div className="flex items-center rounded-full border p-0.5 text-xs">
                <ScopeButton
                  isActive={scope === "lifetime"}
                  onClick={() => setScopeChoice("lifetime")}
                >
                  Lifetime
                </ScopeButton>
                <ScopeButton
                  isActive={scope === "yearly"}
                  onClick={() => setScopeChoice("yearly")}
                >
                  12 months
                </ScopeButton>
              </div>
            )}
            {isBodyweightLoadChart && (
              <AthleteBioInlineSettings
                bodyweightOnly
                compactBodyweightSummary
                expandDirection="down"
                defaultBioPrompt="Set bodyweight"
              />
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent ref={contentRef} className="space-y-4">
        {isLoading || !topLiftsByTypeAndReps ? (
          <Skeleton className="h-[340px] w-full" />
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground py-10 text-center text-sm">
            Log a {liftType} set and your potential at every rep range appears
            here.
          </p>
        ) : (
          <>
            {/* Every rep's callout shares one grid cell and only the selected
                one is visible, so the box always holds the height of the
                tallest at this width and a click never shifts the chart. */}
            <div className="grid" aria-live="polite">
              {rows.map((row) => {
                const isShown = row.reps === selectedReps;
                return (
                  <div
                    key={row.reps}
                    className={cn("[grid-area:1/1]", !isShown && "invisible")}
                    aria-hidden={!isShown}
                  >
                    <TargetCallout
                      row={row}
                      isSuggested={row.reps === suggestedReps}
                      isPicked={pickedReps !== null}
                      onShowSuggested={() => setSelection(null)}
                      bestSetLabel={bestSetLabel}
                      isMetric={isMetric}
                      displayUnit={displayUnit}
                      colors={colors}
                    />
                  </div>
                );
              })}
            </div>
            {/* The key sits above the chart so the marks are explained before
                they are read. */}
            <ChartKey colors={colors} />
            <div
              ref={chartRef}
              onClick={handleChartClick}
              style={isCompact ? { marginInline: -COMPACT_BLEED } : undefined}
            >
              <ChartContainer config={{}} className="!aspect-auto h-[280px]">
                <BarChart
                  data={rows}
                  margin={CHART_MARGIN}
                  // Recharts sets an inline cursor: default on its wrapper, which
                  // beats a class. Any click in a column's band picks that rep.
                  style={{ cursor: "pointer" }}
                >
                  <CartesianGrid
                    vertical={false}
                    strokeDasharray="3 4"
                    stroke="var(--border)"
                  />
                  <XAxis
                    dataKey="reps"
                    axisLine={false}
                    tickLine={false}
                    tickMargin={8}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  />
                  <YAxis
                    hide={isCompact}
                    domain={yDomain}
                    allowDataOverflow
                    axisLine={false}
                    tickLine={false}
                    width={yAxisWidth}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    tickFormatter={(tick) => `${tick}${displayUnit}`}
                  />
                  <Bar
                    dataKey="range"
                    animationDuration={700}
                    animationEasing="ease-out"
                    shape={(props) => (
                      <DumbbellShape
                        {...props}
                        chartId={chartId}
                        colors={colors}
                        isSelected={props.payload?.reps === pickedReps}
                        displayUnit={displayUnit}
                      />
                    )}
                  />
                </BarChart>
              </ChartContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** The headline above the chart: one rep count, what it says, and the weight. */
function TargetCallout({
  row,
  isSuggested,
  isPicked,
  onShowSuggested,
  bestSetLabel,
  isMetric,
  displayUnit,
  colors,
}) {
  const { reps } = row;
  const phraseIndex = (reps - 1) % HEADROOM_PHRASES.length;
  const target = roundDownToLoadable(row.potential, isMetric);
  const targetLabel = `${reps}@${formatWeight(target)}${displayUnit}`;

  let title;
  let body;
  let headline = targetLabel;

  if (row.isBenchmark) {
    title = "Your benchmark set";
    body = `${bestSetLabel} is your strongest set on this chart. Every other target is projected from it.`;
    headline = bestSetLabel;
  } else if (!row.isTested) {
    title = isSuggested
      ? "Easiest PR to chase"
      : `${capitalise(repsWord(reps))} target`;
    body = `${UNTESTED_PHRASES[phraseIndex](reps)} Your ${bestSetLabel} says ${targetLabel} is in reach.`;
  } else if (target > row.achieved) {
    const lift = row.lift;
    title = isSuggested
      ? "Easiest PR to chase"
      : `${capitalise(repsWord(reps))} target`;
    body = `${HEADROOM_PHRASES[phraseIndex](reps)} Your best is ${reps}@${formatWeight(row.achieved)}${displayUnit}${lift?.date ? ` from ${getReadableDateString(lift.date)}` : ""}, and your ${bestSetLabel} says ${targetLabel} is in reach.`;
  } else {
    title = `${capitalise(repsWord(reps))}, right on potential`;
    body = `Your ${reps}@${formatWeight(row.achieved)}${displayUnit} already matches what your ${bestSetLabel} projects. Strong, well-rounded work.`;
    headline = `${reps}@${formatWeight(row.achieved)}${displayUnit}`;
  }

  return (
    <div
      className="flex h-full flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
      style={{
        backgroundColor: `${colors.base}12`,
        borderColor: `${colors.base}40`,
      }}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${colors.base}24`, color: colors.ink }}
        >
          {row.isBenchmark ? (
            <Crown className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Target className="h-4 w-4" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 space-y-0.5">
          <p className="font-semibold">{title}</p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {body}
          </p>
          {!isPicked || isSuggested ? (
            <p className="text-muted-foreground/80 text-xs leading-5">
              {isPicked
                ? "Click it again to let go."
                : "Click any rep count on the chart to see its target."}
            </p>
          ) : (
            <button
              type="button"
              onClick={onShowSuggested}
              className="block text-xs leading-5 font-medium underline decoration-dotted underline-offset-2"
              style={{ color: colors.ink }}
            >
              Show the easiest PR
            </button>
          )}
        </div>
      </div>
      <div
        className="shrink-0 text-3xl font-bold tracking-tight tabular-nums sm:text-4xl"
        style={{ color: colors.ink }}
      >
        {headline}
      </div>
    </div>
  );
}

/**
 * Draws one rep count's dumbbell inside the band Recharts gives the range bar:
 * y is the top of the range (the potential) and y + height the bottom (the
 * best set).
 */
function DumbbellShape({
  x,
  y,
  width,
  height,
  background,
  payload,
  chartId,
  colors,
  isSelected,
  displayUnit,
}) {
  if (!payload || x == null || y == null) return null;
  const cx = x + width / 2;
  const yHigh = Math.min(y, y + height);
  const yLow = Math.max(y, y + height);
  const { isTested, isBenchmark, gap } = payload;
  const showGap = isTested && !isBenchmark && gap > 0;
  const bandWidth = background?.width ?? width;
  const gapLabel = `+${formatWeight(Math.round(gap * 10) / 10)}${bandWidth > 52 ? displayUnit : ""}`;

  return (
    <g>
      {isSelected && background && (
        <rect
          x={background.x + 2}
          y={background.y}
          width={Math.max(0, background.width - 4)}
          height={background.height}
          rx={10}
          fill={colors.base}
          opacity={0.1}
        />
      )}

      {!isTested ? (
        <circle
          cx={cx}
          cy={yHigh}
          r={7}
          fill="var(--card)"
          stroke={colors.ink}
          strokeWidth={2}
          strokeDasharray="3 3"
        />
      ) : (
        <>
          {yLow - yHigh > 1 && (
            <line
              x1={cx}
              x2={cx}
              y1={yLow}
              y2={yHigh}
              stroke={colors.base}
              strokeOpacity={0.4}
              strokeWidth={4}
              strokeLinecap="round"
            />
          )}
          {showGap && (
            <circle
              cx={cx}
              cy={yHigh}
              r={6}
              fill="var(--card)"
              stroke={colors.ink}
              strokeWidth={2}
            />
          )}
          {isBenchmark && (
            <>
              <defs>
                <radialGradient id={`halo-${chartId}`}>
                  <stop
                    offset="0%"
                    stopColor={colors.base}
                    stopOpacity={0.45}
                  />
                  <stop offset="100%" stopColor={colors.base} stopOpacity={0} />
                </radialGradient>
              </defs>
              <circle cx={cx} cy={yLow} r={18} fill={`url(#halo-${chartId})`} />
            </>
          )}
          <circle
            cx={cx}
            cy={yLow}
            r={isBenchmark ? 8 : 6}
            fill={colors.base}
            stroke="var(--card)"
            strokeWidth={2}
          />
        </>
      )}

      {showGap && (
        <text
          x={cx}
          y={yHigh - 13}
          textAnchor="middle"
          fontSize={11}
          fontWeight={600}
          fill={colors.ink}
        >
          {gapLabel}
        </text>
      )}
      {isBenchmark && (
        <Crown
          x={cx - 7}
          y={yLow - 30}
          width={14}
          height={14}
          color={colors.ink}
          strokeWidth={2.25}
        />
      )}
    </g>
  );
}

/** Explains the marks, since a dumbbell chart has no stock legend. */
function ChartKey({ colors }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-1 text-sm font-medium">
      <span className="flex items-center gap-2">
        <svg width="16" height="16" aria-hidden="true">
          <circle cx="8" cy="8" r="6" fill={colors.base} />
        </svg>
        Best set
      </span>
      <span className="flex items-center gap-2">
        <svg width="16" height="16" aria-hidden="true">
          <circle
            cx="8"
            cy="8"
            r="6"
            fill="none"
            stroke={colors.ink}
            strokeWidth="2"
          />
        </svg>
        Potential
      </span>
      <span className="flex items-center gap-2">
        <svg width="16" height="16" aria-hidden="true">
          <circle
            cx="8"
            cy="8"
            r="7"
            fill="none"
            stroke={colors.ink}
            strokeWidth="2"
            strokeDasharray="3 3"
          />
        </svg>
        Not logged yet
      </span>
      <span className="flex items-center gap-2">
        <Crown
          className="h-4 w-4"
          style={{ color: colors.ink }}
          aria-hidden="true"
        />
        Benchmark set
      </span>
    </div>
  );
}

const normalizeHex = (value) => {
  if (typeof value !== "string" || !value.startsWith("#")) return null;
  const hex = value.slice(1);
  if (hex.length === 3) {
    return `#${hex
      .split("")
      .map((c) => c + c)
      .join("")}`.toLowerCase();
  }
  if (hex.length === 6) {
    return `#${hex}`.toLowerCase();
  }
  return null;
};

const hexToRgb = (hex) => {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
};

const mixHex = (hexA, hexB, amount = 0.5) => {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  if (!a || !b) return hexA;

  const clamped = Math.max(0, Math.min(1, amount));
  const mix = (x, y) => Math.round(x + (y - x) * clamped);
  const toHex = (n) => n.toString(16).padStart(2, "0");

  return `#${toHex(mix(a.r, b.r))}${toHex(mix(a.g, b.g))}${toHex(mix(a.b, b.b))}`;
};

const isLightHex = (hex) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  return 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b > 160;
};
