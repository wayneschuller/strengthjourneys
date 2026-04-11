/**
 * Plate Milestones — how many plates can you lift?
 *
 * A fun, data-aware tracker for the classic gym-floor milestones:
 *   1 plate press, 2 plate bench, 3 plate squat, 4 plate deadlift.
 *
 * "Plates", "wheels", "45s", "blues" — whatever you call them, this page
 * tracks your progress toward each tier across the big four lifts.
 */
import Head from "next/head";
import Link from "next/link";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { NextSeo } from "next-seo";
import { motion, useReducedMotion } from "motion/react";
import { RelatedArticles } from "@/components/article-cards";
import { MiniFeedbackWidget } from "@/components/feedback";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { cn } from "@/lib/utils";
import { GettingStartedCard } from "@/components/onboarding/instructions-cards";
import { useLocalStorage, useReadLocalStorage } from "usehooks-ts";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
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
  Trophy,
  LineChart,
  Calculator,
  BicepsFlexed,
  Bot,
  CircleDashed,
  Anvil,
  Mountain,
  RotateCcw,
  Weight,
} from "lucide-react";

import { PlateDiagram } from "@/components/warmups/plate-diagram";
import { calculatePlateBreakdown } from "@/lib/warmups";
import { fetchRelatedArticles } from "@/lib/sanity-io.js";
import { gaTrackShareCopy } from "@/lib/analytics";
import { ShareCopyButton } from "@/components/share-copy-button";
import { useTransientSuccess } from "@/hooks/use-transient-success";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { findBestE1RM } from "@/lib/processing-utils";
import { estimateE1RM } from "@/lib/estimate-e1rm";
import { getLiftDetailUrl } from "@/components/lift-type-indicator";

const LIFT_GRAPHICS = {
  "Strict Press": "/strict_press.svg",
  "Bench Press": "/bench_press.svg",
  "Back Squat": "/back_squat.svg",
  Deadlift: "/deadlift.svg",
};

// Plate weights: 20 kg / 45 lb per plate per side
const PLATE_KG = 20;
const PLATE_LB = 45;
const BAR_KG = 20;
const BAR_LB = 45;

// Compute total weight for N plates per side
const plateTotal = (n, isMetric) =>
  isMetric ? BAR_KG + n * 2 * PLATE_KG : BAR_LB + n * 2 * PLATE_LB;

// All plate tiers we track (1 through 5)
const ALL_TIERS = [1, 2, 3, 4, 5];

// The "classic" targets per lift — the milestone everyone talks about
const CLASSIC_TARGETS = {
  press: 1,    // 1 plate press
  bench: 2,    // 2 plate bench
  squat: 3,    // 3 plate squat
  deadlift: 4, // 4 plate deadlift
};

// Which plate tiers to show as sub-milestones for each lift
const LIFT_TIERS = {
  press: [1, 2],           // 1 plate is solid, 2 plate press is elite
  bench: [1, 2, 3],       // 1 beginner, 2 intermediate, 3 advanced
  squat: [1, 2, 3, 4],    // full progression
  deadlift: [1, 2, 3, 4, 5], // 5 plate deadlift is the dream
};

const MILESTONES = [
  {
    key: "press",
    liftType: "Strict Press",
    targetPlates: CLASSIC_TARGETS.press,
    tiers: LIFT_TIERS.press,
    storageKey: LOCAL_STORAGE_KEYS.PLATE_MILESTONE_PRESS,
    defaultValue: 95,
    maxLb: 315,
    maxKg: 140,
  },
  {
    key: "bench",
    liftType: "Bench Press",
    targetPlates: CLASSIC_TARGETS.bench,
    tiers: LIFT_TIERS.bench,
    storageKey: LOCAL_STORAGE_KEYS.PLATE_MILESTONE_BENCH,
    defaultValue: 155,
    maxLb: 495,
    maxKg: 220,
  },
  {
    key: "squat",
    liftType: "Back Squat",
    targetPlates: CLASSIC_TARGETS.squat,
    tiers: LIFT_TIERS.squat,
    storageKey: LOCAL_STORAGE_KEYS.PLATE_MILESTONE_SQUAT,
    defaultValue: 225,
    maxLb: 585,
    maxKg: 260,
  },
  {
    key: "deadlift",
    liftType: "Deadlift",
    targetPlates: CLASSIC_TARGETS.deadlift,
    tiers: LIFT_TIERS.deadlift,
    storageKey: LOCAL_STORAGE_KEYS.PLATE_MILESTONE_DEADLIFT,
    defaultValue: 275,
    maxLb: 585,
    maxKg: 260,
  },
];

const PLATE_DIAGRAM_IS_METRIC = false;
const PLATE_DIAGRAM_PLATE_PREFERENCE = "blue";

const FAQ_ITEMS = [
  {
    question: "What does \"plates\" mean in the gym?",
    answer:
      "A \"plate\" almost always means a 45 lb (20 kg) weight plate. When someone says they bench \"two plates,\" they mean two 45 lb plates on each side of the bar, totaling 225 lbs (100 kg). The count is always per side. Also called wheels, 45s, or blues (from competition bumper plate colors).",
  },
  {
    question: "What is the 1/2/3/4 plate club?",
    answer:
      "The 1/2/3/4 plate club means hitting a 1 plate strict press (135 lb / 60 kg), 2 plate bench (225 lb / 100 kg), 3 plate squat (315 lb / 140 kg), and 4 plate deadlift (405 lb / 180 kg). These are widely recognized milestones that map naturally to the relative difficulty of each lift.",
  },
  {
    question: "How long does it take to hit a 2 plate bench?",
    answer:
      "For most male lifters training consistently, a 225 lb (100 kg) bench press takes 1 to 3 years. It depends on bodyweight, programming, and genetics. A 2 plate bench is a genuine intermediate milestone and worth celebrating when you get there.",
  },
  {
    question: "Is a 3 plate squat good?",
    answer:
      "A 315 lb (140 kg) squat is a solid intermediate-to-advanced milestone. Most recreational lifters never reach it. If you squat 3 plates to depth, you are stronger than the vast majority of people who set foot in a gym.",
  },
  {
    question: "How rare is a 4 plate deadlift?",
    answer:
      "A 405 lb (180 kg) deadlift puts you well into advanced territory. Most dedicated lifters can reach it within 2 to 4 years of serious training. It is the classic \"big boy\" milestone and the sound of four plates rattling off the floor is unmistakable.",
  },
  {
    question: "What about a 5 plate deadlift?",
    answer:
      "A 495 lb (220 kg) deadlift is elite-level for natural lifters. Very few people outside of competitive powerlifting ever pull 5 plates. If you get there, you have earned serious bragging rights.",
  },
  {
    question: "Why are they called \"blues\"?",
    answer:
      "In competition bumper plates (used in Olympic weightlifting and CrossFit), the 20 kg plate is blue. Since 20 kg is essentially the same as 45 lbs, \"blues\" became shorthand for standard full-size plates. Other color names you might hear: reds (25 kg / 55 lb), yellows (15 kg / 35 lb), and greens (10 kg / 25 lb).",
  },
  {
    question: "Do these milestones work for kg lifters?",
    answer:
      "Yes. A 20 kg plate is the metric equivalent of a 45 lb plate. One plate per side on a 20 kg bar is 60 kg; two plates is 100 kg; three is 140 kg; four is 180 kg. The milestones are universal.",
  },
];

const WHATS_NEXT_FEATURES = [
  {
    href: "/1000lb-club-calculator",
    title: "1000lb Club Calculator",
    description:
      "Track your squat + bench + deadlift total toward the iconic 1000 lb milestone.",
    IconComponent: Anvil,
  },
  {
    href: "/200-300-400-500-strength-club-calculator",
    title: "200/300/400/500 Club",
    description:
      "The classic barbell milestones: 200 press, 300 bench, 400 squat, 500 deadlift.",
    IconComponent: Mountain,
  },
  {
    href: "/how-strong-am-i",
    title: "How Strong Am I?",
    description:
      "See your percentile rank across lifters, gym-goers, and powerlifting culture.",
    IconComponent: CircleDashed,
  },
  {
    href: "/strength-levels",
    title: "Strength Levels",
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
];

// --- Helpers ---
const KG_PER_LB = 0.453592;
const LB_PER_KG = 2.20462;
const toKg = (lbs) => (Number(lbs) * KG_PER_LB).toFixed(1);
const toLb = (weight, unitType) =>
  unitType === "lb" ? weight : weight * LB_PER_KG;
const roundTo5 = (value) => Math.round(value / 5) * 5;
const clampToMax = (value, max) => Math.min(max, Math.max(0, roundTo5(value)));

const getPlateBreakdown = (totalWeightLb) =>
  calculatePlateBreakdown(
    totalWeightLb,
    BAR_LB,
    PLATE_DIAGRAM_IS_METRIC,
    PLATE_DIAGRAM_PLATE_PREFERENCE,
  );

// Label for N plates: "1 plate", "2 plates", etc.
const plateLabel = (n) => `${n} plate${n === 1 ? "" : "s"}`;

// Thor celebration keyframes (shared with 200/300/400/500 page)
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

export async function getStaticProps() {
  const RELATED_ARTICLES_CATEGORY = "Strength Milestones";
  const relatedArticles = await fetchRelatedArticles(RELATED_ARTICLES_CATEGORY);

  return {
    props: {
      relatedArticles,
    },
    revalidate: 60 * 60,
  };
}

export default function PlateMilestonesPage({ relatedArticles }) {
  const canonicalURL = "https://www.strengthjourneys.xyz/plate-milestones";
  const description =
    "How many plates can you lift? Track your progress toward the classic plate milestones: 1 plate press, 2 plate bench, 3 plate squat, 4 plate deadlift. Also known as wheels, 45s, or blues.";
  const title =
    "Plate Milestones: How Many Plates Can You Lift?";
  const keywords =
    "plate milestones, 1 2 3 4 plate club, how many plates, 2 plate bench, 3 plate squat, 4 plate deadlift, wheels, 45s, blue plates, barbell milestones, strength goals";

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "Plate Milestones Tracker",
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
            name: "Plate Milestones",
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
          title,
          description,
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
      <PlateMilestonesMain relatedArticles={relatedArticles} />
    </>
  );
}

// --- Slider with PR/90d markers (same pattern as strength club page) ---
function SliderWithMarkers({
  value,
  max,
  prVal,
  r90Val,
  onValueChange,
  onValueCommit,
  className,
}) {
  const showPr = prVal != null && prVal > 0 && prVal <= max;
  const showR90 =
    r90Val != null && r90Val > 0 && r90Val <= max && r90Val !== prVal;
  const prPercent = showPr ? (prVal / max) * 100 : 0;
  const r90Percent = showR90 ? (r90Val / max) * 100 : 0;

  return (
    <div className="relative pb-6">
      <Slider
        value={[value]}
        min={0}
        max={max}
        step={5}
        onValueChange={onValueChange}
        onValueCommit={onValueCommit}
        className={`mt-2 ${className}`}
      />
      {showPr && (
        <div
          className="pointer-events-none absolute bottom-0 flex flex-col items-center"
          style={{ left: `${prPercent}%`, transform: "translateX(-50%)" }}
        >
          <div className="h-3 w-px bg-primary/40" />
          <span className="text-primary/60 text-[9px] leading-none font-medium">
            PR
          </span>
        </div>
      )}
      {showR90 && (
        <div
          className="pointer-events-none absolute bottom-0 flex flex-col items-center"
          style={{ left: `${r90Percent}%`, transform: "translateX(-50%)" }}
        >
          <div className="h-3 w-px bg-amber-500/40" />
          <span className="text-[9px] leading-none font-medium text-amber-600/60">
            90d
          </span>
        </div>
      )}
    </div>
  );
}

// --- Blue plate icon (45 lb / 20 kg bumper plate) ---
function BluePlateIcon({ achieved }) {
  return (
    <svg
      width="28"
      height="40"
      viewBox="0 0 28 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="transition-opacity duration-300"
      style={{ opacity: achieved ? 1 : 0.25 }}
    >
      {/* Outer plate shape */}
      <rect
        x="2"
        y="1"
        width="24"
        height="38"
        rx="3"
        fill={achieved ? "#2563EB" : "#94a3b8"}
        stroke={achieved ? "#1d4ed8" : "#64748b"}
        strokeWidth="1.5"
      />
      {/* Inner ring */}
      <rect
        x="6"
        y="5"
        width="16"
        height="30"
        rx="2"
        fill="none"
        stroke={achieved ? "#3b82f6" : "#94a3b8"}
        strokeWidth="1"
        opacity="0.5"
      />
      {/* Center hole */}
      <circle
        cx="14"
        cy="20"
        r="3.5"
        fill={achieved ? "#1e3a5f" : "#475569"}
        stroke={achieved ? "#1d4ed8" : "#64748b"}
        strokeWidth="1"
      />
      {/* Weight label */}
      <text
        x="14"
        y="35"
        textAnchor="middle"
        fontSize="6"
        fontWeight="bold"
        fill="white"
        opacity="0.9"
      >
        20
      </text>
    </svg>
  );
}

// --- Tier progress dots ---
function TierDots({ tiers, currentWeightLb, targetPlates }) {
  return (
    <div className="flex items-center gap-1.5">
      {tiers.map((n) => {
        const tierWeightLb = plateTotal(n, false);
        const achieved = currentWeightLb >= tierWeightLb;
        const isTarget = n === targetPlates;
        return (
          <div key={n} className="flex flex-col items-center gap-0.5">
            <div
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-all",
                achieved
                  ? "bg-green-500 text-white shadow-sm"
                  : isTarget
                    ? "bg-muted ring-primary/30 text-muted-foreground ring-2"
                    : "bg-muted text-muted-foreground/50",
              )}
            >
              {n}
            </div>
            <span
              className={cn(
                "text-[8px] leading-none",
                achieved ? "font-semibold text-green-600" : "text-muted-foreground/50",
              )}
            >
              {plateTotal(n, false)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// --- Main component ---
function PlateMilestonesMain({ relatedArticles }) {
  const { toast } = useToast();
  const { isSuccess: isCopied, triggerSuccess: triggerCopied } =
    useTransientSuccess();
  const prefersReducedMotion = useReducedMotion();
  const { topLiftsByTypeAndReps, parsedData, isDemoMode } =
    useUserLiftingData();
  const storedFormula = useReadLocalStorage(LOCAL_STORAGE_KEYS.FORMULA, {
    initializeWithValue: false,
  });
  const e1rmFormula = storedFormula ?? "Brzycki";
  const [isShaking, setIsShaking] = useState(false);
  const [flashingCard, setFlashingCard] = useState(null);
  const prevValuesRef = useRef(null);
  const celebratedRef = useRef(new Set());
  const activeLiftTimeoutRef = useRef(null);
  const celebrationFrameRef = useRef(null);
  const hasAutoPopulatedRef = useRef(false);
  const [activeLiftKey, setActiveLiftKey] = useState(null);
  const [recent90dCutoffDate] = useState(() =>
    new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10),
  );

  const [press, setPress] = useLocalStorage(
    LOCAL_STORAGE_KEYS.PLATE_MILESTONE_PRESS,
    MILESTONES[0].defaultValue,
    { initializeWithValue: false },
  );
  const [bench, setBench] = useLocalStorage(
    LOCAL_STORAGE_KEYS.PLATE_MILESTONE_BENCH,
    MILESTONES[1].defaultValue,
    { initializeWithValue: false },
  );
  const [squat, setSquat] = useLocalStorage(
    LOCAL_STORAGE_KEYS.PLATE_MILESTONE_SQUAT,
    MILESTONES[2].defaultValue,
    { initializeWithValue: false },
  );
  const [deadlift, setDeadlift] = useLocalStorage(
    LOCAL_STORAGE_KEYS.PLATE_MILESTONE_DEADLIFT,
    MILESTONES[3].defaultValue,
    { initializeWithValue: false },
  );

  const setters = useMemo(
    () => ({
      press: setPress,
      bench: setBench,
      squat: setSquat,
      deadlift: setDeadlift,
    }),
    [setBench, setDeadlift, setPress, setSquat],
  );
  const values = useMemo(
    () => ({ press, bench, squat, deadlift }),
    [press, bench, squat, deadlift],
  );

  // Count total plate tiers achieved across all lifts
  const totalTiersAchieved = useMemo(() => {
    let count = 0;
    for (const m of MILESTONES) {
      for (const n of m.tiers) {
        if (values[m.key] >= plateTotal(n, false)) count++;
      }
    }
    return count;
  }, [values]);

  const totalTiersPossible = MILESTONES.reduce(
    (sum, m) => sum + m.tiers.length,
    0,
  );

  // Check if classic 1/2/3/4 is complete
  const classicClubAchieved = MILESTONES.every(
    (m) => values[m.key] >= plateTotal(m.targetPlates, false),
  );

  // PR weights from user data (converted to lb)
  const prWeightsLb = useMemo(() => {
    if (!topLiftsByTypeAndReps || isDemoMode) return null;

    const nextPrWeights = {};

    for (const milestone of MILESTONES) {
      const result = findBestE1RM(
        milestone.liftType,
        topLiftsByTypeAndReps,
        e1rmFormula,
      );
      const bestWeight = result?.bestE1RMWeight;
      nextPrWeights[milestone.key] = bestWeight
        ? clampToMax(toLb(bestWeight, result.unitType), milestone.maxLb)
        : null;
    }

    return Object.values(nextPrWeights).some((value) => value != null)
      ? nextPrWeights
      : null;
  }, [e1rmFormula, isDemoMode, topLiftsByTypeAndReps]);
  const usingUserData = Boolean(prWeightsLb);

  // Auto-populate from user data on first load
  useEffect(() => {
    if (hasAutoPopulatedRef.current || !prWeightsLb) return;
    hasAutoPopulatedRef.current = true;
    for (const milestone of MILESTONES) {
      const nextValue = prWeightsLb[milestone.key];
      if (nextValue != null) setters[milestone.key](nextValue);
    }
  }, [prWeightsLb, setters]);

  // 90-day bests
  const recent90dLb = useMemo(() => {
    if (!prWeightsLb || !parsedData?.length || isDemoMode) return null;

    const liftKeyByType = Object.fromEntries(
      MILESTONES.map((m) => [m.liftType, m.key]),
    );
    const best = Object.fromEntries(MILESTONES.map((m) => [m.key, 0]));

    for (const entry of parsedData) {
      const key = liftKeyByType[entry.liftType];
      if (!key || entry.isGoal || entry.reps <= 0 || entry.weight <= 0)
        continue;
      if (entry.date < recent90dCutoffDate) continue;
      const weightLb = toLb(entry.weight, entry.unitType);
      const e1rm =
        entry.reps === 1
          ? weightLb
          : estimateE1RM(entry.reps, weightLb, e1rmFormula);
      if (e1rm > best[key]) best[key] = e1rm;
    }

    const result = Object.fromEntries(
      MILESTONES.map((m) => [
        m.key,
        best[m.key] > 0 ? clampToMax(best[m.key], m.maxLb) : null,
      ]),
    );

    const hasDistinct = MILESTONES.some(
      (m) =>
        result[m.key] != null &&
        result[m.key] !== prWeightsLb?.[m.key],
    );

    return hasDistinct ? result : null;
  }, [e1rmFormula, isDemoMode, parsedData, prWeightsLb, recent90dCutoffDate]);

  const handleResetToPRs = useCallback(() => {
    if (!prWeightsLb) return;
    for (const m of MILESTONES) {
      const v = prWeightsLb[m.key];
      if (v != null) setters[m.key](v);
    }
  }, [prWeightsLb, setters]);

  const handleResetTo90d = useCallback(() => {
    if (!recent90dLb) return;
    for (const m of MILESTONES) {
      const v = recent90dLb[m.key];
      if (v != null) setters[m.key](v);
    }
  }, [recent90dLb, setters]);

  const hasMovedFromPR =
    usingUserData &&
    prWeightsLb &&
    MILESTONES.some(
      (m) =>
        prWeightsLb[m.key] != null &&
        values[m.key] !== prWeightsLb[m.key],
    );

  const hasMovedFrom90d =
    usingUserData &&
    recent90dLb &&
    MILESTONES.some(
      (m) =>
        recent90dLb[m.key] != null &&
        values[m.key] !== recent90dLb[m.key],
    );

  // Cleanup
  useEffect(() => {
    return () => {
      if (activeLiftTimeoutRef.current)
        clearTimeout(activeLiftTimeoutRef.current);
      if (celebrationFrameRef.current)
        cancelAnimationFrame(celebrationFrameRef.current);
    };
  }, []);

  const handleLiftValueChange = useCallback(
    (liftKey, setter) =>
      ([v]) => {
        const milestone = MILESTONES.find((item) => item.key === liftKey);
        const nextValue = milestone
          ? clampToMax(v, milestone.maxLb)
          : v;
        const prVal = prWeightsLb?.[liftKey];
        const r90Val = recent90dLb?.[liftKey];

        if (prVal != null && Math.abs(nextValue - prVal) <= 5) {
          setter(prVal);
        } else if (r90Val != null && Math.abs(nextValue - r90Val) <= 5) {
          setter(r90Val);
        } else {
          setter(nextValue);
        }
        if (prefersReducedMotion) return;
        setActiveLiftKey(liftKey);
        if (activeLiftTimeoutRef.current)
          clearTimeout(activeLiftTimeoutRef.current);
        activeLiftTimeoutRef.current = setTimeout(
          () => setActiveLiftKey(null),
          120,
        );
      },
    [prefersReducedMotion, prWeightsLb, recent90dLb],
  );

  const handleLiftValueCommit = useCallback(() => {
    if (activeLiftTimeoutRef.current)
      clearTimeout(activeLiftTimeoutRef.current);
    setActiveLiftKey(null);
  }, []);

  const triggerThorCelebration = useCallback((cardKey) => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 600);
    setFlashingCard(cardKey);
    setTimeout(() => setFlashingCard(null), 400);
    if (navigator.vibrate) navigator.vibrate([100, 30, 100, 30, 60]);
  }, []);

  // Celebrate when crossing a plate milestone
  useEffect(() => {
    if (typeof window === "undefined" || prefersReducedMotion) return;

    if (prevValuesRef.current === null) {
      prevValuesRef.current = { ...values };
      // Mark already-achieved tiers so they don't trigger on load
      MILESTONES.forEach((m) => {
        m.tiers.forEach((n) => {
          if (values[m.key] >= plateTotal(n, false)) {
            celebratedRef.current.add(`${m.key}-${n}`);
          }
        });
      });
      return;
    }

    const prev = prevValuesRef.current;
    prevValuesRef.current = { ...values };

    for (const m of MILESTONES) {
      for (const n of m.tiers) {
        const tierWeight = plateTotal(n, false);
        const celebKey = `${m.key}-${n}`;
        const wasBelow = prev[m.key] < tierWeight;
        const nowAtOrAbove = values[m.key] >= tierWeight;
        if (wasBelow && nowAtOrAbove && !celebratedRef.current.has(celebKey)) {
          celebratedRef.current.add(celebKey);
          celebrationFrameRef.current = requestAnimationFrame(() => {
            triggerThorCelebration(m.key);
            celebrationFrameRef.current = null;
          });
          return; // One celebration at a time
        }
      }
    }
  }, [
    press,
    bench,
    squat,
    deadlift,
    prefersReducedMotion,
    triggerThorCelebration,
    values,
  ]);

  const handleCopyResult = () => {
    const url = "https://www.strengthjourneys.xyz/plate-milestones";
    const lines = [
      classicClubAchieved
        ? "I've conquered the 1/2/3/4 Plate Club!"
        : `Plate milestones: ${totalTiersAchieved} of ${totalTiersPossible} tiers achieved!`,
      "",
      ...MILESTONES.map((m) => {
        const achieved = m.tiers.filter(
          (n) => values[m.key] >= plateTotal(n, false),
        );
        const tierStr = m.tiers
          .map(
            (n) =>
              `${values[m.key] >= plateTotal(n, false) ? "\u2705" : "\u2b1c"}${n}`,
          )
          .join(" ");
        return `${m.liftType}: ${values[m.key]} lbs (${toKg(values[m.key])} kg) ${tierStr}`;
      }),
      "",
      "Strength Journeys",
      url,
    ];
    navigator.clipboard
      ?.writeText(lines.join("\n"))
      .then(() => triggerCopied())
      .catch(() =>
        toast({ variant: "destructive", title: "Could not copy to clipboard" }),
      );
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
          <PageHeaderHeading icon={Weight}>
            Plate Milestones
          </PageHeaderHeading>
          <PageHeaderDescription>
            How many plates can you lift? Track your progress toward the
            classic <strong>1/2/3/4 plate club</strong> and beyond. Whether
            you call them <strong>plates</strong>, <strong>wheels</strong>,{" "}
            <strong>45s</strong>, or <strong>blues</strong>, these are the
            milestones every barbell lifter chases.
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
                href="/200-300-400-500-strength-club-calculator"
                className="hover:bg-muted block rounded-lg border p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <h3 className="text-base font-semibold">200/300/400/500</h3>
                <p className="text-sm">
                  The classic lb-based barbell milestones.
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
                  prVal={prWeightsLb?.[milestone.key]}
                  r90Val={recent90dLb?.[milestone.key]}
                />
              ))}
            </div>

            {/* Combined summary */}
            <div className="mt-6 rounded-lg border p-4 text-center">
              <div className="text-muted-foreground text-sm">
                Plate Tiers Achieved
              </div>
              <div className="text-3xl font-bold tabular-nums">
                {totalTiersAchieved}{" "}
                <span className="text-muted-foreground text-lg font-normal">
                  / {totalTiersPossible}
                </span>
              </div>
              <div
                className={cn("mt-1 text-sm font-semibold", {
                  "text-green-600": classicClubAchieved,
                  "text-muted-foreground": !classicClubAchieved,
                })}
              >
                {classicClubAchieved
                  ? "1/2/3/4 Plate Club achieved! You are in the club."
                  : `${MILESTONES.filter((m) => values[m.key] >= plateTotal(m.targetPlates, false)).length} of 4 classic milestones (1/2/3/4) achieved`}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                {hasMovedFromPR && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs"
                    onClick={handleResetToPRs}
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset to PRs
                  </Button>
                )}
                {hasMovedFrom90d && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs"
                    onClick={handleResetTo90d}
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset to 90-day bests
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <MiniFeedbackWidget
                  prompt="Useful?"
                  contextId="plate_milestones"
                  page="/plate-milestones"
                  analyticsExtra={{ context: "plate_milestones_card" }}
                />
                <ShareCopyButton
                  label="Copy my result"
                  successLabel="Copied"
                  isSuccess={isCopied}
                  onPressAnalytics={() =>
                    gaTrackShareCopy("plate_milestones", {
                      page: "/plate-milestones",
                    })
                  }
                  onClick={handleCopyResult}
                />
              </div>
            </div>
          </CardContent>
          {classicClubAchieved && (
            <CardFooter className="flex flex-col gap-2 text-sm">
              <p>
                You have conquered the 1/2/3/4 Plate Club. Ready for the next
                challenge? See if your squat, bench, and deadlift total hits{" "}
                <Link
                  href="/1000lb-club-calculator"
                  className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
                >
                  the 1000 lb Club
                </Link>
                .
              </p>
            </CardFooter>
          )}
        </Card>

        {/* Plate reference table */}
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-semibold">
            Plate loading reference
          </h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="px-3 py-2 text-left font-semibold">Plates per side</th>
                  <th className="px-3 py-2 text-right font-semibold">Total (lb)</th>
                  <th className="px-3 py-2 text-right font-semibold">Total (kg)</th>
                  <th className="px-3 py-2 text-left font-semibold">Gym talk</th>
                </tr>
              </thead>
              <tbody>
                {ALL_TIERS.map((n) => (
                  <tr key={n} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">
                      {n} {n === 1 ? "plate" : "plates"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {plateTotal(n, false)} lb
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {plateTotal(n, true)} kg
                    </td>
                    <td className="text-muted-foreground px-3 py-2">
                      {n === 1 && "\"Got my first plate\""}
                      {n === 2 && "\"Two wheels\" / \"two blues\""}
                      {n === 3 && "\"Three plates\" / \"three wheels\""}
                      {n === 4 && "\"Four plates\" / \"four 45s\""}
                      {n === 5 && "\"Five plates\" / \"five wheels\""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="mb-4 text-xl font-semibold">
            Got your plates. What&apos;s next?
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
            About plate milestones
          </h2>
          <div className="space-y-3 text-sm leading-relaxed">
            <p>
              Counting plates is how lifters have measured progress since
              the first barbell was loaded. A <strong>plate</strong> means a
              standard 45 lb (20 kg) weight on each side of the bar. One
              plate per side totals 135 lb (60 kg). Two plates: 225 lb
              (100 kg). Three: 315 lb (140 kg). Four: 405 lb (180 kg). Five:
              495 lb (220 kg).
            </p>
            <p>
              The <strong>1/2/3/4 plate club</strong> sets the benchmark:
              a 1 plate strict press, 2 plate bench, 3 plate squat, and
              4 plate deadlift. These targets scale naturally with the
              relative difficulty of each lift. Hitting all four marks you as
              a well-rounded, genuinely strong lifter.
            </p>
            <p>
              Whether you call them plates, wheels, 45s, or blues, the
              satisfying clank of adding another full plate to the bar is a
              universal gym experience. Use the sliders above to see where
              you stand, then check your detailed standards with our{" "}
              <Link
                href="/strength-levels"
                className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
              >
                Strength Levels
              </Link>{" "}
              page.
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
            Learn more about strength milestones, plate loading, and training
            strategies in our articles below.
          </p>
          <RelatedArticles articles={relatedArticles} />
        </section>
      </div>
    </PageContainer>
  );
}

// --- Individual milestone card ---
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
  prVal,
  r90Val,
}) {
  const { key, liftType, targetPlates, tiers, maxLb } = milestone;
  const targetWeightLb = plateTotal(targetPlates, false);
  const percent = Math.min(100, Math.round((value / targetWeightLb) * 100));
  const achieved = value >= targetWeightLb;

  const breakdown = getPlateBreakdown(value);

  const fillPercent = Math.min(100, (value / targetWeightLb) * 100);

  const getBorderStyle = () => {
    if (achieved) {
      return {
        borderColor: "rgb(16 185 129)",
        boxShadow:
          "0 0 20px rgba(16, 185, 129, 0.4), 0 0 40px rgba(16, 185, 129, 0.15)",
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

  // Count how many tiers this lift has achieved
  const tiersAchieved = tiers.filter(
    (n) => value >= plateTotal(n, false),
  ).length;

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

      {/* Content — column layout */}
      <div className="relative z-[1] flex flex-col items-center text-center">
        {/* Lift SVG — centered hero */}
        <Link href={getLiftDetailUrl(liftType)} className="mb-2">
          <motion.img
            src={LIFT_GRAPHICS[liftType]}
            alt={`${liftType} illustration`}
            className="h-24 w-24 origin-bottom object-contain sm:h-28 sm:w-28"
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

        {/* Blue plate icons — one per target plate */}
        <div className="mb-2 flex items-center justify-center gap-1">
          {Array.from({ length: targetPlates }, (_, i) => (
            <BluePlateIcon
              key={i}
              achieved={value >= plateTotal(i + 1, false)}
            />
          ))}
        </div>

        {/* Lift name + target weight */}
        <Link
          href={getLiftDetailUrl(liftType)}
          className="text-base font-bold underline decoration-dotted underline-offset-2 hover:text-blue-600"
        >
          {liftType}
        </Link>
        <div className="text-muted-foreground mt-0.5 text-xs tabular-nums">
          {plateLabel(targetPlates)}: {targetWeightLb} lb / {plateTotal(targetPlates, true)} kg
        </div>

        {/* Trophy for achieved */}
        {achieved && (
          <motion.div
            className="mt-1"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
          >
            <Trophy className="h-7 w-7 text-amber-500" />
          </motion.div>
        )}

        {/* Tier progress dots */}
        <div className="mt-3 mb-3 flex justify-center">
          <TierDots
            tiers={tiers}
            currentWeightLb={value}
            targetPlates={targetPlates}
          />
        </div>

        {/* Plate diagram */}
        <div className="mb-3 w-full">
          <PlateDiagram
            platesPerSide={breakdown.platesPerSide}
            barWeight={BAR_LB}
            isMetric={PLATE_DIAGRAM_IS_METRIC}
            hideLabels
            animationDelay={0.3 + index * 0.1}
            animationKey={`plates-${key}-${value}`}
          />
        </div>

        {/* Slider */}
        <div className="mb-2 w-full text-left">
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-xl font-bold tabular-nums">
              {value} lbs{" "}
              <span className="text-muted-foreground text-sm font-normal">
                ({toKg(value)} kg)
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
          <SliderWithMarkers
            value={value}
            max={maxLb}
            prVal={prVal}
            r90Val={r90Val}
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
            ? tiersAchieved === tiers.length
              ? `All ${tiers.length} plate tiers conquered!`
              : `${plateLabel(targetPlates)} achieved! ${tiers.length - tiersAchieved} more tier${tiers.length - tiersAchieved === 1 ? "" : "s"} to go`
            : `${targetWeightLb - value} lbs to ${plateLabel(targetPlates)}`}
        </div>
      </div>
    </motion.div>
  );
}
