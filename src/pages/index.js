/** @format */

"use client";

import Link from "next/link";
import Head from "next/head";
import Image from "next/image";

import {
  Calculator,
  Timer,
  LineChart,
  Trophy,
  Newspaper,
  BicepsFlexed,
  Music,
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

//
export const featurePages = [
  {
    href: "/analyzer",
    title: "PR Analyzer",
    description: "See lifetime and recent personal records.",
    IconComponent: Trophy,
  },
  {
    href: "/visualizer",
    title: "Strength Visualizer",
    description: "Interactive lifetime charts of all lifts.",
    IconComponent: LineChart,
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
    description: "Set timer for phones or large gym screens.",
    IconComponent: Timer,
  },
  {
    href: "/gym-playlist-leaderboard",
    title: "Gym Music Playlist Leaderboard",
    description: "Discover and share new motivational music.",
    IconComponent: Music,
  },
  {
    href: "/articles/the-power-of-owning-your-lifting-data-with-google-sheets",
    title: "Article: The Power of Owning Your Lifting Data",
    description: "Why we recommend Google Sheets for lifters.",
    IconComponent: Newspaper,
  },
  {
    href: "/articles/the-iron-and-the-soul-author-henry-rollins",
    title: "Feature Article: The Iron and the Soul",
    description: "The classic inspirational lifting essay by Henry Rollins.",
    IconComponent: Newspaper,
  },
];

const featureArticles = [
  {
    href: "/articles/henry-rollins-the-iron-and-the-soul",
    title: "The Iron and the Soul",
    description: "The classic article by Henry Rollins.",
    IconComponent: Newspaper,
  },
];

export default function Home() {
  const title =
    "Strength Journeys | Free Barbell Lifting Progress Tracker and Analysis Tools";
  const URL = "https://www.strengthjourneys.xyz/";
  const description =
    "Track and analyze your barbell lifting progress with Strength Journeys. Free tools include PR analyzer, strength visualizer, 1RM calculator, and more. Integrate with Google Sheets for easy data management. Open source and perfect for powerlifters and strength athletes.";

  return (
    <div className="mx-4 mb-4 md:mx-[5vw]">
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link
          rel="icon"
          type="image/png"
          sizes="48x48"
          href="/favicon-48x48.png"
        />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        <link rel="canonical" href={URL} />
        <meta property="og:title" content={title} key="title" />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={URL} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Strength Journeys" />
        <meta
          property="og:image"
          content="https://www.strengthjourneys.xyz/StrengthJourneysOGimage.png"
        />
      </Head>

      <h1 className="space-x-2 text-center text-4xl font-extrabold tracking-tight md:mt-8 lg:text-5xl">
        Welcome to Strength Journeys
      </h1>

      <PageDescription />

      <div className="my-10 grid grid-cols-1 gap-8 md:grid-cols-2 lg:my-16 lg:grid-cols-3 2xl:grid-cols-4">
        {featurePages.map((card, index) => (
          <FeatureCard key={index} {...card} />
        ))}
      </div>

      <div className="mx-4 md:mx-20">
        <GettingStartedCard />
      </div>
    </div>
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
        <CardDescription className="">{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center">
        <IconComponent size={64} strokeWidth={1.25} />
      </CardContent>
    </Link>
  </Card>
);
