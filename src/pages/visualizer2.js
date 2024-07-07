"use client";

import Head from "next/head";
import { useEffect, useState, useContext } from "react";
import { useSession, signIn } from "next-auth/react";
import { useUserLiftingData } from "@/lib/use-userlift-data";
import { ChooseSheetInstructionsCard } from "@/components/instructions-cards";
import { devLog } from "@/lib/processing-utils";
import { useReadLocalStorage } from "usehooks-ts";
import { VisualizerShadcn } from "@/components/visualizer/visualizer-shadcn";
import { SessionAnalysisCard } from "@/components/analyzer/session-analysis-card";

export default function Visualizer2() {
  const { data: session, status: authStatus } = useSession();
  const { isLoading } = useUserLiftingData();
  const ssid = useReadLocalStorage("ssid");
  const [highlightDate, setHighlightDate] = useState(null);

  if (!isLoading && authStatus === "authenticated" && !ssid)
    return (
      <div className="mt-5 flex flex-1 flex-row justify-center align-middle md:mt-10">
        <ChooseSheetInstructionsCard session={session} />
      </div>
    );

  return (
    <div className="mx-4 mb-4 md:mx-[5vw] 2xl:mx-[15vw]">
      <Head>
        <title>PR Analyzer (Strength Journeys)</title>
        <meta name="description" content="Strength Journeys Lift PR Analyzer" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <h1 className="mb-8 flex-1 scroll-m-20 text-center text-4xl font-extrabold tracking-tight md:hidden lg:text-5xl">
        PR Analyzer
      </h1>
      <div class="flex flex-col gap-5 md:flex-row">
        <div class="w-full md:w-3/4">
          <VisualizerShadcn
            highlightDate={highlightDate}
            setHighlightDate={setHighlightDate}
          />
        </div>
        <div class="w-full md:w-1/4">
          <SessionAnalysisCard
            highlightDate={highlightDate}
            setHighlightDate={setHighlightDate}
          />
        </div>
      </div>
    </div>
  );
}
