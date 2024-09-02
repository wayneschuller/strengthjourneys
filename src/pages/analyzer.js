"use client";

import Head from "next/head";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useUserLiftingData } from "@/lib/use-userlift-data";
import { ChooseSheetInstructionsCard } from "@/components/instructions-cards";
import { useReadLocalStorage } from "usehooks-ts";
import { Separator } from "@/components/ui/separator";
import { devLog } from "@/lib/processing-utils";

// Here are the analyzer dashboard cards
import { SessionAnalysisCard } from "@/components/analyzer/session-analysis-card";
import { SelectedLiftsIndividualLiftCards } from "@/components/analyzer/lift-achievements-card";
import { ConsistencyCard } from "@/components/analyzer/consistency-card";
import { LiftTypeFrequencyPieCard } from "@/components/analyzer/lift-frequency-pie-card";
import { MonthsHighlightsCard } from "@/components/analyzer/months-highlights-card";
import { ActivityHeatmapsCard } from "@/components/analyzer/heatmap-card";
import { InspirationCard } from "@/components/analyzer/inspiration-card";
import { TitleSEOHead } from "@/components/title-seo";

export default function Analyzer() {
  const { data: session, status: authStatus } = useSession();
  const { isLoading } = useUserLiftingData();
  const ssid = useReadLocalStorage("ssid");

  if (!isLoading && authStatus === "authenticated" && !ssid)
    return (
      <div className="mt-5 flex flex-1 flex-row justify-center align-middle md:mt-10">
        <ChooseSheetInstructionsCard session={session} />
      </div>
    );

  // OG Meta Tags
  const URL = "https://www.strengthjourneys.xyz/strength-level-calculator";
  const description =
    "Unlock insights into your strength training progress with our PR Analyzer. Track consistency, view monthly highlights, and visualize your lifting journey. Get personalized analysis and inspiration to fuel your strength gains.";
  const title = "PR Analyzer - Strength Progress Reports | Strength Journeys";
  const ogImage =
    "https://www.strengthjourneys.xyz/strength_journeys_strength_levels_analyzer_og.png";

  return (
    <>
      <TitleSEOHead
        title={title}
        description={description}
        canonicalURL={URL}
        ogImage={ogImage}
      />

      <main className="mx-4 mb-4 md:mx-[5vw]">
        <h1 className="mb-8 flex-1 scroll-m-20 text-center text-4xl font-extrabold tracking-tight md:hidden lg:text-5xl">
          PR Analyzer
        </h1>

        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
          <div className="flex h-full flex-col">
            <SessionAnalysisCard />
          </div>
          <div className="flex h-full flex-col gap-6">
            <ConsistencyCard />
            <MonthsHighlightsCard />
          </div>
          <div className="grid h-full gap-6">
            <div className="">
              <InspirationCard />
            </div>
            <div className="flex h-full flex-col">
              <LiftTypeFrequencyPieCard />
            </div>
          </div>
          <div className="col-span-full">
            <ActivityHeatmapsCard />
          </div>
          <Separator className="col-span-full" />
        </div>
        <SelectedLiftsIndividualLiftCards />
      </main>
    </>
  );
}
