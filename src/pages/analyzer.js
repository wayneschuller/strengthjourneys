"use client";

import Head from "next/head";
import { useSession } from "next-auth/react";
import { useContext, useState, useEffect } from "react";
import { ParsedDataContext } from "@/pages/_app";
import useUserLiftData from "@/lib/useUserLiftData";
import InspirationCard from "@/components/InspirationCard";
import InstructionsCard from "@/components/InstructionsCard";
import LiftAchievementsCard from "@/components/LiftAchievementsCard";
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
import { devLog, processTopLiftsByTypeAndReps } from "@/lib/SJ-utils";
import LiftTypeFrequencyPieCard from "@/components/LiftFrequencyPie";

const Analyzer = () => {
  const { data: session } = useSession();
  const { isLoading } = useUserLiftData();
  const { parsedData, selectedLiftTypes, topLiftsByTypeAndReps } =
    useContext(ParsedDataContext);
  const ssid = useReadLocalStorage("ssid");

  // Main useEffect - wait for parsedData process component specfic data
  // useEffect(() => {
  //   return;
  //   // devLog(`Analyzer useEffect[parsedData]: (isDemoMode: ${isDemoMode})`);
  //   // devLog(parsedData);
  //   if (!parsedData) return;
  // }, [parsedData]);

  // devLog(`Rendering <Analyzer />...`);

  if (!isLoading && session?.user && !ssid)
    return (
      <div className="mt-5 flex flex-1 flex-row justify-center align-middle md:mt-10">
        <InstructionsCard session={session} />
      </div>
    );

  if (!parsedData || !selectedLiftTypes) return null;

  // Build an object of PRs for everything in selectedLifts
  // liftTypePRs[liftType] = arrays (for reps 1..10) of subarrays for your top 20 lifts at those reps
  // FIXME: if we are prop passing this do it in state useeffect?
  // const selectedLiftsPRs = getSelectedLiftsPRs(parsedData, selectedLiftTypes);
  const selectedLiftsPRs = null;
  // devLog(selectedLiftsPRs);
  // const topLiftsByTypeAndReps = processTopLiftsByTypeAndReps( parsedData, selectedLiftTypes);
  devLog(topLiftsByTypeAndReps);

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
            <MonthsHighlightsCard />
          </div>
          <div className="xl:col-span-2">
            <LiftTypeFrequencyPieCard />
          </div>
          <div className="md:col-span-2 xl:col-span-4">
            <InspirationCard />
          </div>
          <div className="md:col-span-2 xl:col-span-4">
            <ActivityHeatmapsCard />
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
      {selectedLiftTypes.map((lift) => (
        <LiftAchievementsCard
          key={`${lift}-card`}
          liftType={lift}
          parsedData={parsedData}
        />
      ))}
      {!isDemoMode && (
        <div className="grid grid-cols-1">
          <Card>
            <CardHeader>
              <CardTitle>Analyzing Other Lifts</CardTitle>
              {/* <CardDescription>Demo Mode </CardDescription> */}
            </CardHeader>
            <CardContent>
              <div className="">
                At any time click the dumbell icon to select other lifts for
                analysis.
              </div>
              <div className="">
                The lift chooser is also in the top right corner of the
                navigation bar.
              </div>
            </CardContent>
            <CardFooter className="flex justify-around">
              <SidePanelSelectLiftsButton isIconMode={false} />
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
