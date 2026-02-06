"use client";

import { useSession } from "next-auth/react";
import { NextSeo } from "next-seo";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { ChooseSheetInstructionsCard } from "@/components/instructions-cards";
import { useReadLocalStorage } from "usehooks-ts";
import { Separator } from "@/components/ui/separator";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { devLog } from "@/lib/processing-utils";
import { RelatedArticles } from "@/components/article-cards";
import { useLocalStorage } from "usehooks-ts";
import { estimateE1RM, estimateWeightForReps } from "@/lib/estimate-e1rm";
import { E1RMFormulaRadioGroup } from "@/components/e1rm-formula-radio-group";
import { Skeleton } from "@/components/ui/skeleton";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  PageContainer,
  PageHeader,
  PageHeaderHeading,
  PageHeaderDescription,
} from "@/components/page-header";

import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Legend } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

import { ChartColumnDecreasing, LoaderCircle } from "lucide-react";

import { fetchRelatedArticles } from "@/lib/sanity-io.js";
import { parse } from "date-fns";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

export async function getStaticProps() {
  const RELATED_ARTICLES_CATEGORY = "Personal Record Analyzer";
  const relatedArticles = await fetchRelatedArticles(RELATED_ARTICLES_CATEGORY);

  return {
    props: {
      relatedArticles,
    },
    revalidate: 60 * 60,
  };
}

export default function StrengthPotential({ relatedArticles }) {
  // OG Meta Tags
  const description =
    "Unlock free insights into your strength training with the barbell strength potential charts. Track PRs and discover untapped PRs across rep schemes.";
  const title = "Barbell Strength Potential | Strength Journeys";
  const canonicalURL =
    "https://www.strengthjourneys.xyz/barbell-strength-potential";
  const ogImageURL =
    "https://www.strengthjourneys.xyz/strength_journeys_barbell_strength_potential_og.png";
  const keywords =
    "strength training, PR analyzer, workout progress, potential strength, lifting journey, strength gains, personal records, strength progress reports, fitness data visualization";

  return (
    <>
      <NextSeo
        title={title}
        description={description}
        canonical={canonicalURL}
        openGraph={{
          url: canonicalURL,
          title: title,
          description: description,
          type: "website",
          images: [
            {
              url: ogImageURL,
              alt: "Strength Journeys Barbell Strength Potential",
            },
          ],
          site_name: "Strength Journeys",
        }}
        twitter={{
          handle: "@wayneschuller",
          site: "@wayneschuller",
          cardType: "summary_large_image",
        }}
        additionalMetaTags={[
          {
            name: "keywords",
            content: keywords,
          },
        ]}
      />
      {/* Keep the main component separate. I learned the hard way if it breaks server rendering you lose static metadata tags */}
      <StrengthPotentialMain relatedArticles={relatedArticles} />
    </>
  );
}

function StrengthPotentialMain({ relatedArticles }) {
  const { data: session, status: authStatus } = useSession();
  const { selectedLiftTypes, isLoading } = useUserLiftingData();
  const ssid = useReadLocalStorage(LOCAL_STORAGE_KEYS.SSID, {
    initializeWithValue: false,
  });
  const [e1rmFormula, setE1rmFormula] = useLocalStorage(LOCAL_STORAGE_KEYS.FORMULA, "Brzycki", {
    initializeWithValue: false,
  });

  if (!isLoading && authStatus === "authenticated" && ssid === null)
    return (
      <div className="mt-5 flex flex-1 flex-row justify-center align-middle md:mt-10">
        <ChooseSheetInstructionsCard session={session} />
      </div>
    );

  return (
    <PageContainer>
      <PageHeader>
        <PageHeaderHeading icon={ChartColumnDecreasing}>
          Barbell Strength Potential
        </PageHeaderHeading>
        <PageHeaderDescription>
          Review your strength potential with bar charts showcasing your top
          lifts across rep ranges, highlighting untapped gains to help you find
          new personal records to feed that desperate hunger for validation.
        </PageHeaderDescription>
        <div className="md:max-w-md">
          <E1RMFormulaRadioGroup
            e1rmFormula={e1rmFormula}
            setE1rmFormula={setE1rmFormula}
            horizontal={true}
          />
        </div>
      </PageHeader>
      <section className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {selectedLiftTypes.map((liftType) => (
          <StrengthPotentialBarChart key={liftType} liftType={liftType} />
        ))}
      </section>
      <RelatedArticles articles={relatedArticles} />
    </PageContainer>
  );
}

function StrengthPotentialBarChart({ liftType = "Bench Press" }) {
  const { parsedData, topLiftsByTypeAndReps, isValidating } =
    useUserLiftingData();
  const [e1rmFormula, setE1rmFormula] = useLocalStorage(LOCAL_STORAGE_KEYS.FORMULA, "Brzycki", {
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
    // Get computed CSS variable values and convert to usable color strings
    const root = document.documentElement;
    const computedStyle = getComputedStyle(root);

    // Helper to get HSL value and convert to a color string SVG can use
    const getHSLColor = (varName) => {
      const hslValue = computedStyle.getPropertyValue(varName).trim();
      if (!hslValue) return null;
      return `hsl(${hslValue})`;
    };

    // Helper to get computed color value for background
    const getBackgroundColor = () => {
      const temp = document.createElement("div");
      temp.style.backgroundColor = "hsl(var(--background))";
      temp.style.position = "absolute";
      temp.style.visibility = "hidden";
      document.body.appendChild(temp);
      const color = getComputedStyle(temp).backgroundColor;
      document.body.removeChild(temp);
      return color || "#ffffff";
    };

    // Create lighter variants by adjusting lightness
    const createLighterVariant = (hslString, lightnessIncrease = 10) => {
      if (!hslString) return null;
      // Extract HSL values: "hsl(12 76% 61%)" -> ["12", "76", "61"]
      const match = hslString.match(/hsl\((\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\)/);
      if (!match) return hslString;
      const [, h, s, l] = match;
      const newL = Math.min(100, parseFloat(l) + lightnessIncrease);
      return `hsl(${h} ${s}% ${newL}%)`;
    };

    // Get chart colors (these are HSL values)
    const chart1HSL = getHSLColor("--chart-1");
    const chart3HSL = getHSLColor("--chart-3");
    const mutedForegroundHSL = getHSLColor("--muted-foreground");

    setThemeColors({
      chart1: chart1HSL || "#3b82f6",
      chart1Light: chart1HSL ? createLighterVariant(chart1HSL, 15) : "#60a5fa",
      chart3: chart3HSL || "#f59e0b",
      chart3Light: chart3HSL ? createLighterVariant(chart3HSL, 10) : "#facc15",
      mutedForeground: mutedForegroundHSL || "#64748b",
      border: mutedForegroundHSL || "#8884d8",
      background: getBackgroundColor(),
    });
  }, [theme, resolvedTheme]); // Re-run when theme changes

  // Early return only if topLiftsByTypeAndReps exists but is empty/invalid for this liftType
  // if (topLiftsByTypeAndReps && !topLiftsByTypeAndReps[liftType]) {
  // return null;
  // }

  const topLifts = topLiftsByTypeAndReps[liftType];
  const startTime = performance.now();

  // Find the best e1RM across all rep schemes
  let bestE1RMWeight = 0;
  let bestLift = null;
  let unitType = "lb"; // Default to lb if not specified
  let chartData = [];

  if (parsedData) {
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
          bestLift = lift;
        }
        if (lift.unitType) unitType = lift.unitType;
      }
    }

    // Convert `topLifts` into chart data (only for reps 1-10)
    chartData = Array.from({ length: 10 }, (_, i) => {
      const reps = i + 1;
      const topLiftAtReps = topLifts[i]?.[0] || null; // Default to null if no lift exists

      // Use 0 weight and the full potential if no lift exists at this rep range
      // This allows us to have bar charts that are 100% potential
      const actualWeight = topLiftAtReps?.weight || 0;

      // Calculate potential max weight based on the best e1RM
      const potentialMax = estimateWeightForReps(
        bestE1RMWeight,
        reps,
        e1rmFormula,
      );

      // Calculate the "extension" piece (difference between potential max and actual lift)

      const extension = Math.max(0, potentialMax - actualWeight);

      return {
        reps: `${reps} ${reps === 1 ? "rep" : "reps"}`, // X-axis label
        weight: actualWeight, // Y-axis value (bar height)
        potentialMax,
        extension,
        // actualLabel: "Best Lift Achieved", // Embedded label
        // potentialLabel: "Untapped Potential Max", // Embedded label
        // Tooltip-specific data
        actualLift: topLiftAtReps,
        bestLift: bestLift,
      };
    });

    // devLog(chartData);
  }

  return (
    <Card className="shadow-lg md:mx-2">
      <CardHeader>
        <CardTitle>{liftType} Strength Potential By Rep Range</CardTitle>
        <CardDescription>
          Your best set: {bestLift.reps}@{bestLift.weight}
          {bestLift.unitType} ({formatDate(bestLift.date)})
          {isValidating && (
            <LoaderCircle className="ml-3 inline-flex h-5 w-5 animate-spin" />
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!topLiftsByTypeAndReps ? (
          <Skeleton className="h-[300px] w-full" /> // FIXME: This skeleton never shows
        ) : (
          <ChartContainer config={{}} className="">
            <BarChart data={chartData}>
              <XAxis dataKey="reps" stroke={themeColors.border} />
              <YAxis
                stroke={themeColors.border}
                domain={[0, "auto"]}
                tickFormatter={(tick) => `${tick}${unitType}`}
              />
              <ChartTooltip
                content={
                  <CustomTooltip
                    actualColor={themeColors.chart1}
                    potentialColor={themeColors.chart3}
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
                // radius={[8, 8, 0, 0]}
                // animationDuration={800}
                // animationEasing="ease-out"
              />

              {/* Extension (potential max increase) with gradient */}
              <Bar
                dataKey="extension"
                stackId="a"
                // fill="url(#potentialGradient)"
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
}) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload; // Get the data for the hovered bar
    const reps = parseInt(data.reps); // Extract reps (e.g., "7 reps" -> 7)

    // Extract data from the lift objects
    const actualLift = data.actualLift || {};
    const bestLift = data.bestLift || {};

    const actualWeight = actualLift.weight || 0;
    const actualDate = actualLift.date ? formatDate(actualLift.date) : "N/A";
    const bestWeight = bestLift.weight || 0;
    const bestDate = bestLift.date ? formatDate(bestLift.date) : "N/A";
    const unitType = actualLift.unitType || "lb"; // Default to "lb" if not specified

    // devLog( `CustomTooltip: reps: ${reps}, actualWeight: ${actualWeight}, bestWeight: ${bestWeight}`,);

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
            {unitType} achieved {actualDate}.
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
              {unitType}
            </p>
            <p className="text-xs text-gray-500">
              (Based on best: {bestLift.reps}@{bestWeight}
              {unitType}, {bestDate})
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
