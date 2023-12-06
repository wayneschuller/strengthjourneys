"use client";

import Head from "next/head";
import { useContext, useState, useEffect } from "react";
import { useSession } from "next-auth/react";
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
import { useLocalStorage } from "usehooks-ts";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  Sheet,
  SheetContent,
  SheetClose,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import Heatmap from "@/components/heatmaps";
import { Separator } from "@/components/ui/separator";
import { SidePanelLiftChooser } from "@/components/SidePaneLiftChooser";

let didInit = false;

const Analyzer = () => {
  const [liftTypes, setLiftTypes] = useState([]);
  const [liftTypesSelected, setLiftTypesSelected] = useLocalStorage(
    "selectedLifts",
    [],
  );
  const { parsedData, setParsedData, ssid, setSsid } =
    useContext(ParsedDataContext);
  const { data: session } = useSession();
  const { data, isError, isLoading } = useUserLiftData(session, ssid);

  // Main useEffect - wait for parsedData process component specfic data
  useEffect(() => {
    // devLog(`Analyzer useEffect[parsedData]:`);
    // devLog(parsedData);
    if (!parsedData) return;

    // Count the frequency of each liftType
    // We need this for the lift type multi-select UI immediately
    const liftTypeFrequency = {};
    parsedData.forEach((lifting) => {
      const liftType = lifting.liftType;
      liftTypeFrequency[liftType] = (liftTypeFrequency[liftType] || 0) + 1;
    });

    // Create an array of objects with liftType and frequency properties, sorted by frequency descending
    const sortedLiftTypes = Object.keys(liftTypeFrequency)
      .map((liftType) => ({
        liftType: liftType,
        frequency: liftTypeFrequency[liftType],
      }))
      .sort((a, b) => b.frequency - a.frequency);

    setLiftTypes(sortedLiftTypes);
  }, [parsedData]);

  useEffect(() => {
    devLog(`liftTypes:`);
    devLog(liftTypes);

    devLog(`liftTypesSelected (length: ${liftTypesSelected.length}):`);
    devLog(liftTypesSelected);

    if (
      typeof liftTypesSelected === "undefined" ||
      liftTypesSelected.length === 0
    ) {
      // Determine the number of elements to copy (up to a maximum of 4)
      const elementsToCopy = Math.min(4, liftTypes.length);

      // Copy the elements from sortedLiftTypes to liftTypeSelected state
      setLiftTypesSelected(liftTypes.slice(0, elementsToCopy));
    } else {
      // FIXME: we need to check that the liftTypesSelected only has elements that are in sortedLiftTypes
      // OR handle this graciously elsewhere?
    }
  }, [liftTypes, liftTypesSelected]);

  // devLog(`Rendering <Analyzer />...`);

  if (!isLoading && session?.user && !ssid)
    return (
      <div className="mt-5 flex flex-1 flex-row justify-center align-middle md:mt-10">
        <InstructionsCard session={session} />
      </div>
    );

  // devLog(liftTypesSelected);

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
            <Card>
              <CardHeader>
                <CardTitle className="hidden md:block">
                  Two Years of{" "}
                  {session?.user?.name ? `${session.user.name}'s` : ""} Lifting
                  {session?.user == null && " (Sample Data)"}
                </CardTitle>
                <CardTitle className="block md:hidden">
                  Six Months of Lifting{" "}
                  {session?.user == null && " (Sample Data)"}
                </CardTitle>
                {/* <CardDescription>Card Description</CardDescription> */}
              </CardHeader>
              <CardContent>
                {isLoading && (
                  <div className="flex">
                    <Skeleton className="h-36 w-11/12 flex-1" />
                  </div>
                )}
                {!isLoading && <Heatmap parsedData={parsedData} months={24} />}
              </CardContent>
            </Card>
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
                liftTypesSelected={liftTypesSelected}
              />
            )}
          </div>
          <div className="xl:col-span-2">
            <InspirationCard />
          </div>
          <Separator className="md:col-span-2 xl:col-span-4" />
          <div className="md:col-span-2 xl:col-span-4">
            <SidePanelLiftChooser
              liftTypes={liftTypes}
              selected={liftTypesSelected}
              setSelected={setLiftTypesSelected}
            />
            {/* <FancyMultiSelect
              placeholder={"Choose lift types"}
              selected={liftTypesSelected}
              setSelected={setLiftTypesSelected}
              menuOptions={liftTypes}
            /> */}
          </div>
          {liftTypesSelected.map((lift) => (
            <LiftAchievementsCard
              key={`${lift.liftType}-card`}
              liftType={lift.liftType}
              parsedData={parsedData}
            />
          ))}
        </div>
      </div>
    </>
  );
};
export default Analyzer;
