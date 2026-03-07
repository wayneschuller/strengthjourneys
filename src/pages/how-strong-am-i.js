import { useMemo, useState } from "react";
import { NextSeo } from "next-seo";
import { Copy, CircleDashed } from "lucide-react";

import {
  PageContainer,
  PageHeader,
  PageHeaderHeading,
  PageHeaderDescription,
} from "@/components/page-header";
import { AthleteBioInlineSettings } from "@/components/athlete-bio-quick-settings";
import { StrengthCirclesChart } from "@/components/strength-circles/strength-circles-chart";
import { RelatedArticles } from "@/components/article-cards";
import { fetchRelatedArticles } from "@/lib/sanity-io.js";
import {
  computeStrengthResults,
  UNIVERSES,
} from "@/lib/strength-circles/universe-percentiles";
import {
  useAthleteBio,
  getStrengthRatingForE1RM,
  STRENGTH_LEVEL_EMOJI,
} from "@/hooks/use-athlete-biodata";
import { getRatingBadgeVariant } from "@/lib/strength-level-ui";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

// ─── ISR ─────────────────────────────────────────────────────────────────────

export async function getStaticProps() {
  const relatedArticles = await fetchRelatedArticles("Strength Standards");
  return { props: { relatedArticles }, revalidate: 60 * 60 };
}

// ─── Config ───────────────────────────────────────────────────────────────────

const LIFTS = [
  { key: "squat",    label: "Back Squat",  emoji: "🏋️", standardKey: "Back Squat"  },
  { key: "bench",    label: "Bench Press", emoji: "💪", standardKey: "Bench Press" },
  { key: "deadlift", label: "Deadlift",    emoji: "⛓️", standardKey: "Deadlift"    },
];

const CANONICAL = "https://www.strengthjourneys.xyz/how-strong-am-i";

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
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ─── Left column: 3 lift sliders ─────────────────────────────────────────────

function LiftSliders({ liftWeights, onChange, isMetric }) {
  const unit = isMetric ? "kg" : "lb";
  const min  = isMetric ? 20  : 44;
  const max  = isMetric ? 300 : 660;
  const step = isMetric ? 2.5 : 5;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Your Lifts
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {LIFTS.map(({ key, label, emoji }) => (
          <div key={key} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <span>{emoji}</span>
                <span>{label}</span>
              </div>
              <span className="text-sm font-bold tabular-nums">
                {liftWeights[key]}<span className="ml-0.5 text-xs font-normal text-muted-foreground">{unit}</span>
              </span>
            </div>
            <Slider
              value={[liftWeights[key]]}
              onValueChange={([v]) => onChange(key, v)}
              min={min}
              max={max}
              step={step}
              aria-label={`${label} 1RM`}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Right column: per-lift breakdown ────────────────────────────────────────

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
          const weight     = liftWeights[key];
          const percentile = liftResult?.percentiles?.[activeUniverse];
          const rating     = liftResult?.standard
            ? getStrengthRatingForE1RM(toKg(weight, isMetric), liftResult.standard)
            : null;

          return (
            <div
              key={key}
              className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="shrink-0">{emoji}</span>
                <span className="font-medium truncate">{label}</span>
                <span className="text-muted-foreground shrink-0">
                  {weight}{unit}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                {rating && (
                  <Badge
                    variant={getRatingBadgeVariant(rating)}
                    className="hidden text-xs xl:inline-flex"
                  >
                    {STRENGTH_LEVEL_EMOJI[rating]} {rating}
                  </Badge>
                )}
                <span className="tabular-nums font-semibold">
                  {ordinal(percentile)}
                </span>
              </div>
            </div>
          );
        })}

        {results.hasAllThree && results.total && (
          <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            <span className="text-muted-foreground">SBD Total</span>
            <span className="tabular-nums font-bold">
              {ordinal(results.total.percentiles?.[activeUniverse])}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Inner client component ───────────────────────────────────────────────────

function HowStrongAmIPageInner() {
  const { age, sex, bodyWeight, isMetric, toggleIsMetric } = useAthleteBio();
  const { toast } = useToast();

  const [liftWeightsKg, setLiftWeightsKg] = useState(() => ({
    squat: toKg(225, false),
    bench: toKg(155, false),
    deadlift: toKg(265, false),
  }));

  const [selectedUniverse, setSelectedUniverse] = useState("Barbell Lifters");
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

  // Chart rings show average percentile across all three lifts
  const chartPercentiles = useMemo(() => {
    const out = {};
    for (const universe of UNIVERSES) {
      const vals = LIFTS
        .map(({ key }) => results.lifts[key]?.percentiles?.[universe])
        .filter((v) => v != null);
      out[universe] = vals.length
        ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
        : 0;
    }
    return out;
  }, [results]);

  const handleShare = () => {
    const percentile = chartPercentiles[activeUniverse];
    const text = `I'm stronger than ${percentile}% of ${activeUniverse.toLowerCase()} — Strength Journeys: How Strong Am I? ${CANONICAL}`;
    navigator.clipboard
      .writeText(text)
      .then(() => toast({ title: "Copied!", description: "Result copied to clipboard." }))
      .catch(() => toast({ title: "Copy failed", description: "Try selecting the text manually.", variant: "destructive" }));
  };

  return (
    <PageContainer>
      <PageHeader>
        <PageHeaderHeading icon={CircleDashed}>How Strong Am I?</PageHeaderHeading>
        <PageHeaderDescription>
          Strength Percentile Calculator — see how you rank across four groups,
          from the general population to competitive powerlifters.
        </PageHeaderDescription>
      </PageHeader>

      <Card className="mt-4">
        <CardContent className="pt-5">
          {/* Bio strip — full width above grid */}
          <div className="flex justify-center">
            <AthleteBioInlineSettings
              defaultBioPrompt="Enter your details for personalised percentiles."
              onUnitChange={handleUnitSwitch}
            />
          </div>

          {/*
            Desktop: 3-column grid — controls | chart | breakdown
            Mobile:  single column — chart first (order-1), controls second (order-2),
                     breakdown last (order-3)

            The center column is true-center on the page because the outer columns
            are equal-width (1fr each) and the center is auto-width capped at ~420px.
          */}
          <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_minmax(0,420px)_1fr] lg:items-start lg:gap-8">

            {/* ── Col 1: Lift sliders ──────────────────────────────────── */}
            <div className="order-2 lg:order-none">
              <LiftSliders
                liftWeights={liftWeights}
                onChange={handleLiftChange}
                isMetric={isMetric}
              />
            </div>

            {/* ── Col 2: Hero chart + share button ────────────────────── */}
            <div className="order-1 lg:order-none flex flex-col items-center gap-4">
              <StrengthCirclesChart
                percentiles={chartPercentiles}
                activeUniverse={activeUniverse}
                onUniverseChange={setSelectedUniverse}
                onUniverseHoverChange={setHoveredUniverse}
              />
              <Button variant="outline" size="sm" onClick={handleShare} className="gap-2">
                <Copy className="h-3.5 w-3.5" />
                Copy result
              </Button>
            </div>

            {/* ── Col 3: Per-lift breakdown ────────────────────────────── */}
            <div className="order-3 lg:order-none">
              <LiftBreakdown
                results={results}
                activeUniverse={activeUniverse}
                liftWeights={liftWeights}
                isMetric={isMetric}
              />
            </div>
          </div>

          <section className="mt-10 max-w-2xl mx-auto">
            <ExplainerSection />
            <FAQSection />
          </section>
        </CardContent>
      </Card>
    </PageContainer>
  );
}

// ─── Explainer ────────────────────────────────────────────────────────────────

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
        handled automatically by the underlying standards data.
      </p>
    </div>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

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
    a: "Enter your best 1-rep max. If you only know a recent heavy set, use the One Rep Max Calculator to estimate it first.",
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
        {FAQ_ITEMS.map(({ q, a }) => (
          <div key={q} className="rounded-md border p-3">
            <p className="text-sm font-medium">{q}</p>
            <p className="mt-1 text-sm text-muted-foreground">{a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page export ──────────────────────────────────────────────────────────────

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
      <HowStrongAmIPageInner />
      {relatedArticles?.length > 0 && (
        <RelatedArticles articles={relatedArticles} />
      )}
    </>
  );
}
