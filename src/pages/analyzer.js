"use client";

import Head from "next/head";
import { useContext, useState, useEffect } from "react";
import { useSession, signIn } from "next-auth/react";
import useUserLiftData from "@/lib/useUserLiftData";
import { ParsedDataContext } from "@/pages/_app";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import useDrivePicker from "@fyelci/react-google-drive-picker";
import { parseGSheetData } from "@/lib/parseGSheetData";
import { sampleParsedData } from "@/lib/sampleParsedData";
import { devLog } from "@/lib/devLog";
import InspirationCard from "@/components/InspirationCard";
import { Skeleton } from "@/components/ui/skeleton";
import InstructionsCard from "@/components/InstructionsCard";
import LiftAchievementsCard from "@/components/LiftAchievementsCard";

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
import Heatmap from "@/components/heatmaps";
import { Separator } from "@/components/ui/separator";
import LiftChooserComboMenu from "@/components/LiftChooserComboMenu";

let didInit = false;

const Analyzer = () => {
  const [liftTypes, setLiftTypes] = useState([]);
  const [liftTypesSelected, setLiftTypesSelected] = useState([]);
  const { parsedData, setParsedData, ssid, setSsid } =
    useContext(ParsedDataContext);
  const { data: session } = useSession();
  const { data, isError, isLoading } = useUserLiftData(session, ssid);

  // Now declare all our local variables that show computable derivable stuff
  let localParsedData = null;
  let achievementsArray = [];

  // FIXME: we need a useEffect for:
  // - loading localstorage into selected
  // - saving to localstorage when setSelected called? (or do via wrapper)
  // - loading the lift options into the combo menu from user data

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

    devLog(`localParsedData:`);
    devLog(localParsedData);
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
    // We need this for the fancy multi select
    const liftTypeFrequency = {};
    localParsedData.forEach((lifting) => {
      const liftType = lifting.liftType;
      liftTypeFrequency[liftType] = (liftTypeFrequency[liftType] || 0) + 1;
    });

    // Create an array of objects with value property for the multi-select
    const sortedLiftTypes = Object.keys(liftTypeFrequency)
      .sort((a, b) => liftTypeFrequency[b] - liftTypeFrequency[a])
      .map((liftType) => ({ value: liftType, label: liftType }));

    // console.log(sortedLiftTypes);

    setLiftTypes(sortedLiftTypes);
  }, [data]);

  if (!isLoading && session?.user && !data?.values)
    return (
      <div className="mt-5 flex flex-1 flex-row justify-center align-middle md:mt-10">
        <InstructionsCard session={session} />
      </div>
    );

  // devLog(`Achivements array:`);
  // devLog(achievementsArray);
  devLog(liftTypesSelected);

  const bestSets = processBestSets(localParsedData); // Collect the top 5 of each rep scheme 1..10
  // devLog(`Best sets:`);
  // devLog(bestSets);

  const recentBestSets = getRecentBestSets(bestSets); // Have they done any this month?
  // devLog(`Recent best sets:`);
  // devLog(recentBestSets);

  // FIXME: try to refactor this JSX to breakdown each unique Card to separate components

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
                {!isLoading && (
                  <Heatmap
                    parsedData={parsedData}
                    bestSets={bestSets}
                    months={24}
                  />
                )}
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
              <OverviewAchievements
                parsedData={localParsedData}
                recentBestSets={recentBestSets}
                maxRows={10}
              />
            )}
          </div>
          <div className="xl:col-span-2">
            <InspirationCard />
          </div>
          {/* {!session && !parsedData && <div> You need to sign in. </div>} */}
          <Separator className="md:col-span-2 xl:col-span-4" />
          <div className="md:col-span-2 xl:col-span-4">
            <LiftChooserComboMenu
              placeholder={"Choose lift types"}
              selected={liftTypesSelected}
              setSelected={setLiftTypesSelected}
              menuOptions={liftTypes}
            />
          </div>
          {liftTypesSelected.map((lift) => (
            <LiftAchievementsCard
              key={lift.value}
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

const OverviewAchievements = ({ parsedData, recentBestSets, maxRows }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>This Month{"'"}s Highlights</CardTitle>
        {/* <CardDescription>Card Description</CardDescription> */}
      </CardHeader>
      <CardContent>
        <BestSetDisplay recentBestSets={recentBestSets} maxRows={maxRows} />
      </CardContent>
    </Card>
  );
};

// Array of 20 celebration emojis to display based on PR position
function getCelebrationEmoji(position) {
  const positionEmojis = [
    "\u{1F947}", // 🥇 Gold Medal (1st place)
    "\u{1F948}", // 🥈 Silver Medal (2nd place)
    "\u{1F949}", // 🥉 Bronze Medal (3rd place)
    "\u{1F4AA}", // 💪 Flexed Biceps
    "\u{1F44C}", // 👌 OK Hand Sign
    "\u{1F44F}", // 👏 Clapping Hands
    "\u{1F3C6}", // 🏆 Trophy
    "\u{1F525}", // 🔥 Fire
    "\u{1F4AF}", // 💯 Hundred Points Symbol
    "\u{1F929}", // 🤩 Star-Struck
    "\u{1F389}", // 🎉 Party Popper
    "\u{1F44D}", // 👍 Thumbs Up
    "\u{1F381}", // 🎁 Wrapped Gift
    "\u{1F60D}", // 😍 Heart Eyes
    "\u{1F389}", // 🎉 Party Popper
    "\u{1F60A}", // 😊 Smiling Face with Smiling Eyes
    "\u{1F604}", // 😄 Grinning Face with Smiling Eyes
    "\u{1F60B}", // 😋 Face Savoring Food
    "\u{1F973}", // 🥳 Partying Face
    "\u{1F609}", // 😉 Winking Face
  ];

  return positionEmojis[position];
}

const BestSetDisplay = ({ recentBestSets, maxRows }) => {
  if (!recentBestSets) return null;
  const displayedEntries = recentBestSets.slice(0, maxRows);

  // FIXME: I don't like how this map creates multiple grids rather than placing
  // them all in one grid.
  return (
    <div>
      {displayedEntries.map((entry, index) => (
        <div key={`bestSet-${index}`} className="mb-4 grid grid-cols-3 lg:mb-0">
          <div>{entry.liftType}:</div>
          <div className="flex flex-col xl:flex-row xl:gap-1">
            <div className="font-semibold">
              {entry.reps}@{entry.weight}kg
            </div>
            <div>({getReadableDateString(entry.date)})</div>
          </div>

          <div className="col-span-1">
            {getCelebrationEmoji(entry.position)} #{entry.position + 1} best{" "}
            {entry.reps}RM ever.
          </div>
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
  if (!parsedData) return null;

  const bestSets = {};

  parsedData.forEach((entry) => {
    const { liftType, reps, weight, date } = entry;

    if (reps >= 1 && reps <= 10) {
      if (!bestSets[liftType]) {
        bestSets[liftType] = {};
      }

      if (!bestSets[liftType][reps]) {
        bestSets[liftType][reps] = [];
      }

      // Check if an entry with the same date, reps, and weight already exists
      const existingEntryIndex = bestSets[liftType][reps].findIndex(
        (existingEntry) =>
          existingEntry.date === date && existingEntry.weight === weight,
      );

      if (existingEntryIndex !== -1) {
        // If it exists, replace the existing entry
        // This is because we want to put the final set as the PR set
        bestSets[liftType][reps][existingEntryIndex] = entry;
      } else {
        // If it doesn't exist, add the new entry
        bestSets[liftType][reps].push(entry);
      }

      // Sort the bestSets array by weight in descending order and keep only the top 20 lifts
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
        ...bestSets[liftType][reps]
          .map((entry, index) => {
            // Assuming each entry has a 'date' property
            const entryDate = new Date(entry.date);

            // Check if the entry date is within the last 30 days
            const daysDifference = Math.ceil(
              (currentDate - entryDate) / (1000 * 60 * 60 * 24),
            );

            return daysDifference <= 30
              ? { ...entry, position: index } // Add the position field
              : null; // Skip entries that don't meet the criteria
          })
          .filter(Boolean), // Remove null entries
      );
    });
  });

  // Sort entries by position, reps and date
  recentEntries.sort((a, b) => {
    // Sort by position in ascending order
    if (a.position !== b.position) {
      return a.position - b.position;
    }

    // If positions are equal, sort by reps in ascending order
    if (a.reps !== b.reps) {
      return a.reps - b.reps;
    }

    // If both position and reps are equal, sort by date in descending order
    return new Date(b.date) - new Date(a.date);
  });

  return recentEntries;
};

// Convert ISO "YYYY-MM-DD" to readable date string
export function getReadableDateString(ISOdate) {
  let date = new Date(ISOdate);

  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const monthNamesFull = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const day = date.getDate();
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();

  let dateString = `${month} ${day}`;
  const currentYear = new Date().getFullYear();

  // Include the year only if it's not the current year
  if (year !== currentYear) {
    dateString += `, ${year}`;
  }

  return dateString;
}
