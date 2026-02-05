/** @format */

"use client";

import Link from "next/link";
import { NextSeo } from "next-seo";
import { devLog } from "@/lib/processing-utils";
import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useLocalStorage } from "usehooks-ts";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { estimateE1RM } from "@/lib/estimate-e1rm";

import {
  Calculator,
  Timer,
  LineChart,
  Trophy,
  Newspaper,
  BicepsFlexed,
  Music,
  LibraryBig,
  Bot,
  Anvil,
  ChartColumnDecreasing,
  Bus,
  Crown,
  Shield,
  Skull,
  Luggage,
  Flame,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GettingStartedCard } from "@/components/instructions-cards";
import { Testimonials } from "@/components/testimonials";
import { bigFourLiftInsightData } from "@/lib/big-four-insight-data";
import { Separator } from "@/components/ui/separator";
import { HeroSection } from "@/components/hero-section";
import { HomeDashboard } from "@/components/home-dashboard";

// The feature pages are the main tools, with one card each on the landing page
export const featurePages = [
  {
    href: "/analyzer",
    title: "PR Analyzer",
    description:
      "See lifetime and recent personal records. Consistency pie charts and heatmaps.",
    IconComponent: Trophy,
  },
  {
    href: "/visualizer",
    title: "Strength Visualizer",
    description:
      "Interactive lifetime charts of all lifts. See your strength journey.",
    IconComponent: LineChart,
  },
  {
    href: "/barbell-strength-potential",
    title: "Barbell Strength Potential",
    description:
      "Top lifts by rep range with bar charts that reveal untapped strength potential.",
    IconComponent: ChartColumnDecreasing,
  },
  {
    href: "/ai-lifting-assistant",
    title: "AI Lifting Assistant",
    description:
      "A strength expert chatbot. Talk to your lifting data. A coach who loves you.",
    IconComponent: Bot,
  },
  {
    href: "/calculator",
    title: "One Rep Max Calculator",
    description: "The greatest e1rm multi-formula one rep max calculations.",
    IconComponent: Calculator,
  },
  {
    href: "/warm-up-sets-calculator",
    title: "Warm Ups Calculator",
    description:
      "Generate warmup sets for your barbell workouts using progressive warmup methodology.",
    IconComponent: Flame,
  },
  {
    href: "/strength-level-calculator",
    title: "Strength Level Calculator",
    description:
      "How strong are you? Assess your relative strength by age, gender and lift type.",
    IconComponent: BicepsFlexed,
  },
  {
    href: "/1000lb-club-calculator",
    title: "1000lb Club Calculator",
    description:
      "Are you in the 1000lb club? Track your progress to this milestone.",
    IconComponent: Anvil,
  },
  {
    href: "/tonnage",
    title: "Tonnage Metrics",
    description:
      "Ever wondered how many buses you've lifted? Your lifting volume, visualized.",
    IconComponent: Bus,
  },
  {
    href: "/timer",
    title: "Lifting Set Timer",
    description: "A set timer for phones or large gym screens.",
    IconComponent: Timer,
  },
  {
    href: "/gym-playlist-leaderboard",
    title: "Gym Music Leaderboard",
    description: "Discover and share new motivational music playlists.",
    IconComponent: Music,
  },
  {
    href: "/articles",
    title: "Strength Articles Library",
    description:
      "A collection of our articles, common questions, plus curated lifting content.",
    IconComponent: LibraryBig,
  },
];

// The main barbell lifts are the main lifts that have dedicated pages
// Defined again here for static generation SEO benefits
// One day we might add power clean and power snatch.
const mainBarbellLifts = [
  {
    slug: "barbell-squat-insights",
    liftType: "Back Squat",
    liftDescription:
      "A barbell squat to full depth, resting across the upper back.",
    IconComponent: Crown,
  },
  {
    slug: "barbell-bench-press-insights",
    liftType: "Bench Press",
    liftDescription:
      "A horizontal press from the chest while lying on a bench.",
    IconComponent: Shield,
  },
  {
    slug: "barbell-deadlift-insights",
    liftType: "Deadlift",
    liftDescription: "Lifting a barbell from the floor to a standing lockout.",
    IconComponent: Skull,
  },
  {
    slug: "barbell-strict-press-insights",
    liftType: "Strict Press",
    liftDescription: "A standing overhead press with no leg drive.",
    IconComponent: Luggage,
  },
];

// {
//   href: "/articles/why-it-s-good-to-be-a-barbell-weirdo",
//   title: `Feature Article: Why It's Good To Be A Barbell Weirdo`,
//   description: "Embrace your inner weirdo.",
//   IconComponent: Newspaper,
// },
// {
//   href: "/articles/the-iron-and-the-soul-author-henry-rollins",
//   title: "Feature Article: The Iron and the Soul",
//   description: "The classic inspirational lifting essay by Henry Rollins.",
//   IconComponent: Newspaper,
// },

export default function Home() {
  const title = "Strength Journeys | Free Barbell Lifting Analysis Tools";
  const canonicalURL = "https://www.strengthjourneys.xyz/";
  const description =
    "Track and analyze your barbell lifting with Strength Journeys. Free PR analyzer, 1RM calculator, and more. Integrates with Google Sheets. Open source.";
  const keywords =
    "strength training, barbell lifting, powerlifting, PR analyzer, strength visualizer, one rep max calculator, strength level calculator, lifting timer, gym playlist, strength articles, workout tracking, Google Sheets integration, free tools, open source, strength progress, personal records, e1rm, relative strength, workout music, lifting motivation";
  const ogImageURL = "https://www.strengthjourneys.xyz/202409-og-image.png";
  const { data: session, status: authStatus } = useSession();
  const [showHeroSection, setShowHeroSection] = useState(true); // Ensure static generation of Hero Section
  const [isFadingHero, setIsFadingHero] = useState(false);

  // When user is authenticated, stop showing the Hero section
  useEffect(() => {
    if (authStatus === "authenticated" && showHeroSection && !isFadingHero) {
      setIsFadingHero(true); // start fade-out
      setTimeout(() => setShowHeroSection(false), 800); // <-- match duration below
    }
  }, [authStatus, showHeroSection, isFadingHero]);

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
              alt: "Strength Journeys PR Analyzer",
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
      <main className="mx-4 mb-4 md:mx-[5vw]">
        {/* Fixed height hero section that turns into our onboarding section and then home dashboard */}
        <div className="duration-800 flex items-center justify-center transition-all md:relative md:h-[500px]">
          {showHeroSection ? (
            <div
              className={`duration-800 inset-0 h-full w-full transition-all md:absolute ${isFadingHero ? "pointer-events-none -translate-y-6 scale-95 opacity-0" : "translate-y-0 scale-100 opacity-100"} `}
            >
              <HeroSection />
            </div>
          ) : (
            <div
              className={`duration-800 inset-0 h-full w-full transition-opacity md:absolute ${showHeroSection ? "opacity-0" : "opacity-100"} `}
            >
              <HomeDashboard />
            </div>
          )}
        </div>

        <h2 class="mb-4 mt-8 text-xl font-semibold">
          🏋️ The Big Four Barbell Lifts
        </h2>

        <BigFourLiftCards />
        <Separator className="my-8" />

        <h2 class="mt-8 text-xl font-semibold">🛠️ Strength Insights & Tools</h2>
        <div className="mb-16 mt-4 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {featurePages.map((card, index) => (
            <FeatureCard key={index} {...card} />
          ))}
        </div>

        <Testimonials />

        <div className="mx-4 mt-10 md:mx-10">
          <GettingStartedCard />
        </div>
      </main>
    </>
  );
}

function FeatureCard({ href, title, description, IconComponent }) {
  const isWarmupsCalculator = href === "/warm-up-sets-calculator";

  return (
    <Card className="group relative shadow-lg ring-0 ring-ring hover:ring-1">
      {isWarmupsCalculator && (
        <Badge
          variant="outline"
          className="absolute right-2 top-2 bg-primary/10 text-xs text-primary"
        >
          New
        </Badge>
      )}
      <Link href={href}>
        <CardHeader className="min-h-28">
          <CardTitle className="">{title}</CardTitle>
          <CardDescription className="h-[2rem]">{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center transition-transform group-hover:scale-110">
          <IconComponent size={64} strokeWidth={1.25} />
        </CardContent>
      </Link>
    </Card>
  );
}

function BigFourLiftCards() {
  const lifts = mainBarbellLifts;
  const { topLiftsByTypeAndReps, liftTypes } = useUserLiftingData() || {};
  const [e1rmFormula] = useLocalStorage(LOCAL_STORAGE_KEYS.FORMULA, "Brzycki", {
    initializeWithValue: false,
  });
  const { status: authStatus } = useSession();
  const [statsVisible, setStatsVisible] = useState(false);

  const bigFourDiagrams = {
    "Back Squat": "/back_squat.svg",
    "Bench Press": "/bench_press.svg",
    Deadlift: "/deadlift.svg",
    "Strict Press": "/strict_press.svg",
  };

  const formatLiftDate = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getStatsForLift = (liftType) => {
    if (!topLiftsByTypeAndReps || !topLiftsByTypeAndReps[liftType]) return null;

    const repRanges = topLiftsByTypeAndReps[liftType];
    let bestE1RMWeight = 0;
    let bestLift = null;
    let unitType = "lb";

    // Mirror the barbell-strength-potential "best lift" logic:
    // scan rep ranges 1–10 and pick the set with highest estimated 1RM
    for (let repsIndex = 0; repsIndex < 10; repsIndex++) {
      const topAtReps = repRanges[repsIndex]?.[0];
      if (!topAtReps) continue;

      const reps = repsIndex + 1;
      const currentE1RM = estimateE1RM(reps, topAtReps.weight, e1rmFormula);

      if (currentE1RM > bestE1RMWeight) {
        bestE1RMWeight = currentE1RM;
        bestLift = topAtReps;
      }

      if (topAtReps.unitType) {
        unitType = topAtReps.unitType;
      }
    }

    const liftTotals = liftTypes?.find((lift) => lift.liftType === liftType);

    return {
      bestLift,
      unitType,
      totalSets: liftTotals?.totalSets ?? 0,
      totalReps: liftTotals?.totalReps ?? 0,
    };
  };

  // Let stats gently fade in after the hero/home slider transition.
  // Hard-coded delay to line up with the 800ms hero animation.
  useEffect(() => {
    if (authStatus === "authenticated" && topLiftsByTypeAndReps) {
      const timeoutId = setTimeout(() => {
        setStatsVisible(true);
      }, 1400);
      return () => clearTimeout(timeoutId);
    }
    setStatsVisible(false);
  }, [authStatus, topLiftsByTypeAndReps]);

  return (
    <div className="grid grid-cols-2 gap-6 md:grid-cols-2 lg:grid-cols-4">
      {lifts.map((lift) => {
        const stats = getStatsForLift(lift.liftType);
        const hasAnyData =
          stats && (stats.totalSets > 0 || stats.totalReps > 0 || stats.bestLift);
        const isStatsMode = authStatus === "authenticated" && hasAnyData;

        return (
          <Card
            key={lift.slug}
            className="group shadow-lg ring-0 ring-ring hover:ring-1"
          >
            <Link href={`/${lift.slug}`}>
              <CardHeader className="min-h-28">
                <CardTitle>{lift.liftType}</CardTitle>
                <div className="relative min-h-8">
                  {/* Base description (for guests / non-stats mode). Hidden visually when stats overlay is active. */}
                  <CardDescription
                    className={
                      isStatsMode
                        ? "h-8 opacity-0 transition-opacity duration-300"
                        : "h-8"
                    }
                  >
                    {lift.liftDescription}
                  </CardDescription>

                  {/* Stats overlay that fades in on top for authenticated users with data */}
                  {isStatsMode && stats && (
                    <div
                      className={`pointer-events-none absolute inset-0 flex flex-col justify-center text-sm text-muted-foreground transition-opacity duration-500 ${
                        statsVisible ? "opacity-100" : "opacity-0"
                      }`}
                    >
                      {(stats.totalSets > 0 || stats.totalReps > 0) && (
                        <span>
                          {stats.totalSets.toLocaleString()} sets ·{" "}
                          {stats.totalReps.toLocaleString()} reps logged
                        </span>
                      )}
                      {stats.bestLift && (
                        <span className="block">
                          Best set: {stats.bestLift.reps}@{stats.bestLift.weight}
                          {stats.bestLift.unitType || stats.unitType}
                          {stats.bestLift.date && (
                            <> on {formatLiftDate(stats.bestLift.date)}</>
                          )}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex justify-center p-2">
                <img
                  src={bigFourDiagrams[lift.liftType]}
                  alt={`${lift.liftType} diagram`}
                  className="h-36 w-36 object-contain transition-transform group-hover:scale-110"
                />
              </CardContent>
            </Link>
          </Card>
        );
      })}
    </div>
  );
}
