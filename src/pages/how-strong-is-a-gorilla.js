import Head from "next/head";
import Link from "next/link";
import { NextSeo } from "next-seo";
import { useEffect, useMemo, useState } from "react";
import { useLocalStorage } from "usehooks-ts";
import { GorillaIcon } from "@/components/gorilla-icon";
import { UnitChooser } from "@/components/unit-type-chooser";
import { RelatedArticles } from "@/components/article-cards";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { fetchRelatedArticles } from "@/lib/sanity-io.js";
import {
  PageContainer,
  PageHeader,
  PageHeaderHeading,
  PageHeaderDescription,
} from "@/components/page-header";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const LB_PER_KG = 2.20462;
const KG_PER_LB = 0.453592;
const GORILLA_MULTIPLIER_LOW = 6;
const GORILLA_MULTIPLIER_HIGH = 10;
const GORILLA_MULTIPLIER_MID = 8;

// Matches Deadlift color in use-lift-colors.js
const DEADLIFT_COLOR = "#005F73";
const DEADLIFT_COLOR_SOFT = "rgba(0, 95, 115, 0.12)";

const TRAINED_HUMAN_BASE_BENCH_LB = 175;
const TRAINED_HUMAN_BASE_PRESS_LB = 110;
const TRAINED_HUMAN_BASE_SCORE_LB =
  TRAINED_HUMAN_BASE_BENCH_LB + TRAINED_HUMAN_BASE_PRESS_LB;

const DEFAULT_VALUES = {
  bodyWeightLb: 185,
  benchLb: 135,
  pressLb: 95,
};

const HUMAN_PERCENTILE_TABLE = [
  { ratio: 0.3, humans: 20, gym: 6 },
  { ratio: 0.5, humans: 42, gym: 16 },
  { ratio: 0.8, humans: 68, gym: 35 },
  { ratio: 1.0, humans: 82, gym: 52 },
  { ratio: 1.2, humans: 90, gym: 66 },
  { ratio: 1.5, humans: 95, gym: 79 },
  { ratio: 1.8, humans: 98, gym: 89 },
  { ratio: 2.1, humans: 99, gym: 94 },
  { ratio: 2.5, humans: 99.5, gym: 97 },
];

export async function getStaticProps() {
  const RELATED_ARTICLES_CATEGORY = "Strength Calculator";
  const relatedArticles = await fetchRelatedArticles(RELATED_ARTICLES_CATEGORY);

  return {
    props: {
      relatedArticles,
    },
    revalidate: 60 * 60,
  };
}

export default function GorillaStrengthPage({ relatedArticles }) {
  const canonicalURL = "https://www.strengthjourneys.xyz/how-strong-is-a-gorilla";
  const title = "How Strong Are You Compared to a Gorilla? | Strength Journeys";
  const description =
    "Playful gorilla strength comparison tool. Estimate your upper-body strength score versus a silverback range.";
  const keywords =
    "how strong is a gorilla, gorilla strength, gorilla vs human strength, how strong are you";

  return (
    <>
      <Head>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: title,
            description,
            url: canonicalURL,
          })}
        </script>
      </Head>
      <NextSeo
        title={title}
        description={description}
        canonical={canonicalURL}
        openGraph={{
          url: canonicalURL,
          title,
          description,
          type: "website",
          images: [
            {
              url: "https://www.strengthjourneys.xyz/strength_journeys_strength_levels_calculator_og.png",
              alt: "How Strong Are You Compared to a Gorilla",
            },
          ],
          site_name: "Strength Journeys",
        }}
      />
      <GorillaStrengthMain relatedArticles={relatedArticles} />
    </>
  );
}

function GorillaStrengthMain({ relatedArticles }) {
  const [isCopied, setIsCopied] = useState(false);
  const [isMetric, setIsMetric] = useLocalStorage(
    LOCAL_STORAGE_KEYS.GORILLA_IS_METRIC,
    false,
    { initializeWithValue: false },
  );
  const [bodyWeight, setBodyWeight] = useLocalStorage(
    LOCAL_STORAGE_KEYS.GORILLA_BODY_WEIGHT,
    DEFAULT_VALUES.bodyWeightLb,
    { initializeWithValue: false },
  );
  const [bench, setBench] = useLocalStorage(
    LOCAL_STORAGE_KEYS.GORILLA_BENCH,
    DEFAULT_VALUES.benchLb,
    { initializeWithValue: false },
  );
  const [press, setPress] = useLocalStorage(
    LOCAL_STORAGE_KEYS.GORILLA_PRESS,
    DEFAULT_VALUES.pressLb,
    { initializeWithValue: false },
  );

  useEffect(() => {
    if (!isCopied) return;
    const timer = setTimeout(() => setIsCopied(false), 1400);
    return () => clearTimeout(timer);
  }, [isCopied]);

  const bodyWeightLb = isMetric ? bodyWeight * LB_PER_KG : bodyWeight;
  const benchLb = isMetric ? bench * LB_PER_KG : bench;
  const pressLb = isMetric ? press * LB_PER_KG : press;
  const upperBodyStrengthScoreLb = benchLb + pressLb;

  // Light bodyweight-based scaling: +/-15% max relative to 185 lb baseline.
  const bodyweightScale = clamp(
    1 + ((bodyWeightLb - DEFAULT_VALUES.bodyWeightLb) / DEFAULT_VALUES.bodyWeightLb) * 0.15,
    0.85,
    1.15,
  );

  const gorillaLowLb =
    TRAINED_HUMAN_BASE_SCORE_LB * GORILLA_MULTIPLIER_LOW * bodyweightScale;
  const gorillaHighLb =
    TRAINED_HUMAN_BASE_SCORE_LB * GORILLA_MULTIPLIER_HIGH * bodyweightScale;
  const gorillaMidLb =
    TRAINED_HUMAN_BASE_SCORE_LB * GORILLA_MULTIPLIER_MID * bodyweightScale;

  const gorillaPercent = clamp((upperBodyStrengthScoreLb / gorillaMidLb) * 100, 0, 999);
  const fillPercent = clamp(gorillaPercent, 0, 100);

  const strengthRatio = bodyWeightLb > 0 ? upperBodyStrengthScoreLb / bodyWeightLb : 0;
  const percentile = useMemo(
    () => getEstimatedPercentiles(strengthRatio),
    [strengthRatio],
  );

  const displayScore = formatWeightInt(upperBodyStrengthScoreLb, isMetric);
  const displayLow = formatWeightInt(gorillaLowLb, isMetric);
  const displayHigh = formatWeightInt(gorillaHighLb, isMetric);
  const displayMid = formatWeightInt(gorillaMidLb, isMetric);
  const scoreUnit = isMetric ? "kg" : "lb";

  const bragLine = getBragLine(gorillaPercent);

  const handleUnitSwitch = () => {
    const nextIsMetric = !isMetric;
    setIsMetric(nextIsMetric);
    setBodyWeight((prev) => roundWeight(convertWeight(prev, isMetric, nextIsMetric)));
    setBench((prev) => roundWeight(convertWeight(prev, isMetric, nextIsMetric)));
    setPress((prev) => roundWeight(convertWeight(prev, isMetric, nextIsMetric)));
  };

  const copyResult = async () => {
    const text =
      `I'm ~${Math.round(gorillaPercent)}% as strong as a gorilla (upper-body). ` +
      "https://www.strengthjourneys.xyz/how-strong-is-a-gorilla";
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
    } catch {
      setIsCopied(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader hideRecapBanner>
        <PageHeaderHeading icon={GorillaIcon}>
          How Strong Are You Compared to a Gorilla?
        </PageHeaderHeading>
        <PageHeaderDescription>
          A playful, approximate comparison — not biological precision.
        </PageHeaderDescription>
      </PageHeader>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <CardTitle>Your Gorilla Comparison</CardTitle>
            <UnitChooser isMetric={isMetric} onSwitchChange={handleUnitSwitch} />
          </div>
        </CardHeader>

        <CardContent className="space-y-8 pb-6 pt-2">

          {/* ── HERO RESULT ── */}
          <div
            className="rounded-2xl p-6 text-center"
            style={{ background: DEADLIFT_COLOR_SOFT }}
          >
            <p
              className="text-[5rem] font-black leading-none tabular-nums tracking-tighter sm:text-[6rem]"
              style={{ color: DEADLIFT_COLOR }}
            >
              ~{Math.round(gorillaPercent)}%
            </p>
            <p className="mt-2 text-base font-semibold">
              of a silverback gorilla&apos;s strength
            </p>
            <p className="mt-1.5 text-sm italic text-muted-foreground">{bragLine}</p>

            {/* Progress bar */}
            <div className="mt-6 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>You</span>
                <div className="flex items-center gap-1">
                  <span>Silverback</span>
                  <GorillaIcon className="h-4 w-4" style={{ color: DEADLIFT_COLOR }} />
                </div>
              </div>
              <div className="relative h-5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all duration-150 ease-out"
                  style={{
                    width: `${fillPercent}%`,
                    background: `linear-gradient(90deg, ${DEADLIFT_COLOR}66, ${DEADLIFT_COLOR})`,
                  }}
                />
                {[25, 50, 75].map((pct) => (
                  <div
                    key={pct}
                    className="absolute inset-y-0 w-0.5 bg-background/50"
                    style={{ left: `${pct}%` }}
                  />
                ))}
              </div>
              <div className="relative h-4">
                {[25, 50, 75, 100].map((pct) => (
                  <span
                    key={pct}
                    className="absolute -translate-x-1/2 text-[10px] text-muted-foreground"
                    style={{ left: `${pct}%` }}
                  >
                    {pct}%
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* ── STAT TILES ── */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile
              label="Stronger than"
              value={`${Math.round(percentile.humans)}%`}
              sub="of all adults"
            />
            <StatTile
              label="Stronger than"
              value={`${Math.round(percentile.gym)}%`}
              sub="of gym-goers"
            />
            <StatTile
              label="Your score"
              value={displayScore}
              sub={scoreUnit}
            />
            <StatTile
              label="Gorilla range"
              value={`${displayLow}–${displayHigh}`}
              sub={scoreUnit}
            />
          </div>

          {/* ── INPUTS ── */}
          <div className="space-y-5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Your lifts
            </p>
            <div className="grid gap-6 md:grid-cols-3">
              <StrengthInput
                label="Bodyweight"
                helper="context only (v1)"
                value={bodyWeight}
                onChange={setBodyWeight}
                min={isMetric ? 45 : 100}
                max={isMetric ? 205 : 450}
                step={1}
                unit={scoreUnit}
              />
              <StrengthInput
                label="Bench Press"
                helper="1RM or best single"
                value={bench}
                onChange={setBench}
                min={0}
                max={isMetric ? 320 : 700}
                step={1}
                unit={scoreUnit}
              />
              <StrengthInput
                label="Strict Press"
                helper="1RM or best single"
                value={press}
                onChange={setPress}
                min={0}
                max={isMetric ? 220 : 500}
                step={1}
                unit={scoreUnit}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Upper-body score:{" "}
              <span className="font-bold" style={{ color: DEADLIFT_COLOR }}>
                {displayScore} {scoreUnit}
              </span>
              {" "}(bench + strict press)
            </p>
          </div>

          {/* ── SHARE + LINK ── */}
          <div className="flex flex-wrap items-center gap-3 border-t pt-6">
            <Button
              onClick={copyResult}
              style={{ backgroundColor: DEADLIFT_COLOR }}
            >
              {isCopied ? "✓ Copied!" : "Share result"}
            </Button>
            <Link
              href="/how-strong-am-i"
              className="text-sm font-semibold underline-offset-2 hover:underline"
              style={{ color: DEADLIFT_COLOR }}
            >
              Want the serious version? → How Strong Am I?
            </Link>
          </div>

          {/* ── ASSUMPTIONS ── */}
          <Accordion type="single" collapsible>
            <AccordionItem value="assumptions">
              <AccordionTrigger>Assumptions & methodology</AccordionTrigger>
              <AccordionContent>
                <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
                  <li>
                    Gorilla strength is estimated at ~6–10× a trained human upper-body composite.
                  </li>
                  <li>
                    Bodyweight is used as a light contextual scaling factor (+/–15% cap).
                  </li>
                  <li>This is for perspective and fun, not a scientific measurement.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>

        <CardFooter className="pt-0 text-xs text-muted-foreground">
          Playful approximation. Not biological precision.
        </CardFooter>
      </Card>

      <section className="mt-8">
        <RelatedArticles articles={relatedArticles} />
      </section>
    </PageContainer>
  );
}

function StatTile({ label, value, sub }) {
  return (
    <div className="flex flex-col items-center justify-center gap-0.5 rounded-xl border bg-muted/30 p-4 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-black tabular-nums" style={{ color: DEADLIFT_COLOR }}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function StrengthInput({ label, helper, value, onChange, min, max, step, unit }) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-sm font-semibold">{label}</Label>
        <span
          className="shrink-0 text-xl font-black tabular-nums"
          style={{ color: DEADLIFT_COLOR }}
        >
          {Math.round(value)}
          <span className="ml-0.5 text-xs font-normal text-muted-foreground">{unit}</span>
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(vals) => onChange(vals[0])}
        aria-label={`${label} slider in ${unit}`}
      />
      <p className="text-xs text-muted-foreground">{helper}</p>
    </div>
  );
}

function getEstimatedPercentiles(ratio) {
  if (ratio <= HUMAN_PERCENTILE_TABLE[0].ratio) {
    return {
      humans: HUMAN_PERCENTILE_TABLE[0].humans,
      gym: HUMAN_PERCENTILE_TABLE[0].gym,
    };
  }

  for (let i = 0; i < HUMAN_PERCENTILE_TABLE.length - 1; i += 1) {
    const lower = HUMAN_PERCENTILE_TABLE[i];
    const upper = HUMAN_PERCENTILE_TABLE[i + 1];
    if (ratio <= upper.ratio) {
      const t = (ratio - lower.ratio) / (upper.ratio - lower.ratio);
      return {
        humans: lower.humans + (upper.humans - lower.humans) * t,
        gym: lower.gym + (upper.gym - lower.gym) * t,
      };
    }
  }

  return {
    humans: HUMAN_PERCENTILE_TABLE[HUMAN_PERCENTILE_TABLE.length - 1].humans,
    gym: HUMAN_PERCENTILE_TABLE[HUMAN_PERCENTILE_TABLE.length - 1].gym,
  };
}

function formatWeightInt(valueLb, isMetric) {
  const value = isMetric ? valueLb * KG_PER_LB : valueLb;
  return Math.round(value);
}

function convertWeight(value, fromMetric, toMetric) {
  if (fromMetric === toMetric) return value;
  if (toMetric) return value * KG_PER_LB;
  return value * LB_PER_KG;
}

function roundWeight(value) {
  return Math.max(0, Math.round(value));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getBragLine(percent) {
  if (percent < 10) return "You are in the game. Keep training.";
  if (percent < 20) return "You're about 1/7th of a gorilla. Respect.";
  if (percent < 35) return "You are closing in on serious primate territory.";
  if (percent < 50) return "You are officially scary in normal gym terms.";
  return "You might be the problem in the jungle.";
}
