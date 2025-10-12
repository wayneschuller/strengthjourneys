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
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GettingStartedCard } from "@/components/instructions-cards";
import { SloganCarousel } from "@/components/slogan-carousel";
import { Testimonials } from "@/components/testimonials";
import { bigFourLiftInsightData } from "@/lib/big-four-insight-data";
import { Separator } from "@/components/ui/separator";
import SpreadsheetShowcase from "@/components/spreadsheet-showcase";
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
        {showHeroSection ? (
          <div
            className={`duration-800 transition-all ease-in-out ${isFadingHero ? "pointer-events-none -translate-y-6 scale-95 opacity-0" : "translate-y-0 scale-100 opacity-100"} `}
          >
            <HeroSection />
          </div>
        ) : (
          <HomeDashboard />
        )}

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

function HeroSection() {
  return (
    <div>
      <div className="mb-8 flex flex-row justify-center">
        <SloganCarousel />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2">
        <div>
          <h1 className="mb-4 mt-4 space-x-2 text-balance text-center text-5xl font-extrabold leading-tight tracking-tight md:mb-8 md:mt-8 lg:text-left lg:text-6xl xl:text-7xl">
            Welcome to Strength Journeys
          </h1>

          <PageDescription />
        </div>
        <SpreadsheetShowcase />
      </div>
    </div>
  );
}
const PageDescription = () => (
  <h2 className="mb-10 mt-2 text-center text-xl tracking-tight md:text-left md:text-3xl lg:w-4/5">
    A free{" "}
    <a
      className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
      target="_blank"
      href="https://github.com/wayneschuller/strengthjourneys"
    >
      open source
    </a>{" "}
    dashboard that turns your{" "}
    <a
      className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
      target="_blank"
      href="https://docs.google.com/spreadsheets/d/14J9z9iJBCeJksesf3MdmpTUmo2TIckDxIQcTx1CPEO0/edit#gid=0"
    >
      Google Sheet lifting log
    </a>{" "}
    into powerful, visual insights for barbell training.
  </h2>
);

function FeatureCard({ href, title, description, IconComponent }) {
  return (
    <Card className="group shadow-lg shadow-primary-foreground ring-0 ring-black hover:ring-1 dark:ring-white">
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

  const bigFourDiagrams = {
    "Back Squat": "/back_squat.svg",
    "Bench Press": "/bench_press.svg",
    Deadlift: "/deadlift.svg",
    "Strict Press": "/strict_press.svg",
  };

  return (
    <div className="grid grid-cols-2 gap-6 md:grid-cols-2 lg:grid-cols-4">
      {lifts.map((lift) => (
        <Card
          key={lift.slug}
          className="group shadow-lg shadow-primary-foreground ring-0 ring-black hover:ring-1 dark:ring-white"
        >
          <Link href={`/${lift.slug}`}>
            <CardHeader className="min-h-28">
              <CardTitle>{lift.liftType}</CardTitle>
              <CardDescription className="h-[2rem]">
                {lift.liftDescription}
              </CardDescription>
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
      ))}
    </div>
  );
}
