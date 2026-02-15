/** @format */

"use client";

import Link from "next/link";
import { NextSeo } from "next-seo";
import { devLog } from "@/lib/processing-utils";
import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useEffect } from "react";

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
  Sparkles,
} from "lucide-react";

import { motion } from "motion/react";
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
import { HomeDashboard } from "@/components/home-dashboard/home-dashboard";
import { BigFourLiftCards } from "@/components/big-four-lift-cards";
import { StrengthUnwrappedDecemberBanner } from "@/components/year-recap/strength-unwrapped-banner";

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
      "Your E1RMs across every rep range over time. See your strength journey.",
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
  {
    href: "/strength-year-in-review",
    title: "Strength Unwrapped - Yearly Recap",
    description:
      "Your year of strength training in a Spotify Wrapped-style recap. Sessions, tonnage, PRs, and more.",
    IconComponent: Sparkles,
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
  const title = "Free Barbell Lifting Analysis Tools | Strength Journeys";
  const canonicalURL = "https://www.strengthjourneys.xyz/";
  const description =
    "Track and analyze your barbell lifting with Strength Journeys. Free PR analyzer, 1RM calculator, and more. Integrates with Google Sheets. Open source.";
  const keywords =
    "strength training, barbell lifting, powerlifting, PR analyzer, strength visualizer, one rep max calculator, strength level calculator, lifting timer, gym playlist, strength articles, workout tracking, Google Sheets integration, free tools, open source, strength progress, personal records, e1rm, relative strength, workout music, lifting motivation";
  const ogImageURL = "https://www.strengthjourneys.xyz/202409-og-image.png";
  const { data: session, status: authStatus } = useSession();
  const [showHeroSection, setShowHeroSection] = useState(true); // Ensure static generation of Hero Section
  const [isFadingHero, setIsFadingHero] = useState(false);
  const [bigFourAnimated, setBigFourAnimated] = useState(false);

  // When user is authenticated, stop showing the Hero section
  useEffect(() => {
    if (authStatus === "authenticated" && showHeroSection && !isFadingHero) {
      setIsFadingHero(true); // start fade-out
      setTimeout(() => setShowHeroSection(false), 800); // <-- match duration below
    }
  }, [authStatus, showHeroSection, isFadingHero]);

  // Delay the Big Four lift cards entrance until after the home dashboard intro
  // (hero fade + row processing ~1.2s + top stat cards ~2.2s). For guests, show them immediately.
  useEffect(() => {
    if (authStatus === "authenticated") {
      const totalIntroMs = 4000; // Row processing + section cards left-to-right stagger
      const timeoutId = setTimeout(() => {
        setBigFourAnimated(true);
      }, totalIntroMs);
      return () => clearTimeout(timeoutId);
    }

    if (authStatus === "unauthenticated") {
      setBigFourAnimated(true);
    }
  }, [authStatus]);

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
        <div className="flex flex-col items-center justify-center transition-all duration-800">
          {showHeroSection ? (
            <div
              className={`inset-0 h-full w-full transition-all duration-800 ${isFadingHero ? "pointer-events-none -translate-y-6 scale-95 opacity-0" : "translate-y-0 scale-100 opacity-100"} `}
            >
              <HeroSection />
            </div>
          ) : (
            <div
              className={`inset-0 h-full w-full transition-opacity duration-800 ${showHeroSection ? "opacity-0" : "opacity-100"} `}
            >
              <HomeDashboard />
            </div>
          )}
        </div>

        <StrengthUnwrappedDecemberBanner className="mt-8 mb-6" />

        <h2 className="mt-8 mb-4 text-xl font-semibold">
          🏋️ The Big Four Barbell Lifts
        </h2>

        <BigFourLiftCards lifts={mainBarbellLifts} animated={bigFourAnimated} />
        <Separator className="my-8" />

        <h2 className="mt-8 text-xl font-semibold">🛠️ Strength Insights & Tools</h2>
        <div className="mt-4 mb-16 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {featurePages.map((card, index) => (
            <FeatureCard key={index} index={index} {...card} />
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

function FeatureCard({ href, title, description, IconComponent, index = 0 }) {
  const isWarmupsCalculator = href === "/warm-up-sets-calculator";
  const chartColorVar = `--chart-${(index % 5) + 1}`;

  return (
    <Card className="group ring-ring relative shadow-lg ring-0 hover:ring-1">
      {isWarmupsCalculator && (
        <Badge
          variant="outline"
          className="bg-primary/10 text-primary absolute top-2 right-2 text-xs"
        >
          New
        </Badge>
      )}
      <Link href={href}>
        <CardHeader className="min-h-28">
          <CardTitle className="">{title}</CardTitle>
          <CardDescription className="h-[2rem]">{description}</CardDescription>
        </CardHeader>
        <CardContent
          className="flex justify-center transition-transform group-hover:scale-110"
          style={{ color: `var(${chartColorVar})` }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.7, y: 12 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px", amount: 0.3 }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 18,
              delay: (index % 12) * 0.04,
            }}
          >
            <IconComponent size={64} strokeWidth={1.25} className="shrink-0" />
          </motion.div>
        </CardContent>
      </Link>
    </Card>
  );
}
