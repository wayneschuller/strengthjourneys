"use client";

import dynamic from "next/dynamic";
import Head from "next/head";
import React, { useState } from "react";

import { Inter, Righteous } from "next/font/google";
const inter = Inter({ subsets: ["latin"] });
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import {
  Sheet,
  SheetContent,
  SheetClose,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

// Hack needed to get zoom/pan to work for next.js client
// https://github.com/chartjs/chartjs-plugin-zoom/issues/742
const DynamicHeaderVisualizerChart = dynamic(
  () => import("../components/VisualizerChart"),
  {
    ssr: false,
  },
);

const Visualizer = () => {
  return (
    <>
      <Head>
        <title>Strength Visualizer (Strength Journeys)</title>
        <meta
          name="description"
          content="Strength Journeys Strength Analyzer"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="">
        <h1 className="flex-1 scroll-m-20 text-center text-4xl font-extrabold tracking-tight md:hidden lg:text-5xl ">
          Strength Visualizer
        </h1>
        <div>{/* <LiftChooserPanel /> */}</div>
        <div
          style={{ position: "relative", height: "80vh", width: "92vw" }}
          className=""
        >
          <DynamicHeaderVisualizerChart />
        </div>
      </div>
    </>
  );
};
export default Visualizer;

const LiftChooserPanel = ({}) => {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="mt-2 px-2 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 ">
          {/* <ViewVerticalIcon className="h-5 w-5" /> */}
          Choose Lifts
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="pr-0">
        <div className="flex w-min flex-col">
          <div>Back Squat</div>
          <div>Deadlift</div>
          <div>Bench Press</div>
          <SheetClose asChild className="flex justify-center">
            <Button>Close controls</Button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export function convertToHslFormat(originalHsl) {
  // Split the original HSL string into individual components
  const [hue, saturation, lightness] = originalHsl.split(" ");

  // Extract numeric values
  const numericHue = parseFloat(hue);
  const numericSaturation = parseFloat(saturation);
  const numericLightness = parseFloat(lightness);

  // Construct the HSL format string
  const hslFormat = `hsl(${numericHue}, ${numericSaturation}%, ${numericLightness}%)`;

  return hslFormat;
}

export function fadeHslColor(originalHsl, fadeAmount, isDarkMode) {
  // console.log(originalHsl);
  // Split the original HSL string into individual components
  const [hue, saturation, lightness] = originalHsl.split(" ");

  // Extract numeric values
  const numericHue = parseFloat(hue);
  const numericSaturation = parseFloat(saturation);
  let numericLightness = parseFloat(lightness);

  // Adjust lightness based on mode
  if (isDarkMode) {
    // Dark mode: decrease lightness
    numericLightness = Math.max(0, numericLightness - fadeAmount);
  } else {
    // Light mode: increase lightness
    numericLightness = Math.min(100, numericLightness + fadeAmount);
  }

  // Construct the new HSL format string
  const fadedHsl = `hsl(${numericHue}, ${numericSaturation}%, ${numericLightness}%)`;

  return fadedHsl;
}
