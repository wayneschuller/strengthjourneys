import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, Cell } from "recharts";

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

function chooseCadence(firstDate, lastDate, targetBars = 10) {
  const options = ["week", "month", "quarter", "year"];
  const scored = options.map((cadence) => {
    const count = countBucketsInRange(firstDate, lastDate, cadence);
    const distance = Math.abs(count - targetBars);
    const lowPenalty = count < 4 ? (4 - count) * 3 : 0;
    const highPenalty = count > 14 ? (count - 14) * 0.6 : 0;
    return { cadence, count, score: distance + lowPenalty + highPenalty };
  });
  scored.sort((a, b) => a.score - b.score);
  return scored[0]?.cadence ?? "month";
}

/**
 * Builds a time-bucketed reps chronology for a single lift type.
 *
 * @param {Array} parsedData - Full parsed lifting data from UserLiftingDataProvider.
 * @param {string} liftType - The lift to aggregate.
 * @param {number} [targetBars=10] - Preferred number of bars; cadence is chosen to get close.
 * @returns {Object|null} Chronology object with `bars`, `cadence`, `maxReps`, `nonZeroBars`,
 *   `startLabel`, `endLabel` — or null if there is insufficient data.
 */
export function buildLiftChronology(parsedData, liftType, targetBars = 10) {
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

  const cadence = chooseCadence(firstDate, lastDate, targetBars);
  const sums = new Map();

  parsedData.forEach((entry) => {
    if (entry.isGoal) return;
    if (entry.liftType !== liftType) return;
    if (typeof entry.reps !== "number") return;
    const d = parseDateUTC(entry.date);
    if (!d) return;
    const key = bucketKeyUTC(d, cadence);
    sums.set(key, (sums.get(key) ?? 0) + (entry.reps ?? 0));
  });

  const bars = [];
  let cursor = startOfBucketUTC(firstDate, cadence);
  const end = startOfBucketUTC(lastDate, cadence);
  let i = 0;
  while (cursor <= end && i < 5000) {
    const key = cursor.toISOString().slice(0, 10);
    bars.push({
      bucket: key,
      label: formatDateShortUTC(cursor, cadence),
      reps: sums.get(key) ?? 0,
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

export function MiniLiftChronologyChart({ liftType, color, chronology }) {
  if (!liftType || !chronology?.bars?.length) return null;

  const chartConfig = { reps: { label: "Reps", color } };
  const gradientId = `mlc-grad-${color.replace(/[^a-zA-Z0-9]/g, "")}`;
  const cadenceLabel = CADENCE_LABEL[chronology.cadence] ?? "Reps";
  const header = `${cadenceLabel} reps · ${chronology.startLabel} – ${chronology.endLabel}`;

  return (
    <div>
      <p className="mb-1 text-xs text-muted-foreground">{header}</p>
      <ChartContainer
      config={chartConfig}
      className="mt-0 mb-5 !aspect-auto h-[72px] w-full select-none [&_.recharts-surface]:focus:outline-none [&_.recharts-surface]:focus-visible:outline-none"
      onMouseDownCapture={(e) => e.preventDefault()}
    >
      <BarChart
        data={chronology.bars}
        margin={{ top: 6, right: 2, left: 2, bottom: 4 }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={1} />
            <stop offset="100%" stopColor={color} stopOpacity={0.4} />
          </linearGradient>
        </defs>
        <XAxis dataKey="label" hide />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => {
                const item = payload?.[0]?.payload;
                if (!item) return "";
                return item.label;
              }}
              formatter={(value) => (
                <div className="flex w-full items-center justify-between gap-3">
                  <span className="text-muted-foreground">Reps</span>
                  <span className="font-mono font-medium tabular-nums">
                    {Number(value).toLocaleString()}
                  </span>
                </div>
              )}
            />
          }
        />
        <Bar
          dataKey="reps"
          radius={[2, 2, 0, 0]}
          fill={`url(#${gradientId})`}
          stroke={BAR_OUTLINE}
          strokeWidth={1.25}
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
    </div>
  );
}
