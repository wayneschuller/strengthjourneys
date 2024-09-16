/** @format */

"use client";

import Link from "next/link";
import Head from "next/head";
import Image from "next/image";
import { NextSeo } from "next-seo";

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

//
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
    href: "/articles/why-it-s-good-to-be-a-barbell-weirdo",
    title: `Feature Article: Why It's Good To Be A Barbell Weirdo`,
    description: "Embrace your inner weirdo.",
    IconComponent: Newspaper,
  },
  {
    href: "/articles/the-iron-and-the-soul-author-henry-rollins",
    title: "Feature Article: The Iron and the Soul",
    description: "The classic inspirational lifting essay by Henry Rollins.",
    IconComponent: Newspaper,
  },
];

export default function Home() {
  const title = "Strength Journeys | Free Barbell Lifting Analysis Tools";
  const canonicalURL = "https://www.strengthjourneys.xyz/";
  const description =
    "Track and analyze your barbell lifting with Strength Journeys. Free PR analyzer, 1RM calculator, and more. Integrates with Google Sheets. Open source.";
  const keywords =
    "strength training, barbell lifting, powerlifting, PR analyzer, strength visualizer, one rep max calculator, strength level calculator, lifting timer, gym playlist, strength articles, workout tracking, Google Sheets integration, free tools, open source, strength progress, personal records, e1rm, relative strength, workout music, lifting motivation";
  const ogImageURL = "https://www.strengthjourneys.xyz/202409-og-image.png";

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
        <div className="flex flex-row justify-center">
          <SloganCarousel />
        </div>
        <h1 className="my-4 space-x-2 text-balance text-center text-4xl font-extrabold tracking-tight md:mt-8 lg:text-5xl">
          Welcome to Strength Journeys
        </h1>

        <PageDescription />

        <div className="my-10 grid grid-cols-1 gap-8 md:grid-cols-2 lg:my-16 lg:grid-cols-3 2xl:grid-cols-4">
          {featurePages.map((card, index) => (
            <FeatureCard key={index} {...card} />
          ))}
        </div>

        {/* <Testimonials /> */}

        <div className="mx-4 md:mx-20">
          <GettingStartedCard />
        </div>
      </main>
    </>
  );
}

const PageDescription = () => (
  <h2 className="mt-2 text-center text-2xl tracking-tight lg:mx-20">
    A free{" "}
    <a
      className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
      target="_blank"
      href="https://github.com/wayneschuller/strengthjourneys"
    >
      open source
    </a>{" "}
    web app with creative visualization and analysis of your{" "}
    <a
      className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
      target="_blank"
      href="https://docs.google.com/spreadsheets/d/14J9z9iJBCeJksesf3MdmpTUmo2TIckDxIQcTx1CPEO0/edit#gid=0"
    >
      Google Sheet
    </a>{" "}
    barbell lifting data.
  </h2>
);

const FeatureCard = ({ href, title, description, IconComponent }) => (
  <Card className="shadow-lg shadow-primary-foreground ring-0 ring-black hover:ring-1 dark:ring-white">
    <Link href={href}>
      <CardHeader className="min-h-28">
        <CardTitle className="">{title}</CardTitle>
        <CardDescription className="h-[2rem]">{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center">
        <IconComponent size={64} strokeWidth={1.25} />
      </CardContent>
    </Link>
  </Card>
);
