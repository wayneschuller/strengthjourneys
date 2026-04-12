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
  Disc,
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

const plateLabel = (n) => `${n} plate${n === 1 ? "" : "s"}`;

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
  const { topLiftsByTypeAndReps, parsedData, isDemoMode } =
    useUserLiftingData();
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
}) {
  const { key, liftType, targetPlates, tiers, maxLb } = milestone;
  const targetWeightLb = plateTotal(targetPlates, false);
  const percent = Math.min(100, Math.round((value / targetWeightLb) * 100));
  const achieved = value >= targetWeightLb;

  const breakdown = getPlateBreakdown(value);

  // Count how many tiers this lift has achieved
  const tiersAchieved = tiers.filter(
    (n) => value >= plateTotal(n, false),
  ).length;

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2 transition-colors",
        achieved && "border-green-500/40 bg-green-500/5",
      )}
    >
      {/* Row layout: lift SVG + plate icons (fixed width) | slider + info */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {/* Left: lift SVG + plate icons in a fixed-width container */}
        <div className="flex flex-shrink-0 items-center gap-2 sm:w-[220px]">
          <Link
            href={getLiftDetailUrl(liftType)}
            className="flex flex-shrink-0"
          >
            <img
              src={LIFT_GRAPHICS[liftType]}
              alt={`${liftType} illustration`}
              className="h-14 w-14 object-contain"
            />
          </Link>

          {/* Blue plate images — fill left-to-right like a thermometer */}
          <div className="flex items-center gap-0.5">
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
                className="h-9 w-9 sm:h-10 sm:w-10"
                style={{
                  opacity,
                  transition: "opacity 300ms ease",
                }}
              />
            );
          })}
          </div>
        </div>

        {/* Right: info + slider */}
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
                {value} lbs ({toKg(value)} kg)
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
                  : `${targetWeightLb - value} lb to go`}
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
    </div>
  );
}
