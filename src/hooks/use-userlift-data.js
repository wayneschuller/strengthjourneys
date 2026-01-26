"use client";

import { useContext, useState, useEffect, createContext, useMemo } from "react";
import { useRouter } from "next/router";
import { useSession, signIn } from "next-auth/react";
import useSWR from "swr";
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
import { useToast } from "@/hooks/use-toast";
import { useLocalStorage } from "usehooks-ts";
import { ToastAction } from "@/components/ui/toast";
import {
  format,
  isToday,
  parseISO,
  differenceInDays,
  differenceInWeeks,
  differenceInMonths,
  differenceInYears,
} from "date-fns";

const fetcher = (...args) => fetch(...args).then((res) => res.json()); // Generic fetch for useSWR

// We use these to only trigger toast announcements once
let demoToastInit = false;
let loadedToastInit = false;

const UserLiftingDataContext = createContext();

export const useUserLiftingData = () => useContext(UserLiftingDataContext);

export const UserLiftingDataProvider = ({ children }) => {
  // These are our key global state variables.
  // Keep this as minimal as possible. Don't put things here that components could derive quickly from 'parsedData'
  const [parsedData, setParsedData] = useState(null); // see @/lib/sample-parsed-data.js for data structure design
  const [topLiftsByTypeAndReps, setTopLiftsByTypeAndReps] = useState(null); // see @/lib/processing-utils.js for data structure design
  const [
    topLiftsByTypeAndRepsLast12Months,
    setTopLiftsByTypeAndRepsLast12Months,
  ] = useState(null); // see @/lib/processing-utils.js for data structure design
  const [selectedLiftTypes, setSelectedLiftTypes] = useState([]);
  const [rawRows, setRawRows] = useState(null); // As soon as we have the user data, update this for UI indicators

  const { data: session, status: authStatus } = useSession();

  const [ssid, setSsid] = useLocalStorage("ssid", null, {
    initializeWithValue: false,
  });
  const [sheetURL, setSheetURL] = useLocalStorage(
    "sheetURL",
    null,

    { initializeWithValue: false },
  );
  const [sheetFilename, setSheetFilename] = useLocalStorage(
    "sheetFilename",
    null,
    { initializeWithValue: false },
  );

  const { toast } = useToast();
  const router = useRouter();
  const currentPath = router.pathname;

  const shouldFetch =
    authStatus === "authenticated" && !!session?.accessToken && !!ssid;

  const apiURL = `/api/read-gsheet?ssid=${ssid}`;

  // -----------------------------------------------------------------------------------------------
  // Call gsheets API via our backend api route using useSWR
  // (we used to do from client but got intermittent CORS problems)
  // -----------------------------------------------------------------------------------------------
  const { data, error, isLoading, isValidating } = useSWR(
    shouldFetch ? apiURL : null,
    fetcher,
    {
      // SWR options
      // refreshInterval: 5000, // Polling interval in milliseconds (e.g., 5000 for every 5 seconds)
    },
  );

  if (error) devLog(`Local fetch to GSheet servers error: ${error}`);
  const isError = !!error; // FIXME: We could send back error details

  // -----------------------------------------------------------------------------------------------
  // When useSWR (just above) gives new Google sheet data, parse it
  // -----------------------------------------------------------------------------------------------
  useEffect(() => {
    const loadingMessage = isLoading ? "isLoading, " : "";
    const errorMessage = isError ? "isError, " : "";
    const dataMessage = `gsheet ${data ? "LOADED" : "NOT received yet"}`;

    devLog(
      `useUserLiftingData useEffect: authStatus: ${authStatus}, ${loadingMessage}${errorMessage}${dataMessage}`,
    );

    if (authStatus === "loading") return; // Wait for auth. Don't prematurely go into demo mode
    if (isLoading) return; // Wait for useSWR. Don't prematurely go into demo mode

    // isError happens when Google decides they don't love us
    // There was an edge case where it will ping during token refresh and get a 401 error once
    // Checking for !data tends to step over this error
    if (isError && !data) {
      toast({
        variant: "destructive",
        title: "Uh oh! Something went wrong.",
        description: "Lift some weights and come back later.",
      });

      if (
        typeof window !== "undefined" &&
        process.env.NEXT_PUBLIC_STRENGTH_JOURNEYS_ENV !== "development"
      ) {
        window.gtag("event", "gSheetAPIError");
      }

      devLog(`useSWR isError from google`);

      // FIXME: We used to clear the ssid but it happened too often. There are occasional weird errors (wifi loading etc)
      // setSsid(null);
      // setSheetFilename(null);
      // setSheetURL(null);
    }

    let parsedData = null; // A local version for this scope only

    if (authStatus === "authenticated" && data?.values) {
      try {
        // devLog(data.values.length);
        setRawRows(data?.values?.length);
        parsedData = parseData(data.values); // Will be sorted date ascending

        // We have some good new data loaded - tell the user via toast
        loadedToastInit = true; // Don't show this again

        // Find the latest date in parsedData
        let latestDate = null;
        if (parsedData && parsedData.length > 0) {
          // parsedData is sorted ascending, so last item is latest
          latestDate = parsedData[parsedData.length - 1].date;
        }
        let latestDateString = "";
        let gymInviteString = "";

        // Show informative toast (but not on the front page because the home dashboard has the same info)
        if (
          latestDate &&
          typeof router.pathname === "string" &&
          router.pathname !== "/"
        ) {
          const parsed = parseISO(latestDate);
          const now = new Date();
          const daysAgo = differenceInDays(now, parsed);
          const weeksAgo = differenceInWeeks(now, parsed);
          const monthsAgo = differenceInMonths(now, parsed);
          const yearsAgo = differenceInYears(now, parsed);

          if (isToday(parsed)) {
            latestDateString = "Latest data: Today";
            gymInviteString = "💪 You're crushing it today! Keep going!";
          } else if (daysAgo === 1) {
            latestDateString = "Latest data: Yesterday";
          } else if (daysAgo <= 7) {
            latestDateString = `Latest data: ${daysAgo} days ago`;
            gymInviteString = "Heading into the gym today, right?";
          } else if (weeksAgo === 1) {
            latestDateString = "Latest data: 1 week ago";
          } else if (weeksAgo <= 3) {
            latestDateString = `Latest data: ${weeksAgo} weeks ago`;
          } else if (monthsAgo === 1) {
            latestDateString = "Latest data: 1 month ago";
          } else if (monthsAgo <= 11) {
            latestDateString = `Latest data: ${monthsAgo} months ago`;
          } else if (yearsAgo === 1) {
            latestDateString = "Latest data: 1 year ago";
          } else {
            latestDateString = `Latest data: ${yearsAgo} years ago`;
          }

          // Add gym invite if daysAgo > 3
          if (daysAgo > 7) {
            gymInviteString = "🏋️‍♂️ It's been a while! Time to hit the gym?";
          }
          toast({
            title: "Data updated from Google Sheets",
            description: (
              <>
                {sheetURL ? (
                  <a
                    href={decodeURIComponent(sheetURL)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
                  >
                    {sheetFilename || "File name unknown"}
                  </a>
                ) : (
                  sheetFilename || "File name unknown"
                )}
                <br />
                {parsedData.length} valid rows
                {latestDateString && (
                  <>
                    <br />
                    {latestDateString}
                  </>
                )}
                {gymInviteString && (
                  <>
                    <br />
                    <span className="font-bold text-orange-600">
                      {gymInviteString}
                    </span>
                  </>
                )}
              </>
            ),
          });
        }

        if (
          typeof window !== "undefined" &&
          process.env.NEXT_PUBLIC_STRENGTH_JOURNEYS_ENV !== "development"
        ) {
          window.gtag("event", "gSheetDataUpdated");
        }
      } catch (error) {
        // Parsing error. Tell the user.
        console.error("Data parsing error:", error.message);
        toast({
          variant: "destructive",
          title: "Data Parsing Error",
          description: error.message,
        });

        demoToastInit = true; // Don't run another toast

        // Forget their chosen file, we have access but we cannot parse it
        devLog(
          `Could not parse data - deleting gsheet details from localstorage.`,
        );
        setSsid(null);
        setSheetFilename(null);
        setSheetURL(null);
        // Don't sign out, just go gracefully into demo mode below.

        if (
          typeof window !== "undefined" &&
          process.env.NEXT_PUBLIC_STRENGTH_JOURNEYS_ENV !== "development"
        ) {
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

    // Calculate liftTypes locally for use in selectedLiftTypes logic
    // (liftTypes is also computed via useMemo for the context provider)
    const liftTypes = calculateLiftTypes(parsedData);

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
    const { topLiftsByTypeAndReps, topLiftsByTypeAndRepsLast12Months } =
      processTopLiftsByTypeAndReps(parsedData, liftTypes);

    setTopLiftsByTypeAndReps(topLiftsByTypeAndReps);
    setTopLiftsByTypeAndRepsLast12Months(topLiftsByTypeAndRepsLast12Months);
    // devLog(topLiftsByTypeAndReps);
    // devLog(topLiftsByTypeAndRepsLast12Months);

    setParsedData(parsedData);
  }, [data, isLoading, isError, authStatus]);

  // Calculate liftTypes from parsedData (computed automatically when parsedData changes)
  const liftTypes = useMemo(() => 
    parsedData ? calculateLiftTypes(parsedData) : [], 
    [parsedData]
  );

  // useEffect for reminding the user when they are looking at demo data
  useEffect(() => {
    if (authStatus === "loading") return;

    // A list of pages with demo data that need this reminder toast
    devLog(currentPath);
    const demoDataPaths = [
      "/visualizer",
      "/analyzer",
      "/barbell-strength-potential",
      "/tonnage",
      "/[lift]",
    ];
    if (!demoDataPaths.includes(currentPath)) return;

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
        isValidating,
        liftTypes,
        selectedLiftTypes,
        setSelectedLiftTypes,
        parsedData,
        topLiftsByTypeAndReps,
        topLiftsByTypeAndRepsLast12Months,
        rawRows,
      }}
    >
      {children}
    </UserLiftingDataContext.Provider>
  );
};
