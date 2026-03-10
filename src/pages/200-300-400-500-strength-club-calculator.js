import Head from "next/head";
import Link from "next/link";
import { useState, useEffect, useRef, useId, useCallback, useMemo } from "react";
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
  CardFooter,
} from "@/components/ui/card";

import {
  PageContainer,
  PageHeader,
  PageHeaderHeading,
  PageHeaderDescription,
  PageHeaderRight,
} from "@/components/page-header";

import { Slider } from "@/components/ui/slider";
import {
  Mountain,
  Trophy,
  LineChart,
  Calculator,
  BicepsFlexed,
  Bot,
  CircleDashed,
  Anvil,
} from "lucide-react";

import { PlateDiagram } from "@/components/warmups/plate-diagram";
import { calculatePlateBreakdown } from "@/lib/warmups";
import { fetchRelatedArticles } from "@/lib/sanity-io.js";
import { gaTrackShareCopy } from "@/lib/analytics";
import { ShareCopyButton } from "@/components/share-copy-button";
import { useTransientSuccess } from "@/hooks/use-transient-success";

const BIG_FOUR_URLS = {
  "Strict Press": "/barbell-strict-press-insights",
  "Bench Press": "/barbell-bench-press-insights",
  "Back Squat": "/barbell-squat-insights",
  Deadlift: "/barbell-deadlift-insights",
};

const LIFT_GRAPHICS = {
  "Strict Press": "/strict_press.svg",
  "Bench Press": "/bench_press.svg",
  "Back Squat": "/back_squat.svg",
  Deadlift: "/deadlift.svg",
};

const MILESTONES = [
  {
    key: "press",
    liftType: "Strict Press",
    target: 200,
    label: "200 lb Press",
    storageKey: LOCAL_STORAGE_KEYS.STRENGTH_CLUB_PRESS,
    defaultValue: 115,
    max: 400,
  },
  {
    key: "bench",
    liftType: "Bench Press",
    target: 300,
    label: "300 lb Bench",
    storageKey: LOCAL_STORAGE_KEYS.STRENGTH_CLUB_BENCH,
    defaultValue: 185,
    max: 500,
  },
  {
    key: "squat",
    liftType: "Back Squat",
    target: 400,
    label: "400 lb Squat",
    storageKey: LOCAL_STORAGE_KEYS.STRENGTH_CLUB_SQUAT,
    defaultValue: 255,
    max: 700,
  },
  {
    key: "deadlift",
    liftType: "Deadlift",
    target: 500,
    label: "500 lb Deadlift",
    storageKey: LOCAL_STORAGE_KEYS.STRENGTH_CLUB_DEADLIFT,
    defaultValue: 315,
    max: 800,
  },
];


const COMBINED_TARGET = 1400; // 200 + 300 + 400 + 500 (for display only)
const BAR_WEIGHT_LB = 45;
const STRENGTH_CLUB_DIAGRAM_IS_METRIC = false;
const STRENGTH_CLUB_PLATE_PREFERENCE = "blue";

const FAQ_ITEMS = [
  {
    question: "What is the 200/300/400/500 strength club?",
    answer:
      "It's a set of classic barbell milestones: a 200 lb strict press, 300 lb bench press, 400 lb back squat, and 500 lb deadlift. Achieving all four marks you as a seriously strong lifter.",
  },
  {
    question: "How long does it take to reach these milestones?",
    answer:
      "It varies hugely by individual. Most dedicated lifters can reach the bench and deadlift targets within 3-5 years. The 200 lb strict press is often the hardest and can take the longest.",
  },
  {
    question: "Why is the strict press the hardest milestone?",
    answer:
      "The strict press uses the smallest muscle groups of the four lifts. A 200 lb press represents an elite level of overhead strength for most natural lifters.",
  },
  {
    question: "What are these milestones in kilograms?",
    answer:
      "Roughly: 90 kg press, 136 kg bench, 181 kg squat, and 227 kg deadlift. The targets are culturally rooted in pounds but the challenge is universal.",
  },
  {
    question: "What do 2 plate, 3 plate, 4 plate, and 5 plate actually total?",
    answer:
      "On a standard 45 lb bar, the literal totals are 225 lb, 315 lb, 405 lb, and 495 lb. On a standard 20 kg bar, the equivalent plate milestones are 100 kg, 140 kg, 180 kg, and 220 kg. That is why the 200/300/400/500 club is closely related to the 2/3/4/5 plate idea, but not exactly the same numbers.",
  },
  {
    question: "Do I need to hit all four to be in the club?",
    answer:
      "Traditionally yes — all four lifts at their targets. But every milestone you reach is a major achievement worth celebrating on its own.",
  },
  {
    question: "Do I need to hit all these lifts on the same day?",
    answer:
      "No. You do not need to hit a 200 press, 300 bench, 400 squat, and 500 deadlift in one session. The usual standard is that you hit each milestone at some point in your lifting lifetime. That said, your old high school bench probably should not count unless you can still claim it with a straight face.",
  },
];

const WHATS_NEXT_FEATURES = [
  {
    href: "/1000lb-club-calculator",
    title: "1000lb Club Calculator",
    description:
      "Track your squat + bench + deadlift total toward the iconic 1000lb milestone.",
    IconComponent: Anvil,
  },
  {
    href: "/how-strong-am-i",
    title: "How Strong Am I?",
    description:
      "See your percentile rank across lifters, gym-goers, and powerlifting culture.",
    IconComponent: CircleDashed,
  },
  {
    href: "/big-four-strength-standards-calculator",
    title: "Big Four Strength Standards",
    description:
      "Check beginner-to-elite benchmarks for squat, bench, deadlift, and strict press.",
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
  const RELATED_ARTICLES_CATEGORY = "Strength Standards";
  const relatedArticles = await fetchRelatedArticles(RELATED_ARTICLES_CATEGORY);

  return {
    props: {
      relatedArticles,
    },
    revalidate: 60 * 60,
  };
}

/**
 * 200/300/400/500 Strength Club Calculator page.
 * Renders SEO metadata and delegates rendering to StrengthClubMain.
 */
export default function StrengthClubCalculator({ relatedArticles }) {
  const canonicalURL =
    "https://www.strengthjourneys.xyz/200-300-400-500-strength-club-calculator";
  const description =
    "Free 200/300/400/500 Strength Club Calculator — track your progress toward the classic barbell milestones: 200 press, 300 bench, 400 squat, 500 deadlift. The 2/3/4/5 plate club.";
  const title =
    "200/300/400/500 Strength Club Calculator: Track Your Barbell Milestones";
  const keywords =
    "200 300 400 500 strength club, 2 3 4 5 plate club, barbell milestones, strength standards, 200 lb press, 300 lb bench, 400 lb squat, 500 lb deadlift, powerlifting goals, strength calculator";
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "200/300/400/500 Strength Club Calculator",
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
            name: "200/300/400/500 Strength Club Calculator",
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
      <StrengthClubMain relatedArticles={relatedArticles} />
    </>
  );
}

// Helpers: dual lb/kg display (lb-primary, same as 1000lb club)
const KG_PER_LB = 0.453592;
const toKgF = (lbs) => (Number(lbs) * KG_PER_LB).toFixed(1);
const getStrengthClubPlateBreakdown = (totalWeightLb) =>
  calculatePlateBreakdown(
    totalWeightLb,
    BAR_WEIGHT_LB,
    STRENGTH_CLUB_DIAGRAM_IS_METRIC,
    STRENGTH_CLUB_PLATE_PREFERENCE,
  );

// Thor celebration: screen shake + lightning flash
const SHAKE_KEYFRAMES = `
@keyframes thor-shake {
  0%, 100% { transform: translate3d(0, 0, 0); }
  10% { transform: translate3d(-8px, 2px, 0); }
  20% { transform: translate3d(7px, -3px, 0); }
  30% { transform: translate3d(-6px, 4px, 0); }
  40% { transform: translate3d(5px, -2px, 0); }
  50% { transform: translate3d(-4px, 3px, 0); }
  60% { transform: translate3d(6px, -1px, 0); }
  70% { transform: translate3d(-3px, 2px, 0); }
  80% { transform: translate3d(4px, -2px, 0); }
  90% { transform: translate3d(-2px, 1px, 0); }
}
@keyframes lightning-flash {
  0% { opacity: 0; }
  5% { opacity: 0.9; }
  10% { opacity: 0; }
  15% { opacity: 0.6; }
  20% { opacity: 0; }
  100% { opacity: 0; }
}
`;

/**
 * Inner client component for the 200/300/400/500 Strength Club Calculator.
 */
function StrengthClubMain({ relatedArticles }) {
  const { toast } = useToast();
  const { isSuccess: isCopied, triggerSuccess: triggerCopied } =
    useTransientSuccess();
  const prefersReducedMotion = useReducedMotion();
  const [isShaking, setIsShaking] = useState(false);
  const [flashingCard, setFlashingCard] = useState(null);
  const prevValuesRef = useRef(null);
  const celebratedRef = useRef(new Set());
  const activeLiftTimeoutRef = useRef(null);
  const celebrationFrameRef = useRef(null);
  const [activeLiftKey, setActiveLiftKey] = useState(null);

  const [press, setPress] = useLocalStorage(
    LOCAL_STORAGE_KEYS.STRENGTH_CLUB_PRESS,
    115,
    { initializeWithValue: false },
  );
  const [bench, setBench] = useLocalStorage(
    LOCAL_STORAGE_KEYS.STRENGTH_CLUB_BENCH,
    185,
    { initializeWithValue: false },
  );
  const [squat, setSquat] = useLocalStorage(
    LOCAL_STORAGE_KEYS.STRENGTH_CLUB_SQUAT,
    255,
    { initializeWithValue: false },
  );
  const [deadlift, setDeadlift] = useLocalStorage(
    LOCAL_STORAGE_KEYS.STRENGTH_CLUB_DEADLIFT,
    315,
    { initializeWithValue: false },
  );

  const setters = { press: setPress, bench: setBench, squat: setSquat, deadlift: setDeadlift };
  const values = useMemo(() => ({ press, bench, squat, deadlift }), [press, bench, squat, deadlift]);
  const total = press + bench + squat + deadlift;
  const allAchieved = MILESTONES.every((m) => values[m.key] >= m.target);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (activeLiftTimeoutRef.current) {
        clearTimeout(activeLiftTimeoutRef.current);
      }
      if (celebrationFrameRef.current) {
        cancelAnimationFrame(celebrationFrameRef.current);
      }
    };
  }, []);

  const handleLiftValueChange = useCallback(
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
      },
    [prefersReducedMotion],
  );

  const handleLiftValueCommit = useCallback(() => {
    if (activeLiftTimeoutRef.current) {
      clearTimeout(activeLiftTimeoutRef.current);
    }
    setActiveLiftKey(null);
  }, []);

  const triggerThorCelebration = useCallback((cardKey) => {
    // Screen shake
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 600);

    // Lightning flash on the achieved card
    setFlashingCard(cardKey);
    setTimeout(() => setFlashingCard(null), 400);

    // Mobile haptic
    if (navigator.vibrate) {
      navigator.vibrate([100, 30, 100, 30, 60]);
    }
  }, []);

  // Thor celebration when crossing a milestone threshold
  useEffect(() => {
    if (typeof window === "undefined" || prefersReducedMotion) return;

    if (prevValuesRef.current === null) {
      prevValuesRef.current = { ...values };
      // Mark already-achieved milestones so they don't trigger on first load
      MILESTONES.forEach((m) => {
        if (values[m.key] >= m.target) {
          celebratedRef.current.add(m.key);
        }
      });
      return;
    }

    const prev = prevValuesRef.current;
    prevValuesRef.current = { ...values };

    for (const m of MILESTONES) {
      const wasBelow = prev[m.key] < m.target;
      const nowAtOrAbove = values[m.key] >= m.target;
      if (wasBelow && nowAtOrAbove && !celebratedRef.current.has(m.key)) {
        celebratedRef.current.add(m.key);
        celebrationFrameRef.current = requestAnimationFrame(() => {
          triggerThorCelebration(m.key);
          celebrationFrameRef.current = null;
        });
        break; // One celebration at a time
      }
    }
  }, [press, bench, squat, deadlift, prefersReducedMotion, triggerThorCelebration, values]);

  const handleCopyResult = () => {
    const achieved = MILESTONES.filter((m) => values[m.key] >= m.target);
    const url =
      "https://www.strengthjourneys.xyz/200-300-400-500-strength-club-calculator";
    const lines = [
      allAchieved
        ? "I've conquered the 200/300/400/500 Strength Club!"
        : `I've hit ${achieved.length} of 4 milestones in the 200/300/400/500 Strength Club!`,
      "",
      ...MILESTONES.map(
        (m) =>
          `${values[m.key] >= m.target ? "\u2705" : "\u2b1c"} ${m.liftType}: ${values[m.key]} lbs (${toKgF(values[m.key])} kg) — target ${m.target} lbs`,
      ),
      "",
      `Total: ${total} lbs (${toKgF(total)} kg)`,
      "",
      "Strength Journeys",
      url,
    ];
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
      <style dangerouslySetInnerHTML={{ __html: SHAKE_KEYFRAMES }} />

      <div
        style={
          isShaking
            ? { animation: "thor-shake 0.6s ease-in-out" }
            : undefined
        }
      >
        <PageHeader>
          <PageHeaderHeading icon={Mountain}>
            200/300/400/500 Strength Club
          </PageHeaderHeading>
          <PageHeaderDescription>
            The classic barbell milestones — a 200 lb press, 300 lb bench,
            400 lb squat, and 500 lb deadlift. Also known as the{" "}
            <strong>2/3/4/5 plate club</strong>. Track your progress toward
            each target below.
          </PageHeaderDescription>
          <PageHeaderRight>
            <div className="text-muted-foreground hidden gap-2 md:flex md:flex-col xl:flex-row">
              <Link
                href="/1000lb-club-calculator"
                className="hover:bg-muted block rounded-lg border p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <h3 className="text-base font-semibold">1000lb Club</h3>
                <p className="text-sm">
                  Track your S/B/D total toward 1000 lbs.
                </p>
              </Link>
              <Link
                href="/big-four-strength-standards-calculator"
                className="hover:bg-muted block rounded-lg border p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <h3 className="text-base font-semibold">
                  Big Four Standards
                </h3>
                <p className="text-sm">
                  Beginner-to-elite benchmarks per lift.
                </p>
              </Link>
            </div>
          </PageHeaderRight>
        </PageHeader>

        <Card className="pt-4">
          <CardContent className="pt-4">
            <div className="grid gap-6 md:grid-cols-2">
              {MILESTONES.map((milestone, index) => (
                <MilestoneCard
                  key={milestone.key}
                  milestone={milestone}
                  value={values[milestone.key]}
                  setter={setters[milestone.key]}
                  index={index}
                  isFlashing={flashingCard === milestone.key}
                  isActive={activeLiftKey === milestone.key}
                  onValueChange={handleLiftValueChange}
                  onValueCommit={handleLiftValueCommit}
                  prefersReducedMotion={prefersReducedMotion}
                />
              ))}
            </div>

            {/* Combined total summary */}
            <div className="mt-6 rounded-lg border p-4 text-center">
              <div className="text-muted-foreground text-sm">Combined Total</div>
              <div className="text-3xl font-bold tabular-nums">
                {total} lbs{" "}
                <span className="text-muted-foreground text-lg font-normal">
                  ({toKgF(total)} kg)
                </span>
              </div>
              <div
                className={cn("mt-1 text-sm font-semibold", {
                  "text-green-600": allAchieved,
                  "text-muted-foreground": !allAchieved,
                })}
              >
                {allAchieved
                  ? "All four milestones achieved! You're in the 200/300/400/500 club!"
                  : `${MILESTONES.filter((m) => values[m.key] >= m.target).length} of 4 milestones achieved`}
              </div>
            </div>

            <div className="mt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <MiniFeedbackWidget
                  prompt="Useful?"
                  contextId="strength_club_calculator"
                  page="/200-300-400-500-strength-club-calculator"
                  analyticsExtra={{ context: "strength_club_calculator_card" }}
                />
                <ShareCopyButton
                  label="Copy my result"
                  successLabel="Copied"
                  isSuccess={isCopied}
                  onPressAnalytics={() =>
                    gaTrackShareCopy("strength_club", {
                      page: "/200-300-400-500-strength-club-calculator",
                    })
                  }
                  onClick={handleCopyResult}
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-2 text-sm">
            <p>
              See your beginner-to-elite standards per lift at our{" "}
              <Link
                href="/big-four-strength-standards-calculator"
                className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
              >
                Big Four Strength Standards Calculator
              </Link>
              . Explore:{" "}
              <Link
                href={BIG_FOUR_URLS["Strict Press"]}
                className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
              >
                Press
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
                href={BIG_FOUR_URLS["Back Squat"]}
                className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
              >
                Squat
              </Link>
              {" · "}
              <Link
                href={BIG_FOUR_URLS.Deadlift}
                className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
              >
                Deadlift
              </Link>
            </p>
          </CardFooter>
        </Card>

        <section className="mt-10">
          <h2 className="mb-4 text-xl font-semibold">
            Know your milestones. What&apos;s next?
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
            About the 200/300/400/500 milestones
          </h2>
          <div className="space-y-3 text-sm leading-relaxed">
            <p>
              The <strong>200/300/400/500</strong> targets represent iconic
              barbell strength milestones: a <strong>200 lb strict press</strong>,{" "}
              <strong>300 lb bench press</strong>,{" "}
              <strong>400 lb back squat</strong>, and{" "}
              <strong>500 lb deadlift</strong>. Together they total{" "}
              <strong>1,400 lbs</strong>.
            </p>
            <p>
              These numbers align roughly with the 2/3/4/5 plate-per-side
              loading pattern, making them easy to remember and deeply
              satisfying to achieve. Use the sliders above to see how close
              you are, then check your per-lift standards with our{" "}
              <Link
                href="/big-four-strength-standards-calculator"
                className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
              >
                Big Four Strength Standards Calculator
              </Link>
              .
            </p>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="mb-4 text-xl font-semibold">FAQ</h2>
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
            Learn more about strength standards, milestones, and training
            strategies in our articles below.
          </p>
          <RelatedArticles articles={relatedArticles} />
        </section>
      </div>
    </PageContainer>
  );
}

/**
 * Individual milestone card with slider, plate diagram, and gradient fill background.
 */
function MilestoneCard({
  milestone,
  value,
  setter,
  index,
  isFlashing,
  isActive,
  onValueChange,
  onValueCommit,
  prefersReducedMotion,
}) {
  const { key, liftType, target, max } = milestone;
  const percent = Math.min(100, Math.round((value / target) * 100));
  const achieved = value >= target;

  // These milestone diagrams are intentionally always shown with lb plates.
  const breakdown = getStrengthClubPlateBreakdown(value);

  // Green gradient fill that rises from bottom based on progress
  const fillPercent = Math.min(100, (value / target) * 100);

  // Border/glow color based on progress
  const getBorderStyle = () => {
    if (achieved) {
      return {
        borderColor: "rgb(16 185 129)",
        boxShadow: "0 0 20px rgba(16, 185, 129, 0.4), 0 0 40px rgba(16, 185, 129, 0.15)",
      };
    }
    if (percent >= 75) {
      return {
        borderColor: `rgba(16, 185, 129, ${0.3 + (percent - 75) * 0.028})`,
        boxShadow: `0 0 ${(percent - 75) * 0.6}px rgba(16, 185, 129, 0.2)`,
      };
    }
    if (percent >= 50) {
      return {
        borderColor: `rgba(16, 185, 129, ${(percent - 50) * 0.012})`,
      };
    }
    return {};
  };

  return (
    <motion.div
      className="relative overflow-hidden rounded-lg border-2 p-4"
      style={getBorderStyle()}
      initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
      animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 20,
        delay: 0.15 + index * 0.12,
      }}
    >
      {/* Green gradient fill background */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 transition-all duration-300"
        style={{
          height: `${fillPercent}%`,
          background: achieved
            ? "linear-gradient(to top, rgba(16, 185, 129, 0.18), rgba(52, 211, 153, 0.08))"
            : `linear-gradient(to top, rgba(16, 185, 129, ${0.04 + fillPercent * 0.001}), transparent)`,
        }}
      />

      {/* Lightning flash overlay */}
      {isFlashing && (
        <div
          className="pointer-events-none absolute inset-0 z-10 bg-white"
          style={{ animation: "lightning-flash 0.4s ease-out forwards" }}
        />
      )}

      {/* Content */}
      <div className="relative z-[1]">
        {/* Header: target number + lift name + SVG */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={BIG_FOUR_URLS[liftType]} className="flex-shrink-0">
              <motion.img
                src={LIFT_GRAPHICS[liftType]}
                alt={`${liftType} illustration`}
                className="h-20 w-20 origin-bottom object-contain sm:h-24 sm:w-24"
                animate={
                  prefersReducedMotion
                    ? undefined
                    : isActive
                      ? { scale: 1.1, y: -3 }
                      : { scale: 1, y: 0 }
                }
                transition={{
                  type: "spring",
                  stiffness: 360,
                  damping: 16,
                  mass: 0.6,
                }}
              />
            </Link>
            <div>
              <div className="flex items-baseline gap-1 text-4xl font-black tabular-nums sm:text-5xl">
                {target}
                <span className="text-muted-foreground text-sm font-semibold uppercase sm:text-base">
                  lb
                </span>
              </div>
              <Link
                href={BIG_FOUR_URLS[liftType]}
                className="text-muted-foreground text-sm font-semibold underline decoration-dotted underline-offset-2 hover:text-blue-600"
              >
                {liftType}
              </Link>
            </div>
          </div>
          {achieved && (
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 15 }}
            >
              <Trophy className="h-8 w-8 text-amber-500" />
            </motion.div>
          )}
        </div>

        {/* Plate diagram — exact loading, updates with slider */}
        <div className="mb-3">
          <PlateDiagram
            platesPerSide={breakdown.platesPerSide}
            barWeight={BAR_WEIGHT_LB}
            isMetric={STRENGTH_CLUB_DIAGRAM_IS_METRIC}
            hideLabels
            animationDelay={0.3 + index * 0.1}
            animationKey={`plates-${key}-${value}`}
          />
          <p className="text-muted-foreground mt-2 text-xs">
            Plate diagram uses standard lb plates, even if you train in kg.
          </p>
        </div>

        {/* Slider */}
        <div className="mb-2">
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-xl font-bold tabular-nums">
              {value} lbs{" "}
              <span className="text-muted-foreground text-sm font-normal">
                ({toKgF(value)} kg)
              </span>
            </span>
            <span
              className={cn("text-sm font-semibold tabular-nums", {
                "text-green-600": achieved,
                "text-muted-foreground": !achieved,
              })}
            >
              {percent}%
            </span>
          </div>
          <Slider
            value={[value]}
            min={0}
            max={max}
            step={5}
            onValueChange={onValueChange(key, setter)}
            onValueCommit={onValueCommit}
            className={`${prefersReducedMotion ? "" : `thumb-spring thumb-spring-${index}`}`}
          />
        </div>

        {/* Status text */}
        <div
          className={cn("text-sm font-medium", {
            "text-green-600": achieved,
            "text-muted-foreground": !achieved,
          })}
        >
          {achieved
            ? `${value - target} lbs past the milestone!`
            : `${target - value} lbs to go`}
        </div>
      </div>
    </motion.div>
  );
}
