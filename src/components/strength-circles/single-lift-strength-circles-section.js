/**
 * Lift-specific Strength Circles section for progress guide pages and calculators.
 * Can either use a provided live E1RM value or fall back to the user's best
 * logged E1RM for the target lift, which keeps the percentile UI reusable
 * across both the historical guide view and the live calculator flow.
 */

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ReferenceLine,
} from "recharts";
import { differenceInCalendarYears } from "date-fns";
import { useReadLocalStorage } from "usehooks-ts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StrengthCirclesChart } from "@/components/strength-circles/strength-circles-chart";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { estimateE1RM } from "@/lib/estimate-e1rm";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { cn } from "@/lib/utils";
import { getLiftPercentiles } from "@/lib/strength-circles/universe-percentiles";
import {
  LIFT_TYPE_TO_PERCENTILE_KEY,
  DEFAULT_E1RM_KG,
} from "@/lib/strength-circles/strength-score";

const TIMELINE_COLORS = {
  "General Population": "var(--chart-1)",
  "Gym-Goers": "var(--chart-2)",
  "Barbell Lifters": "var(--chart-3)",
  "Powerlifting Culture": "var(--chart-4)",
};
// Ordered from broadest to most specialised — the same order as the rings,
// so the stacked lines read top-to-bottom as "the comparison gets tougher".
const TIMELINE_UNIVERSES = [
  "General Population",
  "Gym-Goers",
  "Barbell Lifters",
  "Powerlifting Culture",
];
const UNIVERSE_PROSE = {
  "General Population": "the general population",
  "Gym-Goers": "gym-goers",
  "Barbell Lifters": "barbell lifters",
  "Powerlifting Culture": "powerlifting culture",
};

// Rolling window each timeline point looks back over for a best e1RM.
const WINDOW_DAYS = 90;

function ordinal(value) {
  if (value == null) return null;
  const n = Math.round(value);
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

function formatMonthYear(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC", // dateStr parses as UTC midnight; avoids a local day-shift
  });
}

export function SingleLiftStrengthCirclesSection({
  liftType,
  e1rmKgOverride = null,
  showTimeline = true,
  compact = false,
  compactClassName = "",
}) {
  const { age, sex, bodyWeight, isMetric } = useAthleteBio();
  const { parsedData, hasUserData, isDemoMode } = useUserLiftingData();
  const e1rmFormula =
    useReadLocalStorage(LOCAL_STORAGE_KEYS.FORMULA, {
      initializeWithValue: false,
    }) ?? "Brzycki";
  const [selectedUniverse, setSelectedUniverse] = useState("Gym-Goers");
  const [hoveredUniverse, setHoveredUniverse] = useState(null);

  const percentileKey = LIFT_TYPE_TO_PERCENTILE_KEY[liftType];
  const activeUniverse = hoveredUniverse ?? selectedUniverse;
  const showTimelinePanel = showTimeline && hasUserData;

  const bestE1rmKg = useMemo(() => {
    if (e1rmKgOverride > 0) return e1rmKgOverride;
    if (!hasUserData || isDemoMode || !parsedData?.length || !liftType) {
      // Fall back to sensible defaults so anonymous/demo visitors see the circles
      return DEFAULT_E1RM_KG[liftType] ?? 0;
    }

    let best = 0;
    for (const entry of parsedData) {
      if (
        entry.liftType !== liftType ||
        entry.isGoal ||
        !entry.date ||
        entry.reps <= 0 ||
        entry.weight <= 0
      ) {
        continue;
      }

      const weightKg =
        entry.unitType === "kg" ? entry.weight : entry.weight / 2.2046;
      const e1rmKg =
        entry.reps === 1
          ? weightKg
          : estimateE1RM(entry.reps, weightKg, e1rmFormula);

      if (e1rmKg > best) best = e1rmKg;
    }

    return best;
  }, [e1rmFormula, e1rmKgOverride, hasUserData, isDemoMode, liftType, parsedData]);

  const currentPercentiles = useMemo(() => {
    if (
      !percentileKey ||
      !bestE1rmKg ||
      !age ||
      !sex ||
      bodyWeight == null
    ) {
      return null;
    }

    const bodyWeightKg = isMetric ? bodyWeight : bodyWeight / 2.2046;
    return getLiftPercentiles(
      age,
      bodyWeightKg,
      sex === "female" ? "female" : "male",
      percentileKey,
      bestE1rmKg,
    );
  }, [age, bestE1rmKg, bodyWeight, isMetric, percentileKey, sex]);

  const percentileTimeline = useMemo(() => {
    if (
      !hasUserData ||
      isDemoMode ||
      !parsedData?.length ||
      !liftType ||
      !percentileKey ||
      !age ||
      !sex ||
      bodyWeight == null
    ) {
      return null;
    }

    const bodyWeightKg = isMetric ? bodyWeight : bodyWeight / 2.2046;
    const gender = sex === "female" ? "female" : "male";
    const today = new Date();

    const liftEntries = parsedData
      .filter(
        (entry) =>
          entry.liftType === liftType &&
          !entry.isGoal &&
          entry.reps > 0 &&
          entry.weight > 0 &&
          entry.date,
      )
      .map((entry) => {
        const weightKg =
          entry.unitType === "kg" ? entry.weight : entry.weight / 2.2046;
        return {
          date: entry.date,
          // Parse and estimate once up front — the sampling loop below is
          // O(samples × entries) and a long history makes that expensive.
          ms: new Date(entry.date).getTime(),
          e1rmKg:
            entry.reps === 1
              ? weightKg
              : estimateE1RM(entry.reps, weightKg, e1rmFormula),
        };
      })
      .sort((a, b) => a.ms - b.ms);

    if (liftEntries.length < 2) return null;

    const firstDate = new Date(liftEntries[0].date);
    const lastDate = new Date(liftEntries[liftEntries.length - 1].date);
    const spanDays = (lastDate - firstDate) / 86400000;

    let intervalDays;
    if (spanDays <= 180) intervalDays = 7;
    else if (spanDays <= 730) intervalDays = 14;
    else intervalDays = 30;

    const samples = [];
    const cursor = new Date(firstDate);
    cursor.setDate(cursor.getDate() + WINDOW_DAYS);
    while (cursor <= lastDate) {
      samples.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + intervalDays);
    }
    if (
      samples.length === 0 ||
      (lastDate - samples[samples.length - 1]) / 86400000 > 7
    ) {
      samples.push(new Date(lastDate));
    }

    if (samples.length < 2) return null;

    const points = [];
    for (const sampleDate of samples) {
      const sampleMs = sampleDate.getTime();
      const cutoffMs = sampleMs - WINDOW_DAYS * 86400000;
      let bestSampleE1rmKg = 0;

      for (const entry of liftEntries) {
        if (entry.ms > sampleMs) break;
        if (entry.ms < cutoffMs) continue;
        if (entry.e1rmKg > bestSampleE1rmKg) bestSampleE1rmKg = entry.e1rmKg;
      }

      if (bestSampleE1rmKg <= 0) continue;

      // Score each point against the athlete they were then, not the athlete
      // they are now — the strength standards are age-adjusted, so using
      // today's age quietly flatters (or punishes) the early years.
      const ageAtSample = Math.max(
        0,
        age - differenceInCalendarYears(today, sampleDate),
      );

      const pointPercentiles = getLiftPercentiles(
        ageAtSample,
        bodyWeightKg,
        gender,
        percentileKey,
        bestSampleE1rmKg,
      );

      if (!pointPercentiles?.["General Population"]) continue;

      points.push({
        date: sampleDate.toISOString().slice(0, 10),
        e1rmKg: bestSampleE1rmKg,
        ...pointPercentiles,
      });
    }

    return points.length >= 2 ? points : null;
  }, [
    age,
    bodyWeight,
    e1rmFormula,
    hasUserData,
    isDemoMode,
    isMetric,
    liftType,
    parsedData,
    percentileKey,
    sex,
  ]);

  // First / latest / peak for the universe currently highlighted, so the panel
  // can lead with the journey rather than restating the number in the rings.
  const timelineStory = useMemo(() => {
    if (!percentileTimeline) return null;

    const first = percentileTimeline[0];
    const latest = percentileTimeline[percentileTimeline.length - 1];
    let peak = first;
    for (const point of percentileTimeline) {
      if ((point[activeUniverse] ?? 0) > (peak[activeUniverse] ?? 0)) {
        peak = point;
      }
    }

    return {
      firstPercentile: first[activeUniverse],
      firstDate: first.date,
      latestPercentile: latest[activeUniverse],
      peakPercentile: peak[activeUniverse],
      peakDate: peak.date,
    };
  }, [activeUniverse, percentileTimeline]);

  if (!currentPercentiles) return null;

  if (compact) {
    return (
      <div className={cn("w-full max-w-[360px] xl:max-w-[420px] 2xl:max-w-[500px]", compactClassName)}>
        <StrengthCirclesChart
          percentiles={currentPercentiles}
          activeUniverse={activeUniverse}
          onUniverseChange={setSelectedUniverse}
          onUniverseHoverChange={setHoveredUniverse}
          showLegend={false}
          showTrustLine={false}
        />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{liftType} Strength Circles</CardTitle>
        <p className="text-sm text-muted-foreground">
          See how your current {liftType.toLowerCase()} stacks up across four comparison groups.
        </p>
      </CardHeader>
      <CardContent
        className={cn(
          "grid grid-cols-1 gap-6",
          showTimelinePanel
            ? "lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]"
            : "",
        )}
      >
        <div className="mx-auto w-full max-w-md">
          <StrengthCirclesChart
            percentiles={currentPercentiles}
            activeUniverse={activeUniverse}
            onUniverseChange={setSelectedUniverse}
            onUniverseHoverChange={setHoveredUniverse}
            showLegend={true}
            showTrustLine={true}
          />
        </div>
        {showTimelinePanel && (
          <div className="flex flex-col justify-start gap-4">
            {percentileTimeline ? (
              <SingleLiftPercentileTimelineChart
                data={percentileTimeline}
                story={timelineStory}
                activeUniverse={activeUniverse}
                liftLabel={liftType}
                isMetric={isMetric}
              />
            ) : (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Log more {liftType.toLowerCase()} sessions to unlock the long-term percentile chart.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Timeline tooltip ────────────────────────────────────────────────────────
// One hover gives the date, the e1RM behind that point, and where it landed in
// all four groups — the vertical spread between them is the whole story.

function TimelineTooltip({
  active,
  label,
  payload,
  activeUniverse,
  liftLabel,
  isMetric,
}) {
  if (!active || !payload?.length) return null;

  const point = payload[0].payload;
  const weight = isMetric ? point.e1rmKg : point.e1rmKg * 2.2046;

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-popover-foreground shadow-md">
      <p className="text-xs font-semibold">{formatMonthYear(label)}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        Best {liftLabel.toLowerCase()} e1RM:{" "}
        <span className="font-medium tabular-nums text-foreground">
          {Math.round(weight)}
          {isMetric ? "kg" : "lb"}
        </span>{" "}
        (best in the prior {WINDOW_DAYS} days)
      </p>
      <div className="mt-2 flex flex-col gap-1">
        {TIMELINE_UNIVERSES.map((universe) => {
          const isActive = universe === activeUniverse;
          return (
            <div
              key={universe}
              className={cn(
                "flex items-center justify-between gap-4 text-[11px]",
                isActive
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground",
              )}
            >
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-2 flex-shrink-0 rounded-full"
                  style={{
                    backgroundColor: TIMELINE_COLORS[universe],
                    opacity: isActive ? 1 : 0.55,
                  }}
                />
                {universe}
              </span>
              <span className="tabular-nums">
                {point[universe] != null ? ordinal(point[universe]) : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Timeline chart ──────────────────────────────────────────────────────────
// All four universes share one 0–100 axis. They are monotone re-mappings of the
// same underlying lift, so drawing them separately just repeated one shape four
// times; stacked together, the gaps between the lines *are* the point.

function SingleLiftPercentileTimelineChart({
  data,
  story,
  activeUniverse = "General Population",
  liftLabel,
  isMetric,
}) {
  const liftSlug = liftLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  const firstDate = new Date(data[0].date);
  const lastDate = new Date(data[data.length - 1].date);
  const spanDays = (lastDate - firstDate) / 86400000;

  const formatTick = (dateStr) => {
    const date = new Date(dateStr);
    const tz = "UTC"; // dateStr parses as UTC midnight; format in UTC to avoid local day-shift
    if (spanDays <= 365) {
      return date.toLocaleDateString("en-US", { month: "short", timeZone: tz });
    }
    if (spanDays <= 365 * 4) {
      return date.toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
        timeZone: tz,
      });
    }
    return `’${date.toLocaleDateString("en-US", { year: "2-digit", timeZone: tz })}`;
  };

  // Evenly spaced ticks that always include both ends. The old every-nth-plus-last
  // approach could land two ticks a fortnight apart, printing e.g. "’26 ’26".
  const maxTicks = spanDays <= 365 ? 6 : spanDays <= 365 * 4 ? 7 : 8;
  const tickCount = Math.max(2, Math.min(maxTicks, data.length));
  const tickStep = (data.length - 1) / (tickCount - 1);
  const ticks = [
    ...new Set(
      Array.from(
        { length: tickCount },
        (_, index) => data[Math.round(index * tickStep)].date,
      ),
    ),
  ];

  // Inactive universes render first so the highlighted line sits on top.
  const drawOrder = [
    ...TIMELINE_UNIVERSES.filter((universe) => universe !== activeUniverse),
    activeUniverse,
  ];

  const activeColor = TIMELINE_COLORS[activeUniverse] || "var(--chart-1)";
  const prose = UNIVERSE_PROSE[activeUniverse] ?? activeUniverse.toLowerCase();

  const journey = (() => {
    if (!story) return null;
    const { firstPercentile, firstDate: from, latestPercentile } = story;
    if (firstPercentile == null || latestPercentile == null) return null;

    const fromYear = new Date(from).getUTCFullYear();
    const change = latestPercentile - firstPercentile;

    if (change >= 2) return `up from ${ordinal(firstPercentile)} in ${fromYear}`;
    if (change <= -2)
      return `down from ${ordinal(firstPercentile)} in ${fromYear}`;
    return `holding around ${ordinal(firstPercentile)} since ${fromYear}`;
  })();

  const peakNote = (() => {
    if (!story?.peakPercentile || story.latestPercentile == null) return null;
    if (story.peakPercentile - story.latestPercentile < 3) {
      return "your best stretch yet";
    }
    return `peak ${ordinal(story.peakPercentile)} in ${formatMonthYear(story.peakDate)}`;
  })();

  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {liftLabel} percentile over time
        </p>
        {story?.latestPercentile != null && (
          <p className="mt-0.5 text-sm font-semibold">
            <span style={{ color: activeColor }}>
              {ordinal(story.latestPercentile)} percentile
            </span>{" "}
            among {prose}
          </p>
        )}
        {(journey || peakNote) && (
          <p className="text-xs text-muted-foreground">
            {[journey, peakNote].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>

      <div className="h-[240px] w-full sm:h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -22 }}>
            <defs>
              <linearGradient
                id={`single-lift-pct-grad-${liftSlug}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="5%" stopColor={activeColor} stopOpacity={0.28} />
                <stop offset="95%" stopColor={activeColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tickFormatter={formatTick}
              ticks={ticks}
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => `${value}`}
            />
            <RechartsTooltip
              cursor={{
                stroke: "var(--muted-foreground)",
                strokeOpacity: 0.35,
                strokeWidth: 1,
              }}
              content={
                <TimelineTooltip
                  activeUniverse={activeUniverse}
                  liftLabel={liftLabel}
                  isMetric={isMetric}
                />
              }
            />
            {story?.peakPercentile != null && (
              <ReferenceLine
                y={story.peakPercentile}
                stroke={activeColor}
                strokeDasharray="3 3"
                strokeOpacity={0.5}
              />
            )}
            {drawOrder.map((universe) => {
              const isActive = universe === activeUniverse;
              const color = TIMELINE_COLORS[universe] || "var(--chart-1)";

              return (
                <Area
                  key={universe}
                  type="monotone"
                  dataKey={universe}
                  stroke={color}
                  strokeWidth={isActive ? 2.4 : 1.4}
                  strokeOpacity={isActive ? 1 : 0.4}
                  fill={
                    isActive ? `url(#single-lift-pct-grad-${liftSlug})` : "none"
                  }
                  dot={false}
                  activeDot={
                    isActive ? { r: 3, strokeWidth: 0, fill: color } : false
                  }
                  isAnimationActive={false}
                />
              );
            })}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <p className="text-[11px] leading-snug text-muted-foreground">
        Each point is your best e1RM in the {WINDOW_DAYS} days before it, scored
        at your age at the time and your current bodyweight. Hover a group to
        bring its line forward.
      </p>
    </div>
  );
}
