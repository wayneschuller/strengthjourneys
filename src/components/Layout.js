/** @format */

"use client";
import Navbar from "./NavBar";
import Footer from "@/components/Footer";
import { SessionProvider } from "next-auth/react";
import { useState, useEffect, useContext } from "react";
import { ParsedDataContext } from "@/pages/_app";
import { parseGSheetData } from "@/lib/parseGSheetData";
import { useSession, signIn, signOut } from "next-auth/react";
import useUserLiftData from "@/lib/useUserLiftData";
import { devLog } from "@/lib/SJ-utils";
import { sampleParsedData } from "@/lib/sampleParsedData";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useRouter } from "next/router";
import { useReadLocalStorage } from "usehooks-ts";

let demoToastInit = false;
let loadedToastInit = false;

export function Layout({ children }) {
  const {
    parsedData,
    setParsedData,
    ssid,
    setSsid,
    isDemoMode,
    setIsDemoMode,
    liftTypes,
    setLiftTypes,
    selectedLiftTypes,
    setSelectedLiftTypes,
  } = useContext(ParsedDataContext);
  const { data: session } = useSession();
  const { data, isError, isLoading } = useUserLiftData(session, ssid);
  const sheetFilename = useReadLocalStorage("sheetFilename");
  const { toast } = useToast();
  const router = useRouter();
  const currentPath = router.asPath;

  // When userUserLiftData (useSWR) gives new Google sheet data, parse it
  // useSWR can ping google and cache it and it won't trigger here until data changes
  useEffect(() => {
    // devLog(`<Layout /> useEffect[data]: isError is ${isError}`);
    // devLog(data);

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

    let parsedData = null; // A local parsedData for this scope only

    // Get some parsedData
    if (data?.values) {
      parsedData = parseGSheetData(data.values);

      // FIXME: here is the point to check for parsing failures and go to demomode.

      setIsDemoMode(false);
    } else {
      parsedData = sampleParsedData;
      setIsDemoMode(true);
    }

    // Before we set parsedData there are a few other global
    // state variables everything needs.

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

    // Retrieve selectedLifts from localStorage (there are two versions for demo data and user data)
    const localStorageKey = `selectedLifts${isDemoMode ? "_demoMode" : ""}`;
    const selectedLifts = localStorage.getItem(localStorageKey);

    // Check if data exists in localStorage before parsing
    if (selectedLifts !== null) {
      // Parse and set data in the state
      const parsedSelectedLifts = JSON.parse(selectedLifts);
      devLog(`LocalStorage (${localStorageKey}):`);
      devLog(parsedSelectedLifts);
      setSelectedLiftTypes(parsedSelectedLifts);
    } else {
      // Select a number of lift types as default, minimum of 4 or the length of sortedLiftTypes
      devLog(`Setting some default selected lifts`);
      const numberOfDefaultLifts = Math.min(4, sortedLiftTypes.length);
      const defaultSelectedLifts = sortedLiftTypes
        .slice(0, numberOfDefaultLifts)
        .map((lift) => lift.liftType);

      // Set default selected lifts
      setSelectedLiftTypes(defaultSelectedLifts);
    }

    setParsedData(parsedData);
  }, [data, isError]);

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
    if (
      !loadedToastInit &&
      !isLoading &&
      ssid &&
      session?.user &&
      parsedData?.length !== 0
    ) {
      loadedToastInit = true; // Don't show this again

      const description = sheetFilename || "File name unknown";

      toast({
        title: "Data loaded from Google Sheets",
        description: description,
      });
      return;
    }
  }, [session, isLoading, parsedData, router]);

  return (
    <>
      <Navbar />
      <main className={`mt-4 flex justify-center`}>{children}</main>
      <Footer />
    </>
  );
}
