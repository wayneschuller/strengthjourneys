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
      // console.log(parsedData);
    } else {
      localParsedData = parsedData;
    }
  } else {
    localParsedData = sampleParsedData;
  }

  // Get the giant object of achivements["Back Squat"] which contains interesting statistics
  // Convert to array
  const achievementsArray = Object.values(
    analyzerProcessParsedData(localParsedData),
  );

  // Sort the array by totalSets in descending order
  achievementsArray.sort((a, b) => b.totalSets - a.totalSets);

  const bestSets = processBestSets(localParsedData); // Collect the top 5 of each rep scheme 1..10
  console.log(`Best sets:`, bestSets);

  const recentBestSets = getRecentBestSets(bestSets); // Have they done any this month?
  console.log(`Recent best sets:`, recentBestSets);

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
            <OverviewAchievements recentBestSets={recentBestSets} />
          </div>
          {/* {!session && !parsedData && <div> You need to sign in. </div>} */}

          {achievementsArray.map((entry) => (
            <LiftAchievements
              key={entry.liftType}
              liftType={entry.liftType}
              entry={entry}
              bestSets={bestSets[entry.liftType]}
            />
          ))}
        </div>
      </div>
    </>
  );
};
export default Analyzer;

const OverviewAchievements = ({ recentBestSets }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Big Picture</CardTitle>
        {/* <CardDescription>Card Description</CardDescription> */}
      </CardHeader>
      <CardContent>
        <div>
          {Object.keys(recentBestSets).map((liftType) =>
            Object.keys(recentBestSets[liftType]).map((reps) => (
              <BestSetDisplay
                key={`${liftType}-${reps}`}
                liftType={liftType}
                reps={reps}
                recentBestSets={recentBestSets}
              />
            )),
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const LiftAchievements = ({ liftType, entry, bestSets }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{liftType} Achievements</CardTitle>
        {/* <CardDescription>Card Description</CardDescription> */}
      </CardHeader>
      <CardContent>
        <div>
          Total reps: {entry.totalReps}. Total sets: {entry.totalSets}.{" "}
        </div>
        <div>First lift: {entry.oldestDate}</div>
        <div>Most recent lift: {entry.newestDate}</div>

        {bestSets?.["1"]?.[0] && (
          <div>
            Best single: {bestSets["1"][0].weight}
            {bestSets["1"][0].unitType} ({bestSets["1"][0].date})
          </div>
        )}

        {bestSets?.["3"]?.[0] && (
          <div>
            Best triple: {bestSets["3"][0].weight}
            {bestSets["3"][0].unitType} ({bestSets["3"][0].date})
          </div>
        )}

        {bestSets?.["5"]?.[0] && (
          <div>
            Best 5RM: {bestSets["5"][0].weight}
            {bestSets["5"][0].unitType} ({bestSets["5"][0].date})
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const BestSetDisplay = ({ liftType, reps, recentBestSets }) => {
  return (
    <div>
      {recentBestSets.map((entry, index) => (
        <div key={index} className="best-set-entry">
          <p>{`${entry.liftType}: ${entry.reps}@${entry.weight}kg (${entry.date})`}</p>
          {/* Display other fields from the entry as needed */}
          {/* Example: <p>{`🥇 #${index + 1} best 1RM ${entry.liftType} ever.`}</p> */}
        </div>
      ))}
    </div>
  );
};

// This function uniquely processes the parsed Data for the Analyzer
// So it lives here in the <Analyzer /> component
// We build an achievements object which will contain interesting stats per lift. e.g.: achievements["Back Squat"]
function analyzerProcessParsedData(parsedData) {
  if (parsedData === null) {
    console.log(`Error: analyzerProcessParsedData passed null.`);
    return;
  }

  // Initialize the 'achievements' object
  const achievements = {};

  // Iterate through the data array to calculate totalReps and totalSets for each liftType
  parsedData.forEach((entry) => {
    const { liftType, reps, date } = entry;

    if (!achievements[liftType]) {
      // If the liftType doesn't exist in achievements, initialize it
      achievements[liftType] = {
        liftType,
        totalReps: 0,
        totalSets: 0,
        oldestDate: date,
        newestDate: date,
      };
    }

    achievements[liftType].totalReps += reps;
    achievements[liftType].totalSets += 1;

    // Update oldestDate and newestDate for the current liftType
    if (date < achievements[liftType].oldestDate) {
      achievements[liftType].oldestDate = date;
    }

    if (date > achievements[liftType].newestDate) {
      achievements[liftType].newestDate = date;
    }
  });

  return achievements;
}

const processBestSets = (parsedData) => {
  // Initialize the 'bestLifts' object to store the best five lifts for each liftType and rep value
  const bestSets = {};

  // Iterate through the data array to identify the best five lifts for each liftType and rep value
  parsedData.forEach((entry) => {
    const { liftType, reps, weight } = entry;

    // Ensure the rep value is within the range [1, 10]
    if (reps >= 1 && reps <= 10) {
      // If the liftType doesn't exist in bestLifts, initialize it
      if (!bestSets[liftType]) {
        bestSets[liftType] = {};
      }

      // If the rep value doesn't exist for the current liftType, initialize it
      if (!bestSets[liftType][reps]) {
        bestSets[liftType][reps] = [];
      }

      // Add the current lift entry to the bestLifts array for the current liftType and rep value
      bestSets[liftType][reps].push(entry);

      // Sort the bestLifts array by weight in descending order and keep only the top 20 lifts
      bestSets[liftType][reps] = bestSets[liftType][reps]
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 20);
    }
  });

  return bestSets;
};

const getRecentBestSets = (bestSets) => {
  if (!bestSets) return;

  // Get the current date
  const currentDate = new Date();

  // Flatten and filter entries within the last 30 days
  const recentEntries = [];

  // Iterate through lift types
  Object.keys(bestSets).forEach((liftType) => {
    // Iterate through reps for each lift type
    Object.keys(bestSets[liftType]).forEach((reps) => {
      recentEntries.push(
        ...bestSets[liftType][reps].filter((entry) => {
          // Assuming each entry has a 'date' property
          const entryDate = new Date(entry.date);

          // Check if the entry date is within the last 30 days
          const daysDifference = Math.ceil(
            (currentDate - entryDate) / (1000 * 60 * 60 * 24),
          );

          return daysDifference <= 30;
        }),
      );
    });
  });

  // Sort entries by date in descending order
  recentEntries.sort((a, b) => new Date(b.date) - new Date(a.date));

  return recentEntries;
};
