/** @format */

/**
 * Public home page for Strength Journeys.
 * Keep this Pages Router entry focused on the marketing landing experience and
 * the signed-in dashboard handoff without moving user data analysis server-side.
 */

import Head from "next/head";
import Link from "next/link";
import { NextSeo } from "next-seo";
import { useSession } from "next-auth/react";
import { useState, useEffect, useMemo } from "react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { getDashboardStage } from "@/lib/home-dashboard/dashboard-stage";

import {
  Calculator,
  Timer,
  LineChart,
  Layers,
  BicepsFlexed,
  Music,
  LibraryBig,
  Bot,
  Anvil,
  Bus,
  Flame,
  Sparkles,
  CircleDashed,
  Plus,
  Mountain,
  Upload,
  Disc,
} from "lucide-react";

import dynamic from "next/dynamic";

import { motion } from "motion/react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const Testimonials = dynamic(
  () => import("@/components/homepage/testimonials").then((m) => m.Testimonials),
  {
    ssr: false,
    loading: () => (
      <div className="mx-4 mt-10 md:mx-10">
        <div className="text-muted-foreground flex h-32 items-center justify-center rounded-lg border p-4 text-center text-sm">
          Loading testimonials...
        </div>
      </div>
    ),
  },
);
const GettingStartedCard = dynamic(
  () => import("@/components/onboarding/instructions-cards").then((m) => m.GettingStartedCard),
  {
    ssr: false,
    loading: () => (
      <div className="mx-4 mt-10 md:mx-10">
        <div className="text-muted-foreground flex h-32 items-center justify-center rounded-lg border p-4 text-center text-sm">
          Loading getting started guide...
        </div>
      </div>
    ),
  },
);
import { BIG_FOUR_LIFT_META } from "@/lib/big-four-lifts";
import { Separator } from "@/components/ui/separator";
import { HeroSection } from "@/components/homepage/hero-section";
import { HomeDashboard } from "@/components/home-dashboard/home-dashboard";
import { BigFourLiftCards } from "@/components/homepage/big-four-lift-cards";
import { GorillaIcon } from "@/components/gorilla-icon";
import { StrengthUnwrappedDecemberBanner } from "@/components/year-recap/strength-unwrapped-banner";

// The feature pages are the main tools, with one card each on the landing page
export const featurePages = [
  {
    href: "/log",
    title: "Log & Session Browser",
    description:
      "Log your lifting session or browse past workouts in detail with strength tracking and warm-up suggestions.",
    IconComponent: Plus,
  },
  {
    href: "/calculator",
    title: "One Rep Max Calculator",
    description: "The greatest e1rm multi-formula one rep max calculations.",
    IconComponent: Calculator,
  },
  {
    href: "/how-strong-am-i",
    title: "How Strong Am I?",
    description:
      "See your percentile rank across four groups, from the general population to powerlifting culture.",
    IconComponent: CircleDashed,
  },
  {
    href: "/1000lb-club-calculator",
    title: "1000lb Club Calculator",
    description:
      "Are you in the 1000lb club? Track your progress to this milestone.",
    IconComponent: Anvil,
  },
  {
    href: "/strength-levels",
    title: "Strength Levels",
    description:
      "Check beginner, intermediate, advanced, and elite benchmarks for squat, bench press, deadlift, and strict press.",
    IconComponent: BicepsFlexed,
  },
  {
    href: "/lift-explorer",
    title: "Lift Explorer",
    description:
      "Explore your lifting history lift by lift. PRs across every rep range, your journey, and training frequency.",
    IconComponent: Layers,
  },
  {
    href: "/warm-up-sets-calculator",
    title: "Warm Ups Calculator",
    description:
      "Generate warmup sets for your barbell workouts using progressive warmup methodology.",
    IconComponent: Flame,
  },
  {
    href: "/200-300-400-500-strength-club-calculator",
    title: "200/300/400/500 Strength Club",
    description:
      "Track your progress toward the classic barbell milestones: 200 press, 300 bench, 400 squat, 500 deadlift.",
    IconComponent: Mountain,
  },
  {
    href: "/plate-milestones",
    title: "Plate Milestones",
    description:
      "How many plates can you lift? Track your 1/2/3/4 plate club progress. Plates get dates.",
    IconComponent: Disc,
    badgeLabel: "New",
  },
  {
    href: "/articles",
    title: "Strength Articles Library",
    description:
      "A collection of our articles, common questions, plus curated lifting content.",
    IconComponent: LibraryBig,
  },
  {
    href: "/ai-lifting-assistant",
    title: "AI Lifting Assistant",
    description:
      "A strength expert chatbot. Talk to your lifting data. A coach who loves you.",
    IconComponent: Bot,
  },
  {
    href: "/visualizer",
    title: "Strength Visualizer",
    description:
      "Chart lifts beyond the Big Four with full-range E1RM history over time.",
    IconComponent: LineChart,
  },
  {
    href: "/strength-year-in-review",
    title: "Strength Unwrapped - Yearly Recap",
    description:
      "Your year of strength training in a Spotify Wrapped-style recap. Sessions, tonnage, PRs, and more.",
    IconComponent: Sparkles,
  },
  {
    href: "/import",
    title: "Import Data",
    description:
      "Import from Hevy, Strong, Wodify, BTWB, or spreadsheets. Merge everything into your own Sheet.",
    IconComponent: Upload,
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
    href: "/how-strong-is-a-gorilla",
    title: "How Strong Is a Gorilla?",
    description:
      "Compare your bench press to a silverback. Find out how badly you'd lose.",
    IconComponent: GorillaIcon,
  },
  {
    href: "/gym-playlist-leaderboard",
    title: "Gym Music Leaderboard",
    description: "Discover and share new motivational music playlists.",
    IconComponent: Music,
  },
];

// Landing page tiers: group feature cards by purpose for visual hierarchy.
// "Your Training" tools become richer with user data, "Calculators & Standards"
// are the try-before-you-sign-in SEO workhorses, and "More" is a compact strip.
const insightTools = [
  {
    href: "/lift-explorer",
    title: "Lift Explorer",
    description:
      "Explore your lifting history lift by lift. PRs across every rep range, your journey, and training frequency.",
    IconComponent: Layers,
  },
  {
    href: "/ai-lifting-assistant",
    title: "AI Lifting Assistant",
    description:
      "A strength expert chatbot. Talk to your lifting data. A coach who loves you.",
    IconComponent: Bot,
  },
  {
    href: "/tonnage",
    title: "Tonnage Metrics",
    description:
      "Ever wondered how many buses you've lifted? Your lifting volume, visualized.",
    IconComponent: Bus,
  },
  {
    href: "/visualizer",
    title: "Strength Visualizer",
    description:
      "Chart lifts beyond the Big Four with full-range E1RM history over time.",
    IconComponent: LineChart,
  },
];

const calculatorTools = [
  {
    href: "/calculator",
    title: "One Rep Max Calculator",
    description: "The greatest e1rm multi-formula one rep max calculations.",
    IconComponent: Calculator,
  },
  {
    href: "/how-strong-am-i",
    title: "How Strong Am I?",
    description:
      "See your percentile rank across four groups, from the general population to powerlifting culture.",
    IconComponent: CircleDashed,
  },
  {
    href: "/strength-levels",
    title: "Strength Levels",
    description:
      "Beginner, intermediate, advanced, and elite benchmarks for squat, bench, deadlift, and press.",
    IconComponent: BicepsFlexed,
  },
  {
    href: "/warm-up-sets-calculator",
    title: "Warm Ups Calculator",
    description:
      "Generate warmup sets for your barbell workouts using progressive warmup methodology.",
    IconComponent: Flame,
  },
];

const milestoneTools = [
  {
    href: "/plate-milestones",
    title: "Plate Milestones",
    description:
      "How many plates can you lift? Track your 1/2/3/4 plate club progress. Plates get dates.",
    IconComponent: Disc,
    badgeLabel: "New",
  },
  {
    href: "/1000lb-club-calculator",
    title: "1000lb Club Calculator",
    description:
      "Are you in the 1000lb club? Track your progress to this milestone.",
    IconComponent: Anvil,
  },
  {
    href: "/200-300-400-500-strength-club-calculator",
    title: "200/300/400/500 Club",
    description:
      "Track your progress toward the classic barbell milestones: 200 press, 300 bench, 400 squat, 500 deadlift.",
    IconComponent: Mountain,
  },
];

const moreTools = [
  {
    href: "/articles",
    title: "Strength Articles",
    IconComponent: LibraryBig,
  },
  {
    href: "/gym-playlist-leaderboard",
    title: "Gym Music",
    IconComponent: Music,
  },
  {
    href: "/timer",
    title: "Set Timer",
    IconComponent: Timer,
  },
  {
    href: "/strength-year-in-review",
    title: "Strength Unwrapped",
    IconComponent: Sparkles,
  },
  {
    href: "/how-strong-is-a-gorilla",
    title: "Gorilla Strength",
    IconComponent: GorillaIcon,
  },
];

const mainBarbellLifts = BIG_FOUR_LIFT_META.map(
  ({ liftType, progressGuidePath, homepageDescription, iconSrc }) => ({
    slug: progressGuidePath.replace(/^\//, ""),
    liftType,
    liftDescription: homepageDescription,
    iconSrc,
  }),
);

const dataArchiveBenefits = [
  {
    title: "Rescue the messy past",
    description:
      "Drop exports from Hevy, Strong, StrongLifts, Wodify, BTWB, TurnKey, or old spreadsheets.",
    IconComponent: Upload,
  },
  {
    title: "Normalize the whole timeline",
    description:
      "Strength Journeys cleans lift names, detects PRs, skips duplicates, and stitches sessions together.",
    IconComponent: Layers,
  },
  {
    title: "Keep the source of truth",
    description:
      "Save the merged history to a Google Sheet in your Drive, then keep using it with every analysis tool here.",
    IconComponent: LineChart,
  },
];

/**
 * Home page and landing page for Strength Journeys. Shows the hero section or user dashboard,
 * the Big Four barbell lift cards, a grid of feature tool cards, testimonials, and a getting-started card.
 */
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: "Strength Journeys",
      url: "https://www.strengthjourneys.xyz",
    },
    {
      "@type": "Organization",
      name: "Strength Journeys",
      url: "https://www.strengthjourneys.xyz",
      description:
        "Free barbell lifting analysis tools. Import app exports into a Google Sheet you own, then unlock PR tracking, 1RM calculators, strength standards, and training insights.",
      logo: {
        "@type": "ImageObject",
        url: "https://www.strengthjourneys.xyz/nav_logo_light.png",
      },
      sameAs: [
        "https://x.com/wayneschuller",
        "https://github.com/wayneschuller/strengthjourneys",
      ],
      founder: {
        "@type": "Person",
        name: "Wayne Schuller",
        sameAs: ["https://x.com/wayneschuller"],
      },
    },
  ],
};

export default function Home() {
  const title = "Free Barbell Lifting Analysis Tools | Strength Journeys";
  const canonicalURL = "https://www.strengthjourneys.xyz/";
  const description =
    "Track, import, and analyze your barbell lifting data. Merge app exports into a Google Sheet you own, then explore PRs, 1RM calculators, and visual insights.";
  const keywords =
    "strength training, barbell lifting, powerlifting, PR analyzer, strength visualizer, one rep max calculator, strength level calculator, lifting timer, gym playlist, strength articles, workout tracking, workout data import, fitness app export, Google Sheets integration, free tools, open source, strength progress, personal records, e1rm, relative strength, workout music, lifting motivation";
  const ogImageURL = "https://www.strengthjourneys.xyz/202409-og-image.png";
  const { status: authStatus } = useSession();
  const {
    hasUserData,
    isImportedData,
    parsedData,
    rawRows,
    sheetInfo,
    isReturningUserLoading,
  } = useUserLiftingData();
  const [showHeroSection, setShowHeroSection] = useState(true); // Ensure static generation of Hero Section
  const [isFadingHero, setIsFadingHero] = useState(false);
  const [bigFourAnimated, setBigFourAnimated] = useState(false);
  const { dashboardStage } = useMemo(
    () =>
      getDashboardStage({
        parsedData,
        rawRows,
        sheetInfo,
      }),
    [parsedData, rawRows, sheetInfo],
  );
  // Keep the Big Four cards visible for early users, but delay the personalized
  // stats treatment until they have enough history for those comparisons to land.
  const showEnhancedBigFourStats =
    hasUserData &&
    (dashboardStage === "early_base" || dashboardStage === "established");

  // Only collapse the landing hero once the user has real linked data and can
  // meaningfully land on the dashboard. Signed-in demo mode should still feel
  // like the public landing page with stronger setup prompts.
  useEffect(() => {
    if (hasUserData && showHeroSection && !isFadingHero) {
      setIsFadingHero(true); // start fade-out
      setTimeout(() => setShowHeroSection(false), 800); // <-- match duration below
    }
  }, [hasUserData, showHeroSection, isFadingHero]);

  useEffect(() => {
    if (!hasUserData) {
      setShowHeroSection(true);
      setIsFadingHero(false);
    }
  }, [hasUserData]);

  // Delay the Big Four lift cards entrance until after the home dashboard intro
  // (hero fade + row processing ~1.2s + top stat cards ~2.2s). For guests and
  // signed-in demo mode, show them immediately.
  useEffect(() => {
    if (hasUserData) {
      const totalIntroMs = 4000; // Row processing + section cards left-to-right stagger
      const timeoutId = setTimeout(() => {
        setBigFourAnimated(true);
      }, totalIntroMs);
      return () => clearTimeout(timeoutId);
    }

    if (!hasUserData && authStatus !== "loading") {
      setBigFourAnimated(true);
    }
  }, [authStatus, hasUserData]);

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
      <main className="mb-4 px-3 md:px-0">
        <div className="flex min-h-[480px] flex-col items-center justify-center transition-all duration-800">
          {showHeroSection && !isReturningUserLoading ? (
            <div
              className={`inset-0 h-full w-full transition-all duration-800 ${isFadingHero ? "pointer-events-none -translate-y-6 scale-95 opacity-0" : "translate-y-0 scale-100 opacity-100"} `}
            >
              <HeroSection />
            </div>
          ) : !showHeroSection ? (
            <div
              className={`inset-0 h-full w-full transition-opacity duration-800 ${showHeroSection ? "opacity-0" : "opacity-100"} `}
            >
              <HomeDashboard />
            </div>
          ) : null}
        </div>

        <StrengthUnwrappedDecemberBanner className="mt-8 mb-6" />

        <DataArchiveSection />

        <>
          <h2 className="mt-8 mb-4 text-xl font-semibold">
            🏋️ The Big Four Barbell Lifts
          </h2>

          <BigFourLiftCards
            lifts={mainBarbellLifts}
            animated={bigFourAnimated}
            enhancedStats={showEnhancedBigFourStats}
          />
        </>

        <Separator className="my-8" />

        {/* Tier 1: Training insight tools */}
        <h2 className="mt-8 text-xl font-semibold">
          📊 Your Training
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {insightTools.map((card, index) => (
            <FeatureCard key={card.href} index={index} {...card} />
          ))}
        </div>

        <Separator className="my-8" />

        {/* Tier 2: Calculators and strength standards */}
        <h2 className="text-xl font-semibold">
          🧮 Calculators & Standards
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {calculatorTools.map((card, index) => (
            <FeatureCard key={card.href} index={index + insightTools.length} {...card} />
          ))}
        </div>

        <Separator className="my-8" />

        {/* Tier 3: Strength journey milestones */}
        <h2 className="text-xl font-semibold">
          🏆 Strength Journey Milestones
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {milestoneTools.map((card, index) => (
            <FeatureCard key={card.href} index={index + insightTools.length + calculatorTools.length} {...card} />
          ))}
        </div>

        <Separator className="my-8" />

        {/* Tier 4: Compact strip for supplementary tools */}
        <div className="mb-16 flex flex-wrap items-center justify-center gap-3">
          {moreTools.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="border-border bg-card hover:bg-accent hover:text-accent-foreground inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors"
            >
              <tool.IconComponent size={16} strokeWidth={1.5} />
              {tool.title}
            </Link>
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

function DataArchiveSection() {
  return (
    <section className="mx-auto mt-8 max-w-6xl border-y border-border py-8">
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <Badge variant="secondary" className="mb-3">
            Data ownership, not app lock-in
          </Badge>
          <h2 className="text-2xl font-bold leading-tight md:text-3xl">
            Turn app-hopping into one Google Sheet you own.
          </h2>
          <p className="text-muted-foreground mt-3 max-w-3xl text-sm leading-6 md:text-base md:leading-7">
            Strength Journeys can be the merge lane for your whole barbell
            history. Pull the data out of the apps that logged it, bring it
            together in one editable Sheet, and run the fun stuff on top: PRs,
            strength standards, tonnage, timelines, year recaps, and AI
            questions about your own training.
          </p>
          <Link
            href="/import"
            className="bg-primary text-primary-foreground hover:bg-primary/90 mt-5 inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors"
          >
            <Upload className="mr-2 h-4 w-4" />
            Merge Your App History
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          {dataArchiveBenefits.map((benefit) => (
            <div key={benefit.title} className="flex items-start gap-3">
              <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-md">
                <benefit.IconComponent className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">{benefit.title}</h3>
                <p className="text-muted-foreground mt-1 text-sm leading-6">
                  {benefit.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Animated card linking to a single feature tool page, displaying the tool's icon, title, and description.
 * @param {Object} props
 * @param {string} props.href - URL path for the feature page.
 * @param {string} props.title - Display name of the feature.
 * @param {string} props.description - Short description shown under the title.
 * @param {React.ComponentType} props.IconComponent - Lucide icon component rendered as the card illustration.
 * @param {number} [props.index=0] - Card position in the grid, used to assign a chart color and stagger the animation.
 */
function FeatureCard({
  href,
  title,
  description,
  IconComponent,
  badgeLabel,
  index = 0,
}) {
  const chartColorVar = `--chart-${(index % 5) + 1}`;

  return (
    <Card className="group ring-ring relative shadow-lg ring-0 hover:ring-1">
      {badgeLabel && (
        <Badge
          variant="outline"
          className="bg-primary/10 text-primary absolute top-2 right-2 text-xs"
        >
          {badgeLabel}
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
