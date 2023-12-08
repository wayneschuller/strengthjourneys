"use client";

import Head from "next/head";
import { useSession } from "next-auth/react";
import { useContext, useState, useEffect } from "react";
import { ParsedDataContext } from "@/pages/_app";
import useUserLiftData from "@/lib/useUserLiftData";
import { devLog } from "@/lib/SJ-utils";
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

const Analyzer = () => {
  const { data: session } = useSession();
  const { isLoading } = useUserLiftData();
  const { parsedData, selectedLiftTypes } = useContext(ParsedDataContext);
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
  const selectedLiftsPRs = getSelectedLiftsPRs(parsedData, selectedLiftTypes);

  devLog(selectedLiftsPRs);

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
            <MonthsHighlightsCard selectedLiftsPRs={selectedLiftsPRs} />
          </div>
          <div className="xl:col-span-2">
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

function getSelectedLiftsPRs(parsedData, selectedLiftTypes) {
  if (
    !parsedData ||
    !Array.isArray(parsedData) ||
    !Array.isArray(selectedLiftTypes)
  ) {
    throw new Error("Invalid input parameters");
  }

  const startTime = performance.now();

  const selectedLiftsPRs = {};

  // Iterate through each selected lift type
  for (const liftType of selectedLiftTypes) {
    // Use the existing function to get PRs for the current lift type
    const liftTypePRs = getLiftTypePRs(parsedData, liftType);
    // Store the PRs in the result object
    selectedLiftsPRs[liftType] = liftTypePRs;
  }

  devLog(
    `getSelectedLiftsPRs() execution time: \x1b[1m${Math.round(
      performance.now() - startTime,
    )}ms\x1b[0m`,
  );

  return selectedLiftsPRs;
}

function getLiftTypePRs(parsedData, liftType) {
  if (
    !parsedData ||
    !Array.isArray(parsedData) ||
    typeof liftType !== "string"
  ) {
    throw new Error("Invalid input parameters");
  }

  // Initialize liftTypePRs array with empty arrays for each rep range (1 to 10)
  const liftTypePRs = Array.from({ length: 11 }, () => []);

  // Filter entries for the specified lift type
  const liftTypeEntries = parsedData.filter(
    (entry) => entry.liftType === liftType,
  );

  // Sort entries based on weight in descending order
  const sortedEntries = liftTypeEntries.sort((a, b) => b.weight - a.weight);

  // Populate liftTypePRs array for each rep range
  const topEntriesCount = 20;
  for (let reps = 1; reps <= 10; reps++) {
    const liftTypeEntriesForReps = sortedEntries.filter(
      (entry) => entry.reps === reps,
    );
    liftTypePRs[reps] = liftTypeEntriesForReps.slice(0, topEntriesCount);
  }

  return liftTypePRs;
}
