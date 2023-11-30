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

  const achievementsArray = analyzerProcessParsedData(localParsedData);

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
              {achievementsArray.map((entry) => (
                <LiftAchievements
                  key={entry.liftType}
                  liftType={entry.liftType}
                  entry={entry}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
export default Analyzer;

const LiftAchievements = ({ liftType, entry }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{liftType} Achievements</CardTitle>
        {/* <CardDescription>Card Description</CardDescription> */}
      </CardHeader>
      <CardContent>
        <p>Total lifts: {entry.totalLifts}</p>
      </CardContent>
    </Card>
  );
};

// This function uniquely processes the parsed Data for the Analyzer
// So it lives here in the <Analyzer /> component
function analyzerProcessParsedData(parsedData) {
  if (parsedData === null) {
    console.log(`Error: analyzerProcessParsedData passed null.`);
    return;
  }

  const liftTypeCounts = {};

  // Count the number of tuples for each lift type
  parsedData.forEach((entry) => {
    const { liftType } = entry;

    if (!liftTypeCounts[liftType]) {
      liftTypeCounts[liftType] = 0;
    }

    liftTypeCounts[liftType]++;
  });

  // Convert the liftTypeCounts object to an array of objects
  const achievementsArray = Object.entries(liftTypeCounts).map(
    ([liftType, totalLifts]) => ({
      liftType,
      totalLifts,
    }),
  );

  // Sort the array by totalLifts in descending order
  achievementsArray.sort((a, b) => b.totalLifts - a.totalLifts);

  console.log(achievementsArray);

  // Function to get the best five lifts for a specific lift type and reps
  const bestFiveLifts = (data, liftType, reps) => {
    const filteredData = data.filter(
      (entry) => entry.liftType === liftType && entry.reps === reps,
    );

    // Sort the filtered data by weight in descending order
    filteredData.sort((a, b) => b.weight - a.weight);

    // Take the top five entries
    const topFive = filteredData.slice(0, 5);

    return topFive;
  };

  return achievementsArray;
}
