"use client";

import { useContext, useState, useEffect, createContext, useMemo } from "react";
import { useRouter } from "next/router";
import { useSession, signIn } from "next-auth/react";
import useSWR from "swr";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { parseData } from "@/lib/parse-data";
import { gaEvent, gaTrackSignInClick, GA_EVENT_TAGS } from "@/lib/analytics";
import {
  devLog,
  flushTimings,
  processTopLiftsByTypeAndReps,
  processTopTonnageByType,
  processSessionTonnageLookup,
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

/** Generic JSON fetcher for useSWR. */
const fetcher = (...args) => fetch(...args).then((res) => res.json());

// We use these to only trigger toast announcements once
let demoToastInit = false;
let loadedToastInit = false;

const UserLiftingDataContext = createContext();

/** Consumes the lifting data context. Use inside UserLiftingDataProvider. */
export const useUserLiftingData = () => useContext(UserLiftingDataContext);

/**
 * Provides lifting data from Google Sheets (or demo data) to the app.
 * Handles auth, SWR fetch, parsing, toasts, and derived state (liftTypes, topLifts, tonnage, etc.).
 */
export const UserLiftingDataProvider = ({ children }) => {
  // These are our key global state variables.
  // Keep this as minimal as possible. Don't put things here that components could derive quickly from 'parsedData'
  const [parsedData, setParsedData] = useState(null); // see @/lib/sample-parsed-data.js for data structure design
  const [lastDataReceivedAt, setLastDataReceivedAt] = useState(null);

  const { data: session, status: authStatus } = useSession();

  const [ssid, setSsid] = useLocalStorage(LOCAL_STORAGE_KEYS.SSID, null, {
    initializeWithValue: false,
  });
  const [sheetURL, setSheetURL] = useLocalStorage(
    LOCAL_STORAGE_KEYS.SHEET_URL,
    null,

    { initializeWithValue: false },
  );
  const [sheetFilename, setSheetFilename] = useLocalStorage(
    LOCAL_STORAGE_KEYS.SHEET_FILENAME,
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
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    shouldFetch ? apiURL : null,
    fetcher,
    {
      // SWR options
      // refreshInterval: 5000, // Polling interval in milliseconds (e.g., 5000 for every 5 seconds)
    },
  );

  if (error) console.log(`%c⚠ GSheet API Error%c ${error}`, "color:#ef4444;font-weight:bold", "color:inherit");
  const isError = !!error; // FIXME: We could send back error details

  // -----------------------------------------------------------------------------------------------
  // When useSWR (just above) gives new Google sheet data, parse it
  // -----------------------------------------------------------------------------------------------
  useEffect(() => {
    // Pretty pipeline progress log
    const steps = [
      { label: "Auth", done: authStatus === "authenticated", status: authStatus },
      { label: "Fetch", done: !isLoading && !isError, loading: isLoading, error: isError },
      { label: "Data", done: !!data?.values, status: data?.values ? `${data.values.length} rows` : "waiting" },
    ];
    const pipeline = steps.map(s => {
      const icon = s.error ? "✗" : s.loading ? "⏳" : s.done ? "✓" : "○";
      const detail = s.status ? ` (${s.status})` : "";
      return `${icon} ${s.label}${detail}`;
    }).join("  →  ");
    console.log(
      `%c🏋️ Data Pipeline%c  ${pipeline}`,
      "color:#f59e0b;font-weight:bold",
      "color:inherit",
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

      gaEvent(GA_EVENT_TAGS.GSHEET_API_ERROR); // Google Analytics: sheet API error
      console.log(`%c✗ GSheet API rejected by Google%c — will retry on next revalidation`, "color:#ef4444;font-weight:bold", "color:inherit");

      // FIXME: We used to clear the ssid but it happened too often. There are occasional weird errors (wifi loading etc)
      // setSsid(null);
      // setSheetFilename(null);
      // setSheetURL(null);
    }

    // Sync API metadata to localStorage when we have fresh values
    if (authStatus === "authenticated" && data?.values) {
      if (data.name != null && data.name !== sheetFilename) {
        setSheetFilename(data.name);
      }
      if (data.webViewLink != null) {
        const encoded = encodeURIComponent(data.webViewLink);
        if (encoded !== sheetURL) {
          setSheetURL(encoded);
        }
      }
    }

    const effectiveName = data?.name ?? sheetFilename;
    const effectiveUrl = data?.webViewLink ?? (sheetURL ? decodeURIComponent(sheetURL) : null);

    const parsedData = buildParsedState({
      authStatus,
      data,
      toast,
      router,
      sheetURL: effectiveUrl,
      sheetFilename: effectiveName,
      setSsid,
      setSheetFilename,
      setSheetURL,
    });

    setParsedData(parsedData);
    if (authStatus === "authenticated" && data?.values) {
      setLastDataReceivedAt(Date.now());
    }
  // router excluded from deps - Next.js router gets new ref each render, causes infinite loop
  // when combined with useStateFromQueryOrLocalStorage which calls router.replace()
  }, [
    data,
    isLoading,
    isError,
    authStatus,
    toast,
    sheetURL,
    sheetFilename,
    setSsid,
    setSheetFilename,
    setSheetURL,
  ]);

  // Calculate liftTypes from parsedData (computed automatically when parsedData changes)
  const liftTypes = useMemo(() => 
    parsedData ? calculateLiftTypes(parsedData) : [], 
    [parsedData]
  );

  // Calculate topLiftsByTypeAndReps from parsedData and liftTypes (computed automatically when they change)
  const { topLiftsByTypeAndReps, topLiftsByTypeAndRepsLast12Months } = useMemo(() => {
    if (!parsedData || !liftTypes.length) {
      return { topLiftsByTypeAndReps: null, topLiftsByTypeAndRepsLast12Months: null };
    }
    return processTopLiftsByTypeAndReps(parsedData, liftTypes);
  }, [parsedData, liftTypes]);

  // Top tonnage sessions per lift type (all-time and last 12 months)
  const { topTonnageByType, topTonnageByTypeLast12Months } = useMemo(() => {
    if (!parsedData || !liftTypes.length) {
      return { topTonnageByType: null, topTonnageByTypeLast12Months: null };
    }
    return processTopTonnageByType(parsedData, liftTypes);
  }, [parsedData, liftTypes]);

  // Precomputed session tonnage lookup for fast getAverageLiftSessionTonnage / getAverageSessionTonnage
  const sessionTonnageLookup = useMemo(() => {
    if (!parsedData) return null;
    return processSessionTonnageLookup(parsedData);
  }, [parsedData]);

  // Flush accumulated pipeline timings once all processing is done
  useEffect(() => {
    if (!parsedData || !sessionTonnageLookup) return;
    flushTimings();
  }, [parsedData, sessionTonnageLookup]);

  // Calculate rawRows from useSWR data (computed automatically when data changes)
  const rawRows = useMemo(() =>
    data?.values?.length ?? null,
    [data]
  );

  // Sheet metadata from API (or localStorage fallback for name/url). null when no sheet selected.
  const sheetMetadata = useMemo(() => {
    if (!ssid) return null;
    const name = data?.name ?? sheetFilename ?? "Your Google Sheet";
    const webViewLink = data?.webViewLink ?? (sheetURL ? decodeURIComponent(sheetURL) : null);
    return {
      name,
      webViewLink,
      modifiedTime: data?.modifiedTime ?? null,
      modifiedByMeTime: data?.modifiedByMeTime ?? null,
    };
  }, [ssid, data?.name, data?.webViewLink, data?.modifiedTime, data?.modifiedByMeTime, sheetFilename, sheetURL]);

  // useEffect for reminding the user when they are looking at demo data
  useEffect(() => {
    if (authStatus === "loading") return;

    // A list of pages with demo data that need this reminder toast
    const demoDataPaths = [
      "/visualizer",
      "/analyzer",
      "/barbell-strength-potential",
      "/tonnage",
      "/[lift]",
      "/strength-year-in-review",
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
          <ToastAction
            altText="Google Login"
            onClick={() => {
              gaTrackSignInClick(router.pathname); // Google Analytics: track sign-in click before opening OAuth
              signIn("google");
            }}
          >
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
        parsedData,
        topLiftsByTypeAndReps,
        topLiftsByTypeAndRepsLast12Months,
        topTonnageByType,
        topTonnageByTypeLast12Months,
        sessionTonnageLookup,
        rawRows,
        dataSyncedAt: lastDataReceivedAt,
        mutate,
        ssid,
        setSsid,
        sheetURL: sheetMetadata?.webViewLink ?? (sheetURL ? decodeURIComponent(sheetURL) : null),
        setSheetURL,
        sheetFilename: sheetMetadata?.name ?? sheetFilename,
        setSheetFilename,
        sheetMetadata,
      }}
    >
      {children}
    </UserLiftingDataContext.Provider>
  );
};

/**
 * Orchestrates parsing raw sheet data.
 * Delegates to getParsedDataWithFallback (parse + demo fallback + PR marking).
 */
function buildParsedState({
  authStatus,
  data,
  toast,
  router,
  sheetURL,
  sheetFilename,
  setSsid,
  setSheetFilename,
  setSheetURL,
}) {
  return getParsedDataWithFallback({
    authStatus,
    data,
    toast,
    router,
    sheetURL,
    sheetFilename,
    setSsid,
    setSheetFilename,
    setSheetURL,
  });
}

/**
 * Parses raw gsheet values into parsedData. On success: shows "Data updated" toast once, fires analytics.
 * On parse error: clears ssid/sheet from storage, shows error toast. Falls back to demo data when no real data.
 * Also runs markHigherWeightAsHistoricalPRs on the result.
 */
function getParsedDataWithFallback({
  authStatus,
  data,
  toast,
  router,
  sheetURL,
  sheetFilename,
  setSsid,
  setSheetFilename,
  setSheetURL,
}) {
  let parsedData = null; // A local version for this scope only

  if (authStatus === "authenticated" && data?.values) {
    try {
      // devLog(data.values.length);
      parsedData = parseData(data.values); // Will be sorted date ascending

      // Find the latest date in parsedData
      let latestDate = null;
      if (parsedData && parsedData.length > 0) {
        // parsedData is sorted ascending, so last item is latest
        latestDate = parsedData[parsedData.length - 1].date;
      }
      let latestDateString = "";
      let gymInviteString = "";

      // Show informative toast once per session (but not on the front page because the home dashboard has the same info)
      if (
        !loadedToastInit &&
        latestDate &&
        typeof router.pathname === "string" &&
        router.pathname !== "/"
      ) {
        loadedToastInit = true;
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

        // Add gym invite if daysAgo > 7
        if (daysAgo > 7) {
          gymInviteString = "🏋️‍♂️ It's been a while! Time to hit the gym?";
        }
        toast({
          title: "Data updated from Google Sheets",
          description: (
            <>
              {sheetURL ? (
                <a
                  href={sheetURL}
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

      gaEvent(GA_EVENT_TAGS.GSHEET_DATA_UPDATED); // Google Analytics: sheet data loaded successfully
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
      console.log(`%c✗ Parse failed%c — clearing saved sheet from localStorage`, "color:#ef4444;font-weight:bold", "color:inherit");
      setSsid(null);
      setSheetFilename(null);
      setSheetURL(null);
      // Don't sign out, just go gracefully into demo mode below.

      gaEvent(GA_EVENT_TAGS.GSHEET_READ_REJECTED); // Google Analytics: sheet parse rejected
    }
  }

  // If there have been any problems we will switch into demo mode with sample data
  // FIXME: Logic is NQR, demo data should only be when unauthenticated
  // FIXME: if we are committing to demo mode then do the demo toast here and not in a separate useEffect
  if (!parsedData)
    parsedData = transposeDatesToToday(sampleParsedData, true); // Transpose demo dates to recent, add jitter

  // As far as possible try to get components to do their own unique processing of parsedData
  // However if there are metrics commonly needed we can do it here just once to save CPU later

  // Before we set parsedData there are a few other global
  // state variables everything needs.
  parsedData = markHigherWeightAsHistoricalPRs(parsedData);

  return parsedData;
}
