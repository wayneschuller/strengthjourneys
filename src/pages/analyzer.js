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
import { SelectedLiftsIndividualLiftCards } from "@/components/lift-achievements-card";

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
    <div className="mx-4 md:mx-[5vw]">
      <Head>
        <title>PR Analyzer (Strength Journeys)</title>
        <meta name="description" content="Strength Journeys Lift PR Analyzer" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="mb-8">
        <h1 className="mb-8 flex-1 scroll-m-20 text-center text-4xl font-extrabold tracking-tight md:hidden lg:text-5xl ">
          PR Analyzer
        </h1>
        <div className="mt-4 grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="">
            <SessionAnalysisCard />
          </div>
          <div className="">
            <MonthsHighlightsCard />
          </div>
          <div className="grid gap-6 xl:grid-cols-1">
            <div className="">
              <InspirationCard />
            </div>
            <div className="">
              <LiftTypeFrequencyPieCard />
            </div>
          </div>
          <div className="col-span-full">
            <ActivityHeatmapsCard />
          </div>
          <Separator className="col-span-full" />
        </div>
        <SelectedLiftsIndividualLiftCards />
      </div>
    </div>
  );
}
