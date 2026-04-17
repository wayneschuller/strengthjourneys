import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useReadLocalStorage } from "usehooks-ts";
import { NextSeo } from "next-seo";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ReferenceLine,
} from "recharts";
import {
  Copy,
  CircleDashed,
  Calculator,
  BicepsFlexed,
  Trophy,
  LineChart as LineChartIcon,
  Anvil,
  Sparkles,
  RotateCcw,
} from "lucide-react";

import { RelatedArticles } from "@/components/article-cards";
import { AthleteBioInlineSettings } from "@/components/athlete-bio-quick-settings";
import { GoogleSignInButton } from "@/components/onboarding/google-sign-in";
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
import { estimateE1RM } from "@/lib/estimate-e1rm";
import { getRatingBadgeVariant } from "@/lib/strength-level-ui";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
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
    svg: "/back_squat.svg",
    standardKey: "Back Squat",
  },
  {
    key: "bench",
    label: "Bench Press",
    svg: "/bench_press.svg",
    standardKey: "Bench Press",
  },
  {
    key: "deadlift",
    label: "Deadlift",
    svg: "/deadlift.svg",
    standardKey: "Deadlift",
  },
];

const LIFT_INSIGHT_URLS = {
  "Back Squat": "/calculator/squat-1rm-calculator",
  "Bench Press": "/calculator/bench-press-1rm-calculator",
  Deadlift: "/calculator/deadlift-1rm-calculator",
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
    IconComponent: LineChartIcon,
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
  const { data: session, status: authStatus } = useSession();
  const {
    topLiftsByTypeAndReps,
    topLiftsByTypeAndRepsLast12Months,
    parsedData,
    isReturningUserLoading,
    isDemoMode,
    hasUserData,
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

  // Auto-populate sliders from user's actual best E1RMs (skip demo data)
  useEffect(() => {
    if (hasAutoPopulatedRef.current || !topLiftsByTypeAndReps || isDemoMode) return;

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
  }, [topLiftsByTypeAndReps, isDemoMode]);

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

  // Recent 90-day best E1RM per lift — raw kg (for reset) and display units (for markers)
  const recent90dKgRef = useRef(null);
  const recent90dDisplay = useMemo(() => {
    if (!usingUserData || !parsedData?.length || isDemoMode) return null;

    const SBD_TYPES = { "Back Squat": "squat", "Bench Press": "bench", Deadlift: "deadlift" };
    const cutoffDate = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);

    const bestKg = { squat: 0, bench: 0, deadlift: 0 };

    for (const d of parsedData) {
      const k = SBD_TYPES[d.liftType];
      if (!k || d.isGoal || d.reps <= 0 || d.weight <= 0) continue;
      if (d.date < cutoffDate) continue;
      const wKg = d.unitType === "kg" ? d.weight : d.weight / 2.2046;
      const e1rm = d.reps === 1 ? wKg : estimateE1RM(d.reps, wKg, "Brzycki");
      if (e1rm > bestKg[k]) bestKg[k] = e1rm;
    }

    const pr = prWeightsKgRef.current;
    if (!pr) return null;

    // Store raw kg for reset handler
    recent90dKgRef.current = {
      squat: bestKg.squat > 0 ? bestKg.squat : null,
      bench: bestKg.bench > 0 ? bestKg.bench : null,
      deadlift: bestKg.deadlift > 0 ? bestKg.deadlift : null,
    };

    const result = {};
    let hasDistinct = false;
    for (const k of ["squat", "bench", "deadlift"]) {
      if (bestKg[k] <= 0) { result[k] = null; continue; }
      const displayVal = normalizeLiftWeight(convertWeight(bestKg[k], true, isMetric), isMetric);
      const prDisplay = pr[k] != null ? normalizeLiftWeight(convertWeight(pr[k], true, isMetric), isMetric) : null;
      if (displayVal !== prDisplay) hasDistinct = true;
      result[k] = displayVal;
    }

    return hasDistinct ? result : null;
  }, [usingUserData, parsedData, isDemoMode, isMetric]);

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

  const handleResetToPRs = () => {
    if (prWeightsKgRef.current) setLiftWeightsKg({ ...prWeightsKgRef.current });
  };

  const handleResetTo90d = () => {
    const r90 = recent90dKgRef.current;
    if (!r90) return;
    setLiftWeightsKg((prev) => ({
      squat: r90.squat ?? prev.squat,
      bench: r90.bench ?? prev.bench,
      deadlift: r90.deadlift ?? prev.deadlift,
    }));
  };

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

  // User's preferred E1RM formula from localStorage
  const storedFormula = useReadLocalStorage(LOCAL_STORAGE_KEYS.FORMULA, { initializeWithValue: false });
  const e1rmFormula = storedFormula ?? "Brzycki";

  // Compute percentile timeline from training history
  const percentileTimeline = useMemo(() => {
    if (!usingUserData || !parsedData?.length || isDemoMode) return null;

    const SBD_TYPES = { "Back Squat": "squat", "Bench Press": "bench", Deadlift: "deadlift" };
    const WINDOW_DAYS = 90;

    // Filter to SBD lifts, convert weights to kg, sort by date
    const sbdEntries = parsedData
      .filter((d) => SBD_TYPES[d.liftType] && !d.isGoal && d.reps > 0 && d.weight > 0)
      .map((d) => ({
        date: d.date,
        key: SBD_TYPES[d.liftType],
        weightKg: d.unitType === "kg" ? d.weight : d.weight / 2.2046,
        reps: d.reps,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    if (sbdEntries.length < 2) return null;

    const firstDate = new Date(sbdEntries[0].date);
    const lastDate = new Date(sbdEntries[sbdEntries.length - 1].date);
    const spanDays = (lastDate - firstDate) / 86400000;

    // Decide sample interval based on career length
    let intervalDays;
    if (spanDays <= 180) intervalDays = 7;        // weekly for < 6mo
    else if (spanDays <= 730) intervalDays = 14;   // biweekly for < 2yr
    else intervalDays = 30;                         // monthly for 2yr+

    // Generate sample dates
    const samples = [];
    const cursor = new Date(firstDate);
    // Start first sample at least 90 days in so we have data to look back on
    cursor.setDate(cursor.getDate() + WINDOW_DAYS);
    while (cursor <= lastDate) {
      samples.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + intervalDays);
    }
    // Always include the final date if not already close
    if (samples.length === 0 || (lastDate - samples[samples.length - 1]) / 86400000 > 7) {
      samples.push(new Date(lastDate));
    }

    if (samples.length < 2) return null;

    const bio = { age, sex, bodyWeightKg };
    const points = [];

    for (const sampleDate of samples) {
      const sampleMs = sampleDate.getTime();
      const cutoff = sampleMs - WINDOW_DAYS * 86400000;

      const bestE1rm = { squat: null, bench: null, deadlift: null };

      for (const key of ["squat", "bench", "deadlift"]) {
        let best = 0;
        for (const entry of sbdEntries) {
          const entryMs = new Date(entry.date).getTime();
          if (entryMs > sampleMs) break;
          if (entryMs < cutoff || entry.key !== key) continue;
          const e1rm = entry.reps === 1
            ? entry.weightKg
            : estimateE1RM(entry.reps, entry.weightKg, e1rmFormula);
          if (e1rm > best) best = e1rm;
        }
        if (best > 0) bestE1rm[key] = best;
      }

      // Need all 3 lifts for SBD total percentile
      if (bestE1rm.squat == null || bestE1rm.bench == null || bestE1rm.deadlift == null) continue;

      const result = computeStrengthResults(bio, bestE1rm);
      const allPcts = result.total?.percentiles;
      if (!allPcts?.["General Population"]) continue;

      points.push({
        date: sampleDate.toISOString().slice(0, 10),
        ...allPcts,
      });
    }

    return points.length >= 2 ? points : null;
  }, [usingUserData, parsedData, isDemoMode, age, sex, bodyWeightKg, e1rmFormula]);

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

          <div className="mt-5 flex flex-col items-center gap-6 lg:flex-row lg:items-start lg:gap-10">
            <div className="flex w-full max-w-sm flex-col items-center gap-4 lg:order-1 lg:flex-1 lg:max-w-none">
              <div className="w-full max-w-lg xl:max-w-xl">
                <StrengthCirclesChart
                  percentiles={chartPercentiles}
                  activeUniverse={activeUniverse}
                  onUniverseChange={setSelectedUniverse}
                  onUniverseHoverChange={setHoveredUniverse}
                />
              </div>
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

            <div className="w-full max-w-md shrink-0 lg:order-2 lg:max-w-md xl:max-w-lg">
              <LiftSliders
                liftWeights={liftWeights}
                onChange={handleLiftChange}
                onReset={handleResetToPRs}
                onResetTo90d={handleResetTo90d}
                isMetric={isMetric}
                usingUserData={usingUserData}
                authStatus={authStatus}
                isReturningUserLoading={isReturningUserLoading}
                prWeights={prWeightsDisplay}
                recent90d={recent90dDisplay}
                results={results}
                activeUniverse={activeUniverse}
                userStoryData={hasUserData ? userStoryData : null}
                chartPercentiles={chartPercentiles}
                percentileTimeline={percentileTimeline}
                firstName={session?.user?.name?.split(" ")[0]}
              />
            </div>
          </div>

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

// Ideal SBD proportions (% of total) — consensus from powerlifting averages.
const IDEAL_SBD_RATIO = { squat: 0.36, bench: 0.24, deadlift: 0.40 };
const LIFT_LABELS_SHORT = { squat: "Squat", bench: "Bench", deadlift: "Deadlift" };

function getWeakestLiftHint(squat, bench, deadlift) {
  const total = squat + bench + deadlift;
  if (total === 0) return null;
  const gaps = {
    squat: IDEAL_SBD_RATIO.squat * total - squat,
    bench: IDEAL_SBD_RATIO.bench * total - bench,
    deadlift: IDEAL_SBD_RATIO.deadlift * total - deadlift,
  };
  const worst = Object.entries(gaps).reduce(
    (best, [k, v]) => (v > best.gap ? { key: k, gap: v } : best),
    { key: null, gap: 0 },
  );
  if (!worst.key || worst.gap < 5) return null;
  return { lift: LIFT_LABELS_SHORT[worst.key], gap: Math.round(worst.gap) };
}

function LiftSliders({ liftWeights, onChange, onReset, onResetTo90d, isMetric, usingUserData, authStatus, isReturningUserLoading, prWeights, recent90d, results, activeUniverse, userStoryData, chartPercentiles, percentileTimeline, firstName }) {
  const unit = isMetric ? "kg" : "lb";
  const min = isMetric ? 20 : 44;
  const max = isMetric ? 300 : 660;
  const step = isMetric ? 2.5 : 5;

  const showSignInTeaser =
    authStatus === "unauthenticated" && !isReturningUserLoading;

  // Show reset button when any slider has moved away from its PR value
  const hasMovedFromPR = usingUserData && prWeights && LIFTS.some(
    ({ key }) => prWeights[key] != null && liftWeights[key] !== prWeights[key],
  );

  const hasMovedFrom90d = usingUserData && recent90d && LIFTS.some(
    ({ key }) => recent90d[key] != null && liftWeights[key] !== recent90d[key],
  );

  const biggestOpportunity = usingUserData
    ? getWeakestLiftHint(liftWeights.squat, liftWeights.bench, liftWeights.deadlift)
    : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Your Lifts
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {hasMovedFromPR && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-xs text-muted-foreground"
                onClick={onReset}
              >
                <RotateCcw className="h-3 w-3" />
                Reset to PRs
              </Button>
            )}
            {hasMovedFrom90d && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-xs text-muted-foreground"
                onClick={onResetTo90d}
              >
                <RotateCcw className="h-3 w-3" />
                Reset to 90-day bests
              </Button>
            )}
            {usingUserData && !hasMovedFromPR && !hasMovedFrom90d && (
              <Badge variant="outline" className="gap-1 text-xs font-normal">
                <Sparkles className="h-3 w-3" />
                From your log
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {LIFTS.map(({ key, label, svg }) => {
          const prWeight = prWeights?.[key];
          const r90Weight = recent90d?.[key];
          const prPercent = prWeight != null
            ? ((prWeight - min) / (max - min)) * 100
            : null;
          const r90Percent = r90Weight != null
            ? ((r90Weight - min) / (max - min)) * 100
            : null;
          const showPrMarker = usingUserData && prPercent != null && prPercent >= 0 && prPercent <= 100;
          const showR90Marker = usingUserData && r90Percent != null && r90Percent >= 0 && r90Percent <= 100 && r90Weight !== prWeight;

          const liftResult = results?.lifts[key];
          const rating = liftResult?.standard
            ? getStrengthRatingForE1RM(toKg(liftWeights[key], isMetric), liftResult.standard)
            : null;

          return (
            <div key={key} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <img src={svg} alt="" className="h-10 w-10 dark:invert" aria-hidden />
                  <Link
                    href={LIFT_INSIGHT_URLS[label]}
                    className="underline decoration-dotted underline-offset-2 hover:text-blue-600"
                  >
                    {label}
                  </Link>
                </div>
                <div className="flex items-center gap-2">
                  {rating && (
                    <Badge
                      variant={getRatingBadgeVariant(rating)}
                      className="text-xs"
                    >
                      {STRENGTH_LEVEL_EMOJI[rating]} {rating}
                    </Badge>
                  )}
                  <span className="text-sm font-bold tabular-nums">
                    {liftWeights[key]}
                    <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                      {unit}
                    </span>
                  </span>
                </div>
              </div>
              <div className="relative pb-6">
                <Slider
                  value={[liftWeights[key]]}
                  onValueChange={([value]) => {
                    // Snap to PR or 90d marker when within 1 step
                    if (prWeight != null && Math.abs(value - prWeight) <= step) {
                      onChange(key, prWeight);
                    } else if (r90Weight != null && Math.abs(value - r90Weight) <= step) {
                      onChange(key, r90Weight);
                    } else {
                      onChange(key, value);
                    }
                  }}
                  min={min}
                  max={max}
                  step={step}
                  aria-label={`${label} 1RM`}
                />
                {showPrMarker && (
                  <div
                    className="pointer-events-none absolute bottom-0 flex flex-col items-center"
                    style={{ left: `${prPercent}%`, transform: "translateX(-50%)" }}
                  >
                    <div className="h-3 w-px bg-primary/40" />
                    <span className="text-[9px] font-medium leading-none text-primary/60">
                      PR
                    </span>
                  </div>
                )}
                {showR90Marker && (
                  <div
                    className="pointer-events-none absolute bottom-0 flex flex-col items-center"
                    style={{ left: `${r90Percent}%`, transform: "translateX(-50%)" }}
                  >
                    <div className="h-3 w-px bg-amber-500/40" />
                    <span className="text-[9px] font-medium leading-none text-amber-600/60">
                      90d
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {results?.hasAllThree && results.total && (
          <>
            <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span className="text-muted-foreground">SBD Total</span>
              <span className="font-bold tabular-nums">
                {ordinal(results.total.percentiles?.[activeUniverse])}
              </span>
            </div>
            <PercentileConclusion
              percentile={results.total.percentiles?.[activeUniverse]}
              universe={activeUniverse}
              allPercentiles={results.total.percentiles}
              firstName={firstName}
            />
          </>
        )}

        {/* Strength Story — inline for authenticated users */}
        {userStoryData && (
          <StrengthStorySummary
            storyData={userStoryData}
            chartPercentiles={chartPercentiles}
            isMetric={isMetric}
            percentileTimeline={percentileTimeline}
            activeUniverse={activeUniverse}
            firstName={firstName}
          />
        )}

        {/* Sign-in teaser for unauthenticated users */}
        {showSignInTeaser && (
          <div className="rounded-lg border border-dashed p-3">
            <p className="mb-2 text-sm font-medium">Your Strength Story</p>
            <p className="mb-2 text-sm text-muted-foreground">
              Sign in to auto-fill from your training PRs, see career stats,
              and track how your strength has changed over time.
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


function PercentileConclusion({ percentile, universe, allPercentiles, firstName }) {
  if (percentile == null) return null;

  const name = firstName || "You";
  const namePos = firstName ? `${firstName}'s` : "Your";
  const u = universe.toLowerCase();

  let headline;
  let detail;

  if (percentile >= 95) {
    headline = `Elite territory${firstName ? `, ${firstName}` : ""}.`;
    detail = `Stronger than ${percentile}% of ${u}. Very few people reach this level \u2014 years of serious, consistent training got ${name.toLowerCase() === "you" ? "you" : firstName} here.`;
  } else if (percentile >= 85) {
    headline = "Seriously strong.";
    detail = `${name}'${name.endsWith("s") ? "" : "s"} stronger than ${percentile}% of ${u}. Well past the point where people notice \u2014 this is dedicated-lifter strength.`;
  } else if (percentile >= 70) {
    headline = "Above average, clearly trained.";
    detail = `Stronger than ${percentile}% of ${u}. ${namePos} training is paying off \u2014 most people who lift don\u2019t reach this range.`;
  } else if (percentile >= 50) {
    headline = "Solid foundation.";
    detail = `Stronger than ${percentile}% of ${u}. Right in the middle of the pack, with real room to grow. Consistency will move this number.`;
  } else if (percentile >= 30) {
    headline = "Building momentum.";
    detail = `Stronger than ${percentile}% of ${u}. Everyone starts somewhere, and the biggest jumps happen in this range. Keep showing up.`;
  } else {
    headline = "Early days \u2014 big gains ahead.";
    detail = `Stronger than ${percentile}% of ${u}. The good news? Beginners progress faster than anyone. A few months of consistent work will change this dramatically.`;
  }

  // Add cross-universe context when viewing a universe other than the one shown
  const extras = [];
  if (allPercentiles) {
    if (universe !== "General Population" && allPercentiles["General Population"] != null) {
      extras.push(`${ordinal(allPercentiles["General Population"])} percentile in the general population`);
    }
    if (universe !== "Barbell Lifters" && allPercentiles["Barbell Lifters"] != null) {
      extras.push(`${ordinal(allPercentiles["Barbell Lifters"])} among barbell lifters`);
    }
  }

  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2.5">
      <p className="text-sm font-semibold">{headline}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
        {detail}
        {extras.length > 0 && ` ${extras.join(", ")}.`}
      </p>
    </div>
  );
}

function StrengthStorySummary({ storyData, chartPercentiles, isMetric, percentileTimeline, activeUniverse, firstName }) {
  const { careerYears, totalSessions, liftCount, liftStories } = storyData;

  const genPop = chartPercentiles["General Population"];
  const activePercentile = chartPercentiles[activeUniverse] ?? genPop;

  let careerLabel = null;
  if (careerYears != null) {
    if (careerYears >= 1) {
      const years = Math.floor(careerYears);
      careerLabel = `${years}yr${years !== 1 ? "s" : ""}`;
    } else {
      const months = Math.max(1, Math.round(careerYears * 12));
      careerLabel = `${months}mo`;
    }
  }

  // Compute SBD total in display units
  let sbdTotal = null;
  if (liftCount >= 3) {
    const unit = isMetric ? "kg" : "lb";
    const total = Object.values(liftStories).reduce((sum, ls) => {
      const w = ls.unitType === "lb" && isMetric
        ? ls.allTimeE1RM / 2.2046
        : ls.unitType === "kg" && !isMetric
          ? ls.allTimeE1RM * 2.2046
          : ls.allTimeE1RM;
      return sum + Math.round(w);
    }, 0);
    sbdTotal = `${total}${unit}`;
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border-t pt-5">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <Trophy className="h-3.5 w-3.5 text-yellow-500" />
        {firstName ? `${firstName}\u2019s Strength Story` : "Your Strength Story"}
      </p>

      {/* Career headline */}
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          {careerLabel && (
            <span className="text-2xl font-bold tracking-tight">{careerLabel}</span>
          )}
          {totalSessions && (
            <span className="text-lg font-semibold text-muted-foreground">
              {totalSessions.toLocaleString()} sessions
            </span>
          )}
          {sbdTotal && (
            <span className="text-lg font-semibold text-muted-foreground">
              {sbdTotal} SBD
            </span>
          )}
        </div>
      </div>

      {/* Percentile timeline chart */}
      {percentileTimeline && (
        <PercentileTimelineChart
          data={percentileTimeline}
          currentPercentile={activePercentile}
          activeUniverse={activeUniverse}
        />
      )}

    </div>
  );
}

const UNIVERSE_COLORS = {
  "General Population":  "var(--chart-1)",
  "Gym-Goers":           "var(--chart-2)",
  "Barbell Lifters":     "var(--chart-3)",
  "Powerlifting Culture": "var(--chart-4)",
};

function PercentileTimelineChart({ data, currentPercentile, activeUniverse = "General Population" }) {
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
