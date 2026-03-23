import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { NextSeo } from "next-seo";
import {
  Copy,
  CircleDashed,
  Calculator,
  BicepsFlexed,
  Trophy,
  LineChart,
  Anvil,
  Sparkles,
} from "lucide-react";

import { RelatedArticles } from "@/components/article-cards";
import { AthleteBioInlineSettings } from "@/components/athlete-bio-quick-settings";
import { GoogleSignInButton } from "@/components/google-sign-in";
import {
  PageContainer,
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
  PageHeaderRight,
} from "@/components/page-header";
import { StrengthCirclesChart } from "@/components/strength-circles/strength-circles-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import {
  getStrengthRatingForE1RM,
  STRENGTH_LEVEL_EMOJI,
  useAthleteBio,
} from "@/hooks/use-athlete-biodata";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useToast } from "@/hooks/use-toast";
import { fetchRelatedArticles } from "@/lib/sanity-io.js";
import { findBestE1RM } from "@/lib/processing-utils";
import { getRatingBadgeVariant } from "@/lib/strength-level-ui";
import {
  computeStrengthResults,
  UNIVERSES,
} from "@/lib/strength-circles/universe-percentiles";

export async function getStaticProps() {
  const relatedArticles = await fetchRelatedArticles("How Strong Am I?");
  return { props: { relatedArticles }, revalidate: 60 * 60 };
}

const LIFTS = [
  {
    key: "squat",
    label: "Back Squat",
    emoji: "🏋️",
    standardKey: "Back Squat",
  },
  {
    key: "bench",
    label: "Bench Press",
    emoji: "💪",
    standardKey: "Bench Press",
  },
  {
    key: "deadlift",
    label: "Deadlift",
    emoji: "⛓️",
    standardKey: "Deadlift",
  },
];

const LIFT_INSIGHT_URLS = {
  "Back Squat": "/barbell-squat-insights",
  "Bench Press": "/barbell-bench-press-insights",
  Deadlift: "/barbell-deadlift-insights",
};

const NEXT_TOOL_LINKS = [
  {
    href: "/strength-levels",
    title: "Strength Levels",
    description: "Check beginner-to-elite benchmarks for each lift.",
    IconComponent: BicepsFlexed,
  },
  {
    href: "/calculator",
    title: "E1RM Calculator",
    description: "Estimate your one-rep max from a recent work set.",
    IconComponent: Calculator,
  },
  {
    href: "/1000lb-club-calculator",
    title: "1000lb Club Calculator",
    description: "See how your squat, bench, and deadlift total stacks up.",
    IconComponent: Anvil,
  },
  {
    href: "/lift-explorer",
    title: "Lift Explorer",
    description: "Review PRs, consistency, and milestones across your training.",
    IconComponent: Trophy,
  },
  {
    href: "/visualizer",
    title: "Strength Visualizer",
    description: "Chart each lift over time and spot long-term trends.",
    IconComponent: LineChart,
  },
];

const CANONICAL = "https://www.strengthjourneys.xyz/how-strong-am-i";
const TITLE = "How Strong Am I? Strength Percentile Calculator";
const DESCRIPTION =
  "Compare your squat, bench press, and deadlift to the general population, gym-goers, barbell lifters, and competitive powerlifters. Free strength percentile calculator — no login required.";

export default function HowStrongAmIPage({ relatedArticles }) {
  return (
    <>
      <NextSeo
        title={TITLE}
        description={DESCRIPTION}
        canonical={CANONICAL}
        openGraph={{
          url: CANONICAL,
          title: TITLE,
          description: DESCRIPTION,
          type: "website",
        }}
        additionalMetaTags={[
          {
            name: "keywords",
            content:
              "how strong am i, how strong am i calculator, strength percentile calculator, e1rm percentile, strength ranking, strength standards percentile, powerlifting percentile",
          },
        ]}
      />
      <HowStrongAmIPageMain />
      {relatedArticles?.length > 0 && (
        <RelatedArticles articles={relatedArticles} />
      )}
    </>
  );
}

function HowStrongAmIPageMain() {
  const { age, sex, bodyWeight, isMetric, toggleIsMetric } = useAthleteBio();
  const { toast } = useToast();
  const { status: authStatus } = useSession();
  const {
    topLiftsByTypeAndReps,
    topLiftsByTypeAndRepsLast12Months,
    parsedData,
    isReturningUserLoading,
  } = useUserLiftingData();

  const [liftWeightsKg, setLiftWeightsKg] = useState(() => ({
    squat: toKg(225, false),
    bench: toKg(155, false),
    deadlift: toKg(265, false),
  }));

  // Track whether we've auto-populated from user data
  const [usingUserData, setUsingUserData] = useState(false);
  const hasAutoPopulatedRef = useRef(false);
  const prWeightsKgRef = useRef(null);

  // Auto-populate sliders from user's actual best E1RMs
  useEffect(() => {
    if (hasAutoPopulatedRef.current || !topLiftsByTypeAndReps) return;

    const squat = findBestE1RM("Back Squat", topLiftsByTypeAndReps, "Brzycki");
    const bench = findBestE1RM("Bench Press", topLiftsByTypeAndReps, "Brzycki");
    const deadlift = findBestE1RM("Deadlift", topLiftsByTypeAndReps, "Brzycki");

    // Only auto-populate if we found at least one lift
    if (!squat.bestE1RMWeight && !bench.bestE1RMWeight && !deadlift.bestE1RMWeight) return;

    hasAutoPopulatedRef.current = true;

    const toKgFromUnit = (weight, unitType) =>
      unitType === "kg" ? weight : weight / 2.2046;

    const weights = {
      squat: squat.bestE1RMWeight
        ? toKgFromUnit(squat.bestE1RMWeight, squat.unitType)
        : toKg(225, false),
      bench: bench.bestE1RMWeight
        ? toKgFromUnit(bench.bestE1RMWeight, bench.unitType)
        : toKg(155, false),
      deadlift: deadlift.bestE1RMWeight
        ? toKgFromUnit(deadlift.bestE1RMWeight, deadlift.unitType)
        : toKg(265, false),
    };

    // Remember original PR positions for marker labels
    prWeightsKgRef.current = {
      squat: squat.bestE1RMWeight ? toKgFromUnit(squat.bestE1RMWeight, squat.unitType) : null,
      bench: bench.bestE1RMWeight ? toKgFromUnit(bench.bestE1RMWeight, bench.unitType) : null,
      deadlift: deadlift.bestE1RMWeight ? toKgFromUnit(deadlift.bestE1RMWeight, deadlift.unitType) : null,
    };

    setLiftWeightsKg(weights);
    setUsingUserData(true);
  }, [topLiftsByTypeAndReps]);

  // PR weights in display units for slider markers
  const prWeightsDisplay = useMemo(() => {
    const raw = prWeightsKgRef.current;
    if (!raw) return null;
    return {
      squat: raw.squat != null ? normalizeLiftWeight(convertWeight(raw.squat, true, isMetric), isMetric) : null,
      bench: raw.bench != null ? normalizeLiftWeight(convertWeight(raw.bench, true, isMetric), isMetric) : null,
      deadlift: raw.deadlift != null ? normalizeLiftWeight(convertWeight(raw.deadlift, true, isMetric), isMetric) : null,
    };
  }, [isMetric, usingUserData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute enriched user story data (career span, last-year comparison)
  const userStoryData = useMemo(() => {
    if (!usingUserData || !topLiftsByTypeAndReps) return null;

    const allTimeLookup = { squat: "Back Squat", bench: "Bench Press", deadlift: "Deadlift" };
    const liftStories = {};

    for (const [key, liftType] of Object.entries(allTimeLookup)) {
      const allTime = findBestE1RM(liftType, topLiftsByTypeAndReps, "Brzycki");
      const lastYear = topLiftsByTypeAndRepsLast12Months
        ? findBestE1RM(liftType, topLiftsByTypeAndRepsLast12Months, "Brzycki")
        : null;

      if (!allTime.bestE1RMWeight) continue;

      liftStories[key] = {
        allTimeE1RM: Math.round(allTime.bestE1RMWeight),
        lastYearE1RM: lastYear?.bestE1RMWeight ? Math.round(lastYear.bestE1RMWeight) : null,
        unitType: allTime.unitType,
        prDate: allTime.bestLift?.date,
      };
    }

    // Career span from parsedData
    let careerYears = null;
    if (parsedData?.length > 1) {
      const oldest = parsedData[0]?.date;
      const newest = parsedData[parsedData.length - 1]?.date;
      if (oldest && newest) {
        const diffMs = new Date(newest) - new Date(oldest);
        const diffYears = diffMs / (1000 * 60 * 60 * 24 * 365.25);
        careerYears = diffYears;
      }
    }

    // Total sessions (unique dates)
    let totalSessions = null;
    if (parsedData?.length) {
      const dates = new Set(parsedData.filter((d) => !d.isGoal).map((d) => d.date));
      totalSessions = dates.size;
    }

    return {
      liftStories,
      careerYears,
      totalSessions,
      liftCount: Object.keys(liftStories).length,
    };
  }, [usingUserData, topLiftsByTypeAndReps, topLiftsByTypeAndRepsLast12Months, parsedData]);

  const [selectedUniverse, setSelectedUniverse] = useState("General Population");
  const [hoveredUniverse, setHoveredUniverse] = useState(null);

  const liftWeights = useMemo(
    () => convertLiftWeights(liftWeightsKg, true, isMetric),
    [liftWeightsKg, isMetric],
  );

  const handleLiftChange = (key, value) =>
    setLiftWeightsKg((prev) => ({ ...prev, [key]: toKg(value, isMetric) }));

  const handleUnitSwitch = (nextIsMetric) => {
    toggleIsMetric(nextIsMetric);
  };

  const activeUniverse = hoveredUniverse ?? selectedUniverse;
  const bodyWeightKg = toKg(bodyWeight, isMetric);

  const results = useMemo(
    () => computeStrengthResults({ age, sex, bodyWeightKg }, liftWeightsKg),
    [age, sex, bodyWeightKg, liftWeightsKg],
  );

  const chartPercentiles = useMemo(() => {
    const out = {};

    for (const universe of UNIVERSES) {
      const values = LIFTS.map(
        ({ key }) => results.lifts[key]?.percentiles?.[universe],
      ).filter((value) => value != null);

      out[universe] = values.length
        ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
        : 0;
    }

    return out;
  }, [results]);

  const handleShare = () => {
    const percentile = chartPercentiles[activeUniverse];
    const text = `I'm stronger than ${percentile}% of ${activeUniverse.toLowerCase()} — Strength Journeys: How Strong Am I? ${CANONICAL}`;

    navigator.clipboard
      .writeText(text)
      .then(() =>
        toast({ title: "Copied!", description: "Result copied to clipboard." }),
      )
      .catch(() =>
        toast({
          title: "Copy failed",
          description: "Try selecting the text manually.",
          variant: "destructive",
        }),
      );
  };

  return (
    <PageContainer>
      <PageHeader>
        <PageHeaderHeading icon={CircleDashed}>How Strong Am I?</PageHeaderHeading>
        <PageHeaderDescription>
          Strength Percentile Calculator — see how you rank across four groups,
          from the general population to competitive powerlifters.
        </PageHeaderDescription>
        <PageHeaderRight>
          <div className="hidden gap-2 text-muted-foreground md:flex md:flex-col xl:flex-row">
            <Link
              href="/strength-levels"
              className="block rounded-lg border p-4 shadow-sm transition-shadow hover:bg-muted hover:shadow-md"
            >
              <h3 className="text-base font-semibold">
                Strength Levels
              </h3>
              <p className="text-sm">
                Check beginner-to-elite benchmarks per lift.
              </p>
            </Link>
            <Link
              href="/calculator"
              className="block rounded-lg border p-4 shadow-sm transition-shadow hover:bg-muted hover:shadow-md"
            >
              <h3 className="text-base font-semibold">E1RM Calculator</h3>
              <p className="text-sm">Estimate your one rep max from any set.</p>
            </Link>
          </div>
        </PageHeaderRight>
      </PageHeader>

      <Card className="mt-4">
        <CardContent className="pt-5">
          <div className="flex justify-center">
            <AthleteBioInlineSettings
              defaultBioPrompt="Enter your details for personalised percentiles."
              onUnitChange={handleUnitSwitch}
            />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_minmax(0,420px)_1fr] lg:items-start lg:gap-8">
            <div className="order-2 lg:order-none">
              <LiftSliders
                liftWeights={liftWeights}
                onChange={handleLiftChange}
                isMetric={isMetric}
                usingUserData={usingUserData}
                authStatus={authStatus}
                isReturningUserLoading={isReturningUserLoading}
                prWeights={prWeightsDisplay}
              />
            </div>

            <div className="order-1 flex flex-col items-center gap-4 lg:order-none">
              <StrengthCirclesChart
                percentiles={chartPercentiles}
                activeUniverse={activeUniverse}
                onUniverseChange={setSelectedUniverse}
                onUniverseHoverChange={setHoveredUniverse}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
                className="gap-2"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy result
              </Button>
            </div>

            <div className="order-3 lg:order-none">
              <LiftBreakdown
                results={results}
                activeUniverse={activeUniverse}
                liftWeights={liftWeights}
                isMetric={isMetric}
              />
            </div>
          </div>

          {authStatus === "authenticated" && userStoryData ? (
            <YourStrengthStory
              storyData={userStoryData}
              chartPercentiles={chartPercentiles}
              isMetric={isMetric}
            />
          ) : authStatus === "unauthenticated" && !isReturningUserLoading ? (
            <StrengthStoryTeaser />
          ) : null}

          <section className="mx-auto mt-10 max-w-2xl lg:max-w-4xl">
            <ExplainerSection />
            <FAQSection />
          </section>
        </CardContent>
      </Card>

      <NextToolsSection />
    </PageContainer>
  );
}

function toKg(weight, isMetric) {
  return isMetric ? weight : weight / 2.2046;
}

function convertWeight(weight, fromMetric, toMetric) {
  if (fromMetric === toMetric) return weight;
  return toMetric ? weight / 2.2046 : weight * 2.2046;
}

function roundToStep(value, step) {
  return Math.round(value / step) * step;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeLiftWeight(weight, isMetric) {
  const min = isMetric ? 20 : 44;
  const max = isMetric ? 300 : 660;
  const step = isMetric ? 2.5 : 5;

  return clamp(roundToStep(weight, step), min, max);
}

function convertLiftWeights(liftWeights, fromMetric, toMetric) {
  return {
    squat: normalizeLiftWeight(
      convertWeight(liftWeights.squat, fromMetric, toMetric),
      toMetric,
    ),
    bench: normalizeLiftWeight(
      convertWeight(liftWeights.bench, fromMetric, toMetric),
      toMetric,
    ),
    deadlift: normalizeLiftWeight(
      convertWeight(liftWeights.deadlift, fromMetric, toMetric),
      toMetric,
    ),
  };
}

function ordinal(n) {
  if (n == null) return "—";

  const suffixes = ["th", "st", "nd", "rd"];
  const value = n % 100;

  return n + (suffixes[(value - 20) % 10] || suffixes[value] || suffixes[0]);
}

function LiftSliders({ liftWeights, onChange, isMetric, usingUserData, authStatus, isReturningUserLoading, prWeights }) {
  const unit = isMetric ? "kg" : "lb";
  const min = isMetric ? 20 : 44;
  const max = isMetric ? 300 : 660;
  const step = isMetric ? 2.5 : 5;

  const showSignInTeaser =
    authStatus === "unauthenticated" && !isReturningUserLoading;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Your Lifts
          </CardTitle>
          {usingUserData && (
            <Badge variant="outline" className="gap-1 text-xs font-normal">
              <Sparkles className="h-3 w-3" />
              From your log
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {LIFTS.map(({ key, label, emoji }) => {
          const prWeight = prWeights?.[key];
          const prPercent = prWeight != null
            ? ((prWeight - min) / (max - min)) * 100
            : null;
          const showMarker = usingUserData && prPercent != null && prPercent >= 0 && prPercent <= 100;

          return (
            <div key={key} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <span>{emoji}</span>
                  <Link
                    href={LIFT_INSIGHT_URLS[label]}
                    className="underline decoration-dotted underline-offset-2 hover:text-blue-600"
                  >
                    {label}
                  </Link>
                </div>
                <span className="text-sm font-bold tabular-nums">
                  {liftWeights[key]}
                  <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                    {unit}
                  </span>
                </span>
              </div>
              <div className="relative">
                <Slider
                  value={[liftWeights[key]]}
                  onValueChange={([value]) => onChange(key, value)}
                  min={min}
                  max={max}
                  step={step}
                  aria-label={`${label} 1RM`}
                />
                {showMarker && (
                  <div
                    className="pointer-events-none absolute top-0 flex flex-col items-center"
                    style={{ left: `${prPercent}%`, transform: "translateX(-50%)" }}
                  >
                    <div className="h-2 w-0.5 bg-primary/70" />
                    <span className="mt-0.5 text-[10px] font-semibold leading-none text-primary/70">
                      PR
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {showSignInTeaser && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <p className="mb-2 text-sm text-muted-foreground">
              Sign in to auto-fill these from your actual training PRs.
            </p>
            <GoogleSignInButton
              className="flex items-center gap-2"
              cta="how_strong_am_i"
              iconSize={16}
            >
              Sign In With Google
            </GoogleSignInButton>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LiftBreakdown({ results, activeUniverse, liftWeights, isMetric }) {
  const unit = isMetric ? "kg" : "lb";

  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Per-lift — {activeUniverse}
      </p>
      <div className="flex flex-col gap-1.5">
        {LIFTS.map(({ key, label, emoji }) => {
          const liftResult = results.lifts[key];
          const weight = liftWeights[key];
          const percentile = liftResult?.percentiles?.[activeUniverse];
          const rating = liftResult?.standard
            ? getStrengthRatingForE1RM(toKg(weight, isMetric), liftResult.standard)
            : null;

          return (
            <div
              key={key}
                className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm"
              >
              <div className="min-w-0 flex items-center gap-2">
                <span className="shrink-0">{emoji}</span>
                <Link
                  href={LIFT_INSIGHT_URLS[label]}
                  className="truncate font-medium underline decoration-dotted underline-offset-2 hover:text-blue-600"
                >
                  {label}
                </Link>
                <span className="shrink-0 text-muted-foreground">
                  {weight}
                  {unit}
                </span>
              </div>
              <div className="ml-2 flex shrink-0 items-center gap-2">
                {rating && (
                  <Badge
                    variant={getRatingBadgeVariant(rating)}
                    className="hidden text-xs xl:inline-flex"
                  >
                    {STRENGTH_LEVEL_EMOJI[rating]} {rating}
                  </Badge>
                )}
                <span className="font-semibold tabular-nums">
                  {ordinal(percentile)}
                </span>
              </div>
            </div>
          );
        })}

        {results.hasAllThree && results.total && (
          <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            <span className="text-muted-foreground">SBD Total</span>
            <span className="font-bold tabular-nums">
              {ordinal(results.total.percentiles?.[activeUniverse])}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function StrengthStoryTeaser() {
  return (
    <div className="mx-auto mt-8 max-w-2xl">
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Trophy className="h-5 w-5 text-muted-foreground" />
            Your Strength Story
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Sign in and connect your lifting log to unlock your personal
            strength story — career stats, all-time PRs vs last 12 months, and
            your real percentile rankings filled in automatically.
          </p>
          <GoogleSignInButton
            className="flex w-fit items-center gap-2"
            cta="how_strong_story_teaser"
            iconSize={16}
          >
            Sign In With Google
          </GoogleSignInButton>
        </CardContent>
      </Card>
    </div>
  );
}

function YourStrengthStory({ storyData, chartPercentiles, isMetric }) {
  const { liftStories, careerYears, totalSessions, liftCount } = storyData;

  // Find best universe ranking for the headline
  const barbell = chartPercentiles["Barbell Lifters"];
  const genPop = chartPercentiles["General Population"];

  // Career span label
  let careerLabel = null;
  if (careerYears != null) {
    if (careerYears >= 1) {
      const years = Math.floor(careerYears);
      careerLabel = `${years} year${years !== 1 ? "s" : ""}`;
    } else {
      const months = Math.max(1, Math.round(careerYears * 12));
      careerLabel = `${months} month${months !== 1 ? "s" : ""}`;
    }
  }

  const LIFT_META = {
    squat: { label: "Squat", emoji: "🏋️" },
    bench: { label: "Bench", emoji: "💪" },
    deadlift: { label: "Deadlift", emoji: "⛓️" },
  };

  return (
    <div className="mx-auto mt-8 max-w-2xl">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Your Strength Story
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Headline stat */}
          <p className="text-sm text-muted-foreground">
            {genPop >= 90
              ? `You're stronger than ${genPop}% of the general population. That puts you in rare company.`
              : genPop >= 70
                ? `You're stronger than ${genPop}% of the general population — solidly above average.`
                : `You're stronger than ${genPop}% of the general population. Every percentage point is earned.`}
            {barbell != null && (
              <>
                {" "}Among barbell lifters specifically, you rank in the{" "}
                <span className="font-semibold">{ordinal(barbell)}</span> percentile.
              </>
            )}
          </p>

          {/* Career stats row */}
          {(careerLabel || totalSessions) && (
            <div className="flex flex-wrap gap-4 rounded-lg border bg-background/60 px-4 py-3">
              {careerLabel && (
                <div className="flex flex-col">
                  <span className="text-lg font-bold">{careerLabel}</span>
                  <span className="text-xs text-muted-foreground">of training data</span>
                </div>
              )}
              {totalSessions && (
                <div className="flex flex-col">
                  <span className="text-lg font-bold">{totalSessions.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground">sessions logged</span>
                </div>
              )}
              {liftCount >= 3 && (
                <div className="flex flex-col">
                  <span className="text-lg font-bold">
                    {(() => {
                      const unit = isMetric ? "kg" : "lb";
                      const factor = isMetric ? 1 / 2.2046 : 1;
                      const total = Object.values(liftStories).reduce((sum, ls) => {
                        const w = ls.unitType === "lb" && isMetric
                          ? ls.allTimeE1RM * factor
                          : ls.unitType === "kg" && !isMetric
                            ? ls.allTimeE1RM * 2.2046
                            : ls.allTimeE1RM;
                        return sum + Math.round(w);
                      }, 0);
                      return `${total} ${unit}`;
                    })()}
                  </span>
                  <span className="text-xs text-muted-foreground">estimated SBD total</span>
                </div>
              )}
            </div>
          )}

          {/* Per-lift all-time vs last year */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              All-time vs last 12 months
            </p>
            {Object.entries(liftStories).map(([key, story]) => {
              const meta = LIFT_META[key];
              if (!meta) return null;
              const unit = isMetric
                ? "kg"
                : story.unitType === "kg"
                  ? "lb"
                  : story.unitType;
              const allTime = isMetric && story.unitType === "lb"
                ? Math.round(story.allTimeE1RM / 2.2046)
                : !isMetric && story.unitType === "kg"
                  ? Math.round(story.allTimeE1RM * 2.2046)
                  : story.allTimeE1RM;
              const lastYear = story.lastYearE1RM
                ? isMetric && story.unitType === "lb"
                  ? Math.round(story.lastYearE1RM / 2.2046)
                  : !isMetric && story.unitType === "kg"
                    ? Math.round(story.lastYearE1RM * 2.2046)
                    : story.lastYearE1RM
                : null;

              const diff = lastYear != null ? lastYear - allTime : null;

              return (
                <div
                  key={key}
                  className="rounded-md bg-background/60 px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span>{meta.emoji}</span>
                    <span className="font-medium">{meta.label}</span>
                  </div>
                  <div className="mt-1 flex items-baseline gap-4 pl-7">
                    <span className="tabular-nums text-muted-foreground">
                      {allTime} {unit}
                      <span className="ml-1 text-xs">all-time</span>
                    </span>
                    {lastYear != null && (
                      <span className="tabular-nums">
                        {lastYear} {unit}
                        <span className="ml-1 text-xs text-muted-foreground">12mo</span>
                        {diff != null && diff !== 0 && (
                          <span
                            className={`ml-1 text-xs font-semibold ${diff > 0 ? "text-green-600" : "text-amber-600"}`}
                          >
                            {diff > 0 ? "+" : ""}{diff}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Motivational closer */}
          <p className="text-xs italic text-muted-foreground">
            {careerYears >= 3
              ? "Years of consistency built this. That is the kind of strength that does not fade."
              : careerYears >= 1
                ? "A year or more under the bar — your numbers reflect real commitment."
                : "You are building something. Every session adds to the story."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ExplainerSection() {
  return (
    <div className="rounded-lg border bg-muted/30 p-5">
      <h2 className="mb-2 text-base font-semibold">What these circles mean</h2>
      <p className="text-sm text-muted-foreground">
        Each ring compares you to a different group. As the group gets more
        specialised, the comparison gets tougher — beating 70% of barbell
        lifters is a much harder feat than beating 70% of the general
        population.
      </p>
      <h2 className="mb-2 mt-4 text-base font-semibold">How accurate is this?</h2>
      <p className="text-sm text-muted-foreground">
        These percentiles are estimates anchored to the Kilgore strength
        standards and calibrated against published population distributions.
        They are informed comparisons, not exact rankings. Age adjustments are
        handled automatically by the underlying standards data. If you want to
        compare the same lifts against beginner-to-elite benchmarks, use the{" "}
        <Link
          href="/strength-levels"
          className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
        >
          Strength Levels
        </Link>
        .
      </p>
    </div>
  );
}

const FAQ_ITEMS = [
  {
    q: "What does 'stronger than X%' mean?",
    a: "It means your 1-rep max is higher than that percentage of people in the selected group after adjusting for your sex, age, and bodyweight. The universe changes the comparison pool, not the fact that the result is personalised to you.",
  },
  {
    q: "Which group should I care about?",
    a: "Most people find the Barbell Lifters ring most meaningful. It compares you to a barbell-trained population, while still adjusting for your sex, age, and bodyweight, so it is usually the fairest peer group for strength athletes.",
  },
  {
    q: "How do you estimate percentiles?",
    a: "We use the Kilgore strength standards as anchor points, calibrated by age, sex, and bodyweight, then map your lift into each universe's estimated distribution. So the universes change how tough the comparison is, while your personal profile still shapes the result.",
  },
  {
    q: "Am I being compared to everyone, or only people like me?",
    a: "Only partially to everyone. General Population, Gym-Goers, Barbell Lifters, and Powerlifting Culture describe the broader group, but your percentile is still adjusted for your sex, age, and bodyweight. So you are not being ranked against all men and women combined with no adjustment.",
  },
  {
    q: "Should I enter my true 1RM or an estimate?",
    renderAnswer: (
      <>
        Enter your best 1-rep max. If you only know a recent heavy set, use the{" "}
        <Link
          href="/calculator"
          className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
        >
          One Rep Max Calculator
        </Link>{" "}
        to estimate it first.
      </>
    ),
  },
  {
    q: "Does age matter?",
    a: "Yes. Age is part of the model, alongside sex and bodyweight, so a 55-year-old and a 25-year-old at the same relative strength level can land on similar percentiles within the same universe.",
  },
];

function FAQSection() {
  return (
    <div className="mt-6">
      <h2 className="mb-3 text-base font-semibold">Frequently asked questions</h2>
      <div className="flex flex-col gap-3">
        {FAQ_ITEMS.map(({ q, a, renderAnswer }) => (
          <div key={q} className="rounded-md border p-3">
            <p className="text-sm font-medium">{q}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {renderAnswer || a}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function NextToolsSection() {
  return (
    <section className="mt-10">
      <h2 className="mb-4 text-xl font-semibold">What should you check next?</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {NEXT_TOOL_LINKS.map(({ href, title, description, IconComponent }) => (
          <Link
            key={href}
            href={href}
            className="block rounded-lg border p-4 shadow-sm transition-shadow hover:bg-muted hover:shadow-md"
          >
            <div className="mb-2 flex items-center gap-2">
              <IconComponent className="h-5 w-5" />
              <h3 className="font-semibold">{title}</h3>
            </div>
            <p className="text-sm text-muted-foreground">{description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
