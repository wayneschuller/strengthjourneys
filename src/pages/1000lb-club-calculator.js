import Head from "next/head";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { NextSeo } from "next-seo";
import { motion, useReducedMotion } from "motion/react";
import { RelatedArticles } from "@/components/article-cards";
import { MiniFeedbackWidget } from "@/components/feedback";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { cn } from "@/lib/utils";
import { GettingStartedCard } from "@/components/instructions-cards";
import { useLocalStorage } from "usehooks-ts";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  PageContainer,
  PageHeader,
  PageHeaderHeading,
  PageHeaderDescription,
  PageHeaderRight,
} from "@/components/page-header";

import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  Anvil,
  Trophy,
  LineChart,
  Calculator,
  BicepsFlexed,
  Bot,
} from "lucide-react";

import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

import { fetchRelatedArticles } from "@/lib/sanity-io.js";
import { gaTrackShareCopy } from "@/lib/analytics";
import { ShareCopyButton } from "@/components/share-copy-button";
import { useTransientSuccess } from "@/hooks/use-transient-success";

const BIG_FOUR_URLS = {
  "Back Squat": "/barbell-squat-insights",
  "Bench Press": "/barbell-bench-press-insights",
  Deadlift: "/barbell-deadlift-insights",
  "Strict Press": "/barbell-strict-press-insights",
};

const LIFT_GRAPHICS = {
  "Back Squat": "/back_squat.svg",
  "Bench Press": "/bench_press.svg",
  Deadlift: "/deadlift.svg",
};
const TARGET_TOTAL = 1000;

const FAQ_ITEMS = [
  {
    question: "What is the 1000lb club?",
    answer:
      "The 1000lb club means your back squat, bench press, and deadlift combined total is at least 1000 pounds.",
  },
  {
    question: "Do kilos count for the 1000lb club?",
    answer:
      "Yes. This calculator accepts pounds for the sliders and also shows kilogram conversions so you can track progress in either unit.",
  },
  {
    question: "Does strict press count toward a 1000lb total?",
    answer:
      "Most versions of the challenge use only back squat, bench press, and deadlift. Strict press is a strong benchmark but usually not part of the 1000lb total.",
  },
  {
    question: "What if my total is over 1000lb?",
    answer:
      "You are in the club. The calculator shows how far past 1000lb you are so you can set the next milestone.",
  },
];

const WHATS_NEXT_FEATURES = [
  {
    href: "/strength-level-calculator",
    title: "Strength Level Calculator",
    description:
      "How do you compare? Get beginner to elite ratings per lift by age and bodyweight.",
    IconComponent: BicepsFlexed,
  },
  {
    href: "/calculator",
    title: "E1RM Calculator",
    description:
      "Estimate your true 1RM from any set. Set better targets for your next block.",
    IconComponent: Calculator,
  },
  {
    href: "/analyzer",
    title: "PR Analyzer",
    description:
      "Track your PRs, consistency, and heatmaps. See progress over time.",
    IconComponent: Trophy,
  },
  {
    href: "/visualizer",
    title: "Strength Visualizer",
    description:
      "Charts of every lift over time. Watch your strength journey unfold.",
    IconComponent: LineChart,
  },
  {
    href: "/ai-lifting-assistant",
    title: "AI Lifting Assistant",
    description:
      "Ask questions, get program ideas, and advice from your lifting data.",
    IconComponent: Bot,
  },
];

export async function getStaticProps() {
  const RELATED_ARTICLES_CATEGORY = "1000lb Club";
  const relatedArticles = await fetchRelatedArticles(RELATED_ARTICLES_CATEGORY);

  return {
    props: {
      relatedArticles,
    },
    revalidate: 60 * 60,
  };
}

/**
 * 1000lb Club Calculator page. Renders SEO metadata and delegates rendering to ThousandPoundClubCalculatorMain.
 * @param {Object} props
 * @param {Array} props.relatedArticles - CMS articles related to the 1000lb Club topic, fetched via ISR.
 */
export default function ThousandPoundClubCalculator({ relatedArticles }) {
  // OG Meta Tags
  const canonicalURL =
    "https://www.strengthjourneys.xyz/1000lb-club-calculator";
  const description = "Free 1000lb Club Calculator. Instant results.";
  const title =
    "1000lb Club Calculator: Free Tool for Lifters. No login required.";
  const keywords =
    "1000lb Club Calculator, Strength level, strength test, strength standards, powerlifting benchmarks, how strong am I, one-rep max (1RM), squat rating, bench press rating, deadlift rating, overhead press rating, strength comparison, bodyweight ratio, age-adjusted strength, gender-specific strength levels, beginner to elite lifter, strength training progress, fitness assessment tool, weightlifting goals, strength sports";
  const ogImageURL =
    "https://www.strengthjourneys.xyz/strength_journeys_1000lb_club_calculator_og.png";
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "1000lb Club Calculator",
        applicationCategory: "HealthApplication",
        operatingSystem: "Any",
        description,
        url: canonicalURL,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: "https://www.strengthjourneys.xyz",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "1000lb Club Calculator",
            item: canonicalURL,
          },
        ],
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
          title: title,
          description: description,
          type: "website",
          images: [
            {
              url: ogImageURL,
              alt: "Strength Journeys 1000lb Club Calculator",
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
      {/* Keep the main component separate. I learned the hard way if it breaks server rendering you lose static metadata tags */}
      <ThousandPoundClubCalculatorMain relatedArticles={relatedArticles} />
    </>
  );
}

// Helpers: dual lb/kg display (1000lb club is lb-primary)
const toKg = (lbs) => (lbs * 0.453592).toFixed(1);
const KG_PER_LB = 0.453592;

/**
 * Inner client component for the 1000lb Club Calculator page. Provides squat/bench/deadlift sliders,
 * a donut progress chart, a confetti celebration when 1000lb is reached, and a shareable result.
 * @param {Object} props
 * @param {Array} props.relatedArticles - CMS articles to display in the related articles section.
 */
function ThousandPoundClubCalculatorMain({ relatedArticles }) {
  const { toast } = useToast();
  const { isSuccess: isCopied, triggerSuccess: triggerCopied } = useTransientSuccess();
  const prefersReducedMotion = useReducedMotion();
  const [squat, setSquat] = useLocalStorage(
    LOCAL_STORAGE_KEYS.THOUSAND_SQUAT,
    0,
    {
      initializeWithValue: false,
    },
  );
  const [bench, setBench] = useLocalStorage(
    LOCAL_STORAGE_KEYS.THOUSAND_BENCH,
    0,
    {
      initializeWithValue: false,
    },
  );
  const [deadlift, setDeadlift] = useLocalStorage(
    LOCAL_STORAGE_KEYS.THOUSAND_DEADLIFT,
    0,
    {
      initializeWithValue: false,
    },
  );
  const prevTotalRef = useRef(null);
  const hasCelebratedRef = useRef(false);
  const activeLiftTimeoutRef = useRef(null);
  const donutContainerRef = useRef(null);
  const [activeLiftKey, setActiveLiftKey] = useState(null);

  const total = squat + bench + deadlift;
  const inClub = total >= 1000;

  const toKgF = (n) => (Number(n) * KG_PER_LB).toFixed(1);
  const awayLbs = Math.max(0, 1000 - total);
  const pastLbs = Math.max(0, total - 1000);
  const liftRotationByKey = { squat: -4, bench: 3, deadlift: -3 };

  // Celebration when crossing 1000 (client-only, one-time per direction)
  useEffect(() => {
    return () => {
      if (activeLiftTimeoutRef.current) {
        clearTimeout(activeLiftTimeoutRef.current);
      }
    };
  }, []);

  const handleLiftValueChange =
    (liftKey, setter) =>
    ([v]) => {
      setter(v);
      if (prefersReducedMotion) return;
      setActiveLiftKey(liftKey);
      if (activeLiftTimeoutRef.current) {
        clearTimeout(activeLiftTimeoutRef.current);
      }
      activeLiftTimeoutRef.current = setTimeout(() => {
        setActiveLiftKey(null);
      }, 120);
    };

  const handleLiftValueCommit = () => {
    if (activeLiftTimeoutRef.current) {
      clearTimeout(activeLiftTimeoutRef.current);
    }
    setActiveLiftKey(null);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (prevTotalRef.current === null) {
      prevTotalRef.current = total;
      return;
    }
    const wasInClub = prevTotalRef.current >= 1000;
    const nowInClub = total >= 1000;
    prevTotalRef.current = total;
    if (!wasInClub && nowInClub) {
      hasCelebratedRef.current = true;
      const donutRect = donutContainerRef.current?.getBoundingClientRect();
      const x = donutRect
        ? Math.min(1, Math.max(0, (donutRect.left + donutRect.width / 2) / window.innerWidth))
        : 0.5;
      const y = donutRect
        ? Math.min(1, Math.max(0, (donutRect.top + donutRect.height / 2) / window.innerHeight))
        : 0.7;
      import("canvas-confetti").then((confetti) => {
        confetti.default({
          particleCount: 80,
          spread: 60,
          origin: { x, y },
        });
      });
    }
  }, [total]);

  const handleCopyResult = () => {
    const percent = Math.min(100, Math.round((total / 1000) * 100));
    const url = "https://www.strengthjourneys.xyz/1000lb-club-calculator";
    const lines = [
      inClub
        ? "I'm in the 1000 lb club!"
        : `I'm at ${percent}% of the 1000 lb club — ${awayLbs} lbs to go!`,
      "",
      `Back Squat: ${squat} lbs (${toKgF(squat)} kg)`,
      `Bench Press: ${bench} lbs (${toKgF(bench)} kg)`,
      `Deadlift: ${deadlift} lbs (${toKgF(deadlift)} kg)`,
      "",
      `Total: ${total} lbs (${toKgF(total)} kg)`,
      inClub ? `— ${pastLbs} lbs past 1000!` : "",
      "",
      "Strength Journeys",
      url,
    ].filter(Boolean);
    navigator.clipboard
      ?.writeText(lines.join("\n"))
      .then(() => {
        triggerCopied();
      })
      .catch(() => {
        toast({ variant: "destructive", title: "Could not copy to clipboard" });
      });
  };

  return (
    <PageContainer>
      <PageHeader>
        <PageHeaderHeading icon={Anvil}>
          1000lb Club Calculator
        </PageHeaderHeading>
        <PageHeaderDescription>
          How strong am I? Am I in the 1000lb Club? Use our 1000lb Club
          calculator to test if you have joined the hallowed order of strength.
        </PageHeaderDescription>
        <PageHeaderRight>
          <div className="text-muted-foreground hidden gap-2 md:flex md:flex-col xl:flex-row">
            <Link
              href="/strength-level-calculator"
              className="hover:bg-muted block rounded-lg border p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <h3 className="text-base font-semibold">
                Strength Level Calculator
              </h3>
              <p className="text-sm">How strong am I?</p>
            </Link>
            <Link
              href="/calculator"
              className="hover:bg-muted block rounded-lg border p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <h3 className="text-base font-semibold">E1RM Calculator</h3>
              <p className="text-sm">Set targets. Estimate 1RM from any set.</p>
            </Link>
          </div>
        </PageHeaderRight>
      </PageHeader>

      <Card className="pt-4">
        <CardContent className="pt-4">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px] xl:gap-8">
            <div className="space-y-6">
              {[
                {
                  key: "squat",
                  liftType: "Back Squat",
                  value: squat,
                  set: setSquat,
                },
                {
                  key: "bench",
                  liftType: "Bench Press",
                  value: bench,
                  set: setBench,
                },
                {
                  key: "deadlift",
                  liftType: "Deadlift",
                  value: deadlift,
                  set: setDeadlift,
                },
              ].map(({ key, liftType, value, set }) => (
                <div key={key} className="flex items-center gap-4">
                  <Link
                    href={BIG_FOUR_URLS[liftType]}
                    className="flex-shrink-0"
                    aria-hidden
                  >
                    <motion.img
                      src={LIFT_GRAPHICS[liftType]}
                      alt={`${liftType} exercise illustration`}
                      className="h-20 w-20 origin-bottom object-contain sm:h-24 sm:w-24 xl:h-32 xl:w-32"
                      animate={
                        prefersReducedMotion
                          ? undefined
                          : activeLiftKey === key
                            ? {
                                scale: 1.1,
                                y: -5,
                                rotate: liftRotationByKey[key] || 0,
                              }
                            : { scale: 1, y: 0, rotate: 0 }
                      }
                      transition={{
                        type: "spring",
                        stiffness: 360,
                        damping: 16,
                        mass: 0.6,
                      }}
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="text-lg font-semibold">
                      <Link
                        href={BIG_FOUR_URLS[liftType]}
                        className="underline decoration-dotted underline-offset-2 hover:text-blue-600"
                      >
                        {liftType}
                      </Link>
                      : {value} lbs ({toKgF(value)} kg)
                    </div>
                    <Slider
                      value={[value]}
                      min={0}
                      max={700}
                      step={5}
                      onValueChange={handleLiftValueChange(key, set)}
                      onValueCommit={handleLiftValueCommit}
                      className="mt-2"
                    />
                  </div>
                </div>
              ))}

              <motion.div
                className="mt-4 text-3xl font-bold tabular-nums"
                animate={
                  prefersReducedMotion
                    ? undefined
                    : activeLiftKey
                      ? { scale: 1.025, y: -1 }
                      : { scale: 1, y: 0 }
                }
                transition={{
                  type: "spring",
                  stiffness: 320,
                  damping: 22,
                  mass: 0.7,
                }}
              >
                Total: {total} lbs ({toKgF(total)} kg)
              </motion.div>

              <div
                className={cn("text-xl font-semibold", {
                  "text-green-600": inClub,
                  "text-muted-foreground": !inClub,
                })}
              >
                {inClub
                  ? `You're in the 1000lb Club! You're ${pastLbs} lbs (${toKgF(pastLbs)} kg) past 1000.`
                  : `You're ${awayLbs} lbs (${toKgF(awayLbs)} kg) away from the 1000lb Club.`}
              </div>
            </div>
            <div className="xl:self-center">
              <ThousandDonut
                total={total}
                containerRef={donutContainerRef}
                isAdjusting={Boolean(activeLiftKey)}
                prefersReducedMotion={prefersReducedMotion}
              />
            </div>
          </div>
          <div className="mt-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <MiniFeedbackWidget
                prompt="Useful calculator?"
                contextId="thousand_lb_club_calculator"
                page="/1000lb-club-calculator"
                analyticsExtra={{ context: "1000lb_club_calculator_card" }}
              />
              <ShareCopyButton
                label="Copy my result"
                successLabel="Copied"
                isSuccess={isCopied}
                onPressAnalytics={() =>
                  gaTrackShareCopy("1000lb_club", {
                    page: "/1000lb-club-calculator",
                  })}
                onClick={handleCopyResult}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 text-sm">
          <p>
            To see your strength level ratings per lift, see our{" "}
            <Link
              href="/strength-level-calculator"
              className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
            >
              Strength Level Calculator
            </Link>
            . Explore:{" "}
            <Link
              href={BIG_FOUR_URLS["Back Squat"]}
              className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
            >
              Squat
            </Link>
            {" · "}
            <Link
              href={BIG_FOUR_URLS["Bench Press"]}
              className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
            >
              Bench
            </Link>
            {" · "}
            <Link
              href={BIG_FOUR_URLS.Deadlift}
              className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
            >
              Deadlift
            </Link>
            {" · "}
            <Link
              href={BIG_FOUR_URLS["Strict Press"]}
              className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
            >
              Strict Press
            </Link>
          </p>
        </CardFooter>
      </Card>

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-semibold">
          You know your total. What&apos;s next?
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {WHATS_NEXT_FEATURES.map(
            ({ href, title, description, IconComponent }) => (
              <Link
                key={href}
                href={href}
                className="hover:bg-muted block rounded-lg border p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mb-2 flex items-center gap-2">
                  <IconComponent className="h-5 w-5" />
                  <h3 className="font-semibold">{title}</h3>
                </div>
                <p className="text-muted-foreground text-sm">{description}</p>
              </Link>
            ),
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-xl font-semibold">
          How the 1000lb Club calculator works
        </h2>
        <div className="space-y-3 text-sm leading-relaxed">
          <p>
            The formula is simple: <strong>Back Squat + Bench Press + Deadlift</strong>.
            If your total is at least <strong>{TARGET_TOTAL} lbs</strong>, you&apos;re in
            the 1000lb club.
          </p>
          <p>
            Use the sliders to estimate your current total, then compare your
            progress with our{" "}
            <Link
              href="/strength-level-calculator"
              className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
            >
              Strength Level Calculator
            </Link>{" "}
            and project training loads with the{" "}
            <Link
              href="/calculator"
              className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
            >
              E1RM Calculator
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-semibold">
          1000lb Club FAQ
        </h2>
        <div className="space-y-4">
          {FAQ_ITEMS.map(({ question, answer }) => (
            <article key={question} className="rounded-lg border p-4">
              <h3 className="text-base font-semibold">{question}</h3>
              <p className="text-muted-foreground mt-1 text-sm">{answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <GettingStartedCard />
      </section>

      <section className="mt-10">
        <p className="text-muted-foreground mb-4 text-sm">
          Learn more: what the 1000lb club is, why it matters, and how to get
          there—see our articles below.
        </p>
        <RelatedArticles articles={relatedArticles} />
      </section>
    </PageContainer>
  );
}

/**
 * Animated donut chart showing progress toward the 1000lb club target, with the total displayed
 * in the centre and a green color scheme once the target is reached.
 * @param {Object} props
 * @param {number} props.total - Combined squat + bench + deadlift total in pounds.
 * @param {number} [props.target=1000] - Target total in pounds (defaults to 1000).
 */
function ThousandDonut({
  total,
  target = 1000,
  containerRef,
  isAdjusting = false,
  prefersReducedMotion = false,
}) {
  const capped = Math.min(total, target);
  const remainder = Math.max(0, target - total);
  const data = [
    { name: "Progress", value: capped },
    { name: "Remainder", value: remainder },
  ];
  const COLORS = ["#10B981", "#1F2937"]; // emerald / gray-800

  const percent = Math.min(100, Math.round((total / target) * 100));
  const inClub = total >= target;
  const totalKg = (total * KG_PER_LB).toFixed(1);

  return (
    <motion.div
      ref={containerRef}
      className="relative mx-auto my-6 h-[220px] w-full max-w-md xl:h-[320px] xl:max-w-lg"
      animate={
        prefersReducedMotion
          ? undefined
          : isAdjusting
            ? {
                scale: 1.03,
                rotate: 0.6,
                filter: "drop-shadow(0 10px 18px rgba(16,185,129,0.24))",
              }
            : { scale: 1, rotate: 0, filter: "drop-shadow(0 0px 0px rgba(0,0,0,0))" }
      }
      whileHover={
        prefersReducedMotion
          ? undefined
          : {
              scale: 1.04,
              rotate: -0.6,
              filter: "drop-shadow(0 12px 20px rgba(16,185,129,0.26))",
            }
      }
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 18,
        mass: 0.7,
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius="62%"
            outerRadius="90%"
            startAngle={90}
            endAngle={-270}
            stroke="none"
            isAnimationActive={!prefersReducedMotion && !isAdjusting}
            animationDuration={220}
            animationEasing="ease-out"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <motion.div
          className="text-center tabular-nums"
          animate={
            prefersReducedMotion
              ? undefined
              : isAdjusting
                ? { scale: 1.06 }
                : { scale: 1 }
          }
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 20,
            mass: 0.6,
          }}
        >
          {inClub ? (
            <>
              <div className="text-3xl font-bold text-green-500 xl:text-4xl">
                {total} lbs
              </div>
              <div className="text-sm text-green-500/90 xl:text-base">({totalKg} kg)</div>
              <div className="text-sm font-semibold text-green-400 xl:text-base">
                1000lb Club!
              </div>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold xl:text-4xl">{total} lbs</div>
              <div className="text-muted-foreground text-xs xl:text-sm">
                ({totalKg} kg) of {target}
              </div>
              <div className="text-muted-foreground text-sm xl:text-lg">{percent}%</div>
            </>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
