import { useId, useMemo } from "react";
import { useLocalStorage } from "usehooks-ts";
import { Bar, BarChart, XAxis, YAxis, Legend } from "recharts";
import { LoaderCircle } from "lucide-react";

import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { estimateE1RM, estimateWeightForReps } from "@/lib/estimate-e1rm";
import { getDisplayWeight } from "@/lib/processing-utils";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { useLiftColors } from "@/hooks/use-lift-colors";
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
  const { parsedData, topLiftsByTypeAndReps, isValidating, isLoading } =
    useUserLiftingData();
  const { isMetric } = useAthleteBio();
  const { getColor } = useLiftColors();
  const [e1rmFormula] = useLocalStorage(LOCAL_STORAGE_KEYS.FORMULA, "Brzycki", {
    initializeWithValue: false,
  });
  const gradientId = useId().replace(/:/g, "");
  const actualGradientId = `actualGradient-${gradientId}`;
  const potentialPatternId = `potentialPattern-${gradientId}`;

  const chartColors = useMemo(() => {
    const baseColor = getColor(liftType) || "#3b82f6";
    const actual = normalizeHex(baseColor) || "#3b82f6";
    const potential = mixHex(actual, "#111827", 0.18);
    const axis = mixHex(actual, "#111827", 0.36);
    const stripe = isLightHex(actual)
      ? "rgba(0, 0, 0, 0.22)"
      : "rgba(255, 255, 255, 0.34)";

    return {
      actual,
      actualLight: mixHex(actual, "#ffffff", 0.24),
      potential,
      axis,
      stripe,
    };
  }, [getColor, liftType]);

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
        {isLoading || !topLiftsByTypeAndReps ? (
          <Skeleton className="h-[300px] w-full" />
        ) : (
          <ChartContainer
            config={{}}
            className="h-[300px] !aspect-auto"
          >
            <BarChart data={chartData}>
              <XAxis dataKey="reps" stroke={chartColors.axis} />
              <YAxis
                stroke={chartColors.axis}
                domain={[0, "auto"]}
                tickFormatter={(tick) => `${tick}${displayUnit}`}
              />
              <ChartTooltip
                content={
                  <CustomTooltip
                    actualColor={chartColors.actual}
                    potentialColor={chartColors.potential}
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
                  color: chartColors.axis,
                }}
              />

              {/* Base (actual best lift) with gradient */}
              <Bar
                dataKey="weight"
                stackId="a"
                fill={`url(#${actualGradientId})`}
                name="Best Lift Achieved"
              />

              {/* Extension (potential max increase) with gradient */}
              <Bar
                dataKey="extension"
                stackId="a"
                fill={`url(#${potentialPatternId})`}
                radius={[4, 4, 0, 0]}
                animationDuration={800}
                animationEasing="ease-out"
                name="Potential Max"
              />

              {/* Gradient Definitions */}
              <defs>
                <linearGradient id={actualGradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={chartColors.actualLight}
                    stopOpacity={1}
                  />
                  <stop offset="100%" stopColor={chartColors.actual} stopOpacity={1} />
                </linearGradient>
                <pattern
                  id={potentialPatternId}
                  width="8"
                  height="8"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)"
                >
                  <rect
                    width="8"
                    height="8"
                    fill={chartColors.potential}
                    opacity={0.84}
                  />
                  <line
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="8"
                    stroke={chartColors.stripe}
                    strokeWidth="1"
                    opacity={0.7}
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

const normalizeHex = (value) => {
  if (typeof value !== "string" || !value.startsWith("#")) return null;
  const hex = value.slice(1);
  if (hex.length === 3) {
    return `#${hex.split("").map((c) => c + c).join("")}`.toLowerCase();
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
  return (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) > 160;
};
