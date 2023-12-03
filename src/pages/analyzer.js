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
import { cn } from "@/lib/utils";

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
            <Card>
              <CardHeader>
                <CardTitle className="hidden md:block">
                  Two Years of Activity
                </CardTitle>
                <CardTitle className="block md:hidden">
                  Six Months of Activity
                </CardTitle>
                {/* <CardDescription>Card Description</CardDescription> */}
              </CardHeader>
              <CardContent>
                {/* <div className="block md:hidden">
                  <Heatmap
                    parsedData={localParsedData}
                    bestSets={bestSets}
                    months={6}
                  />
                </div> */}
                <div className="hidden md:block">
                  <Heatmap
                    parsedData={localParsedData}
                    bestSets={bestSets}
                    months={24}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="xl:col-span-2">
            <OverviewAchievements
              parsedData={localParsedData}
              recentBestSets={recentBestSets}
              maxRows={10}
            />
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
  const displayedEntries = recentBestSets.slice(0, maxRows);

  return (
    <div>
      <ul className="best-set-list">
        {displayedEntries.map((entry, index) => (
          <li key={`bestSet-${index}`} className="best-set-entry">
            <p>{`${entry.liftType}: ${entry.reps}@${entry.weight}kg (${
              entry.date
            }) ${getCelebrationEmoji(entry.position)} #${
              entry.position + 1
            } best ${entry.reps}RM ${entry.liftType} ever.`}</p>
            {/* Display other fields from the entry as needed */}
          </li>
        ))}
      </ul>
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
