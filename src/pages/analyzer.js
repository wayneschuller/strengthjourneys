"use client";

import Head from "next/head";
import { useSession } from "next-auth/react";
import { useContext, useState, useEffect } from "react";
import { ParsedDataContext } from "@/pages/_app";
import { useUserLiftData } from "@/lib/use-userlift-data";
import { InspirationCard } from "@/components/inspiration-card";
import { InstructionsCard } from "@/components/instructions-card";
import { LiftAchievementsCard } from "@/components/lift-achievements-card";
import { MonthsHighlightsCard } from "@/components/months-highlights-card";
import { useReadLocalStorage } from "usehooks-ts";
import { ActivityHeatmapsCard } from "@/components/heatmaps";
import { SidePanelSelectLiftsButton } from "@/components/side-panel-lift-chooser";
import { LiftTypeFrequencyPieCard } from "@/components/lift-frequency-pie-card";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Separator } from "@/components/ui/separator";
import { devLog } from "@/lib/processing-utils";
import { SessionAnalysisCard } from "@/components/session-analysis-card";

export default function Analyzer() {
  const { data: session, status } = useSession();
  const { isLoading } = useUserLiftData();
  const ssid = useReadLocalStorage("ssid");

  if (!isLoading && status === "authenticated" && !ssid)
    return (
      <div className="mt-5 flex flex-1 flex-row justify-center align-middle md:mt-10">
        <InstructionsCard session={session} />
      </div>
    );

  return (
    <div className="xl:mx-20">
      <Head>
        <title>PR Analyzer (Strength Journeys)</title>
        <meta name="description" content="Strength Journeys Lift PR Analyzer" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="flex-1">
        <h1 className="mb-8 flex-1 scroll-m-20 text-center text-4xl font-extrabold tracking-tight md:hidden lg:text-5xl ">
          PR Analyzer
        </h1>
        <div className="mt-4 grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 xl:grid-cols-4">
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

export function KeyLiftCards() {
  const { parsedData, selectedLiftTypes } = useContext(ParsedDataContext);
  const { status } = useSession();

  return (
    <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
      {status === "unauthenticated" && (
        <div className="md:col-span-2 xl:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle>Demo Mode: Individual Lift Analysis Section</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="">
                At any time click the dumbell icon to select other lifts for
                analysis. The lift chooser is also in the top right corner of
                the navigation bar.
              </div>
            </CardContent>
            <CardFooter className="flex justify-around">
              <SidePanelSelectLiftsButton isIconMode={false} />
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Map through each of the selected lifts  */}
      {selectedLiftTypes.map((lift) => (
        <LiftAchievementsCard
          key={`${lift}-card`}
          liftType={lift}
          parsedData={parsedData}
        />
      ))}

      {status === "authenticated" && (
        // <div className="grid grid-cols-1">
        <div className="md:col-span-2 xl:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle>Analyzing Other Lifts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="">
                At any time click the dumbell button to select other lifts for
                analysis. The dumbell button is also in the top right corner of
                the navigation bar.
              </div>
            </CardContent>
            <CardFooter className="flex justify-around">
              <SidePanelSelectLiftsButton isIconMode={false} />
            </CardFooter>
          </Card>
        </div>
      )}
      <div className="mt-4"></div>
    </div>
  );
}
