/** @format */

import Link from "next/link";
import { NextSeo } from "next-seo";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { motion } from "motion/react";

import {
  Calculator,
  Timer,
  LineChart,
  Trophy,
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

import { Testimonials } from "@/components/testimonials";
import { HeroSection } from "@/components/hero-section";
import { HomeDashboard } from "@/components/home-dashboard/home-dashboard";
import { BigFourLiftCards } from "@/components/big-four-lift-cards";
import { StrengthUnwrappedDecemberBanner } from "@/components/year-recap/strength-unwrapped-banner";
import { HowItWorksStrip } from "@/components/landing/how-it-works-strip";
import { FlagshipFeatureSection } from "@/components/landing/flagship-feature-section";
import { ToolGroupsSection } from "@/components/landing/tool-groups-section";
import { FinalCTASection } from "@/components/landing/final-cta-section";

const springTransition = {
  type: "spring",
  stiffness: 400,
  damping: 18,
};

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

export default function Home() {
  const title = "Free Barbell Lifting Analysis Tools | Strength Journeys";
  const canonicalURL = "https://www.strengthjourneys.xyz/";
  const description =
    "Track and analyze your barbell lifting with Strength Journeys. Free PR analyzer, 1RM calculator, and more. Integrates with Google Sheets. Open source.";
  const keywords =
    "strength training, barbell lifting, powerlifting, PR analyzer, strength visualizer, one rep max calculator, strength level calculator, lifting timer, gym playlist, strength articles, workout tracking, Google Sheets integration, free tools, open source, strength progress, personal records, e1rm, relative strength, workout music, lifting motivation";
  const ogImageURL = "https://www.strengthjourneys.xyz/202409-og-image.png";
  const { status: authStatus } = useSession();
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

  // Guest-only sections are rendered in static HTML for SEO,
  // then hidden client-side for authenticated users.
  const isGuest = authStatus !== "authenticated";

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
        {/* Hero / Dashboard swap */}
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

        {/* Guest-only: How it works + PR Analyzer flagship */}
        {isGuest && (
          <>
            <HowItWorksStrip />
            <FlagshipFeatureSection
              title="See every personal record at a glance"
              description="Track consistency with visual heatmaps and streaks that reward showing up. Your lifting history, instantly analyzed."
              imageSrc="/app1.png"
              imageAlt="PR Analyzer showing personal records and consistency heatmaps"
              href="/analyzer"
              linkText="Explore the Analyzer"
            />
          </>
        )}

        <StrengthUnwrappedDecemberBanner className="mt-8 mb-6" />

        {/* Big Four Barbell Lifts */}
        <motion.h2
          className="mt-8 mb-2 text-center text-2xl font-bold tracking-tight md:text-3xl"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={springTransition}
        >
          The lifts that matter most.
        </motion.h2>
        <p className="mx-auto mb-8 max-w-lg text-center text-muted-foreground">
          Squat, bench, deadlift, press — the foundation of lifelong barbell
          strength.
        </p>

        <BigFourLiftCards lifts={mainBarbellLifts} animated={bigFourAnimated} />

        {/* Guest-only: Per-lift insight flagship */}
        {isGuest && (
          <FlagshipFeatureSection
            reversed
            title="One page per lift. Everything you need."
            description={
              <>
                Strength standards for your age and bodyweight. E1RM trends,
                tonnage tracking, rep PRs, and video guides. Because{" "}
                <Link
                  href="/articles/tracking-tonnage-as-a-simple-programming-guide"
                  className="text-amber-500 underline hover:text-amber-400"
                >
                  total volume matters more than the perfect program
                </Link>
                .
              </>
            }
            imageSrc="/app3.png"
            imageAlt="Back Squat insight page showing strength standards and E1RM trends"
            href="/barbell-squat-insights"
            linkText="See Back Squat Insights"
          />
        )}

        {/* Tabbed tool groups */}
        <ToolGroupsSection tools={featurePages} />

        {/* Testimonials */}
        <Testimonials />

        {/* Final CTA */}
        <div className="mt-12 mb-8">
          <FinalCTASection />
        </div>
      </main>
    </>
  );
}
