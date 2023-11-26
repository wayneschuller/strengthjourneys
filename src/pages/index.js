/** @format */

"use client";

import Link from "next/link";
import Head from "next/head";
import Image from "next/image";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import CalculatorThumbnailDark from "../../public/CalculatorThumbnailDark.jpg";
import CalculatorThumbnailLight from "../../public/CalculatorThumbnailLight.jpg";

export default function Home() {
  const { theme, setTheme } = useTheme();

  const title = "Strength Journeys";

  return (
    <div className="mx-4">
      <Head>
        <title>{title}</title>
        {/* <link rel="icon" href="/favicon.ico" /> */}
        <meta
          name="description"
          content="A one rep max strength calculator you can use with chalked up hands on your phone in the middle of a gym session. 
                We give estimates using multiple exercise science formulas. Designed by lifters for lifters. 
                Useful for powerlifting, strong lifts, crossfit, starting strength and other programs."
        />

        <link rel="canonical" href="https://www.onerepmaxcalculator.xyz/" />
      </Head>
      <h1 className="flex-1 space-x-2 text-center text-4xl font-extrabold tracking-tight lg:text-5xl ">
        Welcome to Strength Journeys 2.0
      </h1>
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2 2xl:grid-cols-4">
        <Link href="/analyzer">
          <Card className="hover:ring-1">
            <CardHeader>
              <CardTitle>PR Analyzer</CardTitle>
              <CardDescription>
                See lifetime and recent personal records.
              </CardDescription>
            </CardHeader>
            <CardContent>Page thumbnail</CardContent>
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
            <CardContent>Chart thumbnail</CardContent>
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
            <CardContent>
              <Image
                src={
                  theme === "dark"
                    ? CalculatorThumbnailDark
                    : CalculatorThumbnailLight
                }
              />
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
            <CardContent>Thumbnail</CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
