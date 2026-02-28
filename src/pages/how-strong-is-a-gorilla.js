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
const DEADLIFT_COLOR_SOFT = "rgba(0, 95, 115, 0.18)";

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

  const copyResult = async () => {
    const text =
      `I’m ~${Math.round(gorillaPercent)}% as strong as a gorilla (upper-body). ` +
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
          A playful, approximate comparison - not biological precision.
        </PageHeaderDescription>
      </PageHeader>

      <Card className="pt-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl">Result</CardTitle>
        </CardHeader>
        <CardContent className="space-y-8 py-6">
          <section className="rounded-xl bg-muted/25 p-6">
            <div className="flex items-center justify-center gap-2">
              <GorillaIcon className="h-5 w-5" style={{ color: DEADLIFT_COLOR }} />
              <p className="text-sm font-semibold">You vs Gorilla</p>
            </div>
            <p
              className="mt-3 text-center text-5xl font-extrabold leading-none"
              style={{ color: DEADLIFT_COLOR }}
            >
              ~{Math.round(gorillaPercent)}%
            </p>
            <p className="mt-2 text-center text-sm font-medium">
              of gorilla strength (midpoint estimate)
            </p>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-sm font-semibold">
                <span>You</span>
                <span>Gorilla</span>
              </div>
              <div className="h-5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-5 rounded-full transition-none"
                  style={{
                    width: `${fillPercent}%`,
                    backgroundColor: DEADLIFT_COLOR,
                  }}
                />
              </div>
            </div>
          </section>

          <section className="rounded-xl bg-muted/20 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Your strength score</h2>
              <UnitChooser
                isMetric={isMetric}
                onSwitchChange={() => {
                  const nextIsMetric = !isMetric;
                  setIsMetric(nextIsMetric);
                  setBodyWeight((prev) =>
                    roundWeight(convertWeight(prev, isMetric, nextIsMetric)),
                  );
                  setBench((prev) =>
                    roundWeight(convertWeight(prev, isMetric, nextIsMetric)),
                  );
                  setPress((prev) =>
                    roundWeight(convertWeight(prev, isMetric, nextIsMetric)),
                  );
                }}
              />
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              <StrengthInput
                label="Bodyweight"
                helper="for context only (v1)"
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

            <p className="mt-5 text-sm font-medium">
              Upper-body strength score:{" "}
              <span className="font-bold" style={{ color: DEADLIFT_COLOR }}>
                {displayScore} {scoreUnit}
              </span>
            </p>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl bg-muted/20 p-5">
              <h3 className="text-base font-semibold">Gorilla estimate</h3>
              <p className="mt-2 text-sm leading-relaxed">
                A silverback is estimated at ~6-10x a trained human in upper-body
                pulling/pressing strength.
              </p>
              <p className="mt-3 text-sm font-medium">
                Estimated gorilla equivalent:{" "}
                <span className="font-bold" style={{ color: DEADLIFT_COLOR }}>
                  {displayLow}-{displayHigh} {scoreUnit}
                </span>{" "}
                (range, midpoint ~{displayMid} {scoreUnit})
              </p>
            </div>

            <div className="rounded-xl bg-muted/20 p-5">
              <h3 className="text-base font-semibold">Interpretation</h3>
              <p className="mt-2 text-sm">
                You are stronger than about{" "}
                <strong>{Math.round(percentile.humans)}% of adults</strong> and{" "}
                <strong>{Math.round(percentile.gym)}% of regular gym-goers</strong>{" "}
                for this upper-body composite.
              </p>
              <p className="mt-3 text-sm">{bragLine}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button
                  onClick={copyResult}
                  className="h-11"
                  style={{ backgroundColor: DEADLIFT_COLOR }}
                >
                  {isCopied ? "Copied" : "Copy result"}
                </Button>
                <Link
                  href="/how-strong-am-i"
                  className="text-sm font-semibold underline"
                  style={{ color: DEADLIFT_COLOR }}
                >
                  Want the serious version? -&gt; How Strong Am I (Strength Circles)
                </Link>
              </div>
            </div>
          </section>

          <Accordion type="single" collapsible>
            <AccordionItem value="assumptions">
              <AccordionTrigger>Assumptions</AccordionTrigger>
              <AccordionContent>
                <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
                  <li>
                    We estimate gorilla strength as 6-10x a trained human upper-body composite.
                  </li>
                  <li>
                    Bodyweight is used only as a light contextual scaling factor (+/-15% cap).
                  </li>
                  <li>
                    This is for perspective and fun, not a scientific measurement.
                  </li>
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

function StrengthInput({
  label,
  helper,
  value,
  onChange,
  min,
  max,
  step,
  unit,
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold">
        {label}: <span className="font-bold">{Math.round(value)} {unit}</span>
      </Label>
      <p className="text-xs text-muted-foreground">{helper}</p>
      <div className="rounded-md border bg-background px-3 py-4">
        <Slider
          min={min}
          max={max}
          step={step}
          value={[value]}
          onValueChange={(vals) => onChange(vals[0])}
          aria-label={`${label} slider in ${unit}`}
        />
      </div>
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
