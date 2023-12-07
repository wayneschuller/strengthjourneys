"use client";

import Head from "next/head";
import { useSession } from "next-auth/react";
import { useContext, useState, useEffect } from "react";
import { ParsedDataContext } from "@/pages/_app";
import useUserLiftData from "@/lib/useUserLiftData";
import { parseGSheetData } from "@/lib/parseGSheetData";
import { sampleParsedData } from "@/lib/sampleParsedData";
import { devLog } from "@/lib/SJ-utils";
import InspirationCard from "@/components/InspirationCard";
import { Skeleton } from "@/components/ui/skeleton";
import InstructionsCard from "@/components/InstructionsCard";
import LiftAchievementsCard from "@/components/LiftAchievementsCard";
import FancyMultiSelect from "@/components/ui/fancy-multi-select";
import MonthsHighlightsCard from "@/components/MonthsHighlightsCard";
import { useReadLocalStorage } from "usehooks-ts";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import ActivityHeatmapsCard from "@/components/heatmaps";
import { Separator } from "@/components/ui/separator";
import { SidePanelSelectLiftsButton } from "@/components/SidePaneLiftChooserButton";

let didInit = false;

const Analyzer = () => {
  const { parsedData, selectedLiftTypes } = useContext(ParsedDataContext);
  const { data: session } = useSession();
  const { data, isError, isLoading } = useUserLiftData();
  const ssid = useReadLocalStorage("ssid");

  // Main useEffect - wait for parsedData process component specfic data
  // useEffect(() => {
  //   return;
  //   // devLog(`Analyzer useEffect[parsedData]: (isDemoMode: ${isDemoMode})`);
  //   // devLog(parsedData);
  //   if (!parsedData) return;
  // }, [parsedData]);

  devLog(`Rendering <Analyzer />...`);

  if (!isLoading && session?.user && !ssid)
    return (
      <div className="mt-5 flex flex-1 flex-row justify-center align-middle md:mt-10">
        <InstructionsCard session={session} />
      </div>
    );

  return (
    <>
      <Head>
        <title>PR Analyzer (Strength Journeys)</title>
        <meta name="description" content="Strength Journeys Lift PR Analyzer" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div>
        <h1 className="mb-8 flex-1 scroll-m-20 text-center text-4xl font-extrabold tracking-tight md:hidden lg:text-5xl ">
          PR Analyzer
        </h1>
        <div className="mx-4 mt-4 grid grid-cols-1 gap-6 md:grid-cols-2 xl:mx-10 xl:grid-cols-4">
          <div className="xl:col-span-2">
            {!isLoading && <MonthsHighlightsCard />}
          </div>
          <div className="xl:col-span-2">
            <InspirationCard />
          </div>
          <div className="md:col-span-2 xl:col-span-4">
            {!isLoading && <ActivityHeatmapsCard />}
          </div>
          <Separator className="md:col-span-2 xl:col-span-4" />
        </div>
        <KeyLiftCards />
      </div>
    </>
  );
};
export default Analyzer;

function KeyLiftCards() {
  const { parsedData, selectedLiftTypes, isDemoMode } =
    useContext(ParsedDataContext);

  return (
    <div className="mx-4 mt-4 grid grid-cols-1 gap-6 md:grid-cols-2 xl:mx-10 xl:grid-cols-4">
      {isDemoMode && (
        <div className="md:col-span-2 xl:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle>Individual Lift Analysis Section</CardTitle>
              <CardDescription>Demo Mode </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="">
                Below are per lift analysis for the key selected lifts. Click
                this button or the top nav bar dumbell icon to change selected
                lifts.
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <SidePanelSelectLiftsButton />
            </CardFooter>
          </Card>
        </div>
      )}
      {selectedLiftTypes.map((lift) => (
        <LiftAchievementsCard
          key={`${lift}-card`}
          liftType={lift}
          parsedData={parsedData}
        />
      ))}
    </div>
  );
}
