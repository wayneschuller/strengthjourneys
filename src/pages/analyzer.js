"use client";

import Head from "next/head";
import { useContext, useState, useEffect } from "react";
import { useSession, signIn } from "next-auth/react";
import useUserLiftData from "@/lib/useUserLiftData";
import { ParsedDataContext } from "@/pages/_app";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import useDrivePicker from "@fyelci/react-google-drive-picker";
import { handleOpenPicker } from "@/components/handleOpenPicker";
import { parseGSheetData } from "@/lib/parseGSheetData";
import { sampleParsedData } from "@/lib/sampleParsedData";

import { Button } from "@/components/ui/button";

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

const Analyzer = () => {
  const { parsedData, setParsedData, ssid, setSsid } =
    useContext(ParsedDataContext);
  const { data: session } = useSession();
  const { data, isError, isLoading } = useUserLiftData(session, ssid);
  const { toast } = useToast();
  const [openPicker, authResponse] = useDrivePicker();

  useEffect(() => {
    console.log(`Analyzer useEffect[]`);
  }, []);

  let chartData = [];
  let localParsedData = null;
  if (session && data?.values) {
    // console.log(data);
    if (parsedData === null) {
      localParsedData = parseGSheetData(data.values); // FIXME: Do this in the useEffect?
      // setParsedData(newParsedData); // This triggers an infinite loop of rerendering
      console.log(parsedData);
    } else {
      localParsedData = parsedData;
    }
  } else {
    localParsedData = sampleParsedData;
  }
  const maxWeightsByLiftType = processParsedData(localParsedData);
  console.log(maxWeightsByLiftType);

  return (
    <>
      <Head>
        <title>PR Analyzer (Strength Journeys)</title>
        <meta name="description" content="Strength Journeys Lift PR Analyzer" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div>
        <h1 className="flex-1 scroll-m-20 text-center text-4xl font-extrabold tracking-tight md:hidden lg:text-5xl ">
          PR Analyzer
        </h1>
        <div>
          {!session && <div> You need to sign in. </div>}
          {session && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Object.entries(maxWeightsByLiftType).map(
                ([liftType, achievements]) => (
                  <LiftAchievements
                    key={liftType}
                    liftType={liftType}
                    achievements={achievements}
                  />
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
export default Analyzer;

const LiftAchievements = ({ liftType, achievements }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{liftType} Achievements</CardTitle>
        {/* <CardDescription>Card Description</CardDescription> */}
      </CardHeader>
      <CardContent>
        <p>One Rep Max: {achievements.oneRepMax} lb</p>
        <p>Three Rep Max: {achievements.threeRepMax} lb</p>
        <p>Five Rep Max: {achievements.fiveRepMax} lb</p>
      </CardContent>
    </Card>
  );
};

// This function uniquely processes the parsed Data for the Visualizer
// So it lives here in the <VisualizerChart /> component
function processParsedData(parsedData) {
  if (parsedData === null) {
    console.log(`Error: processParsedData passed null.`);
    return;
  }

  // Function to calculate max weights for each lift type

  const calculateMaxWeights = (data, liftType) => {
    const parsedData = data.filter((entry) => entry.liftType === liftType);

    // Sort the data by weight in descending order
    parsedData.sort((a, b) => b.weight - a.weight);

    const oneRepMax = parsedData[0].weight;
    const threeRepMax =
      parsedData.find((entry) => entry.reps === 3)?.weight || 0;
    const fiveRepMax =
      parsedData.find((entry) => entry.reps === 5)?.weight || 0;

    return {
      oneRepMax,
      threeRepMax,
      fiveRepMax,
    };
  };

  // Function to group data by lift type
  const groupDataByLiftType = (data) => {
    return data.reduce((acc, entry) => {
      const liftType = entry.liftType;
      if (!acc[liftType]) {
        acc[liftType] = [];
      }
      acc[liftType].push(entry);
      return acc;
    }, {});
  };

  // Function to calculate max weights for each lift type
  const calculateMaxWeightsForLiftTypes = (data) => {
    const groupedData = groupDataByLiftType(data);

    const maxWeightsByLiftType = {};

    for (const liftType in groupedData) {
      if (groupedData.hasOwnProperty(liftType)) {
        maxWeightsByLiftType[liftType] = calculateMaxWeights(
          groupedData[liftType],
          liftType,
        );
      }
    }

    return maxWeightsByLiftType;
  };

  const maxWeightsByLiftType = calculateMaxWeightsForLiftTypes(parsedData);
  return maxWeightsByLiftType;
}
