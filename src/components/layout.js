/** @format */

"use client";
import { useState, useEffect, useContext } from "react";
import { ParsedDataContext } from "@/pages/_app";
import { parseGSheetData } from "@/lib/parse-gsheet-data";
import { useSession, signIn, signOut } from "next-auth/react";
import { useUserLiftData } from "@/lib/use-userlift-data";
import {
  devLog,
  processTopLiftsByTypeAndReps,
  markHigherWeightAsHistoricalPRs,
} from "@/lib/processing-utils";
import {
  sampleParsedData,
  transposeDatesToToday,
} from "@/lib/sample-parsed-data";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { NavBar } from "@/components/nav-bar";
import { Footer } from "@/components/footer";
import { useRouter } from "next/router";
import { useReadLocalStorage } from "usehooks-ts";

// We use these to only trigger toast announcements once
let demoToastInit = false;
let loadedToastInit = false;

export function Layout({ children }) {
  const {
    parsedData,
    setParsedData,
    ssid,
    setLiftTypes,
    setSelectedLiftTypes,
    setTopLiftsByTypeAndReps,
  } = useContext(ParsedDataContext);
  const { data: session, status } = useSession();
  const { data, isError, isLoading } = useUserLiftData();
  const sheetFilename = useReadLocalStorage("sheetFilename");
  const { toast } = useToast();
  const router = useRouter();
  const currentPath = router.asPath;

  // When userUserLiftData (useSWR) gives new Google sheet data, parse it
  // useSWR can ping google and cache it and it won't trigger here until data changes
  useEffect(() => {
    // devLog( `<Layout /> useEffect[data]: isLoading ${isLoading}, isError ${isError}`,);

    if (isLoading) return; // Give useSWR a chance to find data

    // If data changes and we have isError then signOut
    // This is usually because our token has expired
    // FIXME: get Google refreshtokens working
    if (isError) {
      console.log(
        "Couldn't speak to Google. This is normally because it is more than one hour since you logged in. Automatically signing out. This will be fixed in a future version using refresh tokens",
      );
      devLog(data);
      signOut();
      // FIXME Actually we could keep going with the logic below to get demo mode parsedData etc.
      return;
    }

    let parsedData = null; // A local version for this scope only

    if (data?.values) {
      // This always means new or changed data.
      parsedData = parseGSheetData(data.values); // Will be sorted date ascending

      // FIXME: signOut and delete ssid if they get parsing errors
    } else {
      // FIXME: it would be interesting to randomise the sample data a little here

      parsedData = transposeDatesToToday(sampleParsedData); // Make demo mode data be recent
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
    // When in demo mode (auth unauthenticated) we have a separate localstorage
    const localStorageKey = `selectedLifts${
      status === "unauthenticated" ? "_demoMode" : ""
    }`;
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
        `Localstorage selectedLifts not found! (auth status is ${status}). Setting:`,
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

    // devLog(`Layout useEffect setParsedData()...`);
    setParsedData(parsedData);
  }, [data, isLoading, isError]);

  // useEffect for showing toast instructions on key state changes
  useEffect(() => {
    // devLog(`<Layout /> Toast useEffect`);

    if (status === "loading") return;

    // Check if the current path is "/visualizer" or "/analyzer"
    const isVisualizerRoute = currentPath === "/visualizer";
    const isAnalyzerRoute = currentPath === "/analyzer";

    if (!isVisualizerRoute && !isAnalyzerRoute) return; // Don't show toast on generic pages like Timer

    // Tell the user when demo mode has started
    if (!demoToastInit && status === "unauthenticated") {
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
    // FIXME: if they have some PRs TODAY, show them a reward toast with confetti instead
    if (
      !loadedToastInit &&
      status === "authenticated" &&
      ssid &&
      parsedData?.length > 0
    ) {
      loadedToastInit = true; // Don't show this again

      const description = sheetFilename || "File name unknown";

      toast({
        title: "Data loaded from Google Sheets",
        description: description,
      });
      return;
    }
  }, [status, parsedData, router]);

  return (
    <>
      <NavBar />
      {/* Below is where we set global x margins for all pages */}
      <main className="mx-4 mt-4 flex justify-center xl:mx-10">{children}</main>
      <Footer />
    </>
  );
}
