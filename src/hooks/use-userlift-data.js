"use client";

import {
  useContext,
  useState,
  useEffect,
  useCallback,
  createContext,
  useMemo,
} from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { parseData } from "@/lib/parse-data";
import { gaEvent, GA_EVENT_TAGS } from "@/lib/analytics";
import {
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
import { useLocalStorage } from "usehooks-ts";

// ---------------------------------------------------------------------------
// Migration: consolidate old ssid/sheetURL/sheetFilename into SJ_sheetInfo
// Runs once on first client-side load before React mounts.
// ---------------------------------------------------------------------------
if (typeof window !== "undefined") {
  const NEW_KEY = LOCAL_STORAGE_KEYS.SHEET_INFO;
  const existing = localStorage.getItem(NEW_KEY);

  if (!existing) {
    try {
      const rawSsid = localStorage.getItem(LOCAL_STORAGE_KEYS.SSID);
      const ssid = rawSsid ? JSON.parse(rawSsid) : null;

      if (ssid) {
        const rawUrl = localStorage.getItem(LOCAL_STORAGE_KEYS.SHEET_URL);
        const rawFilename = localStorage.getItem(
          LOCAL_STORAGE_KEYS.SHEET_FILENAME,
        );
        const encodedUrl = rawUrl ? JSON.parse(rawUrl) : null;
        const url = encodedUrl ? decodeURIComponent(encodedUrl) : null;
        const filename = rawFilename ? JSON.parse(rawFilename) : null;

        localStorage.setItem(
          NEW_KEY,
          JSON.stringify({
            ssid,
            url,
            filename,
            modifiedTime: null,
            modifiedByMeTime: null,
          }),
        );
      }
    } catch {
      // Silently ignore corrupt data — user will re-pick their sheet
    }

    // Always remove old keys (even if migration had nothing to migrate)
    localStorage.removeItem(LOCAL_STORAGE_KEYS.SSID);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.SHEET_URL);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.SHEET_FILENAME);
  }
}

/**
 * Generic JSON fetcher for useSWR.
 * Throws on non-2xx so SWR sets `error` and the UI can surface real failures.
 */
const fetcher = async (...args) => {
  const res = await fetch(...args);
  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      (json && typeof json.error === "string" && json.error) ||
      `${res.status} ${res.statusText || "Request failed"}`;
    const error = new Error(message);
    error.status = res.status;
    error.statusText = res.statusText || null;
    error.responseBody = json;
    throw error;
  }

  return json;
};

const UserLiftingDataContext = createContext();

/** Consumes the lifting data context. Use inside UserLiftingDataProvider. */
export const useUserLiftingData = () => useContext(UserLiftingDataContext);

/**
 * Provides lifting data from Google Sheets (or demo data) to the app.
 * Handles auth, SWR fetch, parsing, and derived state (liftTypes, topLifts, tonnage, etc.).
 */
export const UserLiftingDataProvider = ({ children }) => {
  // These are our key global state variables.
  // Keep this as minimal as possible. Don't put things here that components could derive quickly from 'parsedData'
  const [parsedData, setParsedData] = useState(null); // see @/lib/sample-parsed-data.js for data structure design
  const [lastDataReceivedAt, setLastDataReceivedAt] = useState(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [parseError, setParseError] = useState(null);
  const [rawRows, setRawRows] = useState(null);

  const { data: session, status: authStatus } = useSession();

  // Single consolidated sheet state
  const [sheetInfo, setSheetInfo] = useLocalStorage(
    LOCAL_STORAGE_KEYS.SHEET_INFO,
    null,
    { initializeWithValue: false },
  );

  const selectSheet = useCallback(
    (ssid) =>
      setSheetInfo({
        ssid,
        url: null,
        filename: null,
        modifiedTime: null,
        modifiedByMeTime: null,
      }),
    [setSheetInfo],
  );

  const clearSheet = useCallback(() => setSheetInfo(null), [setSheetInfo]);

  const shouldFetch =
    authStatus === "authenticated" &&
    !!session?.accessToken &&
    !!sheetInfo?.ssid;

  // -----------------------------------------------------------------------------------------------
  // Call gsheets API via our backend api route using useSWR
  // (we used to do from client but got intermittent CORS problems)
  // -----------------------------------------------------------------------------------------------
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    shouldFetch ? `/api/read-gsheet?ssid=${sheetInfo.ssid}` : null,
    fetcher,
    {
      // SWR options
      // refreshInterval: 5000, // Polling interval in milliseconds (e.g., 5000 for every 5 seconds)
      onSuccess: (freshData) => {
        // Update sync timestamp on every successful SWR fetch/revalidation,
        // including tab-focus revalidations where data content may be unchanged.
        if (authStatus === "authenticated" && freshData?.values) {
          setLastDataReceivedAt(Date.now());
        }
      },
    },
  );

  const isError = !!error;
  const apiError = useMemo(() => {
    if (!error) return null;
    return {
      status: typeof error.status === "number" ? error.status : null,
      statusText:
        typeof error.statusText === "string" ? error.statusText : null,
      message: error.message || "Unknown API error",
    };
  }, [error]);

  // -----------------------------------------------------------------------------------------------
  // Effect A: When useSWR gives new Google sheet data, parse it
  // -----------------------------------------------------------------------------------------------
  useEffect(() => {
    // Pretty pipeline progress log
    const steps = [
      {
        label: "Auth",
        done: authStatus === "authenticated",
        status: authStatus,
      },
      {
        label: "Fetch",
        done: !isLoading && !isError,
        loading: isLoading,
        error: isError,
      },
      {
        label: "Data",
        done: !!data?.values,
        status: data?.values ? `${data.values.length} rows` : "waiting",
      },
    ];
    const pipeline = steps
      .map((s) => {
        const icon = s.error ? "✗" : s.loading ? "⏳" : s.done ? "✓" : "○";
        const detail = s.status ? ` (${s.status})` : "";
        return `${icon} ${s.label}${detail}`;
      })
      .join("  →  ");
    console.log(
      `%c🏋️ Data Pipeline%c  ${pipeline}`,
      "color:#f59e0b;font-weight:bold",
      "color:inherit",
    );

    if (authStatus === "loading") return; // Wait for auth. Don't prematurely go into demo mode
    if (isLoading) return; // Wait for useSWR. Don't prematurely go into demo mode

    // Any API error is now treated as user-visible (layout shows a toast), tracked in GA,
    // and still allowed to recover via normal SWR revalidation retries.
    if (isError) {
      gaEvent(GA_EVENT_TAGS.GSHEET_API_ERROR); // Google Analytics: sheet API error
      console.error(
        `%c✗ GSheet API Error%c ${error} — will retry on next revalidation`,
        "color:#ef4444;font-weight:bold",
        "color:inherit",
      );
      setParseError(null);
      return;
    }

    const result = getParsedDataWithFallback({ authStatus, data });

    if (result.parseError) {
      clearSheet();
    }

    setParsedData(result.parsedData);
    setIsDemoMode(result.isDemoMode);
    setParseError(result.parseError);
    setRawRows(data?.values?.length ?? null);
  }, [data, isLoading, isError, error, authStatus, clearSheet]);

  // -----------------------------------------------------------------------------------------------
  // Effect B: Sync API metadata into sheetInfo when fresh data arrives
  // -----------------------------------------------------------------------------------------------
  useEffect(() => {
    if (authStatus !== "authenticated" || !data?.values) return;

    setSheetInfo((prev) => {
      if (!prev) return prev; // no sheet selected

      const url = data.webViewLink ?? prev.url;
      const filename = data.name ?? prev.filename;
      const modifiedTime = data.modifiedTime ?? prev.modifiedTime;
      const modifiedByMeTime = data.modifiedByMeTime ?? prev.modifiedByMeTime;

      // Skip update if nothing changed (avoids unnecessary re-renders)
      if (
        url === prev.url &&
        filename === prev.filename &&
        modifiedTime === prev.modifiedTime &&
        modifiedByMeTime === prev.modifiedByMeTime
      ) {
        return prev;
      }

      return { ...prev, url, filename, modifiedTime, modifiedByMeTime };
    });
  }, [
    authStatus,
    data?.values,
    data?.name,
    data?.webViewLink,
    data?.modifiedTime,
    data?.modifiedByMeTime,
    setSheetInfo,
  ]);

  // Calculate liftTypes from parsedData (computed automatically when parsedData changes)
  const liftTypes = useMemo(
    () => (parsedData ? calculateLiftTypes(parsedData) : []),
    [parsedData],
  );

  // Calculate topLiftsByTypeAndReps from parsedData and liftTypes (computed automatically when they change)
  const { topLiftsByTypeAndReps, topLiftsByTypeAndRepsLast12Months } =
    useMemo(() => {
      if (!parsedData || !liftTypes.length) {
        return {
          topLiftsByTypeAndReps: null,
          topLiftsByTypeAndRepsLast12Months: null,
        };
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

  return (
    <UserLiftingDataContext.Provider
      value={{
        isLoading,
        isError,
        apiError,
        isValidating,
        isDemoMode,
        parseError,
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
        sheetInfo,
        selectSheet,
        clearSheet,
      }}
    >
      {children}
    </UserLiftingDataContext.Provider>
  );
};

/**
 * Parses raw gsheet values into parsedData. Fires analytics on success/failure.
 * On parse error: returns parseError string (caller handles clearing sheet).
 * Uses demo data only when unauthenticated.
 * When authenticated without usable sheet data, returns empty data so UI can nudge sheet connection.
 * Returns { parsedData, isDemoMode, parseError }.
 */
function getParsedDataWithFallback({ authStatus, data }) {
  let parsedData = null; // A local version for this scope only
  let parseError = null;

  if (authStatus === "authenticated" && data?.values) {
    try {
      parsedData = parseData(data.values); // Will be sorted date ascending
      gaEvent(GA_EVENT_TAGS.GSHEET_DATA_UPDATED); // Google Analytics: sheet data loaded successfully
    } catch (error) {
      // Parsing error
      console.error("Data parsing error:", error.message);
      parseError = error.message;

      console.error(
        `%c✗ Parse failed%c — clearing saved sheet from localStorage`,
        "color:#ef4444;font-weight:bold",
        "color:inherit",
      );
      // Don't sign out; clear sheet and return empty data for authenticated users.

      gaEvent(GA_EVENT_TAGS.GSHEET_READ_REJECTED); // Google Analytics: sheet parse rejected
    }
  }

  const shouldUseDemoData = authStatus === "unauthenticated";
  const isDemoMode = shouldUseDemoData;

  if (shouldUseDemoData) {
    parsedData = transposeDatesToToday(sampleParsedData, true); // Transpose demo dates to recent, add jitter
  } else if (!parsedData) {
    // Authenticated users without a selected/valid sheet should not see demo data.
    parsedData = [];
  }

  // As far as possible try to get components to do their own unique processing of parsedData
  // However if there are metrics commonly needed we can do it here just once to save CPU later

  // Before we set parsedData there are a few other global
  // state variables everything needs.
  parsedData = markHigherWeightAsHistoricalPRs(parsedData);

  return { parsedData, isDemoMode, parseError };
}
