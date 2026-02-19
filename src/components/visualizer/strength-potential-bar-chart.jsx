import { useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { useLocalStorage } from "usehooks-ts";
import { Bar, BarChart, XAxis, YAxis, Legend } from "recharts";
import { LoaderCircle } from "lucide-react";

import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { estimateE1RM, estimateWeightForReps } from "@/lib/estimate-e1rm";
import { getDisplayWeight } from "@/lib/processing-utils";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function StrengthPotentialBarChart({ liftType = "Bench Press" }) {
  const { parsedData, topLiftsByTypeAndReps, isValidating } =
    useUserLiftingData();
  const { isMetric } = useAthleteBio();
  const [e1rmFormula] = useLocalStorage(LOCAL_STORAGE_KEYS.FORMULA, "Brzycki", {
    initializeWithValue: false,
  });
  const { theme, resolvedTheme } = useTheme();

  // Get theme colors from CSS variables
  const [themeColors, setThemeColors] = useState({
    chart1: "#3b82f6", // fallback blue
    chart1Light: "#60a5fa", // fallback light blue
    chart3: "#f59e0b", // fallback orange
    chart3Light: "#facc15", // fallback light orange
    mutedForeground: "#64748b", // fallback gray
    border: "#8884d8", // fallback purple-gray
    background: "#ffffff", // fallback white
  });

  useEffect(() => {
    // Resolve theme CSS variables to computed color strings (rgb/hex) so SVG and
    // chart libs work with any format (hsl, oklch, etc.). getPropertyValue() returns
    // raw values (e.g. "oklch(...)"), so we use a temp element to get computed color.
    const getComputedColor = (varName) => {
      const temp = document.createElement("div");
      temp.style.color = `var(${varName})`;
      temp.style.position = "absolute";
      temp.style.visibility = "hidden";
      document.body.appendChild(temp);
      const color = getComputedStyle(temp).color;
      document.body.removeChild(temp);
      if (!color || color === "rgba(0, 0, 0, 0)" || color === "transparent") return null;
      return color;
    };

    const getBackgroundColor = () => {
      const temp = document.createElement("div");
      temp.style.backgroundColor = "var(--background)";
      temp.style.position = "absolute";
      temp.style.visibility = "hidden";
      document.body.appendChild(temp);
      const color = getComputedStyle(temp).backgroundColor;
      document.body.removeChild(temp);
      return color || "#ffffff";
    };

    // Create a lighter variant from any computed rgb/rgba string
    const createLighterVariant = (rgbString, amount = 0.15) => {
      if (!rgbString) return null;
      const match = rgbString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
      if (!match) return rgbString;
      const [, r, g, b] = match;
      const scale = 1 + amount;
      const nr = Math.min(255, Math.round(Number(r) * scale));
      const ng = Math.min(255, Math.round(Number(g) * scale));
      const nb = Math.min(255, Math.round(Number(b) * scale));
      return `rgb(${nr}, ${ng}, ${nb})`;
    };

    const chart1 = getComputedColor("--chart-1");
    const chart3 = getComputedColor("--chart-3");
    const mutedFg = getComputedColor("--muted-foreground");

    setThemeColors({
      chart1: chart1 || "#3b82f6",
      chart1Light: chart1 ? createLighterVariant(chart1, 0.15) : "#60a5fa",
      chart3: chart3 || "#f59e0b",
      chart3Light: chart3 ? createLighterVariant(chart3, 0.1) : "#facc15",
      mutedForeground: mutedFg || "#64748b",
      border: mutedFg || "#8884d8",
      background: getBackgroundColor(),
    });
  }, [theme, resolvedTheme]); // Re-run when theme changes

  const topLifts = topLiftsByTypeAndReps?.[liftType];

  const { chartData, bestLift, displayUnit } = useMemo(() => {
    let bestE1RMWeight = 0;
    let best = null;
    let nativeUnit = "lb";
    let data = [];

    if (parsedData && topLifts) {
      for (let reps = 0; reps < 10; reps++) {
        if (topLifts[reps]?.[0]) {
          const lift = topLifts[reps][0];
          const currentE1RMweight = estimateE1RM(
            reps + 1,
            lift.weight,
            e1rmFormula,
          );
          if (currentE1RMweight > bestE1RMWeight) {
            bestE1RMWeight = currentE1RMweight;
            best = lift;
          }
          if (lift.unitType) nativeUnit = lift.unitType;
        }
      }

      data = Array.from({ length: 10 }, (_, i) => {
        const reps = i + 1;
        const topLiftAtReps = topLifts[i]?.[0] || null;
        const rawWeight = topLiftAtReps?.weight || 0;
        const rawPotentialMax = estimateWeightForReps(bestE1RMWeight, reps, e1rmFormula);

        const actualWeight = rawWeight > 0
          ? getDisplayWeight({ weight: rawWeight, unitType: nativeUnit }, isMetric).value
          : 0;
        const potentialMax = getDisplayWeight({ weight: rawPotentialMax, unitType: nativeUnit }, isMetric).value;
        const extension = Math.max(0, potentialMax - actualWeight);

        return {
          reps: `${reps} ${reps === 1 ? "rep" : "reps"}`,
          weight: actualWeight,
          potentialMax,
          extension,
          actualLift: topLiftAtReps,
          bestLift: best,
        };
      });
    }

    return { chartData: data, bestLift: best, displayUnit: isMetric ? "kg" : "lb" };
  }, [parsedData, topLifts, e1rmFormula, isMetric]);

  return (
    <Card className="shadow-lg md:mx-2">
      <CardHeader>
        <CardTitle>{liftType} Strength Potential By Rep Range</CardTitle>
        <CardDescription>
          {bestLift
            ? `Your best set: ${bestLift.reps}@${getDisplayWeight(bestLift, isMetric).value}${getDisplayWeight(bestLift, isMetric).unit} (${formatDate(bestLift.date)})`
            : "No data yet"}
          {isValidating && (
            <LoaderCircle className="ml-3 inline-flex h-5 w-5 animate-spin" />
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!topLiftsByTypeAndReps ? (
          <Skeleton className="h-[300px] w-full" /> // FIXME: This skeleton never shows
        ) : (
          <ChartContainer
            config={{}}
            className=""
            key={resolvedTheme ?? theme ?? "light"}
          >
            <BarChart data={chartData}>
              <XAxis dataKey="reps" stroke={themeColors.border} />
              <YAxis
                stroke={themeColors.border}
                domain={[0, "auto"]}
                tickFormatter={(tick) => `${tick}${displayUnit}`}
              />
              <ChartTooltip
                content={
                  <CustomTooltip
                    actualColor={themeColors.chart1}
                    potentialColor={themeColors.chart3}
                    isMetric={isMetric}
                    displayUnit={displayUnit}
                  />
                }
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                wrapperStyle={{
                  fontSize: "12px",
                  color: themeColors.mutedForeground,
                }}
              />

              {/* Base (actual best lift) with gradient */}
              <Bar
                dataKey="weight"
                stackId="a"
                fill="url(#actualGradient)"
                name="Best Lift Achieved"
              />

              {/* Extension (potential max increase) with gradient */}
              <Bar
                dataKey="extension"
                stackId="a"
                fill="url(#potentialPattern)" // Use pattern instead of solid color
                radius={[4, 4, 0, 0]}
                animationDuration={800}
                animationEasing="ease-out"
                name="Potential Max"
              />

              {/* Gradient Definitions */}
              <defs>
                <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={themeColors.chart1Light}
                    stopOpacity={1}
                  />
                  <stop offset="100%" stopColor={themeColors.chart1} stopOpacity={1} />
                </linearGradient>
                <linearGradient
                  id="potentialGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={themeColors.chart3Light}
                    stopOpacity={1}
                  />
                  <stop offset="100%" stopColor={themeColors.chart3} stopOpacity={1} />
                </linearGradient>
                <pattern
                  id="potentialPattern"
                  width="8"
                  height="8"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)" // Diagonal lines
                >
                  <rect
                    width="8"
                    height="8"
                    fill={themeColors.chart3} // Base color from theme
                    opacity={0.8} // Slightly faded
                  />
                  <line
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="8"
                    stroke={themeColors.background} // Use theme background for contrast
                    strokeWidth="1"
                    opacity={0.5} // Subtle pattern
                  />
                </pattern>
              </defs>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

const CustomTooltip = ({
  active,
  payload,
  actualColor = "#3b82f6",
  potentialColor = "#f59e0b",
  isMetric = false,
  displayUnit = "lb",
}) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload; // Get the data for the hovered bar
    const reps = parseInt(data.reps); // Extract reps (e.g., "7 reps" -> 7)

    // Extract data from the lift objects
    const actualLift = data.actualLift || {};
    const bestLift = data.bestLift || {};

    const actualDate = actualLift.date ? formatDate(actualLift.date) : "N/A";
    const bestDate = bestLift.date ? formatDate(bestLift.date) : "N/A";

    // Use already-converted chart values for display (data.weight and data.potentialMax
    // are pre-converted in the useMemo above)
    const actualWeight = data.weight || 0;
    const bestDisplayWeight = bestLift.weight
      ? getDisplayWeight(bestLift, isMetric).value
      : 0;

    return (
      <div className="w-48 rounded border border-border bg-card p-2 shadow-lg md:w-64">
        {/* Title */}
        <p className="font-bold">
          {reps} Rep {bestLift.liftType}
        </p>

        {/* Actual Lift (Blue) */}
        {actualWeight > 0 && (
          <p className="flex items-center">
            <span
              className="mr-2 inline-block h-3 w-3 rounded"
              style={{ backgroundColor: actualColor }}
            ></span>
            {reps}@{actualWeight}
            {displayUnit} achieved {actualDate}.
          </p>
        )}

        {/* Potential Lift (Orange) */}
        {actualWeight < data.potentialMax && (
          <>
            <p className="flex items-center">
              <span
                className="mr-2 inline-block h-3 w-3 rounded"
                style={{ backgroundColor: potentialColor }}
              ></span>
              Potential: {reps}@{data.potentialMax}
              {displayUnit}
            </p>
            <p className="text-xs text-gray-500">
              (Based on best: {bestLift.reps}@{bestDisplayWeight}
              {displayUnit}, {bestDate})
            </p>
          </>
        )}
      </div>
    );
  }
  return null;
};

// Format dates (assuming ISO format, e.g., "2018-08-31" -> "31 Aug 2018")
const formatDate = (dateStr) => {
  if (!dateStr) return "Unknown Date";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};
