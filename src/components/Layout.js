/** @format */

"use client";
import Navbar from "@/components/NavBar";
import { Footer } from "@/components/footer";
import { useState, useEffect, useContext } from "react";
import { ParsedDataContext } from "@/pages/_app";
import { parseGSheetData } from "@/lib/parseGSheetData";
import { useSession, signIn, signOut } from "next-auth/react";
import useUserLiftData from "@/lib/useUserLiftData";
import { devLog, processTopLiftsByTypeAndReps } from "@/lib/SJ-utils";
import { sampleParsedData } from "@/lib/sampleParsedData";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useRouter } from "next/router";
import { useReadLocalStorage } from "usehooks-ts";
import { markHigherWeightAsHistoricalPRs } from "@/lib/SJ-utils";

let demoToastInit = false;
let loadedToastInit = false;

export function Layout({ children }) {
  const {
    parsedData,
    setParsedData,
    ssid,
    setIsDemoMode,
    setLiftTypes,
    setSelectedLiftTypes,
    setTopLiftsByTypeAndReps,
  } = useContext(ParsedDataContext);
  const { data: session } = useSession();
  const { data, isError, isLoading } = useUserLiftData();
  const sheetFilename = useReadLocalStorage("sheetFilename");
  const { toast } = useToast();
  const router = useRouter();
  const currentPath = router.asPath;

  // When userUserLiftData (useSWR) gives new Google sheet data, parse it
  // useSWR can ping google and cache it and it won't trigger here until data changes
  useEffect(() => {
    // devLog( `<Layout /> useEffect[data]: isLoading ${isLoading}, isError ${isError}`,);
    // devLog(data);

    if (isLoading) return; // Give useSWR a chance to find data

    // if (data === undefined) return;

    // If data changes and we have isError then signOut
    // This is usually because our token has expired
    // FIXME: get Google refreshtokens working
    if (isError) {
      console.log(
        "Couldn't speak to Google. This is normally because it is more than one hour since you logged in. Automatically signing out. This will be fixed in a future version using refresh tokens",
      );
      devLog(data);
      signOut();
      setIsDemoMode(true); // Go to demo mode when auto signing out
      // FIXME Actually we could keep going with the logic below to get demo mode parsedData etc.
      return;
    }

    let parsedData = null; // A local version for this scope only
    let isDemoMode = true; // A local version for this scope only

    if (data?.values) {
      // This always means new or changed data.
      parsedData = parseGSheetData(data.values); // Will be sorted date ascending

      // FIXME: here is the point to check for parsing failures and go to demomode.
      isDemoMode = false;
      setIsDemoMode(isDemoMode);
    } else {
      parsedData = sampleParsedData;
      isDemoMode = true;
      setIsDemoMode(isDemoMode);
    }

    // As far as possible try to get components to do their own unique processing of parsedData
    // However if there are metrics commonly needed we can do it here once to save CPU

    // Before we set parsedData there are a few other global
    // state variables everything needs.
    parsedData = markHigherWeightAsHistoricalPRs(parsedData);

    // Count the frequency of each liftType
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

    // Check if selectedLifts exists in localStorage
    // Instead of useLocalStorage we roll our own because of the unique default generation
    // There are two localStorage keys for selectedLifts: demo data and user data
    const localStorageKey = `selectedLifts${isDemoMode ? "_demoMode" : ""}`;
    let selectedLiftTypes = localStorage.getItem(localStorageKey);

    if (selectedLiftTypes !== null) {
      selectedLiftTypes = JSON.parse(selectedLiftTypes);
    } else {
      // Select a number of lift types as default, minimum of 4 or the length of sortedLiftTypes
      const numberOfDefaultLifts = Math.min(4, sortedLiftTypes.length);
      const defaultSelectedLifts = sortedLiftTypes
        .slice(0, numberOfDefaultLifts)
        .map((lift) => lift.liftType);

      devLog(
        `Localstorage selectedLifts not found! (demomode is ${isDemoMode}). Setting:`,
      );
      devLog(defaultSelectedLifts);

      // Set the new default selected lifts in localStorage
      localStorage.setItem(
        localStorageKey,
        JSON.stringify(defaultSelectedLifts),
      );
      selectedLiftTypes = defaultSelectedLifts;
    }

    // Now set it in state for useContext usage throughout the components
    setSelectedLiftTypes(selectedLiftTypes);

    // Critical PR processing
    const topLiftsByTypeAndReps = processTopLiftsByTypeAndReps(
      parsedData,
      selectedLiftTypes,
    );
    setTopLiftsByTypeAndReps(topLiftsByTypeAndReps);

    devLog(`Layout useEffect setParsedData()`);
    setParsedData(parsedData);
  }, [data, isLoading, isError]);

  // useEffect for showing toast instructions on key state changes
  useEffect(() => {
    // devLog(`<Layout /> Toast useEffect`);
    // devLog(session);

    // Check if the current path is "/visualizer" or "/analyzer"
    const isVisualizerRoute = currentPath === "/visualizer";
    const isAnalyzerRoute = currentPath === "/analyzer";

    if (!isVisualizerRoute && !isAnalyzerRoute) return; // Don't show toast on generic pages like Timer

    // session starts undefined, but if they are not logged in it just becomes null
    if (session === undefined) return;

    // Tell the user when demo mode has started
    if (!demoToastInit && session === null) {
      demoToastInit = true; // Don't show this again

      toast({
        title: "Demo Mode",
        description:
          "Sign in via Google to visualize your personal Google Sheet lifting data.",
        action: (
          <ToastAction altText="Google Login" onClick={() => signIn("google")}>
            Google Sign in
          </ToastAction>
        ),
      });
      return;
    }

    // Tell the user when data is loaded
    // FIXME: not working
    // FIXME: if they have some PRs TODAY, show them a reward toast with confetti instead
    // parsedData?.length !== 0
    if (!loadedToastInit && !isLoading && ssid && session?.user) {
      loadedToastInit = true; // Don't show this again

      const description = sheetFilename || "File name unknown";

      toast({
        title: "Data loaded from Google Sheets",
        description: description,
      });
      return;
    }
  }, [session, isLoading, router]);

  return (
    <>
      <Navbar />
      <main className={`mt-4 flex justify-center`}>{children}</main>
      <Footer />
    </>
  );
}
