"use client";

import Head from "next/head";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useUserLiftData } from "@/lib/use-userlift-data";
import { InspirationCard } from "@/components/inspiration-card";
import { ChooseSheetInstructionsCard } from "@/components/instructions-cards";
import { MonthsHighlightsCard } from "@/components/months-highlights-card";
import { useReadLocalStorage } from "usehooks-ts";
import { ActivityHeatmapsCard } from "@/components/heatmaps";
import { LiftTypeFrequencyPieCard } from "@/components/lift-frequency-pie-card";

import { CardDescription } from "@/components/ui/card";

import { Separator } from "@/components/ui/separator";
import { devLog } from "@/lib/processing-utils";
import { SessionAnalysisCard } from "@/components/session-analysis-card";
import { KeyLiftCards } from "@/components/lift-achievements-card";

export default function Analyzer() {
  const { data: session, status: authStatus } = useSession();
  const { isLoading } = useUserLiftData();
  const ssid = useReadLocalStorage("ssid");

  if (!isLoading && authStatus === "authenticated" && !ssid)
    return (
      <div className="mt-5 flex flex-1 flex-row justify-center align-middle md:mt-10">
        <ChooseSheetInstructionsCard session={session} />
      </div>
    );

  return (
    <div className="xl:mx-32">
      <Head>
        <title>PR Analyzer (Strength Journeys)</title>
        <meta name="description" content="Strength Journeys Lift PR Analyzer" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="">
        <h1 className="mb-8 flex-1 scroll-m-20 text-center text-4xl font-extrabold tracking-tight md:hidden lg:text-5xl ">
          PR Analyzer
        </h1>
        <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          <div className="grid xl:col-span-2">
            <SessionAnalysisCard />
          </div>
          <div className="grid xl:col-span-2">
            <MonthsHighlightsCard />
          </div>
          <div className="grid xl:col-span-2">
            <InspirationCard />
          </div>
          <div className="grid xl:col-span-2">
            <LiftTypeFrequencyPieCard />
          </div>
          <div className="md:col-span-2 xl:col-span-4">
            <ActivityHeatmapsCard />
          </div>
          <Separator className="md:col-span-2 xl:col-span-4" />
        </div>
        <KeyLiftCards />
      </div>
    </div>
  );
}
