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
import { useSession } from "next-auth/react";
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
  Disc,
  FileUp,
  Loader2,
} from "lucide-react";

import { PlateDiagram } from "@/components/warmups/plate-diagram";
import { calculatePlateBreakdown } from "@/lib/warmups";
import { fetchRelatedArticles } from "@/lib/sanity-io.js";
import { gaTrackShareCopy } from "@/lib/analytics";
import { ShareCopyButton } from "@/components/share-copy-button";
import { useTransientSuccess } from "@/hooks/use-transient-success";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { findBestE1RM } from "@/lib/processing-utils";
import { estimateE1RM } from "@/lib/estimate-e1rm";
import { getLiftDetailUrl } from "@/components/lift-type-indicator";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ReferenceLine,
  Tooltip as RechartsTooltip,
} from "recharts";

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

// All plate tiers we track (1 through 4)
const ALL_TIERS = [1, 2, 3, 4];

// The "classic" targets per lift
const CLASSIC_TARGETS = {
  press: 1,
  bench: 2,
  squat: 3,
  deadlift: 4,
};

// Which plate tiers to show as sub-milestones for each lift (capped at classic target)
const LIFT_TIERS = {
  press: [1],
  bench: [1, 2],
  squat: [1, 2, 3],
  deadlift: [1, 2, 3, 4],
};

const MILESTONES = [
  {
    key: "press",
    liftType: "Strict Press",
    targetPlates: CLASSIC_TARGETS.press,
    tiers: LIFT_TIERS.press,
    storageKey: LOCAL_STORAGE_KEYS.PLATE_MILESTONE_PRESS,
    defaultValue: 95,
    maxLb: 225,
  },
  {
    key: "bench",
    liftType: "Bench Press",
    targetPlates: CLASSIC_TARGETS.bench,
    tiers: LIFT_TIERS.bench,
    storageKey: LOCAL_STORAGE_KEYS.PLATE_MILESTONE_BENCH,
    defaultValue: 155,
    maxLb: 315,
  },
  {
    key: "squat",
    liftType: "Back Squat",
    targetPlates: CLASSIC_TARGETS.squat,
    tiers: LIFT_TIERS.squat,
    storageKey: LOCAL_STORAGE_KEYS.PLATE_MILESTONE_SQUAT,
    defaultValue: 225,
    maxLb: 405,
  },
  {
    key: "deadlift",
    liftType: "Deadlift",
    targetPlates: CLASSIC_TARGETS.deadlift,
    tiers: LIFT_TIERS.deadlift,
    storageKey: LOCAL_STORAGE_KEYS.PLATE_MILESTONE_DEADLIFT,
    defaultValue: 275,
    maxLb: 495,
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
const toKg = (lbs) => Math.round(Number(lbs) * KG_PER_LB);
const displayWeight = (lbs, isMetric) =>
  isMetric ? `${toKg(lbs)} kg` : `${lbs} lb`;
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

const plateLabel = (n) => `${n} plate${n === 1 ? "" : "s"}`;

const formatMonthYear = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
};

const SHORT_LIFT_NAMES = {
  "Strict Press": "Press",
  "Bench Press": "Bench",
  "Back Squat": "Squat",
  Deadlift: "Deadlift",
};

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
  const title = "Plate Milestones: How Many Plates Can You Lift?";
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

// --- Slider with PR/90d markers ---
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

// --- Main component ---
function PlateMilestonesMain({ relatedArticles }) {
  const { toast } = useToast();
  const { isSuccess: isCopied, triggerSuccess: triggerCopied } =
    useTransientSuccess();
  const { status: authStatus } = useSession();
  const { topLiftsByTypeAndReps, parsedData, isDemoMode, sheetInfo } =
    useUserLiftingData();
  const { isMetric } = useAthleteBio();
  const storedFormula = useReadLocalStorage(LOCAL_STORAGE_KEYS.FORMULA, {
    initializeWithValue: false,
  });
  const e1rmFormula = storedFormula ?? "Brzycki";
  const hasAutoPopulatedRef = useRef(false);
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

  // Check if classic 1/2/3/4 is complete
  const classicClubAchieved = MILESTONES.every(
    (m) => values[m.key] >= plateTotal(m.targetPlates, false),
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
        result[m.key] != null && result[m.key] !== prWeightsLb?.[m.key],
    );

    return hasDistinct ? result : null;
  }, [e1rmFormula, isDemoMode, parsedData, prWeightsLb, recent90dCutoffDate]);

  // Rolling 90-day best E1RM timeline per lift (same approach as 1000lb page)
  const liftTimelines = useMemo(() => {
    if (!parsedData?.length || isDemoMode || !usingUserData) return null;

    const WINDOW_DAYS = 90;
    const timelines = {};

    for (const milestone of MILESTONES) {
      const entries = [];
      for (const d of parsedData) {
        if (
          d.liftType !== milestone.liftType ||
          d.isGoal ||
          d.reps <= 0 ||
          d.weight <= 0
        )
          continue;
        entries.push({
          ms: new Date(d.date).getTime(),
          weightLb: toLb(d.weight, d.unitType),
          reps: d.reps,
        });
      }
      entries.sort((a, b) => a.ms - b.ms);
      if (entries.length < 2) continue;

      const firstMs = entries[0].ms;
      const lastMs = entries[entries.length - 1].ms;
      const spanDays = (lastMs - firstMs) / 86400000;

      let intervalDays;
      if (spanDays <= 180) intervalDays = 7;
      else if (spanDays <= 730) intervalDays = 14;
      else intervalDays = 30;

      const sampleTimestamps = [];
      let cursorMs = firstMs + WINDOW_DAYS * 86400000;
      while (cursorMs <= lastMs) {
        sampleTimestamps.push(cursorMs);
        cursorMs += intervalDays * 86400000;
      }
      if (
        sampleTimestamps.length === 0 ||
        (lastMs - sampleTimestamps[sampleTimestamps.length - 1]) / 86400000 > 7
      ) {
        sampleTimestamps.push(lastMs);
      }
      if (sampleTimestamps.length < 2) continue;

      const points = [];
      for (const sampleMs of sampleTimestamps) {
        const cutoff = sampleMs - WINDOW_DAYS * 86400000;
        let bestE1rm = 0;

        for (const entry of entries) {
          if (entry.ms > sampleMs) break;
          if (entry.ms < cutoff) continue;
          const e1rm =
            entry.reps === 1
              ? entry.weightLb
              : estimateE1RM(entry.reps, entry.weightLb, e1rmFormula);
          if (e1rm > bestE1rm) bestE1rm = e1rm;
        }

        if (bestE1rm === 0) continue;

        points.push({
          date: new Date(sampleMs).toISOString().slice(0, 10),
          timestamp: sampleMs,
          e1rm: Math.round(bestE1rm),
        });
      }

      if (points.length >= 2) {
        timelines[milestone.key] = points;
      }
    }

    return Object.keys(timelines).length > 0 ? timelines : null;
  }, [parsedData, isDemoMode, usingUserData, e1rmFormula]);

  // First/last dates the user crossed each plate tier (derived from timelines)
  const milestoneDates = useMemo(() => {
    if (!liftTimelines) return null;

    const dates = {};
    for (const milestone of MILESTONES) {
      const timeline = liftTimelines[milestone.key];
      if (!timeline) continue;

      const tierInfo = {};
      for (const tierN of milestone.tiers) {
        const threshold = plateTotal(tierN, false);
        let first = null;
        let last = null;

        for (const point of timeline) {
          if (point.e1rm >= threshold) {
            if (!first) first = point.date;
            last = point.date;
          }
        }

        const currentlyAbove =
          timeline[timeline.length - 1].e1rm >= threshold;

        if (first) {
          tierInfo[tierN] = { first, last, currentlyAbove };
        }
      }

      if (Object.keys(tierInfo).length > 0) {
        dates[milestone.key] = tierInfo;
      }
    }

    return Object.keys(dates).length > 0 ? dates : null;
  }, [liftTimelines]);

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
        prWeightsLb[m.key] != null && values[m.key] !== prWeightsLb[m.key],
    );

  const hasMovedFrom90d =
    usingUserData &&
    recent90dLb &&
    MILESTONES.some(
      (m) =>
        recent90dLb[m.key] != null && values[m.key] !== recent90dLb[m.key],
    );

  const handleLiftValueChange = useCallback(
    (liftKey, setter) =>
      ([v]) => {
        const milestone = MILESTONES.find((item) => item.key === liftKey);
        const nextValue = milestone ? clampToMax(v, milestone.maxLb) : v;
        const prVal = prWeightsLb?.[liftKey];
        const r90Val = recent90dLb?.[liftKey];

        if (prVal != null && Math.abs(nextValue - prVal) <= 5) {
          setter(prVal);
        } else if (r90Val != null && Math.abs(nextValue - r90Val) <= 5) {
          setter(r90Val);
        } else {
          setter(nextValue);
        }
      },
    [prWeightsLb, recent90dLb],
  );

  const handleCopyResult = () => {
    const url = "https://www.strengthjourneys.xyz/plate-milestones";
    const lines = [
      classicClubAchieved
        ? "I've conquered the 1/2/3/4 Plate Club!"
        : `Plate milestones: ${totalTiersAchieved} of ${totalTiersPossible} tiers achieved!`,
      "",
      ...MILESTONES.map((m) => {
        const tierStr = m.tiers
          .map(
            (n) =>
              `${values[m.key] >= plateTotal(n, false) ? "\u2705" : "\u2b1c"}${n}`,
          )
          .join(" ");
        return `${m.liftType}: ${displayWeight(values[m.key], isMetric)} ${tierStr}`;
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
      <PageHeader>
        <PageHeaderHeading icon={Disc}>
          Plate Milestones
        </PageHeaderHeading>
        <PageHeaderDescription>
          How many plates can you lift? Track your progress toward the
          classic <strong>1/2/3/4 plate club</strong>. Plates, wheels,
          45s, blues. Whatever you call them, plates get dates.
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
                Advanced lifetime barbell goals.
              </p>
            </Link>
          </div>
        </PageHeaderRight>
      </PageHeader>

      <Card className="pt-2">
        <CardContent className="pt-2">
          {/* Four stacked rows — one per lift */}
          <div className="flex flex-col gap-2">
            {MILESTONES.map((milestone) => (
              <MilestoneRow
                key={milestone.key}
                milestone={milestone}
                value={values[milestone.key]}
                setter={setters[milestone.key]}
                onValueChange={handleLiftValueChange}
                prVal={prWeightsLb?.[milestone.key]}
                r90Val={recent90dLb?.[milestone.key]}
                isMetric={isMetric}
                timeline={liftTimelines?.[milestone.key]}
                tierDates={milestoneDates?.[milestone.key]}
              />
            ))}
          </div>

          {/* Combined summary */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 rounded-lg border px-3 py-2 text-center">
            <div className="flex items-baseline gap-1.5">
              <span className="text-muted-foreground text-xs">Plate Tiers</span>
              <span className="text-xl font-bold tabular-nums">
                {totalTiersAchieved}
                <span className="text-muted-foreground text-sm font-normal">
                  /{totalTiersPossible}
                </span>
              </span>
            </div>
            <span
              className={cn("text-xs font-semibold", {
                "text-green-600": classicClubAchieved,
                "text-muted-foreground": !classicClubAchieved,
              })}
            >
              {classicClubAchieved
                ? "1/2/3/4 Plate Club achieved!"
                : `${MILESTONES.filter((m) => values[m.key] >= plateTotal(m.targetPlates, false)).length} of 4 classic milestones achieved`}
            </span>
            {hasMovedFromPR && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-xs"
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
                className="h-6 gap-1 px-2 text-xs"
                onClick={handleResetTo90d}
              >
                <RotateCcw className="h-3 w-3" />
                Reset to 90-day bests
              </Button>
            )}
          </div>

          <div className="mt-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
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

      {/* Import CTA for non-auth visitors */}
      {(authStatus === "unauthenticated" ||
        (authStatus === "authenticated" && !sheetInfo?.ssid)) && (
        <PlateImportCtaCard />
      )}

      {/* Plate reference table */}
      <section className="mt-10">
        <h2 className="mb-4 text-xl font-semibold">
          Plate loading reference
        </h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="px-3 py-2 text-left font-semibold">
                  Plates per side
                </th>
                <th className="px-3 py-2 text-right font-semibold">
                  Total (lb)
                </th>
                <th className="px-3 py-2 text-right font-semibold">
                  Total (kg)
                </th>
                <th className="px-3 py-2 text-left font-semibold">
                  Gym talk
                </th>
                {usingUserData && (
                  <th className="px-3 py-2 text-left font-semibold">
                    Your lifts
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {ALL_TIERS.map((n) => {
                const threshold = plateTotal(n, false);
                const liftsAtTier = usingUserData
                  ? MILESTONES.filter(
                      (m) => values[m.key] >= threshold,
                    ).map((m) => SHORT_LIFT_NAMES[m.liftType])
                  : [];
                const liftsBelow = usingUserData
                  ? MILESTONES.filter(
                      (m) =>
                        m.tiers.includes(n) &&
                        values[m.key] < threshold,
                    )
                  : [];

                return (
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
                    </td>
                    {usingUserData && (
                      <td className="px-3 py-2">
                        {liftsAtTier.length > 0 ? (
                          <span className="text-xs font-medium text-green-600">
                            {liftsAtTier.length === 4
                              ? "All 4 lifts"
                              : liftsAtTier.join(", ")}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            {liftsBelow.length > 0
                              ? liftsBelow
                                  .map((m) => {
                                    const gap = isMetric
                                      ? `${toKg(threshold) - toKg(values[m.key])} kg`
                                      : `${threshold - values[m.key]} lb`;
                                    return `${SHORT_LIFT_NAMES[m.liftType]}: ${gap} to go`;
                                  })
                                  .join("; ")
                              : "\u2014"}
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
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
        <h2 className="mb-3 text-xl font-semibold">About plate milestones</h2>
        <div className="space-y-3 text-sm leading-relaxed">
          <p>
            Counting plates is how lifters have measured progress since the
            first barbell was loaded. A <strong>plate</strong> means a
            standard 45 lb (20 kg) weight on each side of the bar. One plate
            per side totals 135 lb (60 kg). Two plates: 225 lb (100 kg).
            Three: 315 lb (140 kg). Four: 405 lb (180 kg).
          </p>
          <p>
            The <strong>1/2/3/4 plate club</strong> sets the benchmark: a 1
            plate strict press, 2 plate bench, 3 plate squat, and 4 plate
            deadlift. These targets scale naturally with the relative
            difficulty of each lift. Hitting all four marks you as a
            well-rounded, genuinely strong lifter.
          </p>
          <p>
            Whether you call them plates, wheels, 45s, or blues, the
            satisfying clank of adding another full plate to the bar is a
            universal gym experience. Use the sliders above to see where you
            stand, then check your detailed standards with our{" "}
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
    </PageContainer>
  );
}

// --- Individual milestone row ---
function MilestoneRow({
  milestone,
  value,
  setter,
  onValueChange,
  prVal,
  r90Val,
  isMetric,
  timeline,
  tierDates,
}) {
  const { key, liftType, targetPlates, tiers, maxLb } = milestone;
  const targetWeightLb = plateTotal(targetPlates, false);
  const achieved = value >= targetWeightLb;

  // Count how many tiers this lift has achieved
  const tiersAchieved = tiers.filter(
    (n) => value >= plateTotal(n, false),
  ).length;

  const hasDates = tierDates && Object.keys(tierDates).length > 0;
  const hasTimeline = timeline && timeline.length >= 2;

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2 transition-colors",
        achieved && "border-green-500/40 bg-green-500/5",
      )}
    >
      {/* Row layout: lift SVG + plates (fixed) | slider + info (fills rest) */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        {/* Left: lift SVG + plate icons — fixed width sized for the widest row (deadlift) */}
        <div className="flex flex-shrink-0 items-center gap-3 md:w-[440px]">
          <Link
            href={getLiftDetailUrl(liftType)}
            className="flex flex-shrink-0"
          >
            <img
              src={LIFT_GRAPHICS[liftType]}
              alt={`${liftType} illustration`}
              className="h-20 w-20 object-contain md:h-24 md:w-24"
            />
          </Link>

          {/* Blue plate images — fill left-to-right like a thermometer */}
          <div className="flex items-center gap-1">
          {Array.from({ length: targetPlates }, (_, i) => {
            const sliceStart = BAR_LB + i * (2 * PLATE_LB);
            const sliceEnd = BAR_LB + (i + 1) * (2 * PLATE_LB);
            const sliceProgress =
              value <= sliceStart
                ? 0
                : value >= sliceEnd
                  ? 1
                  : (value - sliceStart) / (sliceEnd - sliceStart);
            const opacity = 0.15 + sliceProgress * 0.85;
            return (
              <img
                key={i}
                src="/blue_plate.svg"
                alt="20 kg plate"
                className="h-16 w-16 md:h-[4.5rem] md:w-[4.5rem]"
                style={{
                  opacity,
                  transition: "opacity 300ms ease",
                }}
              />
            );
          })}
          </div>
        </div>

        {/* Right half: info + slider */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <Link
                href={getLiftDetailUrl(liftType)}
                className="text-sm font-bold underline decoration-dotted underline-offset-2 hover:text-blue-600"
              >
                {liftType}
              </Link>
              <span className="text-muted-foreground text-xs tabular-nums">
                {displayWeight(value, isMetric)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {achieved && (
                <Trophy className="h-4 w-4 text-amber-500" />
              )}
              <span
                className={cn("text-xs font-semibold tabular-nums", {
                  "text-green-600": achieved,
                  "text-muted-foreground": !achieved,
                })}
              >
                {achieved
                  ? tiersAchieved === tiers.length
                    ? "Done!"
                    : `${tiersAchieved}/${tiers.length}`
                  : `${isMetric ? toKg(targetWeightLb) - toKg(value) : targetWeightLb - value} ${isMetric ? "kg" : "lb"} to go`}
              </span>
            </div>
          </div>

          {/* Slider */}
          <SliderWithMarkers
            value={value}
            max={maxLb}
            prVal={prVal}
            r90Val={r90Val}
            onValueChange={onValueChange(key, setter)}
            onValueCommit={() => {}}
          />
        </div>
      </div>

      {/* Personal milestone dates + sparkline (only with user data) */}
      {(hasDates || hasTimeline) && (
        <div className="mt-2 space-y-2 border-t pt-2">
          {hasDates && (
            <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
              {tiers.map((n) => {
                const info = tierDates[n];
                if (!info) return null;
                const firstStr = formatMonthYear(info.first);
                const lastStr = formatMonthYear(info.last);
                const sameMonth = firstStr === lastStr;
                return (
                  <span key={n} className="flex items-center gap-1">
                    <span
                      className={cn(
                        "inline-block h-1.5 w-1.5 rounded-full",
                        info.currentlyAbove
                          ? "bg-green-500"
                          : "bg-amber-500",
                      )}
                    />
                    <span className="text-foreground font-medium">
                      {plateLabel(n)}
                    </span>
                    {info.currentlyAbove ? (
                      <span>since {firstStr}</span>
                    ) : sameMonth ? (
                      <span>{firstStr}</span>
                    ) : (
                      <span>
                        first {firstStr}, last {lastStr}
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          )}

          {hasTimeline && (
            <MilestoneSparkline
              timeline={timeline}
              tiers={tiers}
              liftKey={key}
              isMetric={isMetric}
            />
          )}
        </div>
      )}
    </div>
  );
}

// --- Sparkline tooltip ---
function SparklineTooltipContent({ active, payload, isMetric }) {
  if (!active || !payload?.[0]) return null;
  const { timestamp, e1rm } = payload[0].payload;
  const dateStr = new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return (
    <div className="bg-popover rounded-lg border px-2 py-1.5 text-xs shadow-md">
      <div className="font-medium">{dateStr}</div>
      <div>E1RM: {displayWeight(e1rm, isMetric)}</div>
    </div>
  );
}

// --- Per-lift E1RM sparkline with plate tier reference lines ---
function MilestoneSparkline({ timeline, tiers, liftKey, isMetric }) {
  if (!timeline || timeline.length < 2) return null;

  const tierWeights = tiers.map((n) => plateTotal(n, false));
  const maxTierWeight = Math.max(...tierWeights);
  const minTierWeight = Math.min(...tierWeights);
  const maxE1rm = Math.max(...timeline.map((p) => p.e1rm));
  const minE1rm = Math.min(...timeline.map((p) => p.e1rm));

  const yMax =
    Math.ceil(Math.max(maxE1rm + 10, maxTierWeight + 20) / 25) * 25;
  const yMin =
    Math.floor(
      Math.max(0, Math.min(minE1rm - 10, minTierWeight - 20)) / 25,
    ) * 25;

  const spanDays =
    (timeline[timeline.length - 1].timestamp - timeline[0].timestamp) /
    86400000;

  const formatXTick = (ts) => {
    const d = new Date(ts);
    if (spanDays <= 365)
      return d.toLocaleDateString("en-US", { month: "short" });
    if (spanDays <= 1095)
      return d.toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      });
    return d.toLocaleDateString("en-US", { year: "numeric" });
  };

  const formatYTick = (v) => (isMetric ? `${toKg(v)}` : `${v}`);

  return (
    <div className="h-[110px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={timeline}
          margin={{ top: 4, right: 36, bottom: 0, left: -16 }}
        >
          <defs>
            <linearGradient
              id={`spark-${liftKey}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor="#6366F1" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#6366F1" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="timestamp"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={formatXTick}
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[yMin, yMax]}
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatYTick}
            width={36}
          />
          {tierWeights.map((w, i) => (
            <ReferenceLine
              key={tiers[i]}
              y={w}
              stroke="#10B981"
              strokeDasharray="4 3"
              strokeWidth={1.5}
              label={{
                value: `${plateLabel(tiers[i])}`,
                position: "insideRight",
                offset: -4,
                dy: -8,
                fill: "#10B981",
                fontSize: 10,
                fontWeight: 600,
              }}
            />
          ))}
          <RechartsTooltip
            content={<SparklineTooltipContent isMetric={isMetric} />}
          />
          <Area
            type="monotone"
            dataKey="e1rm"
            stroke="#6366F1"
            strokeWidth={2}
            fill={`url(#spark-${liftKey})`}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 1.5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// --- Import CTA for non-auth visitors ---
function PlateImportCtaCard() {
  const { toast } = useToast();
  const { importFile } = useUserLiftingData();
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);

  const handleFile = async (file) => {
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["csv", "txt", "xls", "xlsx"].includes(ext)) {
      setImportError(
        "Unsupported file type. Use a .csv, .xls, or .xlsx export.",
      );
      return;
    }

    setImporting(true);
    setImportError(null);

    try {
      const { count, formatName } = await importFile(file);
      toast({
        title: "Data loaded",
        description: `Parsed ${count} entries from ${formatName}. Your plate milestones are ready.`,
      });
    } catch (err) {
      setImportError(err.message || "Could not parse that export.");
    } finally {
      setImporting(false);
    }
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    setDragOver(false);
    await handleFile(event.dataTransfer?.files?.[0]);
  };

  const handleBrowseClick = () => {
    if (importing) return;
    fileInputRef.current?.click();
  };

  return (
    <Card className="mt-6 overflow-hidden">
      <CardHeader className="pb-2">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Disc className="h-5 w-5" />
            Drop in your data to see your real plate milestones
          </CardTitle>
          <CardDescription>
            Import your workout data from Hevy, Strong, Wodify, BTWB, or
            TurnKey. We&apos;ll parse it in your browser and auto-fill your
            estimated 1RMs.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] lg:items-stretch">
          {/* Drop zone */}
          <div
            role="button"
            tabIndex={0}
            onClick={handleBrowseClick}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleBrowseClick();
              }
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              "from-muted/20 via-background to-muted/30 flex h-full flex-col justify-between rounded-xl border border-dashed bg-gradient-to-br p-4 text-left transition-colors sm:p-5",
              dragOver && "border-primary bg-primary/5",
              importing && "cursor-wait opacity-80",
              !importing && "cursor-pointer hover:border-primary/60",
            )}
            aria-label="Upload workout export file"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.xls,.xlsx"
              className="hidden"
              onChange={(event) => {
                handleFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />

            <div className="space-y-4">
              <div className="bg-primary/10 text-primary flex h-11 w-11 items-center justify-center rounded-full border">
                {importing ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <FileUp className="h-5 w-5" />
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold sm:text-base">
                  {importing ? "Parsing your data..." : "Add your workout data"}
                </p>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Drop in a Hevy, Strong, Wodify, BTWB, or TurnKey export to
                  auto-fill your plate milestones.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={(event) => {
                  event.stopPropagation();
                  handleBrowseClick();
                }}
                disabled={importing}
              >
                Choose file
              </Button>

              {importError ? (
                <p className="text-sm font-medium text-red-600">
                  {importError}
                </p>
              ) : (
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Parsed locally in your browser for preview mode.
                </p>
              )}
            </div>
          </div>

          {/* Decorative plate preview */}
          <div className="from-muted/20 via-background to-muted/30 flex flex-col items-center justify-center gap-4 rounded-xl border bg-gradient-to-br p-4 opacity-55 saturate-[0.85] sm:p-6">
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: n }, (_, i) => (
                      <img
                        key={i}
                        src="/blue_plate.svg"
                        alt=""
                        className="h-10 w-10 sm:h-12 sm:w-12"
                        style={{ opacity: 0.3 + i * 0.2 }}
                      />
                    ))}
                  </div>
                  <span className="text-muted-foreground text-[10px] tabular-nums">
                    {plateTotal(n, false)} lb
                  </span>
                </div>
              ))}
            </div>
            <p className="text-muted-foreground text-center text-xs">
              Your data fills in the sliders above so you can see exactly where
              you stand on each plate milestone.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
