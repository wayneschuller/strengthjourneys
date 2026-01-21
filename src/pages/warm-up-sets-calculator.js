"use client";

import { NextSeo } from "next-seo";
import { Flame } from "lucide-react";

import { RelatedArticles } from "@/components/article-cards";
import { UnitChooser } from "@/components/unit-type-chooser";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PageHeader,
  PageHeaderHeading,
  PageHeaderDescription,
} from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { useLocalStorage } from "usehooks-ts";
import { useStateFromQueryOrLocalStorage } from "@/hooks/use-state-from-query-or-localStorage";

import {
  generateWarmupSets,
  calculatePlateBreakdown,
  calculateTopSetBreakdown,
  formatPlateBreakdown,
} from "@/lib/warmups";
import { PlateDiagram } from "@/components/warmups/plate-diagram";

import { fetchRelatedArticles } from "@/lib/sanity-io.js";

export async function getStaticProps() {
  const RELATED_ARTICLES_CATEGORY = "Warm Ups Calculator";
  const relatedArticles = await fetchRelatedArticles(RELATED_ARTICLES_CATEGORY);

  return {
    props: {
      relatedArticles: relatedArticles || [],
    },
    revalidate: 60 * 60,
  };
}

export default function WarmUpSetsCalculator({ relatedArticles }) {
  const title = "Barbell Warm Up Sets Calculator | Free tool, no login required";
  const description =
    "Generate warmup sets for your barbell workouts using Starting Strength methodology. Calculate warmup weights, reps, and see plate breakdowns with visual diagrams.";
  const keywords =
    "warmup sets calculator, barbell warmup calculator, starting strength warmup, warmup sets generator, barbell warmup sets, strength training warmup, powerlifting warmup calculator, workout warmup calculator, warmup reps calculator";
  const canonicalURL = "https://www.strengthjourneys.xyz/warm-up-sets-calculator";
  const ogImageURL =
    "https://www.strengthjourneys.xyz/strength_journeys_warm_up_sets_calculator_og.png";

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
              alt: "Strength Journeys Warm Up Sets Calculator",
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
      <WarmUpSetsCalculatorMain relatedArticles={relatedArticles} />
    </>
  );
}

function WarmUpSetsCalculatorMain({ relatedArticles }) {
  const [reps, setReps] = useStateFromQueryOrLocalStorage("warmupReps", 5);
  const [weight, setWeight] = useStateFromQueryOrLocalStorage("warmupWeight", 100);
  const [isMetric, setIsMetric] = useStateFromQueryOrLocalStorage(
    "calcIsMetric",
    false,
  );
  const [barType, setBarType] = useLocalStorage("SJ_WarmupsBarType", "standard", {
    initializeWithValue: false,
  });
  const [platePreference, setPlatePreference] = useLocalStorage(
    "SJ_WarmupsPlatePreference",
    "red",
    {
      initializeWithValue: false,
    },
  );
  const [warmupSetCount, setWarmupSetCount] = useLocalStorage(
    "SJ_WarmupsSetCount",
    4,
    {
      initializeWithValue: false,
    },
  );

  // Calculate bar weight based on unit and bar type
  const barWeight = isMetric
    ? barType === "womens"
      ? 15
      : 20
    : barType === "womens"
      ? 35
      : 45;

  /**
   * Generate warmup sets
   * @type {Array<{weight: number, reps: number, percentage: number, isBarOnly?: boolean}>}
   * warmupSets - Array of warmup set objects:
   *   - weight: Weight for this warmup set (number)
   *   - reps: Number of reps for this set (number)
   *   - percentage: Percentage of top set weight (number, 0 for bar-only sets)
   *   - isBarOnly: Optional flag indicating this is just the empty bar (boolean)
   */
  const warmupSets = generateWarmupSets(
    Number(weight),
    Number(reps),
    barWeight,
    isMetric,
    platePreference,
    Number(warmupSetCount),
  );

  /**
   * Calculate plate breakdown for top set
   * If we have warmup sets, start from the last warmup's plates and add what's needed
   * @type {{platesPerSide: Array<{weight: number, count: number, color: string, name: string}>, remainder: number, closestWeight: number}}
   * topSetBreakdown - Plate breakdown object:
   *   - platesPerSide: Array of plate objects, each with:
   *     - weight: Plate weight (number)
   *     - count: Number of plates of this weight per side (number)
   *     - color: Hex color code for visualization (string)
   *     - name: Display name (string, e.g., "25kg" or "45lb")
   *   - remainder: Difference between target weight and achievable weight (number)
   *   - closestWeight: Actual achievable weight with available plates (number)
   */
  let topSetBreakdown;
  if (warmupSets.length > 0) {
    const lastWarmupSet = warmupSets[warmupSets.length - 1];
    const lastWarmupBreakdown = calculatePlateBreakdown(
      lastWarmupSet.weight,
      barWeight,
      isMetric,
      platePreference,
    );
    topSetBreakdown = calculateTopSetBreakdown(
      Number(weight),
      barWeight,
      lastWarmupBreakdown.platesPerSide,
      isMetric,
      platePreference,
    );
  } else {
    // Fallback to standard calculation if no warmup sets
    topSetBreakdown = calculatePlateBreakdown(
      Number(weight),
      barWeight,
      isMetric,
      platePreference,
    );
  }

  const handleWeightSliderChange = (value) => {
    let newWeight = value[0];
    const minIncrement = isMetric ? 2.5 : 5;
    newWeight = minIncrement * Math.ceil(newWeight / minIncrement);
    setWeight(newWeight);
  };

  const handleKeyPress = (event) => {
    if (event.key === "Enter") {
      event.target.blur();
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      event.target.blur();
    }
  };

  const toggleIsMetric = (newIsMetric) => {
    let newWeight;
    if (!newIsMetric) {
      // Going from kg to lb
      newWeight = Math.round(Number(weight) * 2.2046);
      setIsMetric(false);
    } else {
      // Going from lb to kg
      newWeight = Math.round(Number(weight) / 2.2046);
      setIsMetric(true);
    }
    setTimeout(() => {
      setWeight(newWeight);
    }, 100);
  };

  const unit = isMetric ? "kg" : "lb";
  const maxWeight = isMetric ? 300 : 700;

  return (
    <div className="container">
      <PageHeader>
        <PageHeaderHeading icon={Flame}>Barbell Warm Ups Calculator</PageHeaderHeading>
        <PageHeaderDescription>
          Generate warmup sets for your barbell workouts using Starting Strength
          methodology. Enter your target top set weight and reps, and we&apos;ll
          calculate the warmup progression with plate breakdowns.
        </PageHeaderDescription>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Target Top Set</CardTitle>
          <CardDescription>
            Enter the weight and reps for your working set/s
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Reps and Weight Inputs */}
          <div className="mt-4 grid grid-cols-1 items-center gap-6 md:grid-cols-6 md:gap-4">
            <div className="ml-2 justify-self-center text-2xl md:hidden">
              {reps} reps
            </div>
            <Slider
              className="md:col-span-5"
              value={[Number(reps)]}
              min={1}
              max={12}
              step={1}
              onValueChange={(values) => setReps(values[0])}
              aria-label="Reps"
            />
            <div className="ml-2 hidden justify-self-center text-lg md:block md:w-[7rem] md:justify-self-start">
              {reps} reps
            </div>

            <div className="ml-2 mt-6 w-[9rem] justify-self-center md:hidden">
              <div className="flex items-center gap-1 text-2xl">
                <Input
                  className="text-2xl"
                  type="number"
                  min="1"
                  step={isMetric ? "2.5" : "5"}
                  id="weightInput"
                  value={weight}
                  onChange={(event) => setWeight(event.target.value)}
                  onKeyPress={handleKeyPress}
                  onKeyDown={handleKeyDown}
                  aria-label="Weight"
                />
                <UnitChooser isMetric={isMetric} onSwitchChange={toggleIsMetric} />
              </div>
            </div>
            <Slider
              className="md:col-span-5"
              value={[Number(weight)]}
              min={barWeight}
              max={maxWeight}
              step={isMetric ? 2.5 : 5}
              onValueChange={handleWeightSliderChange}
            />
            <div className="ml-1 hidden w-[8rem] justify-self-center md:block md:justify-self-start">
              <div className="flex items-center gap-1">
                <Input
                  className="text-lg"
                  type="number"
                  min={barWeight}
                  step={isMetric ? "2.5" : "5"}
                  id="weightInput"
                  value={weight}
                  onChange={(event) => setWeight(event.target.value)}
                  onKeyPress={handleKeyPress}
                  onKeyDown={handleKeyDown}
                  aria-label="Weight"
                />
                <UnitChooser isMetric={isMetric} onSwitchChange={toggleIsMetric} />
              </div>
            </div>
          </div>

          {/* Options: horizontal on desktop, vertical on mobile */}
          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Bar Type Selection */}
            <div>
              <Label className="mb-2 block">Barbell Type</Label>
              <RadioGroup value={barType} onValueChange={setBarType}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="standard" id="standard" />
                  <Label htmlFor="standard">
                    Standard bar ({isMetric ? "20kg" : "45lb"})
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="womens" id="womens" />
                  <Label htmlFor="womens">
                    Women&apos;s bar ({isMetric ? "15kg" : "35lb"})
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Plate Preference Selection */}
            <div>
              <Label className="mb-2 block">Plate Preference</Label>
              <RadioGroup value={platePreference} onValueChange={setPlatePreference}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="red" id="prefer-red" />
                  <Label htmlFor="prefer-red">
                    Prefer {isMetric ? "red (25kg)" : "red (55lb)"} plates
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="blue" id="prefer-blue" />
                  <Label htmlFor="prefer-blue">
                    Prefer {isMetric ? "blue (20kg)" : "blue (45lb)"} plates
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Warmup Set Count Selection */}
            <div>
              <Label className="mb-2 block">Warmup sets (before top set)</Label>
              <div className="flex items-center space-x-3">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setWarmupSetCount((prev) => {
                      const current = Number(prev ?? 0) || 0;
                      return Math.max(2, current - 1);
                    })
                  }
                  aria-label="Fewer warmup sets"
                >
                  -
                </Button>
                <div className="w-10 text-center text-lg font-medium">
                  {Number(warmupSetCount)}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setWarmupSetCount((prev) => {
                      const current = Number(prev ?? 0) || 0;
                      return Math.min(6, current + 1);
                    })
                  }
                  aria-label="More warmup sets"
                >
                  +
                </Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Fewer sets = bigger jumps, more sets = smaller jumps.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warmup Sets Output */}
      <WarmupSetsDisplay
        warmupSets={warmupSets}
        topSetBreakdown={topSetBreakdown}
        reps={reps}
        weight={weight}
        unit={unit}
        barWeight={barWeight}
        isMetric={isMetric}
        platePreference={platePreference}
      />

      {relatedArticles && relatedArticles.length > 0 && (
        <RelatedArticles articles={relatedArticles} />
      )}
    </div>
  );
}

/**
 * Display component for warmup sets and top set with plate breakdowns
 * @param {Object} props
 * @param {Array<{weight: number, reps: number, percentage: number, isBarOnly?: boolean}>} props.warmupSets - Array of warmup set objects
 * @param {{platesPerSide: Array<{weight: number, count: number, color: string, name: string}>, remainder: number, closestWeight: number}} props.topSetBreakdown - Plate breakdown for top set
 * @param {number} props.reps - Number of reps for top set
 * @param {number} props.weight - Weight for top set
 * @param {string} props.unit - Unit string ("kg" or "lb")
 * @param {number} props.barWeight - Weight of the barbell
 * @param {boolean} props.isMetric - Whether using metric (kg) or imperial (lb)
 * @param {string} props.platePreference - Plate preference ("red" or "blue")
 */
function WarmupSetsDisplay({
  warmupSets,
  topSetBreakdown,
  reps,
  weight,
  unit,
  barWeight,
  isMetric,
  platePreference,
}) {
  if (warmupSets.length === 0) {
    return null;
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Warmup Sets</CardTitle>
        <CardDescription>
          Progressive warmup sets leading to your top set
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Warmup sets: responsive grid (1 col mobile, 2–3 cols desktop) */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {warmupSets.map((set, idx) => {
            const breakdown = calculatePlateBreakdown(
              set.weight,
              barWeight,
              isMetric,
              platePreference,
            );
            return (
              <div
                key={idx}
                className="flex h-full flex-col justify-between gap-3 rounded-lg border p-4"
              >
                <div>
                  <div className="text-lg font-semibold">
                    Set {idx + 1}: {set.reps}@{set.weight}
                    {unit}
                  </div>
                  {set.percentage > 0 && (
                    <div className="text-sm text-muted-foreground">
                      ~{set.percentage}% of top set
                    </div>
                  )}
                  <div className="mt-1 text-sm text-muted-foreground">
                    {formatPlateBreakdown(breakdown, barWeight, isMetric)}
                  </div>
                </div>
                <div className="mt-2 self-end">
                  <PlateDiagram
                    platesPerSide={breakdown.platesPerSide}
                    barWeight={barWeight}
                    isMetric={isMetric}
                  />
                </div>
              </div>
            );
          })}

          {/* Top Set - included in grid with thicker border */}
          <div className="flex h-full flex-col justify-between gap-3 rounded-lg border-4 border-primary p-4">
            <div>
              <div className="text-xl font-bold">
                Top Set: {reps}@{weight}
                {unit}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {formatPlateBreakdown(topSetBreakdown, barWeight, isMetric)}
              </div>
              {topSetBreakdown.remainder !== 0 && (
                <div className="mt-1 text-xs text-muted-foreground">
                  Closest load: {topSetBreakdown.closestWeight}
                  {unit}
                  {topSetBreakdown.remainder > 0
                    ? ` (+${topSetBreakdown.remainder.toFixed(2)}${unit})`
                    : ` (${topSetBreakdown.remainder.toFixed(2)}${unit})`}
                </div>
              )}
            </div>
            <div className="mt-2 self-end">
              <PlateDiagram
                platesPerSide={topSetBreakdown.platesPerSide}
                barWeight={barWeight}
                isMetric={isMetric}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
