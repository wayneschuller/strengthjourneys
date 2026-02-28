import { useState, useMemo } from "react";
import { NextSeo } from "next-seo";

import {
  PageContainer,
  PageHeader,
  PageHeaderHeading,
  PageHeaderDescription,
} from "@/components/page-header";
import { AthleteBioInlineSettings } from "@/components/athlete-bio-quick-settings";
import { LiftInputCard } from "@/components/strength-circles/lift-input-card";
import { ResultsCard } from "@/components/strength-circles/results-card";
import { RelatedArticles } from "@/components/article-cards";
import { fetchRelatedArticles } from "@/lib/sanity-io.js";
import { computeStrengthResults } from "@/lib/strength-circles/universe-percentiles";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { Trophy } from "lucide-react";

// ─── ISR: fetch related CMS articles ─────────────────────────────────────────

export async function getStaticProps() {
  const relatedArticles = await fetchRelatedArticles("Strength Standards");
  return {
    props: { relatedArticles },
    revalidate: 60 * 60,
  };
}

// ─── Default lift input state ─────────────────────────────────────────────────

const DEFAULT_LIFT_INPUTS = {
  squat:    { mode: "reps", weight: "", reps: 5 },
  bench:    { mode: "reps", weight: "", reps: 5 },
  deadlift: { mode: "reps", weight: "", reps: 5 },
};

// ─── Inner client component (keeps SSR/hydration safe) ───────────────────────

function HowStrongAmIPageInner() {
  const { age, sex, bodyWeight, isMetric } = useAthleteBio();

  const [liftInputs, setLiftInputs] = useState(DEFAULT_LIFT_INPUTS);

  // liftKgs is kept in sync by LiftInputCard via onLiftKgsChange
  // (already converted from display unit, already E1RM-resolved)
  const [liftKgs, setLiftKgs] = useState({ squat: null, bench: null, deadlift: null });

  // Bodyweight in kg for computation
  const bodyWeightKg = isMetric
    ? bodyWeight
    : Math.round((bodyWeight / 2.2046) * 10) / 10;

  // Recompute results whenever bio or lifts change
  const results = useMemo(
    () =>
      computeStrengthResults(
        { age, sex, bodyWeightKg },
        liftKgs,
      ),
    [age, sex, bodyWeightKg, liftKgs],
  );

  return (
    <PageContainer>
      <PageHeader>
        <PageHeaderHeading icon={Trophy}>How Strong Am I?</PageHeaderHeading>
        <PageHeaderDescription>
          Strength Percentile Calculator — see how you rank across four groups,
          from the general population to competitive powerlifters.
        </PageHeaderDescription>
      </PageHeader>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ── Left column: bio + lift inputs ─────────────────────────── */}
        <div className="flex flex-col gap-4">
          <AthleteBioInlineSettings
            defaultBioPrompt="Enter your details for personalised percentiles."
            autoOpenWhenDefault={true}
          />
          <LiftInputCard
            liftInputs={liftInputs}
            onLiftInputsChange={setLiftInputs}
            onLiftKgsChange={setLiftKgs}
          />
        </div>

        {/* ── Right column: results ───────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <ResultsCard results={results} />
        </div>
      </div>

      {/* ── Explainer + FAQ ────────────────────────────────────────────── */}
      <section className="mt-10 max-w-2xl">
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
    a: "It means your estimated 1-rep max, adjusted for your bodyweight and age, is higher than that percentage of people in the selected group.",
  },
  {
    q: "Which group should I care about?",
    a: "Most people find the Barbell Lifters ring most meaningful — it compares you to people who specifically train with a barbell, which is the fairest peer group for strength athletes.",
  },
  {
    q: "How do you estimate percentiles?",
    a: "We use the Kilgore strength standards (physicallyActive → elite thresholds, calibrated by age, sex, and bodyweight) as anchor points and interpolate where your lift sits within each group's distribution.",
  },
  {
    q: "Should I enter my true 1RM or an estimate?",
    a: "Either works. If you enter a recent heavy set, we'll estimate your 1RM using the Brzycki formula — the same formula used across the rest of this site.",
  },
  {
    q: "Does age matter?",
    a: "Yes. The Kilgore standards already account for age, so a 50-year-old and a 25-year-old at the same relative strength level will get similar percentiles.",
  },
  {
    q: "Why do I need all three lifts for a total?",
    a: "The SBD total only makes sense as a combined metric. With partial data we show per-lift percentiles, which are still meaningful on their own.",
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
