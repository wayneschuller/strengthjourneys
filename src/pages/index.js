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

export default function Home() {
  const iconSize = 64;
  const iconStrokeWidth = 1.25;

  const title = "Strength Journeys";

  return (
    <div className="mx-4">
      <Head>
        <title>{title}</title>
        {/* <link rel="icon" href="/favicon.ico" /> */}
        <meta
          name="description"
          content="Free web based stength progress visualisations from your Google Sheet data. 
                We give estimates using multiple exercise science formulas. Designed by lifters for lifters. 
                Useful for powerlifting, strong lifts, crossfit, starting strength and other programs."
        />
        <link rel="canonical" href="https://www.strengthjourneys.xyz/" />
      </Head>
      <h1 className="flex-1 space-x-2 text-center text-4xl font-extrabold tracking-tight lg:text-5xl ">
        Welcome to Strength Journeys
      </h1>
      <h3 className="mt-2 scroll-m-20 text-center text-2xl tracking-tight lg:mx-20">
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
      </h3>
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2 2xl:grid-cols-4">
        <Link href="/analyzer">
          <Card className="hover:ring-1">
            <CardHeader>
              <CardTitle>PR Analyzer</CardTitle>
              <CardDescription>
                See lifetime and recent personal records.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Trophy size={iconSize} strokeWidth={iconStrokeWidth} />
            </CardContent>
          </Card>
        </Link>
        <Link href="/visualizer">
          <Card className="hover:ring-1">
            <CardHeader>
              <CardTitle>Strength Visualizer</CardTitle>
              <CardDescription>
                Interactive lifetime charts of all lifts.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <LineChart size={iconSize} strokeWidth={iconStrokeWidth} />
            </CardContent>
          </Card>
        </Link>
        <Link href="/calculator">
          <Card className="hover:ring-1">
            <CardHeader>
              <CardTitle>One Rep Max Calculator</CardTitle>
              <CardDescription>
                Multi-formula one rep max calculations.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Calculator size={iconSize} strokeWidth={iconStrokeWidth} />
            </CardContent>
          </Card>
        </Link>
        <Link href="/timer">
          <Card className="hover:ring-1">
            <CardHeader>
              <CardTitle>Lifting Set Timer</CardTitle>
              <CardDescription>
                Set timer for phones or large gym screens.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Timer size={iconSize} strokeWidth={iconStrokeWidth} />
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
