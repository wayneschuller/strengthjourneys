import Head from "next/head";
import Link from "next/link";
import { NextSeo } from "next-seo";
import { useEffect, useMemo, useState } from "react";
import { useLocalStorage } from "usehooks-ts";
import { motion } from "motion/react";
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

// Trained human bench press baseline (lb)
const TRAINED_HUMAN_BASE_BENCH_LB = 175;

// Gorilla bench equivalents (fixed — nobody is actually measuring this)
const GORILLA_BENCH_LOW_LB = TRAINED_HUMAN_BASE_BENCH_LB * GORILLA_MULTIPLIER_LOW;  // 1050
const GORILLA_BENCH_MID_LB = TRAINED_HUMAN_BASE_BENCH_LB * GORILLA_MULTIPLIER_MID;  // 1400
const GORILLA_BENCH_HIGH_LB = TRAINED_HUMAN_BASE_BENCH_LB * GORILLA_MULTIPLIER_HIGH; // 1750

const DEFAULT_BENCH_LB = 135;

// Approximate bench-only percentiles (ratio = bench / ~185 lb assumed bodyweight)
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

const ASSUMED_BODYWEIGHT_LB = 185;

export async function getStaticProps() {
  const RELATED_ARTICLES_CATEGORY = "Strength Calculator";
  const relatedArticles = await fetchRelatedArticles(RELATED_ARTICLES_CATEGORY);

  return {
    props: { relatedArticles },
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
  const [bench, setBench] = useLocalStorage(
    LOCAL_STORAGE_KEYS.GORILLA_BENCH,
    DEFAULT_BENCH_LB,
    { initializeWithValue: false },
  );

  useEffect(() => {
    if (!isCopied) return;
    const timer = setTimeout(() => setIsCopied(false), 1400);
    return () => clearTimeout(timer);
  }, [isCopied]);

  const benchLb = isMetric ? bench * LB_PER_KG : bench;
  const gorillaPercent = clamp((benchLb / GORILLA_BENCH_MID_LB) * 100, 0, 999);
  const fillPercent = clamp(gorillaPercent, 0, 100);

  // Gorilla grows from cowering (0.18) to full menace (1.0) as you approach 100%
  const gorillaScale = 0.18 + (fillPercent / 100) * 0.82;
  const gorillaOpacity = 0.3 + (fillPercent / 100) * 0.7;

  // Use fixed assumed bodyweight for percentile ratio (fun approximation)
  const strengthRatio = benchLb / ASSUMED_BODYWEIGHT_LB;
  const percentile = useMemo(
    () => getEstimatedPercentiles(strengthRatio),
    [strengthRatio],
  );

  const scoreUnit = isMetric ? "kg" : "lb";
  const displayBench = Math.round(bench);
  const displayGorillaMid = formatWeightInt(GORILLA_BENCH_MID_LB, isMetric);
  const displayGorillaLow = formatWeightInt(GORILLA_BENCH_LOW_LB, isMetric);
  const displayGorillaHigh = formatWeightInt(GORILLA_BENCH_HIGH_LB, isMetric);

  const bragLine = getBragLine(gorillaPercent);

  const handleUnitSwitch = () => {
    const nextIsMetric = !isMetric;
    setIsMetric(nextIsMetric);
    setBench((prev) => Math.max(0, Math.round(convertWeight(prev, isMetric, nextIsMetric))));
  };

  const copyResult = async () => {
    const text =
      `My bench press is ~${Math.round(gorillaPercent)}% of a gorilla's. ` +
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
          Enter your bench press. Find out how badly you&apos;d lose.
          Please do not challenge an actual gorilla.
        </PageHeaderDescription>
      </PageHeader>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <CardTitle>Your Gorilla Number</CardTitle>
            <UnitChooser isMetric={isMetric} onSwitchChange={handleUnitSwitch} />
          </div>
        </CardHeader>

        <CardContent className="space-y-8 pb-6 pt-2">

          {/* ── HERO RESULT ── */}
          <div
            className="rounded-2xl p-6 text-center"
            style={{ background: DEADLIFT_COLOR_SOFT }}
          >
            {/* Gorilla + percentage side by side */}
            <div className="flex items-end justify-center gap-4">
              <motion.div
                animate={{ scale: gorillaScale, opacity: gorillaOpacity }}
                transition={{ type: "spring", stiffness: 220, damping: 18 }}
                style={{ transformOrigin: "bottom center" }}
                className="shrink-0"
              >
                <GorillaIcon size={120} color={DEADLIFT_COLOR} />
              </motion.div>
              <p
                className="text-[5rem] font-black leading-none tabular-nums tracking-tighter sm:text-[6rem]"
                style={{ color: DEADLIFT_COLOR }}
              >
                ~{Math.round(gorillaPercent)}%
              </p>
            </div>
            <p className="mt-3 text-base font-semibold">
              of a silverback gorilla&apos;s bench press
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
          <div className="grid grid-cols-3 gap-3">
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
              label="Gorilla bench"
              value={`~${displayGorillaMid}`}
              sub={`${scoreUnit} (${displayGorillaLow}–${displayGorillaHigh})`}
            />
          </div>

          {/* ── SINGLE SLIDER ── */}
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Your bench press
            </p>
            <div className="space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <Label className="text-sm font-semibold">Bench Press 1RM</Label>
                <span
                  className="shrink-0 text-xl font-black tabular-nums"
                  style={{ color: DEADLIFT_COLOR }}
                >
                  {displayBench}
                  <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                    {scoreUnit}
                  </span>
                </span>
              </div>
              <Slider
                min={isMetric ? 20 : 45}
                max={isMetric ? 320 : 700}
                step={isMetric ? 2.5 : 5}
                value={[bench]}
                onValueChange={(vals) => setBench(vals[0])}
                aria-label={`Bench press 1RM in ${scoreUnit}`}
              />
              <p className="text-xs text-muted-foreground">
                Your best single rep — form optional, honesty required.
              </p>
            </div>
          </div>

          {/* ── SHARE + LINK ── */}
          <div className="flex flex-wrap items-center gap-3 border-t pt-6">
            <Button
              onClick={copyResult}
              style={{ backgroundColor: DEADLIFT_COLOR }}
            >
              {isCopied ? "✓ Copied! (Gorillas can't read)" : "Share result"}
            </Button>
            <Link
              href="/how-strong-am-i"
              className="text-sm font-semibold underline-offset-2 hover:underline"
              style={{ color: DEADLIFT_COLOR }}
            >
              Want the serious version? → How Strong Am I?
            </Link>
          </div>

          {/* ── HOW DOES THIS WORK ── */}
          <Accordion type="single" collapsible>
            <AccordionItem value="methodology">
              <AccordionTrigger>How does this work?</AccordionTrigger>
              <AccordionContent>
                <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
                  <li>
                    A silverback gorilla is estimated to have the upper-body strength of
                    6–10 trained human lifters. Nobody has actually tested a silverback
                    in a squat rack. For obvious reasons.
                  </li>
                  <li>
                    We use a 175 lb trained human bench press as our baseline, giving a
                    gorilla equivalent of roughly {displayGorillaLow}–{displayGorillaHigh}{" "}
                    {scoreUnit}. The midpoint (~{displayGorillaMid} {scoreUnit}) is your
                    target to hit 100%.
                  </li>
                  <li>
                    Percentile estimates assume an average bodyweight and are very
                    approximate. This is a fun tool, not a research paper.
                  </li>
                  <li>
                    Seriously, do not fight a gorilla. You will lose regardless of your
                    bench press.
                  </li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>

        <CardFooter className="pt-0 text-xs text-muted-foreground">
          For entertainment only. We accept no liability for gorilla-related incidents.
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getBragLine(percent) {
  if (percent < 5) return "A gorilla could bench you. As a warm-up set.";
  if (percent < 10) return "You are in the game. A small, very brave game.";
  if (percent < 20) return "About 1/10th of a gorilla. Solid for your species.";
  if (percent < 35) return "Closing in on primate territory. The gorilla is not concerned.";
  if (percent < 50) return "Gym-scary. Jungle — not so much.";
  return "You might be the problem in the jungle. Still wouldn't recommend it.";
}
