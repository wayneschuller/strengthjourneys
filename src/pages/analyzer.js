"use client";

import Head from "next/head";
import { useSession } from "next-auth/react";
import { useContext, useState, useEffect } from "react";
import useUserLiftData from "@/lib/useUserLiftData";
import { ParsedDataContext } from "@/pages/_app";
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
          <div className="md:col-span-2 xl:col-span-4">
            {!isLoading && <ActivityHeatmapsCard parsedData={parsedData} />}
            {isLoading && (
              <div className="flex">
                <Skeleton className="h-36 w-11/12 flex-1" />
              </div>
            )}
          </div>
          <div className="xl:col-span-2">
            {isLoading && (
              <div className="flex">
                <Skeleton className="h-36 w-11/12 flex-1" />
              </div>
            )}
            {!isLoading && (
              <MonthsHighlightsCard
                parsedData={parsedData}
                liftTypesSelected={selectedLiftTypes}
              />
            )}
          </div>
          <div className="xl:col-span-2">
            <InspirationCard />
          </div>
          <Separator className="md:col-span-2 xl:col-span-4" />
          <div className="md:col-span-2 xl:col-span-4">
            <SidePanelSelectLiftsButton />
            {/* <FancyMultiSelect
              placeholder={"Choose lift types"}
              selected={liftTypesSelected}
              setSelected={setLiftTypesSelected}
              menuOptions={liftTypes}
            /> */}
          </div>
          {selectedLiftTypes.map((lift) => (
            <LiftAchievementsCard
              key={`${lift}-card`}
              liftType={lift}
              parsedData={parsedData}
            />
          ))}
        </div>
      </div>
    </>
  );
};
export default Analyzer;
