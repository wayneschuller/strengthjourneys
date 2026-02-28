import { useState, useMemo } from "react";
import { NextSeo } from "next-seo";
import { Copy } from "lucide-react";
import { Trophy } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

function ordinal(n) {
  if (n == null) return "—";
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ─── Per-lift breakdown ───────────────────────────────────────────────────────

function LiftBreakdown({ results, activeUniverse, liftWeights, isMetric }) {
  const unit = isMetric ? "kg" : "lb";

  return (
    <div className="w-full max-w-md">
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Per-lift — {activeUniverse}
      </p>
      <div className="flex flex-col gap-1.5">
        {LIFTS.map(({ key, label, emoji, standardKey }) => {
          const liftResult = results.lifts[key];
          const weight = liftWeights[key];
          const percentile = liftResult?.percentiles?.[activeUniverse];
          const weightKg = toKg(weight, isMetric);
          const rating = liftResult?.standard
            ? getStrengthRatingForE1RM(weightKg, liftResult.standard)
            : null;

          return (
            <div
              key={key}
              className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-2">
                <span>{emoji}</span>
                <span className="font-medium">{label}</span>
                <span className="text-muted-foreground">
                  {weight}{unit}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {rating && (
                  <Badge
                    variant={getRatingBadgeVariant(rating)}
                    className="hidden text-xs sm:inline-flex"
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

        {/* SBD total row — only when all three lifts produce results */}
        {results.hasAllThree && results.total && (
          <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            <span className="font-medium text-muted-foreground">SBD Total</span>
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
  const { age, sex, bodyWeight, isMetric } = useAthleteBio();
  const { toast } = useToast();
  const unit = isMetric ? "kg" : "lb";

  // Track weights for all three lifts independently (display units)
  const [liftWeights, setLiftWeights] = useState({
    squat:    isMetric ? 100 : 225,
    bench:    isMetric ? 70  : 155,
    deadlift: isMetric ? 120 : 265,
  });

  // Which lift the slider is currently editing
  const [selectedLiftKey, setSelectedLiftKey] = useState("squat");

  // Default active ring = Barbell Lifters (most relevant to our audience)
  const [activeUniverse, setActiveUniverse] = useState("Barbell Lifters");

  const sliderMin  = isMetric ? 20  : 44;
  const sliderMax  = isMetric ? 300 : 660;
  const sliderStep = isMetric ? 2.5 : 5;

  const bodyWeightKg = toKg(bodyWeight, isMetric);

  // All lift weights in kg for computation
  const liftKgs = useMemo(() => ({
    squat:    toKg(liftWeights.squat,    isMetric),
    bench:    toKg(liftWeights.bench,    isMetric),
    deadlift: toKg(liftWeights.deadlift, isMetric),
  }), [liftWeights, isMetric]);

  const results = useMemo(
    () => computeStrengthResults({ age, sex, bodyWeightKg }, liftKgs),
    [age, sex, bodyWeightKg, liftKgs],
  );

  // Chart rings show average percentile across all three lifts per universe
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

  const currentWeight = liftWeights[selectedLiftKey];

  const handleSlider = ([v]) =>
    setLiftWeights((prev) => ({ ...prev, [selectedLiftKey]: v }));

  // Share: copy a short text summary to clipboard
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
        <PageHeaderHeading icon={Trophy}>How Strong Am I?</PageHeaderHeading>
        <PageHeaderDescription>
          Strength Percentile Calculator — see how you rank across four groups,
          from the general population to competitive powerlifters.
        </PageHeaderDescription>
      </PageHeader>

      <div className="mt-4 flex flex-col items-center gap-5">
        {/* Bio strip */}
        <AthleteBioInlineSettings
          defaultBioPrompt="Enter your details for personalised percentiles."
          autoOpenWhenDefault={true}
        />

        {/* ── HERO: chart ──────────────────────────────────────────────── */}
        <div className="w-full max-w-md">
          <StrengthCirclesChart
            percentiles={chartPercentiles}
            activeUniverse={activeUniverse}
            onUniverseChange={setActiveUniverse}
          />
        </div>

        {/* ── Lift input: dropdown + slider ────────────────────────────── */}
        <div className="w-full max-w-md rounded-xl border bg-card p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <Select value={selectedLiftKey} onValueChange={setSelectedLiftKey}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LIFTS.map(({ key, label, emoji }) => (
                  <SelectItem key={key} value={key}>
                    {emoji} {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold tabular-nums leading-none">
                {currentWeight}
              </span>
              <span className="text-sm text-muted-foreground">{unit} 1RM</span>
            </div>
          </div>

          <Slider
            value={[currentWeight]}
            onValueChange={handleSlider}
            min={sliderMin}
            max={sliderMax}
            step={sliderStep}
          />

          <p className="mt-2 text-xs text-muted-foreground">
            Switch the dropdown to set each lift. Results update live.
          </p>
        </div>

        {/* ── Per-lift breakdown ────────────────────────────────────────── */}
        <LiftBreakdown
          results={results}
          activeUniverse={activeUniverse}
          liftWeights={liftWeights}
          isMetric={isMetric}
        />

        {/* ── Share button ──────────────────────────────────────────────── */}
        <Button variant="outline" onClick={handleShare} className="gap-2">
          <Copy className="h-4 w-4" />
          Copy result
        </Button>
      </div>

      <section className="mt-12 max-w-2xl">
        <ExplainerSection />
        <FAQSection />
      </section>
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
    a: "It means your 1-rep max is higher than that percentage of people in the selected group, adjusted for your bodyweight and age.",
  },
  {
    q: "Which group should I care about?",
    a: "Most people find the Barbell Lifters ring most meaningful — it compares you to people who specifically train with a barbell, the fairest peer group for strength athletes.",
  },
  {
    q: "How do you estimate percentiles?",
    a: "We use the Kilgore strength standards as anchor points (physicallyActive → elite, calibrated by age, sex, and bodyweight) and interpolate where your lift sits within each group's distribution.",
  },
  {
    q: "Should I enter my true 1RM or an estimate?",
    a: "Enter your best 1-rep max. If you only know a recent heavy set, use the One Rep Max Calculator to estimate it first.",
  },
  {
    q: "Does age matter?",
    a: "Yes. The Kilgore standards account for age, so a 55-year-old and a 25-year-old at the same relative strength level will get similar percentiles.",
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
