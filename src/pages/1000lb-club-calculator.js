/**
 * 1000lb Club calculator page.
 * Keeps the page on the Pages Router and reuses the shared lifting-data import pipeline
 * so timeline previews can come from uploaded fitness-app exports without a separate flow.
 */
import Head from "next/head";
import Link from "next/link";
import { useMemo, useState, useEffect, useRef, useId } from "react";
import { NextSeo } from "next-seo";
import { useSession } from "next-auth/react";
import { motion, useReducedMotion } from "motion/react";
import { RelatedArticles } from "@/components/article-cards";
import { MiniFeedbackWidget } from "@/components/feedback";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { cn } from "@/lib/utils";
import { GettingStartedCard } from "@/components/instructions-cards";
import { useLocalStorage, useReadLocalStorage } from "usehooks-ts";
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
  CircleDashed,
  FileUp,
  Loader2,
  RotateCcw,
} from "lucide-react";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ReferenceLine,
} from "recharts";

import { fetchRelatedArticles } from "@/lib/sanity-io.js";
import { gaTrackShareCopy } from "@/lib/analytics";
import { openSheetSetupDialog } from "@/lib/open-sheet-setup";
import { PENDING_SHEET_ACTIONS } from "@/lib/pending-sheet-action";
import { ShareCopyButton } from "@/components/share-copy-button";
import { GoogleSignInButton } from "@/components/google-sign-in";
import { useTransientSuccess } from "@/hooks/use-transient-success";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { findBestE1RM } from "@/lib/processing-utils";
import { estimateE1RM } from "@/lib/estimate-e1rm";

const BIG_FOUR_URLS = {
  "Back Squat": "/progress-guide/squat",
  "Bench Press": "/progress-guide/bench-press",
  Deadlift: "/progress-guide/deadlift",
  "Strict Press": "/progress-guide/strict-press",
};

const LIFT_GRAPHICS = {
  "Back Squat": "/back_squat.svg",
  "Bench Press": "/bench_press.svg",
  Deadlift: "/deadlift.svg",
};
const TARGET_TOTAL = 1000;
const roundTo5 = (v) => Math.round(v / 5) * 5;
const clampLb = (v) => Math.min(700, Math.max(0, roundTo5(v)));

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
    question: "What does 'biggest opportunity' mean?",
    answer:
      "It is a simple balance check based on a rough squat-bench-deadlift split of 36% / 24% / 40% of your total. For a 1000lb total, that works out to about a 360lb squat, 240lb bench, and 400lb deadlift. For a 1200lb total, the same split would be about 432lb squat, 288lb bench, and 480lb deadlift. The calculator highlights the lift that is furthest below that rough balance point.",
  },
  {
    question: "What if my total is over 1000lb?",
    answer:
      "You are in the club. The calculator shows how far past 1000lb you are so you can set the next milestone.",
  },
  {
    question: "Does this mean I'm strong now? What's next?",
    answer:
      "Not really. It means you have graduated from beginner bragging rights and earned the right to start side-eyeing the 200/300/400/500 club. If you want the next milestone with a bit more swagger, that is probably the one you are actually thinking about.",
    renderAnswer: (
      <>
        Not really. It means you have graduated from beginner bragging rights
        and earned the right to start side-eyeing the{" "}
        <Link
          href="/200-300-400-500-strength-club-calculator"
          className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
        >
          200/300/400/500 club
        </Link>
        . If you want the next milestone with a bit more swagger, that is
        probably the one you are actually thinking about.
      </>
    ),
  },
];

const WHATS_NEXT_FEATURES = [
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
    href: "/lift-explorer",
    title: "Lift Explorer",
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
  const description =
    "Free 1000lb Club Calculator — add your back squat, bench press, and deadlift to see if you've hit the 1000lb total. Instant results, works in lbs and kg. No login required.";
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

function SliderWithMarkers({ value, prVal, r90Val, onValueChange, onValueCommit, className }) {
  const MAX = 700;
  const showPr = prVal != null && prVal > 0 && prVal <= MAX;
  const showR90 = r90Val != null && r90Val > 0 && r90Val <= MAX && r90Val !== prVal;
  const prPercent = showPr ? (prVal / MAX) * 100 : 0;
  const r90Percent = showR90 ? (r90Val / MAX) * 100 : 0;

  return (
    <div className="relative pb-6">
      <Slider
        value={[value]}
        min={0}
        max={MAX}
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
          <div className="bg-primary/40 h-3 w-px" />
          <span className="text-primary/60 text-[9px] leading-none font-medium">PR</span>
        </div>
      )}
      {showR90 && (
        <div
          className="pointer-events-none absolute bottom-0 flex flex-col items-center"
          style={{ left: `${r90Percent}%`, transform: "translateX(-50%)" }}
        >
          <div className="h-3 w-px bg-amber-500/40" />
          <span className="text-[9px] leading-none font-medium text-amber-600/60">90d</span>
        </div>
      )}
    </div>
  );
}

/**
 * Inner client component for the 1000lb Club Calculator page. Provides squat/bench/deadlift sliders,
 * a donut progress chart, a confetti celebration when 1000lb is reached, and a shareable result.
 * @param {Object} props
 * @param {Array} props.relatedArticles - CMS articles to display in the related articles section.
 */
function ThousandPoundClubCalculatorMain({ relatedArticles }) {
  const { toast } = useToast();
  const { isSuccess: isCopied, triggerSuccess: triggerCopied } =
    useTransientSuccess();
  const prefersReducedMotion = useReducedMotion();
  const { status: authStatus } = useSession();
  const {
    topLiftsByTypeAndReps,
    parsedData,
    isDemoMode,
    isImportedData,
    sheetInfo,
  } = useUserLiftingData();
  const storedFormula = useReadLocalStorage(LOCAL_STORAGE_KEYS.FORMULA, {
    initializeWithValue: false,
  });
  const e1rmFormula = storedFormula ?? "Brzycki";

  const [squat, setSquat] = useLocalStorage(
    LOCAL_STORAGE_KEYS.THOUSAND_SQUAT,
    275,
    {
      initializeWithValue: false,
    },
  );
  const [bench, setBench] = useLocalStorage(
    LOCAL_STORAGE_KEYS.THOUSAND_BENCH,
    205,
    {
      initializeWithValue: false,
    },
  );
  const [deadlift, setDeadlift] = useLocalStorage(
    LOCAL_STORAGE_KEYS.THOUSAND_DEADLIFT,
    315,
    {
      initializeWithValue: false,
    },
  );
  const prevTotalRef = useRef(null);
  const hasCelebratedRef = useRef(false);
  const activeLiftTimeoutRef = useRef(null);
  const donutContainerRef = useRef(null);
  const [activeLiftKey, setActiveLiftKey] = useState(null);

  // PR auto-populate for authenticated users with real data
  const [usingUserData, setUsingUserData] = useState(false);
  const hasAutoPopulatedRef = useRef(false);
  const prWeightsLbRef = useRef(null);

  useEffect(() => {
    if (hasAutoPopulatedRef.current || !topLiftsByTypeAndReps || isDemoMode)
      return;

    const sq = findBestE1RM("Back Squat", topLiftsByTypeAndReps, e1rmFormula);
    const bp = findBestE1RM("Bench Press", topLiftsByTypeAndReps, e1rmFormula);
    const dl = findBestE1RM("Deadlift", topLiftsByTypeAndReps, e1rmFormula);

    if (!sq.bestE1RMWeight && !bp.bestE1RMWeight && !dl.bestE1RMWeight) return;

    hasAutoPopulatedRef.current = true;

    const toLbs = (weight, unitType) =>
      unitType === "lb" ? weight : weight * 2.2046;

    const prSquat = sq.bestE1RMWeight
      ? clampLb(toLbs(sq.bestE1RMWeight, sq.unitType))
      : null;
    const prBench = bp.bestE1RMWeight
      ? clampLb(toLbs(bp.bestE1RMWeight, bp.unitType))
      : null;
    const prDeadlift = dl.bestE1RMWeight
      ? clampLb(toLbs(dl.bestE1RMWeight, dl.unitType))
      : null;

    prWeightsLbRef.current = {
      squat: prSquat,
      bench: prBench,
      deadlift: prDeadlift,
    };

    if (prSquat != null) setSquat(prSquat);
    if (prBench != null) setBench(prBench);
    if (prDeadlift != null) setDeadlift(prDeadlift);
    setUsingUserData(true);
  }, [
    topLiftsByTypeAndReps,
    isDemoMode,
    e1rmFormula,
    setSquat,
    setBench,
    setDeadlift,
  ]);

  // Recent 90-day best E1RM per lift (in lbs, rounded to 5)
  const recent90dLb = useMemo(() => {
    if (!usingUserData || !parsedData?.length || isDemoMode) return null;

    const SBD_TYPES = {
      "Back Squat": "squat",
      "Bench Press": "bench",
      Deadlift: "deadlift",
    };
    const cutoffDate = new Date(
      Date.now() - 90 * 86400000,
    ).toISOString().slice(0, 10);

    const best = { squat: 0, bench: 0, deadlift: 0 };

    for (const d of parsedData) {
      const key = SBD_TYPES[d.liftType];
      if (!key || d.isGoal || d.reps <= 0 || d.weight <= 0) continue;
      if (d.date < cutoffDate) continue;
      const weightLb = d.unitType === "lb" ? d.weight : d.weight * 2.2046;
      const e1rm =
        d.reps === 1 ? weightLb : estimateE1RM(d.reps, weightLb, e1rmFormula);
      if (e1rm > best[key]) best[key] = e1rm;
    }

    const result = {
      squat: best.squat > 0 ? clampLb(best.squat) : null,
      bench: best.bench > 0 ? clampLb(best.bench) : null,
      deadlift: best.deadlift > 0 ? clampLb(best.deadlift) : null,
    };

    // Only return if at least one lift has recent data and differs from all-time PR
    const pr = prWeightsLbRef.current;
    if (!pr) return null;
    const hasDistinct = ["squat", "bench", "deadlift"].some(
      (k) => result[k] != null && result[k] !== pr[k],
    );
    return hasDistinct ? result : null;
  }, [usingUserData, parsedData, isDemoMode, e1rmFormula]);

  // Biggest opportunity hint for the main UI
  const biggestOpportunity = useMemo(() => {
    if (!usingUserData) return null;
    return getWeakestLiftHint(squat, bench, deadlift);
  }, [usingUserData, squat, bench, deadlift]);

  const handleResetToPRs = () => {
    const pr = prWeightsLbRef.current;
    if (!pr) return;
    if (pr.squat != null) setSquat(pr.squat);
    if (pr.bench != null) setBench(pr.bench);
    if (pr.deadlift != null) setDeadlift(pr.deadlift);
  };

  const handleResetTo90d = () => {
    if (!recent90dLb) return;
    if (recent90dLb.squat != null) setSquat(recent90dLb.squat);
    if (recent90dLb.bench != null) setBench(recent90dLb.bench);
    if (recent90dLb.deadlift != null) setDeadlift(recent90dLb.deadlift);
  };

  const hasMovedFromPR =
    usingUserData &&
    prWeightsLbRef.current &&
    ((prWeightsLbRef.current.squat != null &&
      squat !== prWeightsLbRef.current.squat) ||
      (prWeightsLbRef.current.bench != null &&
        bench !== prWeightsLbRef.current.bench) ||
      (prWeightsLbRef.current.deadlift != null &&
        deadlift !== prWeightsLbRef.current.deadlift));

  const hasMovedFrom90d =
    usingUserData &&
    recent90dLb &&
    ((recent90dLb.squat != null && squat !== recent90dLb.squat) ||
      (recent90dLb.bench != null && bench !== recent90dLb.bench) ||
      (recent90dLb.deadlift != null && deadlift !== recent90dLb.deadlift));

  // Rolling 90-day SBD total timeline
  const totalTimeline = useMemo(() => {
    if (!usingUserData || !parsedData?.length || isDemoMode) return null;

    const SBD_TYPES = {
      "Back Squat": "squat",
      "Bench Press": "bench",
      Deadlift: "deadlift",
    };
    const WINDOW_DAYS = 90;

    // Pre-split entries by lift for O(samples * entries_per_lift) instead of O(samples * all_entries * 3)
    const byLift = { squat: [], bench: [], deadlift: [] };
    for (const d of parsedData) {
      const key = SBD_TYPES[d.liftType];
      if (!key || d.isGoal || d.reps <= 0 || d.weight <= 0) continue;
      byLift[key].push({
        ms: new Date(d.date).getTime(),
        weightLb: d.unitType === "lb" ? d.weight : d.weight * 2.2046,
        reps: d.reps,
      });
    }
    for (const key of ["squat", "bench", "deadlift"]) {
      byLift[key].sort((a, b) => a.ms - b.ms);
    }

    const allEntries = [...byLift.squat, ...byLift.bench, ...byLift.deadlift];
    if (allEntries.length < 2) return null;

    const firstDate = new Date(Math.min(...allEntries.map((e) => e.ms)));
    const lastDate = new Date(Math.max(...allEntries.map((e) => e.ms)));
    const spanDays = (lastDate - firstDate) / 86400000;

    let intervalDays;
    if (spanDays <= 180) intervalDays = 7;
    else if (spanDays <= 730) intervalDays = 14;
    else intervalDays = 30;

    const samples = [];
    const cursor = new Date(firstDate);
    cursor.setDate(cursor.getDate() + WINDOW_DAYS);
    while (cursor <= lastDate) {
      samples.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + intervalDays);
    }
    if (
      samples.length === 0 ||
      (lastDate - samples[samples.length - 1]) / 86400000 > 7
    ) {
      samples.push(new Date(lastDate));
    }
    if (samples.length < 2) return null;

    const points = [];
    for (const sampleDate of samples) {
      const sampleMs = sampleDate.getTime();
      const cutoff = sampleMs - WINDOW_DAYS * 86400000;

      const bestE1rm = { squat: 0, bench: 0, deadlift: 0 };

      for (const key of ["squat", "bench", "deadlift"]) {
        for (const entry of byLift[key]) {
          if (entry.ms > sampleMs) break;
          if (entry.ms < cutoff) continue;
          const e1rm =
            entry.reps === 1
              ? entry.weightLb
              : estimateE1RM(entry.reps, entry.weightLb, e1rmFormula);
          if (e1rm > bestE1rm[key]) bestE1rm[key] = e1rm;
        }
      }

      if (
        bestE1rm.squat === 0 ||
        bestE1rm.bench === 0 ||
        bestE1rm.deadlift === 0
      )
        continue;

      const total = Math.round(
        bestE1rm.squat + bestE1rm.bench + bestE1rm.deadlift,
      );
      points.push({
        date: sampleDate.toISOString().slice(0, 10),
        timestamp: sampleMs,
        total,
        squat: Math.round(bestE1rm.squat),
        bench: Math.round(bestE1rm.bench),
        deadlift: Math.round(bestE1rm.deadlift),
      });
    }

    return points.length >= 2 ? points : null;
  }, [usingUserData, parsedData, isDemoMode, e1rmFormula]);

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
      const prVal = prWeightsLbRef.current?.[liftKey];
      const r90Val = recent90dLb?.[liftKey];
      // Snap to whichever marker is closest within 1 step
      if (prVal != null && Math.abs(v - prVal) <= 5) {
        setter(prVal);
      } else if (r90Val != null && Math.abs(v - r90Val) <= 5) {
        setter(r90Val);
      } else {
        setter(v);
      }
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
        ? Math.min(
            1,
            Math.max(
              0,
              (donutRect.left + donutRect.width / 2) / window.innerWidth,
            ),
          )
        : 0.5;
      const y = donutRect
        ? Math.min(
            1,
            Math.max(
              0,
              (donutRect.top + donutRect.height / 2) / window.innerHeight,
            ),
          )
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
          Add your squat, bench press, and deadlift to see whether your total
          reaches the 1000lb Club milestone.
        </PageHeaderDescription>
        <PageHeaderRight>
          <div className="text-muted-foreground hidden gap-2 md:flex md:flex-col xl:flex-row">
            <Link
              href="/how-strong-am-i"
              className="hover:bg-muted block rounded-lg border p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <h3 className="text-base font-semibold">How Strong Am I?</h3>
              <p className="text-sm">
                See your percentile rank across lifter groups.
              </p>
            </Link>
            <Link
              href="/strength-levels"
              className="hover:bg-muted block rounded-lg border p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <h3 className="text-base font-semibold">Strength Levels</h3>
              <p className="text-sm">
                Check beginner-to-elite benchmarks per lift.
              </p>
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
              ].map(({ key, liftType, value, set }, index) => (
                <motion.div
                  key={key}
                  className="flex items-center gap-4"
                  initial={
                    prefersReducedMotion ? undefined : { opacity: 0, x: -20 }
                  }
                  animate={
                    prefersReducedMotion ? undefined : { opacity: 1, x: 0 }
                  }
                  transition={{
                    type: "spring",
                    stiffness: 260,
                    damping: 20,
                    delay: 0.15 + index * 0.15,
                  }}
                >
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
                    <SliderWithMarkers
                      value={value}
                      prVal={prWeightsLbRef.current?.[key]}
                      r90Val={recent90dLb?.[key]}
                      onValueChange={handleLiftValueChange(key, set)}
                      onValueCommit={handleLiftValueCommit}
                      className={prefersReducedMotion ? "" : `thumb-spring thumb-spring-${index}`}
                    />
                  </div>
                </motion.div>
              ))}

              <motion.div
                className="mt-4 flex flex-wrap items-center gap-3"
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
                <span className="text-3xl font-bold tabular-nums">
                  Total: {total} lbs ({toKgF(total)} kg)
                </span>
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
              </motion.div>

              <div
                className={cn("text-xl font-semibold", {
                  "text-green-600": inClub,
                  "text-muted-foreground": !inClub,
                })}
              >
                {inClub
                  ? `You\u2019re in the 1000lb Club! You\u2019re ${pastLbs} lbs (${toKgF(pastLbs)} kg) past 1000.`
                  : `You\u2019re ${awayLbs} lbs (${toKgF(awayLbs)} kg) away from the 1000lb Club.`}
                {!inClub && biggestOpportunity && (
                  <span className="text-foreground/90">
                    {" "}
                    Biggest opportunity: Add ~{biggestOpportunity.gapLbs} lb to
                    your {biggestOpportunity.lift.toLowerCase()}.
                  </span>
                )}
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
                prompt="Useful?"
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
                  })
                }
                onClick={handleCopyResult}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 text-sm">
          <p>
            To see your beginner-to-elite standards per lift, see our{" "}
            <Link
              href="/strength-levels"
              className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
            >
              Strength Levels
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

      {totalTimeline ? (
        <TotalTimelineChart
          data={totalTimeline}
          target={TARGET_TOTAL}
          showSavePrompt={
            isImportedData &&
            (authStatus === "unauthenticated" ||
              (authStatus === "authenticated" && !sheetInfo?.ssid))
          }
        />
      ) : authStatus === "unauthenticated" ||
        (authStatus === "authenticated" && !sheetInfo?.ssid) ? (
        <TotalTimelineCtaCard />
      ) : null}

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
            The formula is simple:{" "}
            <strong>Back Squat + Bench Press + Deadlift</strong>. If your total
            is at least <strong>{TARGET_TOTAL} lbs</strong>, you&apos;re in the
            1000lb club.
          </p>
          <p>
            Use the sliders to estimate your current total, then compare your
            progress with our{" "}
            <Link
              href="/strength-levels"
              className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
            >
              Strength Levels
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
        <h2 className="mb-3 text-xl font-semibold">
          Sample paths to the 1000lb Club
        </h2>
        <p className="text-muted-foreground mb-4 text-sm leading-relaxed">
          There is no single path to a 1000&nbsp;lb total. Your build, training
          history, and leverages all shape where your numbers land. Here are
          three common lifter archetypes that each hit 1000&nbsp;lbs in
          different ways.
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          {/* Squat-dominant */}
          <div className="rounded-lg border p-4">
            <h3 className="mb-2 text-sm font-semibold">
              🦵 The Squat Specialist
            </h3>
            <p className="text-muted-foreground mb-3 text-xs">
              Thick quads, strong back, loves time in the hole. Squat day is the
              best day.
            </p>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b">
                  <td className="py-1">Back Squat</td>
                  <td className="py-1 text-right font-semibold">405 lbs</td>
                </tr>
                <tr className="border-b">
                  <td className="py-1">Bench Press</td>
                  <td className="py-1 text-right">245 lbs</td>
                </tr>
                <tr className="border-b">
                  <td className="py-1">Deadlift</td>
                  <td className="py-1 text-right">350 lbs</td>
                </tr>
                <tr>
                  <td className="py-1 font-semibold">Total</td>
                  <td className="py-1 text-right font-bold text-green-500">
                    1000 lbs
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Deadlift-dominant */}
          <div className="rounded-lg border p-4">
            <h3 className="mb-2 text-sm font-semibold">
              🏗️ The Deadlift Machine
            </h3>
            <p className="text-muted-foreground mb-3 text-xs">
              Long arms, iron grip, built to pull. The bar always leaves the
              floor.
            </p>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b">
                  <td className="py-1">Back Squat</td>
                  <td className="py-1 text-right">315 lbs</td>
                </tr>
                <tr className="border-b">
                  <td className="py-1">Bench Press</td>
                  <td className="py-1 text-right">225 lbs</td>
                </tr>
                <tr className="border-b">
                  <td className="py-1">Deadlift</td>
                  <td className="py-1 text-right font-semibold">460 lbs</td>
                </tr>
                <tr>
                  <td className="py-1 font-semibold">Total</td>
                  <td className="py-1 text-right font-bold text-green-500">
                    1000 lbs
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Bench-light / T-Rex */}
          <div className="rounded-lg border p-4">
            <h3 className="mb-2 text-sm font-semibold">
              🦖 The T-Rex
            </h3>
            <p className="text-muted-foreground mb-3 text-xs">
              Big squat, big pull, tiny arms. Bench day is a rest day in
              disguise.
            </p>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b">
                  <td className="py-1">Back Squat</td>
                  <td className="py-1 text-right font-semibold">385 lbs</td>
                </tr>
                <tr className="border-b">
                  <td className="py-1">Bench Press</td>
                  <td className="py-1 text-right">185 lbs</td>
                </tr>
                <tr className="border-b">
                  <td className="py-1">Deadlift</td>
                  <td className="py-1 text-right font-semibold">430 lbs</td>
                </tr>
                <tr>
                  <td className="py-1 font-semibold">Total</td>
                  <td className="py-1 text-right font-bold text-green-500">
                    1000 lbs
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-semibold">1000lb Club FAQ</h2>
        <div className="space-y-4">
          {FAQ_ITEMS.map(({ question, answer, renderAnswer }) => (
            <article key={question} className="rounded-lg border p-4">
              <h3 className="text-base font-semibold">{question}</h3>
              <p className="text-muted-foreground mt-1 text-sm">
                {renderAnswer || answer}
              </p>
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
/**
 * @param {number} [props.target=1000] - Target total in pounds (defaults to 1000).
 */
function ThousandDonut({
  total,
  target = 1000,
  containerRef,
  isAdjusting = false,
  prefersReducedMotion = false,
}) {
  const gradientId = `thousand-donut-progress-${useId().replace(/:/g, "")}`;
  const capped = Math.min(total, target);
  const remainder = Math.max(0, target - total);
  const data = [
    { name: "Progress", value: capped },
    { name: "Remainder", value: remainder },
  ];
  const percent = Math.min(100, Math.round((total / target) * 100));
  const inClub = total >= target;

  const progressGradient = inClub
    ? { start: "#34D399", end: "#059669" }
    : { start: "#FBBF24", end: "#D97706" };
  const remainderColor = "#1F2937";

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
            : {
                scale: 1,
                rotate: 0,
                filter: "drop-shadow(0 0px 0px rgba(0,0,0,0))",
              }
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
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={progressGradient.start} />
              <stop offset="100%" stopColor={progressGradient.end} />
            </linearGradient>
          </defs>
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
              <Cell
                key={i}
                fill={i === 0 ? `url(#${gradientId})` : remainderColor}
              />
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
              <div className="text-sm font-semibold text-green-400 xl:text-base">
                1000lb Club!
              </div>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold xl:text-4xl">{total} lbs</div>
              <div className="text-muted-foreground text-xs xl:text-sm">
                of {target}
              </div>
              <div className="text-muted-foreground text-sm xl:text-lg">
                {percent}%
              </div>
            </>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}

// Ideal SBD proportions (% of total) — consensus from powerlifting averages.
// Squat ~36%, Bench ~24%, Deadlift ~40%.
const IDEAL_SBD_RATIO = { squat: 0.36, bench: 0.24, deadlift: 0.4 };
const LIFT_LABELS = { squat: "Squat", bench: "Bench", deadlift: "Deadlift" };

function getWeakestLiftHint(squat, bench, deadlift) {
  const total = squat + bench + deadlift;
  if (total === 0) return null;

  // How far each lift is below its ideal share of the total (as lbs deficit).
  const gaps = {
    squat: IDEAL_SBD_RATIO.squat * total - squat,
    bench: IDEAL_SBD_RATIO.bench * total - bench,
    deadlift: IDEAL_SBD_RATIO.deadlift * total - deadlift,
  };

  // Largest positive gap = most under-developed relative to ideal ratios.
  const worst = Object.entries(gaps).reduce(
    (best, [k, v]) => (v > best.gap ? { key: k, gap: v } : best),
    { key: null, gap: 0 },
  );

  if (!worst.key || worst.gap < 10) return null; // <10 lb gap = balanced enough
  return {
    lift: LIFT_LABELS[worst.key],
    gapLbs: Math.round(worst.gap),
  };
}

function TimelineTooltipContent({ active, payload, label }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  const above = d.total >= TARGET_TOTAL;
  const dateStr = new Date(Number(label)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const hint = getWeakestLiftHint(d.squat, d.bench, d.deadlift);

  return (
    <div className="bg-popover rounded-lg border px-3 py-2 text-xs shadow-md">
      <div className="mb-1.5 font-medium">{dateStr}</div>
      <div className="space-y-0.5">
        <div>
          Squat: {d.squat} lbs ({Math.round(d.squat * KG_PER_LB)} kg)
        </div>
        <div>
          Bench: {d.bench} lbs ({Math.round(d.bench * KG_PER_LB)} kg)
        </div>
        <div>
          Deadlift: {d.deadlift} lbs ({Math.round(d.deadlift * KG_PER_LB)} kg)
        </div>
      </div>
      <div
        className={cn(
          "mt-1.5 border-t pt-1.5 font-semibold",
          above ? "text-green-600" : "text-amber-600",
        )}
      >
        Total: {d.total} lbs ({Math.round(d.total * KG_PER_LB)} kg)
        {above ? " \u2714" : ` \u2014 ${TARGET_TOTAL - d.total} lbs to go`}
      </div>
      {hint && (
        <div className="text-muted-foreground mt-1 text-[10px] leading-tight">
          Biggest opportunity: {hint.lift} (~{hint.gapLbs} lbs below ideal
          ratio)
        </div>
      )}
    </div>
  );
}

function TotalTimelineChart({ data, target, showSavePrompt = false }) {
  if (!data || data.length < 2) return null;

  const spanDays =
    (new Date(data[data.length - 1].date) - new Date(data[0].date)) / 86400000;

  const segmentedData = buildSegmentedTimelineData(data, target);
  const xTicks = buildTimelineTicks(data, spanDays);

  const formatTick = (timestamp) => {
    const d = new Date(timestamp);
    if (spanDays <= 365) {
      return d.toLocaleDateString("en-US", { month: "short" });
    }
    if (spanDays <= 1095) {
      return d.toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      });
    }
    return d.toLocaleDateString("en-US", { year: "numeric" });
  };

  const minTotal = Math.min(...data.map((d) => d.total));
  const maxTotal = Math.max(...data.map((d) => d.total));
  const yMin = Math.floor(Math.min(minTotal, target - 50) / 50) * 50;
  const yMax = Math.ceil(Math.max(maxTotal, target + 50) / 50) * 50;
  const yTicks = buildYAxisTicks(yMin, yMax, target);

  const everCrossed = data.some((d) => d.total >= target);
  const latestAbove = data[data.length - 1].total >= target;

  return (
    <Card className="mt-6">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trophy className="h-5 w-5" />
          Your SBD Total Over Time
        </CardTitle>
        <CardDescription>
          Rolling 90-day best E1RM total (squat + bench + deadlift).
          {everCrossed && latestAbove && " You\u2019re in the club."}
          {everCrossed &&
            !latestAbove &&
            " You\u2019ve crossed the line before \u2014 get back there."}
          {!everCrossed &&
            ` ${target - data[data.length - 1].total} lbs to go.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[220px] w-full sm:h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={segmentedData}
              margin={{ top: 8, right: 40, bottom: 0, left: -12 }}
            >
              <defs>
                <linearGradient
                  id="timeline-fill-above"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset={0} stopColor="#10B981" stopOpacity={0.24} />
                  <stop offset={1} stopColor="#10B981" stopOpacity={0.06} />
                </linearGradient>
                <linearGradient
                  id="timeline-fill-below"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset={0} stopColor="#F59E0B" stopOpacity={0.22} />
                  <stop offset={1} stopColor="#F59E0B" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="timestamp"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                ticks={xTicks}
                tickFormatter={formatTick}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[yMin, yMax]}
                ticks={yTicks}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}`}
              />
              <RechartsTooltip content={<TimelineTooltipContent />} />
              <ReferenceLine
                y={target}
                stroke="#10B981"
                strokeDasharray="6 3"
                strokeWidth={2}
                label={{
                  value: `${target} lbs`,
                  position: "insideRight",
                  offset: -6,
                  dy: -10,
                  fill: "#10B981",
                  fontSize: 11,
                  fontWeight: 600,
                }}
              />
              <Area
                type="monotone"
                dataKey="below"
                connectNulls
                stroke="#F59E0B"
                strokeWidth={2.5}
                fill="url(#timeline-fill-below)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "#F59E0B" }}
              />
              <Area
                type="monotone"
                dataKey="above"
                connectNulls
                baseValue={target}
                stroke="#10B981"
                strokeWidth={2.5}
                fill="url(#timeline-fill-above)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "#10B981" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {showSavePrompt ? <TotalTimelineSavePromptInline /> : null}
      </CardContent>
    </Card>
  );
}

function TotalTimelineCtaCard() {
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
        description: `Parsed ${count} entries from ${formatName}. Your chart is ready below.`,
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
            <Trophy className="h-5 w-5" />
            Drop in your data to unlock your 1000lb club chart
          </CardTitle>
          <CardDescription>
            Drag in your workout data from Hevy, Strong, Wodify, BTWB, or
            TurnKey. We&apos;ll parse it in your browser and turn it into your
            1000lb club chart.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] lg:items-stretch">
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
                  generate your 1000lb club chart.
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

          <div className="from-muted/20 via-background to-muted/30 relative overflow-hidden rounded-xl border bg-gradient-to-br p-4 sm:p-6">
            <div className="grid grid-cols-[42px_minmax(0,1fr)] gap-2 opacity-55 saturate-[0.85]">
              <div className="text-muted-foreground flex h-[180px] flex-col justify-between pt-1 text-[11px] tabular-nums sm:h-[220px]">
                <span>1150</span>
                <span>1000</span>
                <span>850</span>
                <span>700</span>
              </div>

              <div className="space-y-2">
                <div className="relative h-[180px] overflow-hidden sm:h-[220px]">
                  <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,transparent_calc(25%-1px),rgba(148,163,184,0.16)_25%,transparent_calc(25%+1px),transparent_calc(50%-1px),rgba(148,163,184,0.12)_50%,transparent_calc(50%+1px),transparent_calc(75%-1px),rgba(148,163,184,0.1)_75%,transparent_calc(75%+1px),transparent_100%)]" />
                  <div className="absolute inset-x-0 top-[25%] border-t-2 border-dashed border-emerald-500/55" />
                  <span className="bg-background/70 absolute top-[calc(25%-20px)] right-2 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-600">
                    1000 lbs
                  </span>
                  <svg
                    viewBox="0 0 700 220"
                    className="absolute inset-0 h-full w-full"
                    preserveAspectRatio="none"
                    aria-hidden
                  >
                    <defs>
                      <linearGradient
                        id="timeline-cta-above"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#10B981"
                          stopOpacity="0.22"
                        />
                        <stop
                          offset="100%"
                          stopColor="#10B981"
                          stopOpacity="0.05"
                        />
                      </linearGradient>
                      <linearGradient
                        id="timeline-cta-below"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.2" />
                        <stop
                          offset="100%"
                          stopColor="#F59E0B"
                          stopOpacity="0.04"
                        />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0,170 C55,164 95,156 138,116 C176,82 218,72 268,92 C314,110 362,172 414,146 C463,122 506,72 548,62 C594,50 642,76 700,68 L700,220 L0,220 Z"
                      fill="url(#timeline-cta-below)"
                    />
                    <path
                      d="M0,170 C55,164 95,156 138,116 C176,82 218,72 268,92 C314,110 362,172 414,146 C463,122 506,72 548,62 C594,50 642,76 700,68 L700,48 C642,58 594,30 548,36 C506,42 463,96 414,112 C362,130 314,86 268,70 C218,52 176,58 138,90 C95,126 55,146 0,152 Z"
                      fill="url(#timeline-cta-above)"
                    />
                    <path
                      d="M0,170 C55,164 95,156 138,116 C176,82 218,72 268,92 C314,110 362,172 414,146 C463,122 506,72 548,62 C594,50 642,76 700,68"
                      fill="none"
                      stroke="#F59E0B"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                    <path
                      d="M138,116 C176,82 218,72 268,92"
                      fill="none"
                      stroke="#10B981"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                    <path
                      d="M414,146 C463,122 506,72 548,62 C594,50 642,76 700,68"
                      fill="none"
                      stroke="#10B981"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                <div className="text-muted-foreground flex justify-between pl-1 text-[11px] tabular-nums">
                  <span>2021</span>
                  <span>2022</span>
                  <span>2023</span>
                  <span>2024</span>
                  <span>2025</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TotalTimelineSavePromptInline() {
  const { status: authStatus } = useSession();
  const { parsedData } = useUserLiftingData();

  const handleCreateFromPrompt = async () => {
    if (!parsedData || parsedData.length === 0) return;

    openSheetSetupDialog("bootstrap", {
      action: PENDING_SHEET_ACTIONS.CREATE_SHEET_FROM_IMPORT,
    });
  };

  return (
    <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50/80 px-4 py-3 dark:border-blue-800/60 dark:bg-blue-950/50">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-base font-semibold text-blue-950 dark:text-blue-100">
            Love this chart?
          </p>
          <p className="text-sm leading-relaxed text-blue-900/85 dark:text-blue-200/85">
            Sign in with Google (3 seconds) to save your history forever and get
            automatic updates with every new workout.
          </p>
        </div>
        {authStatus === "authenticated" ? (
          <Button
            className="border-blue-300 bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 sm:shrink-0"
            onClick={handleCreateFromPrompt}
          >
            Save my data
          </Button>
        ) : (
          <GoogleSignInButton
            cta="1000lb_club_preview_save"
            callbackUrl="/1000lb-club-calculator"
            className="sm:shrink-0"
          >
            Sign in with Google
          </GoogleSignInButton>
        )}
      </div>
    </div>
  );
}

function buildSegmentedTimelineData(data, target) {
  const segmented = [];

  for (let i = 0; i < data.length; i += 1) {
    const point = data[i];
    segmented.push({
      ...point,
      above: point.total >= target ? point.total : null,
      below: point.total <= target ? point.total : null,
    });

    const next = data[i + 1];
    if (!next) continue;

    const prevDelta = point.total - target;
    const nextDelta = next.total - target;
    if (prevDelta === 0 || nextDelta === 0 || prevDelta * nextDelta > 0) {
      continue;
    }

    const ratio = (target - point.total) / (next.total - point.total);
    const crossingTimestamp = Math.round(
      point.timestamp + ratio * (next.timestamp - point.timestamp),
    );

    segmented.push({
      ...point,
      date: new Date(crossingTimestamp).toISOString().slice(0, 10),
      timestamp: crossingTimestamp,
      total: target,
      above: target,
      below: target,
    });
  }

  return segmented;
}

function buildTimelineTicks(data, spanDays) {
  if (!data.length) return [];

  if (spanDays > 1095) {
    const yearlyTicks = [];
    let previousYear = null;

    for (const point of data) {
      const year = new Date(point.timestamp).getFullYear();
      if (year !== previousYear) {
        yearlyTicks.push(point.timestamp);
        previousYear = year;
      }
    }

    const lastTick = data[data.length - 1].timestamp;
    if (yearlyTicks[yearlyTicks.length - 1] !== lastTick) {
      yearlyTicks.push(lastTick);
    }

    return yearlyTicks;
  }

  const desiredTickCount = spanDays > 365 ? 7 : 6;
  const step = Math.max(
    1,
    Math.ceil((data.length - 1) / (desiredTickCount - 1)),
  );
  const ticks = [];

  for (let i = 0; i < data.length; i += step) {
    ticks.push(data[i].timestamp);
  }

  const lastTick = data[data.length - 1].timestamp;
  if (ticks[ticks.length - 1] !== lastTick) {
    ticks.push(lastTick);
  }

  return ticks;
}

function buildYAxisTicks(yMin, yMax, target) {
  const ticks = [];

  for (let value = yMin; value <= yMax; value += 50) {
    ticks.push(value);
  }

  if (!ticks.includes(target)) {
    ticks.push(target);
    ticks.sort((a, b) => a - b);
  }

  return ticks;
}
