import Head from "next/head";
import Link from "next/link";
import { NextSeo } from "next-seo";
import { useMemo } from "react";
import { useLocalStorage } from "usehooks-ts";
import { RelatedArticles } from "@/components/article-cards";
import { UnitChooser } from "@/components/unit-type-chooser";
import { GorillaIcon } from "@/components/gorilla-icon";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { fetchRelatedArticles } from "@/lib/sanity-io.js";
import {
  PageContainer,
  PageHeader,
  PageHeaderHeading,
  PageHeaderDescription,
  PageHeaderRight,
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
import { Separator } from "@/components/ui/separator";

const LB_PER_KG = 2.20462;
const KG_PER_LB = 0.453592;

const GORILLA_MULTIPLIER_LOW = 6;
const GORILLA_MULTIPLIER_HIGH = 10;
const GORILLA_MULTIPLIER_MID = 8;

const AVERAGE_MALE_BENCH_LB = 135;
const AVERAGE_MALE_PRESS_LB = 95;
const AVERAGE_MALE_UPPER_TOTAL_LB = AVERAGE_MALE_BENCH_LB + AVERAGE_MALE_PRESS_LB;

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

const FAQ_ITEMS = [
  {
    question: "How strong is a gorilla compared to a human?",
    answer:
      "A common estimate is that a silverback gorilla has about 6 to 10 times the upper-body pulling or pressing strength of an average adult male.",
  },
  {
    question: "Can a human become as strong as a gorilla?",
    answer:
      "Not in absolute terms. Elite humans can get extremely strong, but gorillas have very different anatomy and leverage.",
  },
  {
    question: "Is this gorilla calculator scientific?",
    answer:
      "No. It is an approximate perspective tool using conservative assumptions, not a biomechanical lab model.",
  },
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

/**
 * How Strong Is a Gorilla page. Renders SEO metadata and delegates rendering to GorillaStrengthMain.
 * @param {Object} props
 * @param {Array} props.relatedArticles - CMS articles related to strength tools, fetched via ISR.
 */
export default function GorillaStrengthPage({ relatedArticles }) {
  const canonicalURL = "https://www.strengthjourneys.xyz/how-strong-is-a-gorilla";
  const title = "How Strong Is a Gorilla? Compare Your Strength | Strength Journeys";
  const description =
    "How strong is a gorilla? Use this fun gorilla strength comparison tool to see your rough upper-body strength percentage versus a silverback.";
  const keywords =
    "how strong is a gorilla, gorilla strength, silverback strength, gorilla vs human strength, strength comparison tool, how strong am i";
  const ogImageURL =
    "https://www.strengthjourneys.xyz/strength_journeys_strength_levels_calculator_og.png";
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: "How Strong Is a Gorilla?",
        description,
        url: canonicalURL,
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ_ITEMS.map(({ question, answer }) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: {
            "@type": "Answer",
            text: answer,
          },
        })),
      },
    ],
  };

  return (
    <>
      <Head>
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
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
              url: ogImageURL,
              alt: "How Strong Is a Gorilla comparison tool",
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
      <GorillaStrengthMain relatedArticles={relatedArticles} />
    </>
  );
}

function GorillaStrengthMain({ relatedArticles }) {
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

  const bodyWeightLb = isMetric ? bodyWeight * LB_PER_KG : bodyWeight;
  const benchLb = isMetric ? bench * LB_PER_KG : bench;
  const pressLb = isMetric ? press * LB_PER_KG : press;

  const upperBodyTotalLb = benchLb + pressLb;
  const gorillaBenchLow = AVERAGE_MALE_BENCH_LB * GORILLA_MULTIPLIER_LOW;
  const gorillaBenchHigh = AVERAGE_MALE_BENCH_LB * GORILLA_MULTIPLIER_HIGH;
  const gorillaPressLow = AVERAGE_MALE_PRESS_LB * GORILLA_MULTIPLIER_LOW;
  const gorillaPressHigh = AVERAGE_MALE_PRESS_LB * GORILLA_MULTIPLIER_HIGH;
  const gorillaUpperLow = AVERAGE_MALE_UPPER_TOTAL_LB * GORILLA_MULTIPLIER_LOW;
  const gorillaUpperHigh = AVERAGE_MALE_UPPER_TOTAL_LB * GORILLA_MULTIPLIER_HIGH;
  const gorillaUpperMid = AVERAGE_MALE_UPPER_TOTAL_LB * GORILLA_MULTIPLIER_MID;

  const asGorillaPercent = Math.max(
    0,
    Math.min(999, (upperBodyTotalLb / gorillaUpperMid) * 100),
  );

  const strengthRatio = bodyWeightLb > 0 ? upperBodyTotalLb / bodyWeightLb : 0;
  const percentile = useMemo(
    () => getEstimatedPercentiles(strengthRatio),
    [strengthRatio],
  );

  const scaleMax = Math.max(gorillaUpperHigh * 1.05, upperBodyTotalLb * 1.15, 400);
  const averageMarker = (AVERAGE_MALE_UPPER_TOTAL_LB / scaleMax) * 100;
  const youMarker = (upperBodyTotalLb / scaleMax) * 100;
  const gorillaLowMarker = (gorillaUpperLow / scaleMax) * 100;
  const gorillaHighMarker = (gorillaUpperHigh / scaleMax) * 100;

  const displayedUpperBodyTotal = formatWeight(upperBodyTotalLb, isMetric);
  const displayedGorillaLow = formatWeight(gorillaUpperLow, isMetric);
  const displayedGorillaHigh = formatWeight(gorillaUpperHigh, isMetric);
  const displayedBenchLow = formatWeight(gorillaBenchLow, isMetric);
  const displayedBenchHigh = formatWeight(gorillaBenchHigh, isMetric);
  const displayedPressLow = formatWeight(gorillaPressLow, isMetric);
  const displayedPressHigh = formatWeight(gorillaPressHigh, isMetric);

  return (
    <PageContainer>
      <PageHeader>
        <PageHeaderHeading icon={GorillaIcon}>How Strong Is a Gorilla?</PageHeaderHeading>
        <PageHeaderDescription>
          Compare Your Strength to a Silverback Gorilla
        </PageHeaderDescription>
        <PageHeaderRight>
          <div className="hidden gap-2 text-muted-foreground md:flex md:flex-col xl:flex-row">
            <Link
              href="/strength-level-calculator"
              className="block rounded-lg border p-4 shadow-sm transition-shadow hover:bg-muted hover:shadow-md"
            >
              <h3 className="text-base font-semibold">How Strong Am I?</h3>
              <p className="text-sm">Get your full strength ranking by lift.</p>
            </Link>
            <Link
              href="/analyzer"
              className="block rounded-lg border p-4 shadow-sm transition-shadow hover:bg-muted hover:shadow-md"
            >
              <h3 className="text-base font-semibold">Strength Circles</h3>
              <p className="text-sm">Track your rankings over your full journey.</p>
            </Link>
          </div>
        </PageHeaderRight>
      </PageHeader>

      <section className="px-3 pb-4 sm:px-[2vw] md:px-[3vw] lg:px-[4vw] xl:px-[5vw]">
        <h2 className="text-xl font-semibold">Quick answer</h2>
        <p className="mt-2 max-w-4xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Conservative estimates often place silverback gorillas at about{" "}
          <strong>{GORILLA_MULTIPLIER_LOW} to {GORILLA_MULTIPLIER_HIGH} times</strong>{" "}
          the upper-body strength of an average adult male. In rough gym terms,
          that can map to very high pressing and pulling equivalents. This page is
          a playful comparison tool, not a biology lab result.
        </p>
      </section>

      <Card className="pt-4">
        <CardHeader>
          <CardTitle>Gorilla Strength Comparison Tool</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-5 lg:grid-cols-3">
            <SliderInput
              label="Bodyweight"
              value={bodyWeight}
              onChange={setBodyWeight}
              min={isMetric ? 45 : 100}
              max={isMetric ? 205 : 450}
              step={1}
              unit={isMetric ? "kg" : "lb"}
              rightControl={
                <UnitChooser
                  isMetric={isMetric}
                  onSwitchChange={() => {
                    const nextIsMetric = !isMetric;
                    setIsMetric(nextIsMetric);
                    setBodyWeight((prev) => roundWeight(convertWeight(prev, isMetric, nextIsMetric)));
                    setBench((prev) => roundWeight(convertWeight(prev, isMetric, nextIsMetric)));
                    setPress((prev) => roundWeight(convertWeight(prev, isMetric, nextIsMetric)));
                  }}
                />
              }
            />
            <SliderInput
              label="Bench Press"
              value={bench}
              onChange={setBench}
              min={0}
              max={isMetric ? 320 : 700}
              step={isMetric ? 1 : 5}
              unit={isMetric ? "kg" : "lb"}
            />
            <SliderInput
              label="Strict Press"
              value={press}
              onChange={setPress}
              min={0}
              max={isMetric ? 220 : 500}
              step={isMetric ? 1 : 5}
              unit={isMetric ? "kg" : "lb"}
            />
          </div>

          <Separator />

          <div className="grid gap-4 lg:grid-cols-3">
            <StatCard
              title="Your Upper-Body Total"
              value={`${displayedUpperBodyTotal} ${isMetric ? "kg" : "lb"}`}
              subtitle={`Bench + Strict Press`}
            />
            <StatCard
              title="Estimated Gorilla Equivalent"
              value={`${displayedGorillaLow} - ${displayedGorillaHigh} ${isMetric ? "kg" : "lb"}`}
              subtitle={`${GORILLA_MULTIPLIER_LOW}x - ${GORILLA_MULTIPLIER_HIGH}x average male upper-body`}
            />
            <StatCard
              title="You vs Gorilla"
              value={`~${Math.round(asGorillaPercent)}%`}
              subtitle={`Based on an ${GORILLA_MULTIPLIER_MID}x midpoint assumption`}
            />
          </div>

          <div className="rounded-lg border p-4">
            <p className="mb-3 text-sm font-medium">Human → You → Gorilla</p>
            <div className="relative h-14">
              <div className="absolute top-5 h-2 w-full rounded-full bg-muted" />
              <RangeBand left={gorillaLowMarker} right={gorillaHighMarker} />
              <ScaleMarker
                label="Average human"
                value={AVERAGE_MALE_UPPER_TOTAL_LB}
                position={averageMarker}
                isMetric={isMetric}
              />
              <ScaleMarker
                label="You"
                value={upperBodyTotalLb}
                position={youMarker}
                isMetric={isMetric}
                emphasized
              />
              <ScaleMarker
                label="Gorilla"
                value={gorillaUpperMid}
                position={((gorillaUpperLow + gorillaUpperHigh) / 2 / scaleMax) * 100}
                isMetric={isMetric}
              />
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <ComparisonRow
              label="Bench equivalent"
              userValue={benchLb}
              gorillaLow={gorillaBenchLow}
              gorillaHigh={gorillaBenchHigh}
              isMetric={isMetric}
            />
            <ComparisonRow
              label="Strict press equivalent"
              userValue={pressLb}
              gorillaLow={gorillaPressLow}
              gorillaHigh={gorillaPressHigh}
              isMetric={isMetric}
            />
            <ComparisonRow
              label="Upper-body total equivalent"
              userValue={upperBodyTotalLb}
              gorillaLow={gorillaUpperLow}
              gorillaHigh={gorillaUpperHigh}
              isMetric={isMetric}
            />
          </div>

          <div className="rounded-lg border bg-muted/30 p-4 text-sm">
            You are estimated stronger than about <strong>{percentile.humans}% of adults</strong>{" "}
            and <strong>{percentile.gym}% of regular gym-goers</strong> for
            upper-body strength.
          </div>
        </CardContent>
        <CardFooter className="flex flex-col items-start gap-3 text-sm">
          <p className="text-muted-foreground">
            These comparisons are approximate and for perspective, not biological precision.
          </p>
          <p>
            Want the serious version? See your full lift-by-lift ranking in our{" "}
            <Link
              href="/strength-level-calculator"
              className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
            >
              Strength Level Calculator
            </Link>
            {" "}and{" "}
            <Link
              href="/analyzer"
              className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
            >
              PR Analyzer
            </Link>
            .
          </p>
        </CardFooter>
      </Card>

      <section className="mt-10 px-3 sm:px-[2vw] md:px-[3vw] lg:px-[4vw] xl:px-[5vw]">
        <h2 className="mb-3 text-xl font-semibold">How this estimate works</h2>
        <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
          <li>
            Uses a conservative public estimate of{" "}
            <strong>{GORILLA_MULTIPLIER_LOW}x to {GORILLA_MULTIPLIER_HIGH}x</strong>{" "}
            average adult male upper-body strength.
          </li>
          <li>
            Converts that multiplier into rough barbell-style equivalents for
            bench press, strict press, and their combined total.
          </li>
          <li>
            Percentile outputs are playful heuristics for perspective, not scientific
            population claims.
          </li>
        </ul>
        <p className="mt-4 text-sm text-muted-foreground">
          Bench equivalent estimate: {displayedBenchLow}-{displayedBenchHigh}{" "}
          {isMetric ? "kg" : "lb"} | Strict press equivalent estimate:{" "}
          {displayedPressLow}-{displayedPressHigh} {isMetric ? "kg" : "lb"}.
        </p>
      </section>

      <RelatedArticles articles={relatedArticles} />
    </PageContainer>
  );
}

function SliderInput({ label, value, onChange, min, max, step, unit, rightControl }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-base">
          {label}: <span className="font-semibold">{value} {unit}</span>
        </Label>
        {rightControl}
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(vals) => onChange(vals[0])}
        aria-label={`${label} in ${unit}`}
      />
    </div>
  );
}

function StatCard({ title, value, subtitle }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-sm text-muted-foreground">{title}</div>
      <div className="mt-1 text-2xl font-bold tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>
    </div>
  );
}

function RangeBand({ left, right }) {
  return (
    <div
      className="absolute top-4 h-4 rounded bg-primary/30"
      style={{
        left: `${clampPercent(left)}%`,
        width: `${Math.max(1, clampPercent(right) - clampPercent(left))}%`,
      }}
      aria-hidden
    />
  );
}

function ScaleMarker({ label, value, position, isMetric, emphasized = false }) {
  return (
    <div
      className="absolute top-0 -translate-x-1/2"
      style={{ left: `${clampPercent(position)}%` }}
    >
      <div className={`h-8 w-[2px] ${emphasized ? "bg-primary" : "bg-foreground/60"}`} />
      <p className="mt-1 text-center text-[11px] font-medium leading-none">{label}</p>
      <p className="text-center text-[10px] text-muted-foreground">
        {formatWeight(value, isMetric)} {isMetric ? "kg" : "lb"}
      </p>
    </div>
  );
}

function ComparisonRow({ label, userValue, gorillaLow, gorillaHigh, isMetric }) {
  const rangeMid = (gorillaLow + gorillaHigh) / 2;
  const percent = Math.max(0, Math.min(220, (userValue / rangeMid) * 100));

  return (
    <div className="rounded-lg border p-3">
      <div className="text-sm font-medium">{label}</div>
      <div className="mt-1 text-xs text-muted-foreground">
        You: {formatWeight(userValue, isMetric)} {isMetric ? "kg" : "lb"} | Gorilla est:{" "}
        {formatWeight(gorillaLow, isMetric)}-{formatWeight(gorillaHigh, isMetric)}{" "}
        {isMetric ? "kg" : "lb"}
      </div>
      <div className="mt-3 h-2 rounded-full bg-muted">
        <div
          className="h-2 rounded-full bg-primary"
          style={{ width: `${Math.min(100, percent)}%` }}
          aria-hidden
        />
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">
        ~{Math.round(percent)}% of gorilla equivalent midpoint
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
        humans: roundOneDecimal(lower.humans + (upper.humans - lower.humans) * t),
        gym: roundOneDecimal(lower.gym + (upper.gym - lower.gym) * t),
      };
    }
  }

  return {
    humans: HUMAN_PERCENTILE_TABLE[HUMAN_PERCENTILE_TABLE.length - 1].humans,
    gym: HUMAN_PERCENTILE_TABLE[HUMAN_PERCENTILE_TABLE.length - 1].gym,
  };
}

function formatWeight(valueLb, isMetric) {
  const value = isMetric ? valueLb * KG_PER_LB : valueLb;
  return roundOneDecimal(value);
}

function convertWeight(value, fromMetric, toMetric) {
  if (fromMetric === toMetric) return value;
  if (toMetric) return value * KG_PER_LB;
  return value * LB_PER_KG;
}

function roundWeight(value) {
  return Math.max(0, Math.round(value));
}

function roundOneDecimal(value) {
  return Math.round(value * 10) / 10;
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, value));
}
