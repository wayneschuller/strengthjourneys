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
import { Fragment, useState, useEffect, useRef, useCallback, useMemo } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

// Unit-aware plate threshold check.
// In metric mode, compare displayed kg against the true metric plate target
// (4 plates = 180 kg, NOT toKg(405) = 184 kg).
const meetsPlateTarget = (valueLb, tierN, isMetric) =>
  isMetric
    ? toKg(valueLb) >= plateTotal(tierN, true)
    : valueLb >= plateTotal(tierN, false);

const formatMonthYear = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
};

const formatMonthDay = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
};

const formatFullDate = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
};

const formatLb = (lbs, isMetric) =>
  isMetric ? `${toKg(lbs)} kg` : `${Math.round(lbs)} lb`;

const formatSet = (set, isMetric) =>
  `${set.reps} × ${formatLb(set.weightLb, isMetric)}`;

const hashString = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
};

const pickVariant = (variants, seed) =>
  variants[hashString(seed) % variants.length];

const daysBetween = (laterYmd, earlierYmd) => {
  const later = new Date(laterYmd + "T00:00:00Z").getTime();
  const earlier = new Date(earlierYmd + "T00:00:00Z").getTime();
  return Math.floor((later - earlier) / 86400000);
};

const SHORT_LIFT_NAMES = {
  "Strict Press": "Press",
  "Bench Press": "Bench",
  "Back Squat": "Squat",
  Deadlift: "Deadlift",
};

const LIFT_VERBS = {
  "Strict Press": "press",
  "Bench Press": "bench",
  "Back Squat": "squat",
  Deadlift: "deadlift",
};

function tierLabel(n) {
  return `${n} plate${n === 1 ? "" : "s"}`;
}

// Builds a one-line, lifter-to-lifter status sentence based on the user's actual
// data for this lift. Chooses one of seven branches in priority order, then
// picks one of 6 deterministic phrasings (seeded by lift + latest-session date
// so the line stabilises until the user logs a new session).
function buildStatusSentence({ milestone, stats, isMetric }) {
  if (!stats) return null;
  const { pr, single, now: nowSet, periodBests, latestDate, daysSinceLatest, progress6mDelta, tierCrossings } = stats;
  if (!pr || !nowSet || !latestDate) return null;

  const liftType = milestone.liftType;
  const liftKey = milestone.key;
  const liftVerb = LIFT_VERBS[liftType] || "lift";
  const wStr = (lb) => formatLb(lb, isMetric);
  const setStr = (s) => formatSet(s, isMetric);
  const seedBase = `${liftKey}-${latestDate ?? "none"}`;

  // Latest tier crossed (by first-crossing date)
  let latestCrossedTier = 0;
  let latestCrossedDate = null;
  for (const t of ALL_TIERS) {
    const c = tierCrossings?.[t];
    if (!c) continue;
    if (!latestCrossedDate || c.first.date > latestCrossedDate) {
      latestCrossedTier = t;
      latestCrossedDate = c.first.date;
    }
  }
  const nextTierAfterLatest = latestCrossedTier > 0 ? latestCrossedTier + 1 : 1;

  // BRANCH: Just crossed (latest tier crossed within 30 days)
  if (latestCrossedDate) {
    const todayYmd = new Date().toISOString().slice(0, 10);
    const daysSinceCross = daysBetween(todayYmd, latestCrossedDate);
    if (daysSinceCross >= 0 && daysSinceCross <= 30) {
      const crossing = tierCrossings[latestCrossedTier];
      const tStr = tierLabel(latestCrossedTier);
      const nextStr =
        nextTierAfterLatest <= 4 ? tierLabel(nextTierAfterLatest) : "the next milestone";
      return pickVariant(
        [
          `🎉 Crossed ${tStr} on ${formatMonthDay(crossing.first.date)} with ${setStr(crossing.first)} · ${nextStr} to go`,
          `🥳 First ${tStr} on ${formatMonthDay(crossing.first.date)} · the bar finally cleared with ${setStr(crossing.first)}`,
          `🎉 Welcome to ${tStr} (since ${formatMonthDay(crossing.first.date)}) · next stop ${nextStr}`,
          `💪 Just earned ${tStr} on ${formatMonthDay(crossing.first.date)} with ${setStr(crossing.first)}`,
          `🔥 ${tStr} unlocked ${formatMonthDay(crossing.first.date)} · the bar rattles different now`,
          `🎉 Crossed ${tStr} on ${formatMonthDay(crossing.first.date)} · keep grinding for ${nextStr}`,
        ],
        `${seedBase}-just-crossed-${latestCrossedTier}`,
      );
    }
  }

  // BRANCH: Returning from layoff (>30 days since last session)
  if (daysSinceLatest > 30) {
    return pickVariant(
      [
        `First ${liftVerb} in ${daysSinceLatest} days · welcome back to the bar`,
        `Back at it after ${daysSinceLatest} days · last logged ${setStr(nowSet)}`,
        `It's been ${daysSinceLatest} days · ease in and the strength comes back fast`,
        `Layoff was ${daysSinceLatest} days · muscle memory has your back`,
        `First ${liftVerb} in ${daysSinceLatest} days · the bar missed you`,
        `${daysSinceLatest} days since your last ${liftVerb} · time to make some noise`,
      ],
      `${seedBase}-returning`,
    );
  }

  // BRANCH: Long anchor (target tier crossed >=2 years ago, currently above, minimal recent gain)
  const targetTier = milestone.targetPlates;
  const targetCrossing = tierCrossings?.[targetTier];
  if (targetCrossing?.currentlyAbove) {
    const todayYmd = new Date().toISOString().slice(0, 10);
    const daysSinceTarget = daysBetween(todayYmd, targetCrossing.first.date);
    const years = Math.floor(daysSinceTarget / 365.25);
    const significantGainLb = isMetric ? 11 : 11; // ~5kg
    if (years >= 2 && Math.abs(progress6mDelta) < significantGainLb) {
      const tStr = tierLabel(targetTier);
      return pickVariant(
        [
          `Anchored at ${tStr} for ${years} years · classic dependable ${liftVerb}`,
          `${tStr} since ${formatMonthDay(targetCrossing.first.date)} · ${years} years of solid lifting`,
          `${years} years at ${tStr} · the kind of consistency most lifters envy`,
          `Holding ${tStr} since ${formatMonthDay(targetCrossing.first.date)} · iron old guard`,
          `${years} year veteran of the ${tStr} club · respect`,
          `Locked in at ${tStr} for ${years} years · this lift is your bread and butter`,
        ],
        `${seedBase}-anchor`,
      );
    }
  }

  // BRANCH: AFAF stuck — recent actual single is meaningfully below PR E1RM, 6m progress is small
  const todayYmd2 = new Date().toISOString().slice(0, 10);
  const singleIsRecent = single && daysBetween(todayYmd2, single.date) <= 365;
  const meaningfulGapLb = isMetric ? 5 : 5; // ~2.5 kg
  const smallProgressLb = isMetric ? 11 : 11; // ~5 kg
  if (
    singleIsRecent &&
    pr.e1rm - single.weightLb >= meaningfulGapLb &&
    progress6mDelta < smallProgressLb
  ) {
    const gapLb = pr.e1rm - single.weightLb;
    return pickVariant(
      [
        `Heaviest real single ${wStr(single.weightLb)} on ${formatMonthDay(single.date)} · E1RM says ${wStr(pr.e1rm)} · ${wStr(gapLb)} gap to close`,
        `Calculator is teasing you: ${wStr(pr.e1rm)} E1RM, ${wStr(single.weightLb)} actually lifted · close that ${wStr(gapLb)} gap`,
        `Real best single ${wStr(single.weightLb)}, estimated ${wStr(pr.e1rm)} · the ${liftVerb} is the slowest lift, this is normal`,
        `Stuck between ${wStr(single.weightLb)} (real) and ${wStr(pr.e1rm)} (E1RM) · grind through it`,
        `${wStr(single.weightLb)} is your honest single · ${wStr(pr.e1rm)} is what your back-off sets predict · go take the real number`,
        `${SHORT_LIFT_NAMES[liftType]} is stubborn · you've got ${wStr(single.weightLb)} on the bar, your reps say you have ${wStr(pr.e1rm)} in you`,
      ],
      `${seedBase}-afaf`,
    );
  }

  // BRANCH: Climbing (6m E1RM gain >= ~5 kg / 11 lb)
  if (progress6mDelta >= smallProgressLb) {
    const gainStr = wStr(progress6mDelta);
    return pickVariant(
      [
        `Climbing well · +${gainStr} E1RM over 6 months`,
        `Last set ${setStr(nowSet)} on ${formatMonthDay(nowSet.date)} · +${gainStr} in 6 months, keep stacking`,
        `+${gainStr} over the last 6 months · this is what progress looks like`,
        `On a tear · ${gainStr} added to your E1RM in 6 months`,
        `Steady climb: +${gainStr} in 6 months · last set ${setStr(nowSet)}`,
        `Six months, ${gainStr} added · keep the trend going`,
      ],
      `${seedBase}-climbing`,
    );
  }

  // BRANCH: Close to next tier (within ~10 lb / 4.5 kg of next un-crossed tier)
  let nextUncrossedTier = null;
  for (const t of ALL_TIERS) {
    if (!tierCrossings?.[t]?.currentlyAbove) {
      nextUncrossedTier = t;
      break;
    }
  }
  if (nextUncrossedTier) {
    const thresholdLb = BAR_LB + nextUncrossedTier * 2 * PLATE_LB;
    const currentBest = Math.max(pr.e1rm, nowSet.e1rm);
    const gapLb = thresholdLb - currentBest;
    const nearThresholdLb = isMetric ? 11 : 11; // ~5 kg
    if (gapLb > 0 && gapLb <= nearThresholdLb) {
      const tStr = tierLabel(nextUncrossedTier);
      const gStr = wStr(gapLb);
      return pickVariant(
        [
          `${gStr} from ${tStr} · keep stacking`,
          `Just ${gStr} short of ${tStr} · the next session might do it`,
          `Almost at ${tStr} · only ${gStr} to go`,
          `${tStr} is ${gStr} away · close enough to taste`,
          `Last few kilos to ${tStr} · ${gStr} stands between you and the next plate`,
          `Within ${gStr} of ${tStr} · time to send it`,
        ],
        `${seedBase}-close`,
      );
    }
  }

  // BRANCH: Steady default
  return pickVariant(
    [
      `Last logged ${setStr(nowSet)} on ${formatMonthDay(nowSet.date)} · holding steady`,
      `Most recent ${setStr(nowSet)} on ${formatMonthDay(nowSet.date)} · keep showing up`,
      `${setStr(nowSet)} last logged on ${formatMonthDay(nowSet.date)} · solid`,
      `Last session ${setStr(nowSet)} on ${formatMonthDay(nowSet.date)} · iron in the bank`,
      `Holding at ${setStr(nowSet)} as of ${formatMonthDay(nowSet.date)} · consistency is a strength too`,
      `Last on the bar: ${setStr(nowSet)} on ${formatMonthDay(nowSet.date)} · keep at it`,
    ],
    `${seedBase}-steady`,
  );
}

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

// --- Tooltip body for a single notch ---
function NotchTooltipBody({ notch }) {
  return (
    <div className="space-y-0.5">
      <div className="font-semibold">{notch.headline}</div>
      {notch.detail && (
        <div className="text-muted-foreground">{notch.detail}</div>
      )}
    </div>
  );
}

// Cluster notches within MERGE_THRESHOLD_PCT so their pill labels don't
// visually collide. Now and period bests merge into one pill when they're
// close — the "climbing past previous peaks" visual emerges naturally from
// horizontal distance once Now is clearly above the period bests.
function clusterNotches(notches, max) {
  const visible = notches
    .filter((n) => n.valueLb > 0 && n.valueLb <= max)
    .sort((a, b) => a.valueLb - b.valueLb);
  const MERGE_THRESHOLD_PCT = 10;
  const clusters = [];
  for (const n of visible) {
    const percent = (n.valueLb / max) * 100;
    const last = clusters[clusters.length - 1];
    const lastNotch = last ? last[last.length - 1] : null;
    const lastPercent = lastNotch ? (lastNotch.valueLb / max) * 100 : -Infinity;
    if (last && Math.abs(percent - lastPercent) <= MERGE_THRESHOLD_PCT) {
      last.push(n);
    } else {
      clusters.push([n]);
    }
  }
  return clusters;
}

// --- Slider with clustered notches + per-pill tooltips ---
// Notches: { key, valueLb, shortLabel, headline, detail, zIndex, isDominant, accent }
// accent: "default" | "single" | "now" | "newPR"
function NotchedMilestoneSlider({
  value,
  max,
  notches,
  onValueChange,
  onValueCommit,
  className,
}) {
  const clusters = clusterNotches(notches || [], max);

  return (
    <div className={cn("relative pb-9", className)}>
      <Slider
        value={[value]}
        min={0}
        max={max}
        step={5}
        onValueChange={onValueChange}
        onValueCommit={onValueCommit}
        className="mt-2"
      />
      {clusters.length > 0 && (
        <TooltipProvider delayDuration={150}>
          {clusters.map((cluster) => {
            const centerPercent =
              cluster.reduce(
                (sum, n) => sum + (n.valueLb / max) * 100,
                0,
              ) / cluster.length;
            const maxZ = Math.max(...cluster.map((n) => n.zIndex));
            const hasNewPR = cluster.some((n) => n.accent === "newPR");
            const mergedLabel = cluster.map((n) => n.shortLabel).join(" · ");
            const clusterKey = cluster.map((n) => n.key).join("-");

            const pillClass = hasNewPR
              ? "bg-yellow-400 text-yellow-950 ring-1 ring-yellow-600/30"
              : "bg-foreground text-background";

            return (
              <Fragment key={clusterKey}>
                {cluster.map((n) => {
                  const tickPercent = (n.valueLb / max) * 100;
                  const tickClass =
                    n.accent === "newPR" ? "bg-yellow-500" : "bg-foreground";
                  return (
                    <div
                      key={`tick-${n.key}`}
                      className={cn(
                        "pointer-events-none absolute h-2 w-px",
                        tickClass,
                      )}
                      style={{
                        left: `${tickPercent}%`,
                        bottom: "18px",
                        transform: "translateX(-50%)",
                        zIndex: n.zIndex,
                      }}
                    />
                  );
                })}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "absolute -translate-x-1/2 rounded px-1.5 py-0.5 text-[10px] font-medium leading-none whitespace-nowrap shadow-sm transition-colors hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        pillClass,
                      )}
                      style={{
                        left: `${centerPercent}%`,
                        bottom: 0,
                        zIndex: maxZ,
                      }}
                    >
                      {mergedLabel}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    sideOffset={6}
                    className="max-w-xs text-xs"
                  >
                    {cluster.length === 1 ? (
                      <NotchTooltipBody notch={cluster[0]} />
                    ) : (
                      <div className="space-y-2">
                        {cluster.map((n) => (
                          <NotchTooltipBody key={n.key} notch={n} />
                        ))}
                      </div>
                    )}
                  </TooltipContent>
                </Tooltip>
              </Fragment>
            );
          })}
        </TooltipProvider>
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

  // Achievement display mode: "actual" (heaviest bar load — honest default) or
  // "e1rm" (PR-derived estimated 1RM — optimistic, what your reps predict).
  // Toggle is visible only for users with parsed lifting data.
  const [achievementMode, setAchievementMode] = useLocalStorage(
    LOCAL_STORAGE_KEYS.PLATE_MILESTONE_MODE,
    "actual",
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

  // Classic-club + total-tier counts are computed further down, once
  // `actualBestByLift` is in scope. See after `actualBestByLift` definition.

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

  // Auto-populate effect is defined further down once `actualBestByLift` is in
  // scope (prefers actual bar load over PR-E1RM so the slider lands on
  // reality, not an inflated extrapolation).

  // Consolidated per-lift stats: lifetime PR/single, period bests (1M/6M/1Y),
  // most-recent-session E1RM, 6-month E1RM delta, and first/last sets crossing each tier.
  // All weights normalized to lb (display layer converts).
  const liftStats = useMemo(() => {
    if (!parsedData?.length || isDemoMode || !usingUserData) return null;

    const now = new Date();
    const ymd = (date) => date.toISOString().slice(0, 10);
    const cutoff1M = ymd(new Date(now.getTime() - 30 * 86400000));
    const cutoff6M = ymd(new Date(now.getTime() - 183 * 86400000));
    const cutoff1Y = ymd(new Date(now.getTime() - 365 * 86400000));
    const todayStr = ymd(now);

    const result = {};

    for (const milestone of MILESTONES) {
      const entries = [];
      for (const d of parsedData) {
        if (
          d.liftType !== milestone.liftType ||
          d.isGoal ||
          d.reps <= 0 ||
          d.weight <= 0 ||
          !d.date
        )
          continue;
        const weightLb = toLb(d.weight, d.unitType);
        const e1rm =
          d.reps === 1
            ? weightLb
            : estimateE1RM(d.reps, weightLb, e1rmFormula);
        entries.push({
          date: d.date,
          reps: d.reps,
          weightLb,
          e1rm,
          unitType: d.unitType,
        });
      }
      if (entries.length === 0) continue;

      entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

      let pr = null;
      let single = null;
      let bestWeightSet = null;
      for (const e of entries) {
        if (!pr || e.e1rm > pr.e1rm) pr = e;
        if (e.reps === 1 && (!single || e.weightLb > single.weightLb))
          single = e;
        if (!bestWeightSet || e.weightLb > bestWeightSet.weightLb)
          bestWeightSet = e;
      }
      const bestWeightLb = bestWeightSet?.weightLb ?? 0;

      const latestDate = entries[entries.length - 1].date;
      let nowSet = null;
      let nowByWeight = null;
      for (const e of entries) {
        if (e.date !== latestDate) continue;
        if (!nowSet || e.e1rm > nowSet.e1rm) nowSet = e;
        if (!nowByWeight || e.weightLb > nowByWeight.weightLb)
          nowByWeight = e;
      }

      // Period bests track both metrics in parallel so the mode toggle can
      // pick the right lens without re-scanning parsedData. All exclude the
      // latest session date so NOW can climb past them visually.
      const periodBests = { "1M": null, "6M": null, "1Y": null };
      const periodBestsByWeight = { "1M": null, "6M": null, "1Y": null };
      for (const e of entries) {
        if (e.date === latestDate) continue;
        if (e.date >= cutoff1M) {
          if (!periodBests["1M"] || e.e1rm > periodBests["1M"].e1rm)
            periodBests["1M"] = e;
          if (
            !periodBestsByWeight["1M"] ||
            e.weightLb > periodBestsByWeight["1M"].weightLb
          )
            periodBestsByWeight["1M"] = e;
        }
        if (e.date >= cutoff6M) {
          if (!periodBests["6M"] || e.e1rm > periodBests["6M"].e1rm)
            periodBests["6M"] = e;
          if (
            !periodBestsByWeight["6M"] ||
            e.weightLb > periodBestsByWeight["6M"].weightLb
          )
            periodBestsByWeight["6M"] = e;
        }
        if (e.date >= cutoff1Y) {
          if (!periodBests["1Y"] || e.e1rm > periodBests["1Y"].e1rm)
            periodBests["1Y"] = e;
          if (
            !periodBestsByWeight["1Y"] ||
            e.weightLb > periodBestsByWeight["1Y"].weightLb
          )
            periodBestsByWeight["1Y"] = e;
        }
      }

      let sixMonthsAgoE1rm = 0;
      for (const e of entries) {
        if (e.date > cutoff6M) break;
        if (e.e1rm > sixMonthsAgoE1rm) sixMonthsAgoE1rm = e.e1rm;
      }
      const progress6mDelta =
        pr && sixMonthsAgoE1rm > 0 ? pr.e1rm - sixMonthsAgoE1rm : 0;

      // currentE1rm = rolling 90-day best ending at the latest log (matches the
      // pre-existing tier-badge semantics from milestoneDates so green/amber dots
      // behave as before).
      const window90Cutoff = ymd(
        new Date(
          new Date(latestDate + "T00:00:00Z").getTime() - 90 * 86400000,
        ),
      );
      let currentE1rm = 0;
      for (const e of entries) {
        if (e.date < window90Cutoff || e.date > latestDate) continue;
        if (e.e1rm > currentE1rm) currentE1rm = e.e1rm;
      }

      const tierCrossings = {};
      for (const tierN of ALL_TIERS) {
        const thresholdLb = BAR_LB + tierN * 2 * PLATE_LB;
        let firstSet = null;
        let lastSet = null;
        for (const e of entries) {
          if (e.e1rm < thresholdLb) continue;
          if (!firstSet) firstSet = e;
          lastSet = e;
        }
        if (firstSet) {
          tierCrossings[tierN] = {
            first: firstSet,
            last: lastSet,
            currentlyAbove: currentE1rm >= thresholdLb,
          };
        }
      }

      const daysSinceLatest = daysBetween(todayStr, latestDate);

      result[milestone.key] = {
        pr,
        single,
        bestWeightLb,
        bestWeightSet,
        now: nowSet,
        nowByWeight,
        periodBests,
        periodBestsByWeight,
        latestDate,
        daysSinceLatest,
        progress6mDelta,
        currentE1rm,
        tierCrossings,
      };
    }

    return Object.keys(result).length > 0 ? result : null;
  }, [parsedData, isDemoMode, usingUserData, e1rmFormula]);

  // 6-month bests in lb (for snap targets + reset button)
  const recent6mLb = useMemo(() => {
    if (!liftStats || !prWeightsLb) return null;
    const result = {};
    let hasDistinct = false;
    for (const m of MILESTONES) {
      const p = liftStats[m.key]?.periodBests?.["6M"];
      if (p) {
        const clamped = clampToMax(p.e1rm, m.maxLb);
        result[m.key] = clamped;
        if (clamped !== prWeightsLb[m.key]) hasDistinct = true;
      } else {
        result[m.key] = null;
      }
    }
    return hasDistinct ? result : null;
  }, [liftStats, prWeightsLb]);

  // Heaviest actual single per lift in lb (for snap)
  const singleWeightsLb = useMemo(() => {
    if (!liftStats) return null;
    const result = {};
    for (const m of MILESTONES) {
      const s = liftStats[m.key]?.single;
      result[m.key] = s ? clampToMax(s.weightLb, m.maxLb) : null;
    }
    return result;
  }, [liftStats]);

  // Heaviest actual weight on the bar per lift in lb (any reps). This is the
  // "honest" measure for plate-milestone achievement: did you actually load N
  // plates on the bar and move it? Drives the slider auto-populate, the Done!
  // trophy, and the parent-level club/tier counts.
  const actualBestByLift = useMemo(() => {
    if (!liftStats) return null;
    const result = {};
    let any = false;
    for (const m of MILESTONES) {
      const lb = liftStats[m.key]?.bestWeightLb;
      if (lb && lb > 0) {
        result[m.key] = clampToMax(lb, m.maxLb);
        any = true;
      } else {
        result[m.key] = null;
      }
    }
    return any ? result : null;
  }, [liftStats]);

  // Effective achievement value for a lift: depends on the user-selected mode.
  // - "actual" (default): heaviest weight ever loaded on the bar (honest)
  // - "e1rm": PR-derived estimated 1RM (optimistic, reps-extrapolated)
  // Guest/demo users always fall through to slider value (no data to anchor).
  const effectiveAchievementValue = useCallback(
    (liftKey) => {
      const actual = actualBestByLift?.[liftKey];
      const pr = prWeightsLb?.[liftKey];
      if (achievementMode === "e1rm") {
        return pr ?? actual ?? values[liftKey];
      }
      return actual ?? pr ?? values[liftKey];
    },
    [achievementMode, actualBestByLift, prWeightsLb, values],
  );

  // Auto-populate slider from user data on first load. The slider lands on the
  // currently-selected mode's basis (actual best or PR-E1RM); afterwards the
  // slider is free-floating, so mode-toggling mid-session doesn't yank it.
  useEffect(() => {
    if (hasAutoPopulatedRef.current) return;
    if (!prWeightsLb && !actualBestByLift) return;
    hasAutoPopulatedRef.current = true;
    for (const milestone of MILESTONES) {
      const actual = actualBestByLift?.[milestone.key];
      const pr = prWeightsLb?.[milestone.key];
      const nextValue =
        achievementMode === "e1rm" ? (pr ?? actual) : (actual ?? pr);
      if (nextValue != null) setters[milestone.key](nextValue);
    }
  }, [actualBestByLift, prWeightsLb, achievementMode, setters]);

  // Check if classic 1/2/3/4 is complete — based on actual bar load when
  // available, falling back to slider value for unauthenticated/demo users.
  const classicClubAchieved = MILESTONES.every((m) =>
    meetsPlateTarget(effectiveAchievementValue(m.key), m.targetPlates, isMetric),
  );

  const totalTiersAchieved = useMemo(() => {
    let count = 0;
    for (const m of MILESTONES) {
      const v = effectiveAchievementValue(m.key);
      for (const n of m.tiers) {
        if (meetsPlateTarget(v, n, isMetric)) count++;
      }
    }
    return count;
  }, [effectiveAchievementValue, isMetric]);

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

  // Unified 5-slot notch system: NOW, 1M, 6M, 1Y, BEST. Both modes share the
  // same temporal slots; the toggle picks which underlying values fill them.
  // - Actual mode: each slot's value is heaviest bar load in that window
  // - E1RM mode: each slot's value is highest E1RM in that window
  // Position = weightLb in actual mode, e1rm in E1RM mode. Notches sharing a
  // setId merge into one pill with a combined label.
  const notchesByLift = useMemo(() => {
    if (!liftStats || !prWeightsLb) return null;
    const result = {};

    const ROLE_CONFIG = {
      "1M": { label: "1M", priority: 1, accent: "default", zIndex: 10, isDominant: false },
      "6M": { label: "6M", priority: 1, accent: "default", zIndex: 10, isDominant: false },
      "1Y": { label: "1Y", priority: 1, accent: "default", zIndex: 10, isDominant: false },
      best: { label: "Best", priority: 2, accent: "default", zIndex: 30, isDominant: false },
      now: { label: "Now", priority: 4, accent: "now", zIndex: 40, isDominant: true },
      newBest: { label: "🎉 New best!", priority: 5, accent: "newPR", zIndex: 40, isDominant: true },
    };
    const PERIOD_LABEL = { "1M": "Last month", "6M": "Last 6 months", "1Y": "Last year" };
    const setId = (s) => `${s.date}-${s.reps}-${s.weightLb}`;

    for (const milestone of MILESTONES) {
      const stats = liftStats[milestone.key];
      const prValueLb = prWeightsLb[milestone.key];
      if (!stats || !stats.pr || prValueLb == null) continue;

      // Pick source data per mode
      const isActual = achievementMode === "actual";
      const bestSet = isActual ? stats.bestWeightSet : stats.pr;
      const nowSet = isActual ? stats.nowByWeight : stats.now;
      const periodsForMode = isActual
        ? stats.periodBestsByWeight
        : stats.periodBests;

      if (!bestSet) continue;

      // Collect roles by set identity. Period bests already exclude latest
      // session date upstream, so NOW can never share a setId with 1M/6M/1Y.
      // NOW can match BEST when the lifter's latest session set IS their
      // lifetime peak — that fires the "newBest" celebration variant.
      const setsById = {};
      const rolesById = {};
      const addRole = (role, set) => {
        if (!set) return;
        const id = setId(set);
        if (!rolesById[id]) {
          rolesById[id] = [];
          setsById[id] = set;
        }
        rolesById[id].push(role);
      };

      addRole("best", bestSet);
      for (const key of ["1Y", "6M", "1M"]) {
        addRole(key, periodsForMode?.[key]);
      }
      if (nowSet) {
        const isNewBest = setId(nowSet) === setId(bestSet);
        addRole(isNewBest ? "newBest" : "now", nowSet);
      }

      const detailFor = (s) =>
        `${s.reps} × ${formatLb(s.weightLb, isMetric)} on ${formatFullDate(s.date)}`;

      const valueStr = (set) =>
        isActual
          ? formatLb(set.weightLb, isMetric)
          : `~${formatLb(set.e1rm, isMetric)}`;

      const headlineFor = (primaryRole, set) => {
        switch (primaryRole) {
          case "best":
            return isActual
              ? `Lifetime heaviest bar load: ${valueStr(set)}`
              : `Lifetime best E1RM: ${valueStr(set)}`;
          case "now":
            return isActual
              ? `Most recent top set: ${valueStr(set)}`
              : `Most recent session E1RM: ${valueStr(set)}`;
          case "newBest":
            return isActual
              ? `🎉 New heaviest bar load: ${valueStr(set)}`
              : `🎉 New personal record: ${valueStr(set)}`;
          default:
            if (PERIOD_LABEL[primaryRole]) {
              const subject = isActual ? "heaviest bar load" : "best E1RM";
              return `${PERIOD_LABEL[primaryRole]} ${subject}: ${valueStr(set)}`;
            }
            return valueStr(set);
        }
      };

      // Drop redundant "best" label when "newBest" is already in the cluster
      // (avoids "🎉 New best! · Best" redundancy).
      const REDUNDANT_WITH_NEWBEST = { newBest: ["best"] };

      const positionFor = (set) => (isActual ? set.weightLb : set.e1rm);

      const notches = [];
      for (const id of Object.keys(rolesById)) {
        const roles = rolesById[id];
        const set = setsById[id];
        roles.sort((a, b) => ROLE_CONFIG[b].priority - ROLE_CONFIG[a].priority);
        const primaryRole = roles[0];
        const primary = ROLE_CONFIG[primaryRole];

        const dropList = REDUNDANT_WITH_NEWBEST[primaryRole] || [];
        const labelRoles = roles.filter((r) => !dropList.includes(r));
        const mergedLabel = labelRoles
          .map((r) => ROLE_CONFIG[r].label)
          .join(" · ");

        notches.push({
          key: `${milestone.key}-${id}`,
          valueLb: clampToMax(positionFor(set), milestone.maxLb),
          shortLabel: mergedLabel,
          headline: headlineFor(primaryRole, set),
          detail: detailFor(set),
          zIndex: primary.zIndex,
          isDominant: primary.isDominant,
          accent: primary.accent,
        });
      }

      if (notches.length > 0) result[milestone.key] = notches;
    }

    return Object.keys(result).length > 0 ? result : null;
  }, [liftStats, prWeightsLb, isMetric, achievementMode]);

  // Per-lift status sentence (one line, varied phrasing per branch).
  const statusSentences = useMemo(() => {
    if (!liftStats) return null;
    const result = {};
    for (const milestone of MILESTONES) {
      const stats = liftStats[milestone.key];
      if (!stats) continue;
      const sentence = buildStatusSentence({ milestone, stats, isMetric });
      if (sentence) result[milestone.key] = sentence;
    }
    return Object.keys(result).length > 0 ? result : null;
  }, [liftStats, isMetric]);

  const handleResetToPRs = useCallback(() => {
    if (!prWeightsLb) return;
    for (const m of MILESTONES) {
      const v = prWeightsLb[m.key];
      if (v != null) setters[m.key](v);
    }
  }, [prWeightsLb, setters]);

  const handleResetTo6m = useCallback(() => {
    if (!recent6mLb) return;
    for (const m of MILESTONES) {
      const v = recent6mLb[m.key];
      if (v != null) setters[m.key](v);
    }
  }, [recent6mLb, setters]);

  const handleResetToActual = useCallback(() => {
    if (!actualBestByLift) return;
    for (const m of MILESTONES) {
      const v = actualBestByLift[m.key];
      if (v != null) setters[m.key](v);
    }
  }, [actualBestByLift, setters]);

  const hasMovedFromPR =
    usingUserData &&
    prWeightsLb &&
    MILESTONES.some(
      (m) =>
        prWeightsLb[m.key] != null && values[m.key] !== prWeightsLb[m.key],
    );

  const hasMovedFrom6m =
    usingUserData &&
    recent6mLb &&
    MILESTONES.some(
      (m) =>
        recent6mLb[m.key] != null && values[m.key] !== recent6mLb[m.key],
    );

  const hasMovedFromActual =
    usingUserData &&
    actualBestByLift &&
    MILESTONES.some(
      (m) =>
        actualBestByLift[m.key] != null &&
        values[m.key] !== actualBestByLift[m.key],
    );

  const handleLiftValueChange = useCallback(
    (liftKey, setter) =>
      ([v]) => {
        const milestone = MILESTONES.find((item) => item.key === liftKey);
        const nextValue = milestone ? clampToMax(v, milestone.maxLb) : v;

        // Snap to known landmarks within 5 lb (in priority order).
        const candidates = [
          actualBestByLift?.[liftKey],
          prWeightsLb?.[liftKey],
          singleWeightsLb?.[liftKey],
          recent6mLb?.[liftKey],
        ];
        for (const target of candidates) {
          if (target != null && Math.abs(nextValue - target) <= 5) {
            setter(target);
            return;
          }
        }
        setter(nextValue);
      },
    [actualBestByLift, prWeightsLb, singleWeightsLb, recent6mLb],
  );

  const handleCopyResult = () => {
    const url = "https://www.strengthjourneys.xyz/plate-milestones";
    const lines = [
      classicClubAchieved
        ? "I've conquered the 1/2/3/4 Plate Club!"
        : `Plate milestones: ${totalTiersAchieved} of ${totalTiersPossible} tiers achieved!`,
      "",
      ...MILESTONES.map((m) => {
        const v = effectiveAchievementValue(m.key);
        const tierStr = m.tiers
          .map(
            (n) =>
              `${meetsPlateTarget(v, n, false) ? "\u2705" : "\u2b1c"}${n}`,
          )
          .join(" ");
        return `${m.liftType}: ${displayWeight(v, isMetric)} ${tierStr}`;
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
          {/* Achievement mode toggle (only when user has data to anchor it) */}
          {actualBestByLift && prWeightsLb && (
            <div className="mb-2 flex items-center justify-end gap-2 text-xs">
              <Label
                htmlFor="plate-milestone-mode"
                className={cn(
                  "cursor-pointer",
                  achievementMode === "actual"
                    ? "text-foreground font-medium"
                    : "text-muted-foreground",
                )}
              >
                Actual lifts
              </Label>
              <Switch
                id="plate-milestone-mode"
                checked={achievementMode === "e1rm"}
                onCheckedChange={(checked) =>
                  setAchievementMode(checked ? "e1rm" : "actual")
                }
                aria-label="Toggle between actual lifts and E1RM potential"
              />
              <Label
                htmlFor="plate-milestone-mode"
                className={cn(
                  "cursor-pointer",
                  achievementMode === "e1rm"
                    ? "text-foreground font-medium"
                    : "text-muted-foreground",
                )}
              >
                E1RM potential
              </Label>
            </div>
          )}

          {/* Four stacked rows — one per lift */}
          <div className="flex flex-col gap-2">
            {MILESTONES.map((milestone) => (
              <MilestoneRow
                key={milestone.key}
                milestone={milestone}
                value={values[milestone.key]}
                setter={setters[milestone.key]}
                onValueChange={handleLiftValueChange}
                isMetric={isMetric}
                notches={notchesByLift?.[milestone.key]}
                tierCrossings={liftStats?.[milestone.key]?.tierCrossings}
                statusSentence={statusSentences?.[milestone.key]}
                actualBestLb={actualBestByLift?.[milestone.key]}
                prE1rmLb={prWeightsLb?.[milestone.key]}
                achievementMode={achievementMode}
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
                : `${MILESTONES.filter((m) => meetsPlateTarget(effectiveAchievementValue(m.key), m.targetPlates, isMetric)).length} of 4 classic milestones achieved`}
            </span>
            {hasMovedFromActual && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-xs"
                onClick={handleResetToActual}
              >
                <RotateCcw className="h-3 w-3" />
                Reset to actual bests
              </Button>
            )}
            {hasMovedFromPR && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-xs"
                onClick={handleResetToPRs}
              >
                <RotateCcw className="h-3 w-3" />
                Reset to E1RM PRs
              </Button>
            )}
            {hasMovedFrom6m && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-xs"
                onClick={handleResetTo6m}
              >
                <RotateCcw className="h-3 w-3" />
                Reset to 6-month bests
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

      {/* Charts section: real sparklines when data exists, mockup + import CTA otherwise */}
      {liftTimelines ? (
        <PlateTimelinesSection
          liftTimelines={liftTimelines}
          isMetric={isMetric}
        />
      ) : (
        (authStatus === "unauthenticated" ||
          (authStatus === "authenticated" && !sheetInfo?.ssid)) && (
          <PlateImportCtaCard />
        )
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
                const liftsAtTier = usingUserData
                  ? MILESTONES.filter(
                      (m) => meetsPlateTarget(values[m.key], n, isMetric),
                    ).map((m) => SHORT_LIFT_NAMES[m.liftType])
                  : [];
                const liftsBelow = usingUserData
                  ? MILESTONES.filter(
                      (m) =>
                        m.tiers.includes(n) &&
                        !meetsPlateTarget(values[m.key], n, isMetric),
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
                                    const target = plateTotal(n, isMetric);
                                    const current = isMetric
                                      ? toKg(values[m.key])
                                      : values[m.key];
                                    const gap = `${target - current} ${isMetric ? "kg" : "lb"}`;
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
  isMetric,
  notches,
  tierCrossings,
  statusSentence,
  actualBestLb,
  prE1rmLb,
  achievementMode = "actual",
}) {
  const { key, liftType, targetPlates, tiers, maxLb } = milestone;

  // Achievement basis depends on user-selected mode. Guest/demo users (no
  // actualBestLb) fall back to slider value either way.
  const hasActualData = actualBestLb != null && actualBestLb > 0;
  const hasE1rmData = prE1rmLb != null && prE1rmLb > 0;
  const fallbackLb = hasActualData ? actualBestLb : value;
  const actualLb = hasActualData ? actualBestLb : fallbackLb;
  const e1rmLb = hasE1rmData ? prE1rmLb : fallbackLb;
  const primaryLb = achievementMode === "e1rm" ? e1rmLb : actualLb;
  const secondaryLb = achievementMode === "e1rm" ? actualLb : e1rmLb;

  const achieved = meetsPlateTarget(primaryLb, targetPlates, isMetric);
  const tiersAchieved = tiers.filter((n) =>
    meetsPlateTarget(primaryLb, n, isMetric),
  ).length;
  const tiersAchievedSecondary = tiers.filter((n) =>
    meetsPlateTarget(secondaryLb, n, isMetric),
  ).length;

  // Bracket hint: surfaces the OTHER measure's state when it disagrees with
  // the primary, so users see both honesty and optimism at a glance.
  // - Actual mode + E1RM ahead: "(E1RM crossed)" — your reps say you could.
  // - E1RM mode + actual lags: "(actual lags)" — but you haven't done it yet.
  let hintText = null;
  if (hasActualData && hasE1rmData) {
    if (achievementMode === "actual" && tiersAchievedSecondary > tiersAchieved) {
      hintText =
        tiers.length === 1
          ? "(E1RM crossed)"
          : `(E1RM at ${tiersAchievedSecondary}/${tiers.length})`;
    } else if (
      achievementMode === "e1rm" &&
      tiersAchievedSecondary < tiersAchieved
    ) {
      hintText =
        tiers.length === 1
          ? "(actual lags)"
          : `(actual at ${tiersAchievedSecondary}/${tiers.length})`;
    }
  }
  const showE1rmHint = hintText != null;
  const e1rmHintText = hintText;

  const hasCrossings =
    tierCrossings && Object.keys(tierCrossings).length > 0;
  // Show all tiers with a crossing record (including bonus tiers beyond the classic target)
  const displayTiers = hasCrossings
    ? ALL_TIERS.filter((n) => tierCrossings[n])
    : [];

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
                {tiersAchieved === tiers.length
                  ? "Done!"
                  : tiersAchieved > 0
                    ? `${tiersAchieved}/${tiers.length}`
                    : `${isMetric ? plateTotal(targetPlates, true) - toKg(primaryLb) : plateTotal(targetPlates, false) - primaryLb} ${isMetric ? "kg" : "lb"} to go`}
              </span>
              {showE1rmHint && (
                <span className="text-[10px] font-normal text-amber-600/80 italic">
                  {e1rmHintText}
                </span>
              )}
            </div>
          </div>

          {/* Slider with clustered notch labels (Single, 1M, 6M, 1Y, PR, Now) */}
          <NotchedMilestoneSlider
            value={value}
            max={maxLb}
            notches={notches}
            onValueChange={onValueChange(key, setter)}
            onValueCommit={() => {}}
          />
        </div>
      </div>

      {/* Personal milestone history: tier crossings + smart status sentence */}
      {(displayTiers.length > 0 || statusSentence) && (
        <div className="mt-2 space-y-1 border-t pt-2">
          {displayTiers.length > 0 && (
            <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
              {displayTiers.map((n) => {
                const info = tierCrossings[n];
                if (!info) return null;
                const firstStr = formatMonthYear(info.first.date);
                const lastStr = formatMonthYear(info.last.date);
                const sameMonth = firstStr === lastStr;
                const setSummary = `${info.first.reps} × ${formatLb(info.first.weightLb, isMetric)}`;
                return (
                  <span key={n} className="flex items-center gap-1">
                    <span
                      className={cn(
                        "inline-block h-1.5 w-1.5 rounded-full",
                        info.currentlyAbove ? "bg-green-500" : "bg-amber-500",
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
                    <span className="text-muted-foreground/70">
                      ({setSummary})
                    </span>
                  </span>
                );
              })}
            </div>
          )}
          {statusSentence && (
            <div className="text-foreground/80 text-xs">
              {statusSentence}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Sparkline tooltip ---
function SparklineTooltipContent({ active, payload, unit }) {
  if (!active || !payload?.[0]) return null;
  const { timestamp, displayE1rm } = payload[0].payload;
  const dateStr = new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return (
    <div className="bg-popover rounded-lg border px-2 py-1.5 text-xs shadow-md">
      <div className="font-medium">{dateStr}</div>
      <div>
        E1RM: {displayE1rm} {unit}
      </div>
    </div>
  );
}

// --- Per-lift E1RM sparkline with single plate target reference line ---
function MilestoneSparkline({ timeline, tiers, liftKey, isMetric }) {
  if (!timeline || timeline.length < 2) return null;

  // Only show the classic target tier (last/highest tier for this lift)
  const targetTier = tiers[tiers.length - 1];

  // Use the correct plate target for the unit system:
  // 4 plates metric = 180kg (bar 20 + 4x2x20), NOT toKg(405) = 184kg
  const targetDisplay = plateTotal(targetTier, isMetric);

  // Convert timeline to display units so the reference line aligns correctly
  const toDisplay = isMetric ? (lb) => Math.round(lb * KG_PER_LB) : (lb) => lb;
  const displayData = timeline.map((p) => ({
    ...p,
    displayE1rm: toDisplay(p.e1rm),
  }));
  const unit = isMetric ? "kg" : "lb";

  const maxVal = Math.max(...displayData.map((p) => p.displayE1rm));
  const minVal = Math.min(...displayData.map((p) => p.displayE1rm));
  const step = isMetric ? 10 : 25;

  const yMax = Math.ceil(Math.max(maxVal + 5, targetDisplay + 10) / step) * step;
  const yMin =
    Math.floor(
      Math.max(0, Math.min(minVal - 5, targetDisplay - 10)) / step,
    ) * step;

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

  const targetLabel = `${plateLabel(targetTier)} (${targetDisplay} ${unit})`;

  return (
    <div className="h-[110px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={displayData}
          margin={{ top: 4, right: 8, bottom: 0, left: 8 }}
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
          <YAxis domain={[yMin, yMax]} hide />
          <ReferenceLine
            y={targetDisplay}
            stroke="#10B981"
            strokeDasharray="4 3"
            strokeWidth={1.5}
            label={{
              value: targetLabel,
              position: "insideTopRight",
              offset: -4,
              dy: -2,
              fill: "#10B981",
              fontSize: 10,
              fontWeight: 600,
            }}
          />
          <RechartsTooltip
            content={<SparklineTooltipContent unit={unit} />}
          />
          <Area
            type="monotone"
            dataKey="displayE1rm"
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

// --- Charts section: shows real sparklines when data exists ---
function PlateTimelinesSection({ liftTimelines, isMetric }) {
  return (
    <Card className="mt-6">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <LineChart className="h-5 w-5" />
          Your E1RM over time
        </CardTitle>
        <CardDescription>
          Rolling 90-day best estimated 1RM for each lift. The dashed line
          marks the classic plate target.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {MILESTONES.map((milestone) => {
            const timeline = liftTimelines[milestone.key];
            if (!timeline || timeline.length < 2) return null;
            return (
              <div
                key={milestone.key}
                className="flex items-stretch gap-3 rounded-lg border p-2"
              >
                <Link
                  href={getLiftDetailUrl(milestone.liftType)}
                  className="flex flex-shrink-0 items-center"
                >
                  <img
                    src={LIFT_GRAPHICS[milestone.liftType]}
                    alt={`${milestone.liftType} illustration`}
                    className="h-24 w-24 object-contain md:h-28 md:w-28"
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    href={getLiftDetailUrl(milestone.liftType)}
                    className="text-sm font-semibold underline decoration-dotted underline-offset-2 hover:text-blue-600"
                  >
                    {milestone.liftType}
                  </Link>
                  <MilestoneSparkline
                    timeline={timeline}
                    tiers={milestone.tiers}
                    liftKey={milestone.key}
                    isMetric={isMetric}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// --- Import CTA with mockup chart for non-auth visitors ---
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
            <LineChart className="h-5 w-5" />
            Chase the plates
          </CardTitle>
          <CardDescription>
            Import your lifting history to track your journey toward each
            plate milestone. See when you first loaded two wheels, three
            plates, or joined the four-plate club.
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

          {/* Mockup sparkline charts */}
          <div className="from-muted/20 via-background to-muted/30 flex flex-col justify-center gap-3 rounded-xl border bg-gradient-to-br p-4 opacity-55 saturate-[0.85] sm:p-6">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Press", target: 135, path: "M0,58 C15,54 30,50 50,46 C65,50 80,54 100,48 C115,44 130,48 150,42 C170,38 190,42 210,36 C225,34 235,36 240,34" },
                { label: "Bench", target: 225, path: "M0,56 C15,50 35,44 55,40 C70,44 85,48 100,42 C120,36 135,32 155,28 C170,34 190,30 210,24 C225,20 235,18 240,16" },
                { label: "Squat", target: 315, path: "M0,62 C15,56 35,52 50,44 C65,40 80,44 100,38 C115,34 135,30 155,26 C170,30 185,24 205,20 C220,16 232,18 240,14" },
                { label: "Deadlift", target: 405, path: "M0,52 C15,46 35,40 50,34 C65,30 80,36 100,30 C115,26 135,22 150,18 C170,22 185,18 205,14 C220,12 232,14 240,10" },
              ].map(({ label, path }) => (
                <div key={label} className="space-y-0.5">
                  <span className="text-muted-foreground text-[10px] font-medium">
                    {label}
                  </span>
                  <svg
                    viewBox="0 0 240 70"
                    className="h-[50px] w-full"
                    preserveAspectRatio="none"
                    aria-hidden
                  >
                    <line
                      x1="0" y1="30" x2="240" y2="30"
                      stroke="#10B981"
                      strokeWidth="1.5"
                      strokeDasharray="4 3"
                      opacity="0.6"
                    />
                    <path
                      d={path}
                      fill="none"
                      stroke="#6366F1"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              ))}
            </div>
            <p className="text-muted-foreground text-center text-xs">
              See exactly when you earned each plate milestone.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
