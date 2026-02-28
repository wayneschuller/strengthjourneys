import { useState, useMemo } from "react";
import { NextSeo } from "next-seo";

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
import { Trophy } from "lucide-react";

// ─── ISR ─────────────────────────────────────────────────────────────────────

export async function getStaticProps() {
  const relatedArticles = await fetchRelatedArticles("Strength Standards");
  return { props: { relatedArticles }, revalidate: 60 * 60 };
}

// ─── Lift config ──────────────────────────────────────────────────────────────

const LIFTS = [
  { key: "squat",    label: "Back Squat",  emoji: "🏋️", standardKey: "Back Squat" },
  { key: "bench",    label: "Bench Press", emoji: "💪", standardKey: "Bench Press" },
  { key: "deadlift", label: "Deadlift",    emoji: "⛓️", standardKey: "Deadlift" },
];

function toKg(weight, isMetric) {
  return isMetric ? weight : weight / 2.2046;
}

// ─── Per-universe breakdown ───────────────────────────────────────────────────

function UniverseBreakdown({ percentiles, activeUniverse, onUniverseChange }) {
  return (
    <div className="flex flex-col gap-1">
      {UNIVERSES.map((universe) => {
        const p = percentiles?.[universe];
        const isActive = universe === activeUniverse;
        return (
          <button
            key={universe}
            onClick={() => onUniverseChange(universe)}
            className={`flex items-center justify-between rounded-md px-3 py-2 text-sm transition-all ${
              isActive
                ? "bg-muted font-semibold"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
          >
            <span>{universe}</span>
            <span className="tabular-nums font-medium">
              {p !== null && p !== undefined ? `${p}th percentile` : "—"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Inner client component ───────────────────────────────────────────────────

function HowStrongAmIPageInner() {
  const { age, sex, bodyWeight, isMetric, standards } = useAthleteBio();
  const unit = isMetric ? "kg" : "lb";

  const [selectedLiftKey, setSelectedLiftKey] = useState("squat");
  const [activeUniverse, setActiveUniverse] = useState("Barbell Lifters");

  // Default slider weight: intermediate Kilgore standard for the user's bio,
  // falling back to a sensible number if standards aren't loaded yet.
  const selectedLift = LIFTS.find((l) => l.key === selectedLiftKey);
  const intermediateDefault = standards?.[selectedLift?.standardKey]?.intermediate;
  const fallback = isMetric ? 100 : 225;
  const [weight, setWeight] = useState(
    intermediateDefault ? Math.round(intermediateDefault) : fallback,
  );

  // Slider range in display units
  const sliderMin  = isMetric ? 20  : 44;
  const sliderMax  = isMetric ? 300 : 660;
  const sliderStep = isMetric ? 2.5 : 5;

  // Compute
  const bodyWeightKg = toKg(bodyWeight, isMetric);
  const weightKg     = toKg(weight, isMetric);

  const liftKgs = useMemo(() => ({
    squat:    selectedLiftKey === "squat"    ? weightKg : null,
    bench:    selectedLiftKey === "bench"    ? weightKg : null,
    deadlift: selectedLiftKey === "deadlift" ? weightKg : null,
  }), [selectedLiftKey, weightKg]);

  const results = useMemo(
    () => computeStrengthResults({ age, sex, bodyWeightKg }, liftKgs),
    [age, sex, bodyWeightKg, liftKgs],
  );

  const activeLiftResult = results.lifts[selectedLiftKey];
  const percentiles = activeLiftResult?.percentiles ?? {};

  const rating = activeLiftResult?.standard
    ? getStrengthRatingForE1RM(weightKg, activeLiftResult.standard)
    : null;

  return (
    <PageContainer>
      <PageHeader>
        <PageHeaderHeading icon={Trophy}>How Strong Am I?</PageHeaderHeading>
        <PageHeaderDescription>
          Strength Percentile Calculator — see how you rank across four groups,
          from the general population to competitive powerlifters.
        </PageHeaderDescription>
      </PageHeader>

      {/* ── Centered hero column ─────────────────────────────────────────── */}
      <div className="mt-4 flex flex-col items-center gap-5">

        {/* Bio strip — compact, nudges user to personalise */}
        <AthleteBioInlineSettings
          defaultBioPrompt="Enter your details for personalised percentiles."
          autoOpenWhenDefault={true}
        />

        {/* ── HERO: Strength Circles chart ─────────────────────────────── */}
        <div className="w-full max-w-md">
          <StrengthCirclesChart
            percentiles={percentiles}
            activeUniverse={activeUniverse}
            onUniverseChange={setActiveUniverse}
          />
        </div>

        {/* ── Lift input: dropdown + weight slider ─────────────────────── */}
        <div className="w-full max-w-md rounded-xl border bg-card p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            {/* Lift selector */}
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

            {/* Weight display */}
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold tabular-nums leading-none">
                {weight}
              </span>
              <span className="text-sm text-muted-foreground">{unit}</span>
            </div>
          </div>

          {/* Weight slider */}
          <Slider
            value={[weight]}
            onValueChange={([v]) => setWeight(v)}
            min={sliderMin}
            max={sliderMax}
            step={sliderStep}
          />

          {/* Kilgore rating pill */}
          {rating && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Kilgore level:</span>
              <Badge variant={getRatingBadgeVariant(rating)} className="text-xs">
                {STRENGTH_LEVEL_EMOJI[rating]} {rating}
              </Badge>
            </div>
          )}
        </div>

        {/* ── Per-universe breakdown ────────────────────────────────────── */}
        {activeLiftResult && (
          <div className="w-full max-w-md">
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {selectedLift?.label} · all groups
            </p>
            <UniverseBreakdown
              percentiles={percentiles}
              activeUniverse={activeUniverse}
              onUniverseChange={setActiveUniverse}
            />
          </div>
        )}
      </div>

      {/* ── Explainer + FAQ ──────────────────────────────────────────────── */}
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
    a: "Either works. The slider represents a 1RM — if you only know a recent heavy set, find your estimated 1RM using the One Rep Max Calculator first.",
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
const CANONICAL = "https://www.strengthjourneys.xyz/how-strong-am-i";

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
