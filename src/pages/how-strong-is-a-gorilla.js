import Head from "next/head";
import Image from "next/image";
import { NextSeo } from "next-seo";
import { useEffect, useMemo, useState } from "react";
import { useLocalStorage } from "usehooks-ts";
import { motion } from "motion/react";
import { Share2, Shield } from "lucide-react";
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
const ASSUMED_BODYWEIGHT_LB = 185;
const MOCKING_THRESHOLD_KG = 180;
const MOCKING_THRESHOLD_LB = MOCKING_THRESHOLD_KG * LB_PER_KG;

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

const FAQ_ITEMS = [
  {
    question: "How strong is a gorilla actually?",
    answer:
      "A silverback gorilla is estimated at 6–10x the upper-body strength of a trained human, based on comparative anatomy studies of muscle fiber density and limb mechanics. Nobody has tested this in a gym setting. For obvious reasons.",
  },
  {
    question: "Why bench press specifically?",
    answer:
      "Bench press is the most commonly tracked upper-body strength lift and the best single proxy for human pushing power. It keeps the comparison clean, simple, and braggable at the gym.",
  },
  {
    question: "Can I actually beat a gorilla?",
    answer:
      "No. A silverback weighs 400–500 lb of near-pure muscle and has been observed throwing 800 lb objects. Your bench press number is irrelevant in an actual encounter. Please do not attempt to verify this.",
  },
  {
    question: "Is this scientifically accurate?",
    answer:
      "It is a playful estimate based on published comparative strength research. The 6–10x multiplier is the most commonly cited figure in the literature. The exact number varies by source, study methodology, and which gorilla showed up that day.",
  },
  {
    question: "Are gorillas basically just angry bodybuilders?",
    answer:
      "No. Gorillas are more like very large yoga dads. Immensely strong, deeply chill, and far more likely to babysit than brawl.",
  },
  {
    question: "How strong is a silverback, really?",
    answer:
      "Strong enough that if he were a gym member, he'd be banned for breaking equipment. Silverbacks can weigh up to 400 lbs and casually move things you'd need a forklift for — all while eating salad.",
  },
  {
    question: "What does “silverback” actually mean?",
    answer:
      "It's not a job title, rank, or Hogwarts house. It simply means: adult male gorilla with stylish silver hair. Think distinguished, not midlife crisis.",
  },
];

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
            "@type": "FAQPage",
            mainEntity: FAQ_ITEMS.map(({ question, answer }) => ({
              "@type": "Question",
              name: question,
              acceptedAnswer: { "@type": "Answer", text: answer },
            })),
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

  // Use fixed assumed bodyweight for percentile ratio (fun approximation)
  const strengthRatio = benchLb / ASSUMED_BODYWEIGHT_LB;
  const percentile = useMemo(
    () => getEstimatedPercentiles(strengthRatio),
    [strengthRatio],
  );

  const scoreUnit = isMetric ? "kg" : "lb";
  const displayBench = Math.round(bench);
  const displayGorillaMid = formatWeightInt(GORILLA_BENCH_MID_LB, isMetric);

  const bragLine = getBragLine(gorillaPercent, benchLb);

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
            className="relative rounded-2xl p-6 text-center"
            style={{ background: DEADLIFT_COLOR_SOFT }}
          >
            {/* Percentage centered in row; right card is right-justified on desktop */}
            <div className="relative overflow-visible py-3 md:grid md:grid-cols-[1fr_auto_1fr] md:items-start md:gap-4">
              <div className="md:col-start-2 flex flex-col items-center justify-center gap-1">
                <motion.div
                  key={`gorilla-wobble-${bench}`}
                  className="pointer-events-none hidden sm:block"
                  initial={{ rotate: 0, y: 0 }}
                  animate={{ rotate: [0, -6, 6, -4, 3, 0], y: [0, -6, 0, -3, 0] }}
                  transition={{ duration: 0.65, ease: "easeInOut" }}
                >
                  <img
                    src="/gorilla1.png"
                    alt=""
                    width="420"
                    height="420"
                    aria-hidden="true"
                    className="h-28 w-auto md:h-32"
                  />
                </motion.div>
                <p
                  className="text-center text-[6rem] font-black leading-none tabular-nums tracking-tighter sm:text-[7rem]"
                  style={{ color: DEADLIFT_COLOR }}
                >
                  {Math.round(gorillaPercent)}%
                </p>
              </div>

              <div className="mx-auto mt-4 w-full max-w-[640px] rounded-xl border bg-background/65 p-3 text-center backdrop-blur-[1px] md:absolute md:left-0 md:top-1/2 md:mt-0 md:w-fit md:-translate-y-1/2">
                <div className="flex items-center gap-1 text-left">
                  <div className="relative h-[clamp(80px,12.8vh,136px)] aspect-[1200/700]">
                    <Image
                      src="/human_bench.png"
                      alt=""
                      fill
                      aria-hidden="true"
                      className="object-contain object-right opacity-90"
                    />
                  </div>
                  <div className="shrink-0">
                    <p className="text-xs text-muted-foreground">Human bench</p>
                    <p className="text-2xl font-black tabular-nums md:text-3xl" style={{ color: DEADLIFT_COLOR }}>
                      {displayBench}
                      <span className="ml-1 text-base font-semibold text-muted-foreground">
                        {scoreUnit}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="mx-auto mt-4 w-full max-w-[640px] rounded-xl border bg-background/65 p-3 text-center backdrop-blur-[1px] md:absolute md:right-0 md:top-1/2 md:mt-0 md:w-fit md:-translate-y-1/2">
                <div className="flex items-center gap-1 text-left">
                  <div className="shrink-0">
                    <p className="text-xs text-muted-foreground">Gorilla bench</p>
                    <p className="text-2xl font-black tabular-nums md:text-3xl" style={{ color: DEADLIFT_COLOR }}>
                      ~{displayGorillaMid}
                      <span className="ml-1 text-base font-semibold text-muted-foreground">
                        {scoreUnit}
                      </span>
                    </p>
                  </div>
                  <div className="relative h-[clamp(80px,12.8vh,136px)] aspect-[1200/700]">
                    <Image
                      src="/gorilla_bench.png"
                      alt=""
                      fill
                      aria-hidden="true"
                      className="object-contain object-left opacity-90"
                    />
                  </div>
                </div>
              </div>
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
            <StatTile label="Stronger than" value="0%" sub="of all gorillas" />
          </div>

          {/* ── SINGLE SLIDER ── */}
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Your bench press
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="flex items-center gap-1.5 text-sm font-semibold">
                  <Shield className="h-4 w-4 shrink-0" style={{ color: DEADLIFT_COLOR }} />
                  Bench Press 1RM
                </Label>
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
              <div className="flex items-center gap-2">
                <Image
                  src="/bench_press.svg"
                  alt=""
                  width={64}
                  height={64}
                  aria-hidden="true"
                  className="shrink-0 opacity-90"
                />
                <Slider
                  min={isMetric ? 20 : 45}
                  max={isMetric ? 320 : 700}
                  step={isMetric ? 2.5 : 5}
                  value={[bench]}
                  onValueChange={(vals) => setBench(vals[0])}
                  aria-label={`Bench press 1RM in ${scoreUnit}`}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Your best single rep — form optional, honesty required.
              </p>
            </div>
          </div>

          {/* ── SHARE ── */}
          {/* TODO: When How Strong Am I? is public, add a link here:
              "Want the serious version? → How Strong Am I? (/how-strong-am-i)" */}
          <div className="flex justify-center border-t pt-6">
            <Button
              onClick={copyResult}
              style={{ backgroundColor: DEADLIFT_COLOR }}
            >
              {isCopied ? (
                "✓ Copied! (Gorillas can't read)"
              ) : (
                <>
                  <Share2 className="mr-2 h-4 w-4" />
                  Share result
                </>
              )}
            </Button>
          </div>
        </CardContent>

        <CardFooter className="pt-0 text-xs text-muted-foreground">
          For entertainment only. We accept no liability for gorilla-related incidents.
        </CardFooter>
      </Card>

      {/* ── FAQ ── */}
      <section className="mt-10">
        <h2 className="mb-4 text-xl font-semibold">Gorilla Strength FAQ</h2>
        <div className="space-y-4">
          {FAQ_ITEMS.map(({ question, answer }) => (
            <article key={question} className="rounded-lg border p-4">
              <h3 className="text-base font-semibold">{question}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{answer}</p>
            </article>
          ))}
        </div>
      </section>

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

function getBragLine(percent, benchLb) {
  if (benchLb <= MOCKING_THRESHOLD_LB) {
    if (percent < 5) return "A gorilla could bench you. As a warm-up set.";
    if (percent < 10) return "You are in the game. A small, very brave game.";
    if (percent < 20) return "About 1/10th of a gorilla. Solid for your species.";
    if (percent < 28) return "Closing in on primate territory. The gorilla is not concerned.";
    return "Big human numbers. The gorilla has noticed you now.";
  }

  if (benchLb < 485) return "180kg+? Sure. And your spotter was Bigfoot.";
  if (benchLb < 575) return "That number is strong. Your honesty is not.";
  if (benchLb < 700) return "We checked. The bar is bent from fiction.";
  return "Legendary strength. Completely imaginary, but legendary.";
}
