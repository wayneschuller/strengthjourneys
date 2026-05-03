import {
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, Cell } from "recharts";
import { getDisplayWeight } from "@/lib/processing-utils";

const BAR_OUTLINE = "var(--muted-foreground)";

function parseDateUTC(ymd) {
  if (!ymd) return null;
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateShortUTC(date, cadence) {
  if (!(date instanceof Date)) return "";
  if (cadence === "year") {
    return String(date.getUTCFullYear());
  }
  if (cadence === "quarter") {
    const q = Math.floor(date.getUTCMonth() / 3) + 1;
    return `Q${q} ${String(date.getUTCFullYear()).slice(-2)}`;
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatBucketRangeUTC(start, cadence) {
  if (!(start instanceof Date)) return "";
  const year = start.getUTCFullYear();
  if (cadence === "year") return String(year);
  if (cadence === "quarter") {
    const qStart = start.getUTCMonth();
    return `${MONTH_NAMES[qStart]} – ${MONTH_NAMES[qStart + 2]} ${year}`;
  }
  if (cadence === "month") {
    return `${MONTH_NAMES[start.getUTCMonth()]} ${year}`;
  }
  // week: 7-day span starting Mon
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const startStr = `${MONTH_NAMES[start.getUTCMonth()]} ${start.getUTCDate()}`;
  const endStr = sameMonth
    ? `${end.getUTCDate()}`
    : `${MONTH_NAMES[end.getUTCMonth()]} ${end.getUTCDate()}`;
  return sameYear
    ? `${startStr} – ${endStr}, ${year}`
    : `${startStr} ${year} – ${endStr} ${end.getUTCFullYear()}`;
}

function startOfBucketUTC(date, cadence) {
  const d = new Date(date);
  if (cadence === "week") {
    const day = d.getUTCDay(); // 0=Sun
    const mondayOffset = (day + 6) % 7;
    d.setUTCDate(d.getUTCDate() - mondayOffset);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }
  if (cadence === "month") {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  }
  if (cadence === "quarter") {
    const qMonth = Math.floor(d.getUTCMonth() / 3) * 3;
    return new Date(Date.UTC(d.getUTCFullYear(), qMonth, 1));
  }
  return new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
}

function addBucketUTC(date, cadence, count = 1) {
  const d = new Date(date);
  if (cadence === "week") {
    d.setUTCDate(d.getUTCDate() + count * 7);
    return d;
  }
  if (cadence === "month") {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + count, 1));
  }
  if (cadence === "quarter") {
    return new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + count * 3, 1),
    );
  }
  return new Date(Date.UTC(d.getUTCFullYear() + count, 0, 1));
}

function bucketKeyUTC(date, cadence) {
  const d = startOfBucketUTC(date, cadence);
  return d.toISOString().slice(0, 10);
}

function countBucketsInRange(firstDate, lastDate, cadence) {
  let count = 0;
  let current = startOfBucketUTC(firstDate, cadence);
  const end = startOfBucketUTC(lastDate, cadence);
  while (current <= end && count < 5000) {
    count += 1;
    current = addBucketUTC(current, cadence, 1);
  }
  return count;
}

function chooseCadence(firstDate, lastDate, targetBarsOrOptions = 10) {
  const optionsConfig =
    typeof targetBarsOrOptions === "number"
      ? { targetBars: targetBarsOrOptions }
      : (targetBarsOrOptions ?? {});
  const {
    targetBars = 10,
    minBars,
    maxBars,
    preferHigherResolution = false,
  } = optionsConfig;
  const options = ["week", "month", "quarter", "year"];
  const scored = options.map((cadence) => {
    const count = countBucketsInRange(firstDate, lastDate, cadence);
    const distance = Math.abs(count - targetBars);
    const effectiveMinBars = minBars ?? 4;
    const effectiveMaxBars = maxBars ?? 14;
    const lowPenalty = count < effectiveMinBars ? (effectiveMinBars - count) * 3 : 0;
    const highPenalty =
      count > effectiveMaxBars ? (count - effectiveMaxBars) * 0.6 : 0;
    return { cadence, count, score: distance + lowPenalty + highPenalty };
  });

  if (preferHigherResolution && minBars != null && maxBars != null) {
    const withinRange = scored
      .filter((option) => option.count >= minBars && option.count <= maxBars)
      .sort((a, b) => b.count - a.count);
    if (withinRange.length > 0) {
      return withinRange[0].cadence;
    }
  }

  scored.sort((a, b) => a.score - b.score);
  return scored[0]?.cadence ?? "month";
}

/**
 * Builds a time-bucketed reps chronology for a single lift type.
 *
 * @param {Array} parsedData - Full parsed lifting data from UserLiftingDataProvider.
 * @param {string} liftType - The lift to aggregate.
 * @param {number|Object} [targetBarsOrOptions=10] - Preferred bar count or chooseCadence options.
 * @param {boolean} [isMetric=false] - When true, weights/tonnage are stored in kg; otherwise lb.
 * @returns {Object|null} Chronology object with `bars`, `cadence`, `maxReps`, `nonZeroBars`,
 *   `startLabel`, `endLabel`, `displayUnit` — or null if there is insufficient data.
 *   Each bar carries `reps`, `sessions`, `tonnage`, `bestSet`, `rangeLabel` for tooltips.
 */
export function buildLiftChronology(
  parsedData,
  liftType,
  targetBarsOrOptions = 10,
  isMetric = false,
) {
  if (!parsedData?.length || !liftType) return null;

  const validEntries = parsedData.filter(
    (entry) => !entry.isGoal && entry.date,
  );
  if (!validEntries.length) return null;

  const firstDate = parseDateUTC(validEntries[0].date);
  const lastDate = parseDateUTC(validEntries[validEntries.length - 1].date);
  if (!firstDate || !lastDate) return null;

  const totalWeeks = countBucketsInRange(firstDate, lastDate, "week");
  if (totalWeeks < 10) return null;

  const cadence = chooseCadence(firstDate, lastDate, targetBarsOrOptions);
  const aggregates = new Map();

  parsedData.forEach((entry) => {
    if (entry.isGoal) return;
    if (entry.liftType !== liftType) return;
    if (typeof entry.reps !== "number") return;
    const d = parseDateUTC(entry.date);
    if (!d) return;
    const key = bucketKeyUTC(d, cadence);

    let bucket = aggregates.get(key);
    if (!bucket) {
      bucket = { reps: 0, sets: [] };
      aggregates.set(key, bucket);
    }

    const reps = entry.reps ?? 0;
    bucket.reps += reps;

    const display = getDisplayWeight(entry, isMetric);
    bucket.sets.push({
      reps,
      weight: display?.value ?? entry.weight ?? 0,
      unit: display?.unit ?? entry.unitType ?? (isMetric ? "kg" : "lb"),
      date: entry.date,
    });
  });

  const bars = [];
  let cursor = startOfBucketUTC(firstDate, cadence);
  const end = startOfBucketUTC(lastDate, cadence);
  let i = 0;
  while (cursor <= end && i < 5000) {
    const key = cursor.toISOString().slice(0, 10);
    const agg = aggregates.get(key);
    const topSets = (agg?.sets ?? [])
      .slice()
      .sort((a, b) => b.weight - a.weight || b.reps - a.reps)
      .slice(0, 5);
    bars.push({
      bucket: key,
      label: formatDateShortUTC(cursor, cadence),
      rangeLabel: formatBucketRangeUTC(cursor, cadence),
      reps: agg?.reps ?? 0,
      topSets,
      index: i,
    });
    cursor = addBucketUTC(cursor, cadence, 1);
    i += 1;
  }

  const maxReps = bars.reduce((m, b) => Math.max(m, b.reps), 0);
  const nonZeroBars = bars.filter((b) => b.reps > 0).length;

  if (nonZeroBars === 0) return null;

  return {
    cadence,
    bars,
    maxReps,
    nonZeroBars,
    startLabel: formatDateShortUTC(
      bars[0] ? parseDateUTC(bars[0].bucket) : firstDate,
      cadence,
    ),
    endLabel: formatDateShortUTC(
      bars[bars.length - 1]
        ? parseDateUTC(bars[bars.length - 1].bucket)
        : lastDate,
      cadence,
    ),
  };
}

/**
 * Small bar chart showing reps over time for a single lift type.
 *
 * @param {Object} props
 * @param {string} props.liftType - Lift name (used as a key/guard).
 * @param {string} props.color - Hex/CSS color for the bars.
 * @param {Object} props.chronology - Output of `buildLiftChronology`.
 */
const CADENCE_LABEL = {
  week: "Weekly",
  month: "Monthly",
  quarter: "Quarterly",
  year: "Annual",
};

export function MiniLiftChronologyChart({
  liftType,
  color,
  chronology,
  density = "default",
}) {
  if (!liftType || !chronology?.bars?.length) return null;

  const chartConfig = { reps: { label: "Reps", color } };
  const gradientId = `mlc-grad-${color.replace(/[^a-zA-Z0-9]/g, "")}`;
  const cadenceLabel = CADENCE_LABEL[chronology.cadence] ?? "Reps";
  const header = `${cadenceLabel} reps · ${chronology.startLabel} – ${chronology.endLabel}`;

  return (
    <div>
      <ChartContainer
        config={chartConfig}
        className={cn(
          "mt-0 mb-0 !aspect-auto w-full select-none [&_.recharts-surface]:focus:outline-none [&_.recharts-surface]:focus-visible:outline-none",
          density === "dense" ? "h-[84px] xl:h-[96px]" : "h-[72px]",
        )}
        onMouseDownCapture={(e) => e.preventDefault()}
      >
        <BarChart
          data={chronology.bars}
          margin={{ top: 6, right: 2, left: 2, bottom: 4 }}
          barCategoryGap={density === "dense" ? "8%" : "14%"}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={1} />
              <stop offset="100%" stopColor={color} stopOpacity={0.4} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" hide />
          <ChartTooltip cursor={false} content={<ChronologyBarTooltip />} />
          <Bar
            dataKey="reps"
            radius={[2, 2, 0, 0]}
            fill={`url(#${gradientId})`}
            stroke={BAR_OUTLINE}
            strokeWidth={1.25}
            maxBarSize={density === "dense" ? 18 : 32}
          >
            {chronology.bars.map((bar, index) => (
              <Cell
                key={`mini-bar-${index}`}
                fill={`url(#${gradientId})`}
                opacity={bar.reps > 0 ? 0.95 : 0.16}
                stroke={BAR_OUTLINE}
                strokeWidth={bar.reps > 0 ? 1.5 : 1}
                strokeOpacity={bar.reps > 0 ? 0.55 : 0.4}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
      <p className="text-center text-xs text-muted-foreground">{header}</p>
    </div>
  );
}

function ChronologyBarTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const bar = payload[0].payload;
  if (!bar) return null;

  const topSets = Array.isArray(bar.topSets) ? bar.topSets : [];

  return (
    <div className="rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-xs shadow-lg">
      <p className="font-semibold">{bar.label}</p>
      {bar.rangeLabel && (
        <p className="mb-1 text-[10px] text-muted-foreground">{bar.rangeLabel}</p>
      )}
      {topSets.length === 0 ? (
        <p className="text-muted-foreground">No sets logged</p>
      ) : (
        <ol className="space-y-0.5">
          {topSets.map((set, idx) => (
            <li
              key={`${set.date}-${idx}`}
              className="flex justify-between gap-3 tabular-nums"
            >
              <span>
                {idx + 1}. {set.reps}@{set.weight}
                {set.unit}
              </span>
              <span className="text-muted-foreground">
                {formatTooltipDate(set.date)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function formatTooltipDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y) return dateStr;
  return `${MONTH_NAMES[m - 1]} ${d}, ${String(y).slice(-2)}`;
}
