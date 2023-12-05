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

let didInit = false;

const Analyzer = () => {
  const [liftTypes, setLiftTypes] = useState([]);
  const [liftTypesSelected, setLiftTypesSelected] = useState([]);
  const { parsedData, setParsedData, ssid, setSsid } =
    useContext(ParsedDataContext);
  const { data: session } = useSession();
  const { data, isError, isLoading } = useUserLiftData(session, ssid);

  // Now declare all our local variables for computable derivable stuff
  let localParsedData = null;

  useEffect(() => {
    if (!parsedData) return; // Don't set localStorage until we are in a running state
    localStorage.setItem("SelectedLifts", JSON.stringify(liftTypesSelected));
  }, [liftTypesSelected]);

  // useEffect(() => {
  //   if (!didInit) {
  //     didInit = true;
  //     // Get the array from local storage or use an empty array if not present
  //     let selectedLifts =
  //       JSON.parse(localStorage.getItem("SelectedLifts")) || [];

  //     devLog(`Found localStorage lifts:`);
  //     devLog(selectedLifts);

  //     setLiftTypesSelected(selectedLifts);
  //     // setLiftTypesSelectedState([]);
  //     // devLog(`useEffect[liftTypesSelected]`);
  //   }
  // }, []);

  // Main useEffect - wait for gsheet in data then process
  useEffect(() => {
    devLog(`Analyzer useEffect[data]:`);
    devLog(data);

    // Let's start a compute chain for data needed by the Analyzer only

    // Get some parsedData
    if (data?.values) {
      localParsedData = parseGSheetData(data.values);
    } else {
      localParsedData = sampleParsedData;
    }

    // devLog(`localParsedData:`);
    // devLog(localParsedData);
    setParsedData(localParsedData);

    // Get the giant object of achivements["Back Squat"] which contains interesting statistics
    // Convert to array
    // achievementsArray = Object.values(
    // analyzerProcessParsedData(localParsedData),
    // );
    // Sort the array by totalSets in descending order
    // achievementsArray.sort((a, b) => b.totalSets - a.totalSets);
    // Transform the array

    // Count the frequency of each liftType
    // We need this for the multi-select
    const liftTypeFrequency = {};
    localParsedData.forEach((lifting) => {
      const liftType = lifting.liftType;
      liftTypeFrequency[liftType] = (liftTypeFrequency[liftType] || 0) + 1;
    });

    // Create an array of objects with value property for the multi-select
    const sortedLiftTypes = Object.keys(liftTypeFrequency)
      .sort((a, b) => liftTypeFrequency[b] - liftTypeFrequency[a])
      .map((liftType) => ({ value: liftType, label: liftType }));

    setLiftTypes(sortedLiftTypes);

    // Maybe here is the time to check localstorage?
    // let selectedLifts = JSON.parse(localStorage.getItem("SelectedLifts")) || [];
    // setLiftTypesSelected(selectedLifts);
  }, [data]);

  devLog(`Rendering <Analyzer />...`);

  if (!isLoading && session?.user && !data?.values)
    return (
      <div className="mt-5 flex flex-1 flex-row justify-center align-middle md:mt-10">
        <InstructionsCard session={session} />
      </div>
    );

  // devLog(`Achivements array:`);
  // devLog(achievementsArray);
  devLog(liftTypesSelected);

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
            <FancyMultiSelect
              placeholder={"Choose lift types"}
              selected={liftTypesSelected}
              setSelected={setLiftTypesSelected}
              menuOptions={liftTypes}
            />
          </div>
          {liftTypesSelected.map((lift) => (
            <LiftAchievementsCard
              key={`${lift.value}-card`}
              liftType={lift.value}
              parsedData={parsedData}
            />
          ))}
        </div>
      </div>
    </>
  );
};
export default Analyzer;
