"use client";

import { useContext, useState, useEffect, createContext } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useReadLocalStorage } from "usehooks-ts";
import { parseData } from "@/lib/parse-data";
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
import { useLocalStorage } from "usehooks-ts";
import { ToastAction } from "@/components/ui/toast";

// We use these to only trigger toast announcements once
let demoToastInit = false;
let loadedToastInit = false;

const UserLiftingDataContext = createContext();

export const useUserLiftingData = () => useContext(UserLiftingDataContext);

export const UserLiftingDataProvider = ({ children }) => {
  // These are our key global state variables.
  // Keep this as minimal as possible. Don't put things here that components could derive quickly
  // We do keep liftTypes (lift names and frequency) here as an exception to save processing it too often
  const [parsedData, setParsedData] = useState(null); // see @/lib/sample-parsed-data.js for data structure design
  const [liftTypes, setLiftTypes] = useState([]); // see @/lib/processing-utils.js for data structure design
  const [topLiftsByTypeAndReps, setTopLiftsByTypeAndReps] = useState(null); // see @/lib/processing-utils.js for data structure design
  const [selectedLiftTypes, setSelectedLiftTypes] = useState([]);

  const { data: session, status: authStatus } = useSession();
  const [ssid, setSsid] = useLocalStorage("ssid", null);
  const [sheetURL, setSheetURL] = useLocalStorage("sheetURL", null);
  const [sheetFilename, setSheetFilename] = useLocalStorage(
    "sheetFilename",
    null,
  );

  const { toast } = useToast();
  const router = useRouter();
  const currentPath = router.asPath;

  const shouldFetch = !!session?.accessToken && !!ssid;
  const accessToken = session?.accessToken;
  // Note: Don't put key or tokens in URI
  const apiURL = `https://sheets.googleapis.com/v3/spreadsheets/${ssid}/values/A:Z?dateTimeRenderOption=FORMATTED_STRING`;
  const { data, error, isLoading } = useSWR(
    shouldFetch ? apiURL : null,
    (url) => fetcherWithToken(url, accessToken), // Directly pass accessToken here
  );
  // if (error) devLog(`Local fetch to GSheet servers error: ${error}`);
  const isError = !!error; // FIXME: We could send back error details

  // When userUserLiftData (useSWR) gives new Google sheet data, parse it
  // useSWR can ping google and cache it and it won't trigger here until data changes
  useEffect(() => {
    devLog(
      `<Layout /> useEffect[data]: authStatus: ${authStatus}, isLoading ${isLoading}, isError ${isError}, data ${
        data ? "IS" : "is NOT"
      } ready.`,
    );

    if (authStatus === "loading") return; // Wait for auth. Don't prematurely go into demo mode
    if (isLoading) return; // Wait for useSWR. Don't prematurely go into demo mode

    // isError happens when Google decides they don't love us
    // There is an edge case where it will ping during token refresh and get a 401 error once
    // Checking for !data tends to step over this error
    if (isError && !data) {
      devLog(`useSWR isError from google...`);

      toast({
        variant: "destructive",
        title: "Uh oh! Something went wrong.",
        description: "Lift some weights and come back later.",
      });

      // Clear selected gsheet so they can try again
      setSsid(null);
      setSheetFilename(null);
      setSheetURL(null);
    }

    let parsedData = null; // A local version for this scope only

    if (authStatus === "authenticated" && data?.values) {
      parsedData = parseData(data.values); // Will be sorted date ascending

      if (parsedData !== null) {
        // We have some good data loaded - tell the user via toast
        // FIXME: why don't we check against the old parsedData.length or some other fast compare?
        // Sometimes the user does a minor change to a gsheet (add a line or an empty row) and it doesn't
        // deserve having the toast interrupt them.
        loadedToastInit = true; // Don't show this again
        const description = sheetFilename || "File name unknown";
        toast({
          title: "Data updated from Google Sheets",
          description: description,
        });

        if (typeof window !== "undefined") {
          window.gtag("event", "gSheetDataUpdated");
        }
      } else {
        // Parsing error. Tell the user.
        console.error(`Could not parse data. Please choose a different file.`);
        toast({
          variant: "destructive",
          title: "Data Parsing Error",
          description:
            "We could access the data but could not understand it. Please choose a different Google Sheet.",
        });
        demoToastInit = true; // Don't run another toast

        // Forget their chosen file, we have access but we cannot parse it
        setSsid(null);
        setSheetFilename(null);
        setSheetURL(null);
        // Don't sign out, just go gracefully into demo mode below.

        if (typeof window !== "undefined") {
          window.gtag("event", "gSheetReadRejected");
        }
      }
    }

    // If there have been any problems we will switch into demo mode with sample data
    // FIXME: Logic is NQR, demo data should only be when unauthenticated
    // FIXME: if we are committing to demo mode then do the demo toast here and not in a separate useEffect
    if (!parsedData) parsedData = transposeDatesToToday(sampleParsedData, true); // Transpose demo dates to recent, add jitter

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
    const localStorageKey = `selectedLifts${
      authStatus === "unauthenticated" ? "_demoMode" : ""
    }`;
    let selectedLiftTypes = localStorage.getItem(localStorageKey);

    // Attempt to parse selectedLiftTypes from localStorage, or fall back to null if unavailable
    selectedLiftTypes = selectedLiftTypes
      ? JSON.parse(selectedLiftTypes)
      : null;

    // Check if selectedLiftTypes is not null and has elements after filtering; otherwise, set defaults
    if (!selectedLiftTypes || !selectedLiftTypes.length) {
      // Define the number of default lift types to select, with a minimum of 4 or the total number available
      const defaultSelectionCount = Math.min(4, liftTypes.length);
      // Select default lift types based on the calculated liftTypes array
      selectedLiftTypes = liftTypes
        .slice(0, defaultSelectionCount)
        .map((lift) => lift.liftType);

      // Log and update localStorage with the default selected lift types
      devLog(
        `Localstorage selectedLifts not found or invalid! Setting defaults for auth status ${authStatus}:`,
        selectedLiftTypes,
      );
      localStorage.setItem(localStorageKey, JSON.stringify(selectedLiftTypes));
    } else {
      // Filter existing selectedLiftTypes to ensure they are all valid based on the current liftTypes data
      selectedLiftTypes = selectedLiftTypes.filter((selectedLift) =>
        liftTypes.some((lift) => lift.liftType === selectedLift),
      );

      // If filtering removes all items, revert to default selection logic
      if (selectedLiftTypes.length === 0) {
        const defaultSelectionCount = Math.min(4, liftTypes.length);
        selectedLiftTypes = liftTypes
          .slice(0, defaultSelectionCount)
          .map((lift) => lift.liftType);

        // Log and update localStorage with the default selected lift types
        devLog(
          `Filtered selectedLifts resulted in an empty array. Setting defaults for auth status ${authStatus}:`,
          selectedLiftTypes,
        );
        localStorage.setItem(
          localStorageKey,
          JSON.stringify(selectedLiftTypes),
        );
      }
    }

    // Now set it in state for useContext usage throughout the components
    setSelectedLiftTypes(selectedLiftTypes);

    // Critical PR processing
    const topLiftsByTypeAndReps = processTopLiftsByTypeAndReps(parsedData);
    setTopLiftsByTypeAndReps(topLiftsByTypeAndReps);
    // devLog(topLiftsByTypeAndReps);

    setParsedData(parsedData);
  }, [data, isLoading, isError, authStatus]);

  // useEffect for reminding the user when Analyzer/Visualizer show demo data
  // FIXME: this could be integrated into the main useEffect above
  useEffect(() => {
    // devLog(`<Layout /> Toast useEffect`);

    if (authStatus === "loading") return;

    // Check if the current path is "/visualizer" or "/analyzer"
    const isVisualizerRoute = currentPath === "/visualizer";
    const isAnalyzerRoute = currentPath === "/analyzer";

    if (!isVisualizerRoute && !isAnalyzerRoute) return; // Don't show toast on generic pages like Timer

    // Tell the user when demo mode has started
    if (!demoToastInit && authStatus === "unauthenticated") {
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
  }, [authStatus, router]);

  return (
    <UserLiftingDataContext.Provider
      value={{
        isLoading,
        isError,
        liftTypes,
        selectedLiftTypes,
        setSelectedLiftTypes,
        parsedData,
        topLiftsByTypeAndReps,
      }}
    >
      {children}
    </UserLiftingDataContext.Provider>
  );
};

// ----------------------------------------------------------------------------------------------------------
// Some code to fetch gsheet API from pure client without a Next.js API route
// Modified fetcher to include the access token in the headers
// ----------------------------------------------------------------------------------------------------------
async function fetcherWithToken(url, token) {
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      // This will capture HTTP errors such as 400, 403, 404, etc.
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    // Here, we catch both network errors and the errors thrown above for HTTP status checks
    throw error;
  }
}
