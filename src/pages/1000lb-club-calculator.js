"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { NextSeo } from "next-seo";
import { RelatedArticles } from "@/components/article-cards";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { cn } from "@/lib/utils";
import { GettingStartedCard } from "@/components/instructions-cards";
import { useLocalStorage } from "usehooks-ts";
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
import { Anvil, Trophy, LineChart, Calculator, BicepsFlexed, Bot, Share2 } from "lucide-react";

import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

import { fetchRelatedArticles } from "@/lib/sanity-io.js";

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

const WHATS_NEXT_FEATURES = [
  { href: "/strength-level-calculator", title: "Strength Level Calculator", description: "How do you compare? Get beginner to elite ratings per lift by age and bodyweight.", IconComponent: BicepsFlexed },
  { href: "/calculator", title: "E1RM Calculator", description: "Estimate your true 1RM from any set. Set better targets for your next block.", IconComponent: Calculator },
  { href: "/analyzer", title: "PR Analyzer", description: "Track your PRs, consistency, and heatmaps. See progress over time.", IconComponent: Trophy },
  { href: "/visualizer", title: "Strength Visualizer", description: "Charts of every lift over time. Watch your strength journey unfold.", IconComponent: LineChart },
  { href: "/ai-lifting-assistant", title: "AI Lifting Assistant", description: "Ask questions, get program ideas, and advice from your lifting data.", IconComponent: Bot },
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

  return (
    <>
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

function ThousandPoundClubCalculatorMain({ relatedArticles }) {
  const [squat, setSquat] = useLocalStorage(LOCAL_STORAGE_KEYS.THOUSAND_SQUAT, 0, {
    initializeWithValue: false,
  });
  const [bench, setBench] = useLocalStorage(LOCAL_STORAGE_KEYS.THOUSAND_BENCH, 0, {
    initializeWithValue: false,
  });
  const [deadlift, setDeadlift] = useLocalStorage(LOCAL_STORAGE_KEYS.THOUSAND_DEADLIFT, 0, {
    initializeWithValue: false,
  });
  const prevTotalRef = useRef(null);
  const hasCelebratedRef = useRef(false);

  const total = squat + bench + deadlift;
  const inClub = total >= 1000;

  const toKgF = (n) => (Number(n) * KG_PER_LB).toFixed(1);
  const awayLbs = Math.max(0, 1000 - total);
  const pastLbs = Math.max(0, total - 1000);

  // Celebration when crossing 1000 (client-only, one-time per direction)
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
      import("canvas-confetti").then((confetti) => {
        confetti.default({ particleCount: 80, spread: 60, origin: { y: 0.7 } });
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
    navigator.clipboard?.writeText(lines.join("\n")).catch(() => {});
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
          <div className="hidden gap-2 text-muted-foreground md:flex md:flex-col xl:flex-row">
            <Link
              href="/strength-level-calculator"
              className="block rounded-lg border p-4 shadow-sm transition-shadow hover:bg-muted hover:shadow-md"
            >
              <h3 className="text-base font-semibold">
                Strength Level Calculator
              </h3>
              <p className="text-sm">How strong am I?</p>
            </Link>
            <Link
              href="/calculator"
              className="block rounded-lg border p-4 shadow-sm transition-shadow hover:bg-muted hover:shadow-md"
            >
              <h3 className="text-base font-semibold">E1RM Calculator</h3>
              <p className="text-sm">Set targets. Estimate 1RM from any set.</p>
            </Link>
          </div>
        </PageHeaderRight>
      </PageHeader>

      <Card className="pt-4">
        <CardContent className="pt-4">
          <div className="space-y-6">
            {[
              { key: "squat", liftType: "Back Squat", value: squat, set: setSquat },
              { key: "bench", liftType: "Bench Press", value: bench, set: setBench },
              { key: "deadlift", liftType: "Deadlift", value: deadlift, set: setDeadlift },
            ].map(({ key, liftType, value, set }) => (
              <div key={key} className="flex items-center gap-4">
                <Link href={BIG_FOUR_URLS[liftType]} className="flex-shrink-0" aria-hidden>
                  <img
                    src={LIFT_GRAPHICS[liftType]}
                    alt=""
                    className="h-20 w-20 object-contain sm:h-24 sm:w-24"
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <label className="text-lg font-semibold">
                    {liftType}: {value} lbs ({toKgF(value)} kg)
                  </label>
                  <Slider
                    value={[value]}
                    min={0}
                    max={700}
                    step={5}
                    onValueChange={([v]) => set(v)}
                    className="mt-2"
                  />
                </div>
              </div>
            ))}

            <div className="mt-4 text-3xl font-bold tabular-nums">
              Total: {total} lbs ({toKgF(total)} kg)
            </div>

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
            <ThousandDonut total={total} />
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={handleCopyResult} className="gap-2">
                <Share2 className="h-4 w-4" />
                Copy my result
              </Button>
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
            <Link href={BIG_FOUR_URLS["Back Squat"]} className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800">Squat</Link>
            {" · "}
            <Link href={BIG_FOUR_URLS["Bench Press"]} className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800">Bench</Link>
            {" · "}
            <Link href={BIG_FOUR_URLS.Deadlift} className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800">Deadlift</Link>
            {" · "}
            <Link href={BIG_FOUR_URLS["Strict Press"]} className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800">Strict Press</Link>
          </p>
        </CardFooter>
      </Card>

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-semibold">You know your total. What&apos;s next?</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {WHATS_NEXT_FEATURES.map(({ href, title, description, IconComponent }) => (
            <Link
              key={href}
              href={href}
              className="block rounded-lg border p-4 shadow-sm transition-shadow hover:bg-muted hover:shadow-md"
            >
              <div className="mb-2 flex items-center gap-2">
                <IconComponent className="h-5 w-5" />
                <h3 className="font-semibold">{title}</h3>
              </div>
              <p className="text-sm text-muted-foreground">{description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <GettingStartedCard />
      </section>

      <section className="mt-10">
        <p className="mb-4 text-sm text-muted-foreground">
          Learn more: what the 1000lb club is, why it matters, and how to get there—see our articles below.
        </p>
        <RelatedArticles articles={relatedArticles} />
      </section>
    </PageContainer>
  );
}

function ThousandDonut({ total, target = 1000 }) {
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
    <div className="relative mx-auto my-6 w-full max-w-md">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius={70}
            outerRadius={100}
            startAngle={90}
            endAngle={-270}
            stroke="none"
            isAnimationActive
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="text-center tabular-nums">
          {inClub ? (
            <>
              <div className="text-3xl font-bold text-green-500">
                {total} lbs
              </div>
              <div className="text-sm text-green-500/90">({totalKg} kg)</div>
              <div className="text-sm font-semibold text-green-400">
                1000lb Club!
              </div>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold">{total} lbs</div>
              <div className="text-xs text-muted-foreground">({totalKg} kg) of {target}</div>
              <div className="text-sm text-muted-foreground">{percent}%</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
