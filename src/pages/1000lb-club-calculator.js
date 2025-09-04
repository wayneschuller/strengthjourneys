"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useSession, signIn } from "next-auth/react";
import { devLog } from "@/lib/processing-utils";
import { NextSeo } from "next-seo";
import { RelatedArticles } from "@/components/article-cards";
import { cn } from "@/lib/utils";
import { UnitChooser } from "@/components/unit-type-chooser";
import { SignInInvite } from "@/components/instructions-cards";
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
  PageHeader,
  PageHeaderHeading,
  PageHeaderDescription,
  PageHeaderRight,
} from "@/components/page-header";

import { Slider } from "@/components/ui/slider";
import { Anvil } from "lucide-react";

import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

import { fetchRelatedArticles } from "@/lib/sanity-io.js";

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

// Strength Level Calculator
function ThousandPoundClubCalculatorMain({ relatedArticles }) {
  const { status: authStatus } = useSession();
  const [isYearly, setIsYearly] = useState(false);

  const [squat, setSquat] = useLocalStorage("SJ_thousand_squat", 0, {
    initializeWithValue: false,
  });
  const [bench, setBench] = useLocalStorage("SJ_thousand_bench", 0, {
    initializeWithValue: false,
  });
  const [deadlift, setDeadlift] = useLocalStorage("SJ_thousand_deadlift", 0, {
    initializeWithValue: false,
  });

  const total = squat + bench + deadlift;
  const inClub = total >= 1000;

  // devLog(standards[`Back Squat`].beginner);

  const bigFourURLs = {
    "Back Squat": "/barbell-squat-insights",
    "Bench Press": "/barbell-bench-press-insights",
    Deadlift: "/barbell-deadlift-insights",
    "Strict Press": "/barbell-strict-press-insights",
  };

  const toKg = (lbs) => (lbs * 0.453592).toFixed(1); // Converts lbs to kg

  return (
    <div className="container">
      <PageHeader>
        <PageHeaderHeading icon={Anvil}>
          1000lb Club Calculator
        </PageHeaderHeading>
        <PageHeaderDescription>
          How strong am I? Am I in the 1000lb Club? Use our 1000lb Club
          calculator to test if you have joined the hallowed order of strength.{" "}
          <SignInInvite />
        </PageHeaderDescription>
        <PageHeaderRight>
          <div className="hidden gap-2 text-muted-foreground md:flex md:flex-col xl:flex-row">
            <Link
              href="/strength-level-calculator"
              className="block rounded-lg border p-4 shadow-sm transition-shadow hover:bg-gray-100 hover:shadow-md dark:hover:bg-gray-800"
            >
              <h3 className="text-base font-semibold">
                Strength Level Calculator
              </h3>
              <p className="text-sm">How strong are you?</p>
            </Link>
            <Link
              href="/calculator"
              className="block rounded-lg border p-4 shadow-sm transition-shadow hover:bg-gray-100 hover:shadow-md dark:hover:bg-gray-800"
            >
              <h3 className="text-base font-semibold">E1RM Calculator</h3>
              <p className="text-sm">Estimate your one rep max.</p>
            </Link>
          </div>
        </PageHeaderRight>
      </PageHeader>
      <Card className="pt-4">
        <CardContent className="">
          <div className="space-y-6">
            {/* Squat Slider */}
            <div>
              <label className="text-lg font-semibold">
                Back Squat: {squat} lbs ({toKg(squat)}kg)
              </label>
              <Slider
                value={[squat]}
                min={0}
                max={700}
                step={5}
                onValueChange={([value]) => setSquat(value)}
                className="mt-2"
              />
            </div>

            {/* Bench Slider */}
            <div>
              <label className="text-lg font-semibold">
                Bench Press: {bench} lbs ({toKg(bench)}kg)
              </label>
              <Slider
                value={[bench]}
                min={0}
                max={700}
                step={5}
                onValueChange={([value]) => setBench(value)}
                className="mt-2"
              />
            </div>

            {/* Deadlift Slider */}
            <div>
              <label className="text-lg font-semibold">
                Deadlift: {deadlift} lbs ({toKg(deadlift)}kg)
              </label>
              <Slider
                value={[deadlift]}
                min={0}
                max={700}
                step={5}
                onValueChange={([value]) => setDeadlift(value)}
                className="mt-2"
              />
            </div>

            {/* Total Display */}
            <div className="mt-4 text-3xl font-bold">Total: {total} lbs</div>

            {/* 1000lb Club Indicator */}
            <div
              className={cn("text-xl font-semibold", {
                "text-green-600": inClub,
                "text-gray-500": !inClub,
              })}
            >
              {inClub
                ? "Congratulations! You're in the 1000lb Club!"
                : "Keep lifting to reach 1000 lbs!"}
            </div>
            <ThousandDonut total={total} />
          </div>
        </CardContent>
        <CardFooter className="text-sm">
          <div className="flex flex-col">
            <p className="">
              To see your strength level ratings per lift, see our{" "}
              <Link
                href="/strength-level-calculator"
                className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
              >
                Strength Level Calculator
              </Link>
              .
            </p>
          </div>
        </CardFooter>
      </Card>
      <RelatedArticles articles={relatedArticles} />
    </div>
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

  return (
    <div className="mx-auto my-6 w-full max-w-md">
      <div className="mb-2 text-center">
        <div className="text-2xl font-semibold">{total} lbs</div>
        <div className="text-xs text-muted-foreground">of {target} lbs</div>
      </div>

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

      {/* simple percent readout */}
      <div className="text-center text-sm text-muted-foreground">
        {Math.min(100, Math.round((total / target) * 100))}% to goal
      </div>
    </div>
  );
}
