/** @format */

"use client";

import Link from "next/link";
import Head from "next/head";
import { Calculator, Timer, LineChart, Trophy } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GettingStartedCard } from "@/components/instructions-cards";

const featurePages = [
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
    description: "Multi-formula one rep max calculations.",
    IconComponent: Calculator,
  },
  {
    href: "/timer",
    title: "Lifting Set Timer",
    description: "Set timer for phones or large gym screens.",
    IconComponent: Timer,
  },
];

export default function Home() {
  const title = "Strength Journeys";

  return (
    <div className="">
      <Head>
        <title>{title}</title>
        {/* Other meta tags */}
        <link rel="canonical" href="https://www.strengthjourneys.xyz/" />
      </Head>

      <h1 className="space-x-2 text-center text-4xl font-extrabold tracking-tight md:mt-8 lg:text-5xl ">
        Welcome to {title}
      </h1>
      <PageDescription />

      <div className="mx-4 my-10 grid grid-cols-1 justify-stretch gap-8 md:grid-cols-2 lg:my-16 lg:grid-cols-4">
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
  <h2 className="mt-2 scroll-m-20 text-center text-2xl tracking-tight lg:mx-20">
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
  <Link href={href}>
    <Card className="shadow-lg shadow-primary-foreground ring-1 ring-black hover:ring-2 dark:ring-white">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center">
        <IconComponent size={64} strokeWidth={1.25} />
      </CardContent>
    </Card>
  </Link>
);
