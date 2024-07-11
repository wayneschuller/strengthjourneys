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

export default function Visualizer() {
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
    <div className="mx-4 mb-4 md:mx-[5vw]">
      <Head>
        <title>Visualizer (Strength Journeys)</title>
        <meta
          name="description"
          content="Strength Journeys Lift Strength Visualizer"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <h1 className="mb-8 flex-1 scroll-m-20 text-center text-4xl font-extrabold tracking-tight md:hidden lg:text-5xl">
        Strength Visualizer
      </h1>
      <div className="flex flex-col gap-5 md:flex-row">
        <div className="w-full lg:w-1/2 xl:w-2/3">
          <VisualizerShadcn setHighlightDate={setHighlightDate} />
        </div>
        <div className="w-full lg:w-1/2 xl:w-1/3">
          <SessionAnalysisCard highlightDate={highlightDate} />
        </div>
      </div>
    </div>
  );
}
