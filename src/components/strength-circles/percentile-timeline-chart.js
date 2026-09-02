/**
 * Percentile timeline chart for the How Strong Am I? page.
 *
 * Lives in its own module so the page can pull it in with next/dynamic. Recharts
 * is the largest dependency on that page and this chart only renders for signed-in
 * lifters who have enough training history to plot, so the vast majority of
 * visitors should never download it.
 */

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ReferenceLine,
} from "recharts";

const UNIVERSE_COLORS = {
  "General Population":  "var(--chart-1)",
  "Gym-Goers":           "var(--chart-2)",
  "Barbell Lifters":     "var(--chart-3)",
  "Powerlifting Culture": "var(--chart-4)",
};

export default function PercentileTimelineChart({ data, currentPercentile, activeUniverse = "General Population" }) {
  const dataKey = activeUniverse;
  const chartColor = UNIVERSE_COLORS[activeUniverse] || "var(--chart-1)";

  // Determine smart tick formatting based on time span
  const firstDate = new Date(data[0].date);
  const lastDate = new Date(data[data.length - 1].date);
  const spanDays = (lastDate - firstDate) / 86400000;

  const formatTick = (dateStr) => {
    const d = new Date(dateStr);
    const tz = "UTC"; // dateStr parses as UTC midnight; format in UTC to avoid local day-shift
    if (spanDays <= 365) {
      // Short: show "Mar", "Apr", etc.
      return d.toLocaleDateString("en-US", { month: "short", timeZone: tz });
    }
    if (spanDays <= 365 * 4) {
      // Medium: show "Mar '24"
      return d.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: tz });
    }
    // Long: show "'20", "'21", etc.
    return "\u2019" + d.toLocaleDateString("en-US", { year: "2-digit", timeZone: tz });
  };

  // Thin out tick labels to avoid overlap — show ~5-7 labels max
  const maxTicks = spanDays <= 365 ? 6 : spanDays <= 365 * 4 ? 7 : 8;
  const tickInterval = Math.max(1, Math.floor(data.length / maxTicks));
  const ticks = data
    .filter((_, i) => i % tickInterval === 0 || i === data.length - 1)
    .map((d) => d.date);

  const formatTooltipDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  };

  // Compute Y domain: floor to nearest 10 below min, cap at 100
  const minPct = Math.min(...data.map((d) => d[dataKey] ?? 0));
  const yMin = Math.max(0, Math.floor(minPct / 10) * 10 - 5);

  const universeLabel = activeUniverse.toLowerCase();

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">
        SBD percentile vs. {universeLabel} over time
      </p>
      <div className="h-28 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="pctGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={chartColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tickFormatter={formatTick}
              ticks={ticks}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[yMin, 100]}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}`}
            />
            <RechartsTooltip
              position={{ y: -10 }}
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: "1px solid hsl(var(--border))",
                backgroundColor: "hsl(var(--popover))",
                color: "hsl(var(--popover-foreground))",
              }}
              labelFormatter={formatTooltipDate}
              formatter={(value) => [`${value}%`, universeLabel]}
            />
            {currentPercentile != null && (
              <ReferenceLine
                y={currentPercentile}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="3 3"
                strokeOpacity={0.5}
              />
            )}
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={chartColor}
              strokeWidth={2}
              fill="url(#pctGrad)"
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0, fill: chartColor }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
