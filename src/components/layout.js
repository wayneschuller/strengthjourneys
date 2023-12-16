/** @format */

"use client";
import { useState, useEffect, useContext } from "react";
import { ParsedDataContext } from "@/pages/_app";
import { parseData } from "@/lib/parse-data";
import { useSession, signIn, signOut } from "next-auth/react";
import { useUserLiftData } from "@/lib/use-userlift-data";
import {
  devLog,
  processTopLiftsByTypeAndReps,
  markHigherWeightAsHistoricalPRs,
  calculateLiftTypes,
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
import { useLocalStorage } from "usehooks-ts";

// We use these to only trigger toast announcements once
let demoToastInit = false;
let loadedToastInit = false;

export function Layout({ children }) {
  const {
    parsedData,
    setParsedData,
    setLiftTypes,
    setSelectedLiftTypes,
    setTopLiftsByTypeAndReps,
  } = useContext(ParsedDataContext);
  const { data: session, status } = useSession();
  const { data, isError, isLoading } = useUserLiftData();
  const [ssid, setSsid] = useLocalStorage("ssid", null);
  const [sheetURL, setSheetURL] = useLocalStorage("sheetURL", null);
  const [sheetFilename, setSheetFilename] = useLocalStorage(
    "sheetFilename",
    null,
  );
  const { toast } = useToast();
  const router = useRouter();
  const currentPath = router.asPath;

  // When userUserLiftData (useSWR) gives new Google sheet data, parse it
  // useSWR can ping google and cache it and it won't trigger here until data changes
  useEffect(() => {
    // devLog( `<Layout /> useEffect[data]: isLoading ${isLoading}, isError ${isError}`,);

    if (status === "loading") return; // Wait for auth. Don't prematurely go into demo mode
    if (isLoading) return; // Wait for useSWR. Don't prematurely go into demo mode

    // If data changes and we have isError then signOut
    // This is usually because our token has expired
    // FIXME: get Google refreshtokens working

    if (isError) {
      console.error(
        "Couldn't speak to Google. This is normally because it is more than one hour since you logged in. Automatically signing out. This will be fixed in a future version using refresh tokens",
      );

      devLog(data);
      toast({
        variant: "destructive",
        title: "Google Server Error",
        description: "Google servers denied access to selected sheet.",
      });
      demoToastInit = true; // Don't run another toast below and block this one

      // FIXME: this moment is tricky - if 1 hour has expired then we just want to log them out and let them log in again
      // However if the problem is access to google, then we ought to delete the ssid localstorage stuff so they can try another gsheet
      // Once we solve refreshtokens, then this kind of error should do the latter - delete ssid and stay logged in.

      // signOut(); // Sign out and return to demo mode (FIXME: Or some how stay logged in)
      return;
    }

    let parsedData = null; // A local version for this scope only

    if (status === "authenticated" && data?.values) {
      parsedData = parseData(data.values); // Will be sorted date ascending
      devLog(`this is here`);

      if (parsedData === null) {
        console.error(`Could not parse data. Please choose a different file.`);
        toast({
          variant: "destructive",
          title: "Data Parsing Error",
          description:
            "We could access the data but could not understand it. Please choose a different Google Sheet.",
        });
        demoToastInit = true; // Don't run another toast below and block this one

        // Forget their chosen file, we have access but we cannot parse it
        setSsid(null);
        setSheetFilename(null);
        setSheetURL(null);
        // Don't sign out, just go gracefully into demo mode below.
      }
    }

    // If there have been any problems we will switch into demo mode with sample data
    // FIXME: Logic is NQR, demo data should only be when unauthenticated
    if (!parsedData) parsedData = transposeDatesToToday(sampleParsedData, true); // Make demo mode data be recent

    // As far as possible try to get components to do their own unique processing of parsedData
    // However if there are metrics commonly needed we can do it here just once to save CPU later

    // Before we set parsedData there are a few other global
    // state variables everything needs.
    parsedData = markHigherWeightAsHistoricalPRs(parsedData);

    // Calculate our liftTypes basic stats array (sorted by most popular lift descending)
    const liftTypes = calculateLiftTypes(parsedData);
    setLiftTypes(liftTypes);

    // Check if selectedLifts exists in localStorage
    // When in demo mode (auth unauthenticated) we have a separate localstorage
    // FIXME: there is a bug here for a new user with only one type of lift data
    const localStorageKey = `selectedLifts${
      status === "unauthenticated" ? "_demoMode" : ""
    }`;
    let selectedLiftTypes = localStorage.getItem(localStorageKey);

    if (selectedLiftTypes !== null) {
      selectedLiftTypes = JSON.parse(selectedLiftTypes);
    } else {
      // Select a number of lift types as default, minimum of 4 or the length of liftTypes (we just calculated above)
      const numberOfDefaultLifts = Math.min(4, liftTypes.length);
      const defaultSelectedLifts = liftTypes
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
    // devLog(topLiftsByTypeAndReps);

    setParsedData(parsedData);
  }, [data, isLoading, isError, status]);

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
