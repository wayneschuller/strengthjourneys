import {
  useContext,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  createContext,
  useMemo,
} from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import {
  parseData,
  parseImportedFile,
} from "@/lib/data-sources/import-dispatcher";
import { getDemoParsedData } from "@/lib/data-sources/sample-parsed-data";
import { gaEvent, GA_EVENT_TAGS, gaTrackSheetLinked } from "@/lib/analytics";
import {
  flushTimings,
  processTopLiftsByTypeAndReps,
  processTopTonnageByType,
  processSessionTonnageLookup,
  markHigherWeightAsHistoricalPRs,
  calculateLiftTypes,
} from "@/lib/processing-utils";
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

// ---------------------------------------------------------------------------
// Returning-user detection: synchronous localStorage snapshot at module load.
// Used to suppress the onboarding hero flash while auth + useLocalStorage
// hydrate. This runs exactly once, before any component mounts.
// ---------------------------------------------------------------------------
const _hadSheetOnLoad = (() => {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.SHEET_INFO);
    return !!JSON.parse(raw)?.ssid;
  } catch {
    return false;
  }
})();

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
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** Consumes the lifting data context. Use inside UserLiftingDataProvider. */
export const useUserLiftingData = () => useContext(UserLiftingDataContext);

/**
 * The central data engine of the app. Provides lifting data from Google Sheets
 * (or demo data when unauthenticated) to the entire component tree.
 *
 * Handles auth, SWR fetch, parsing, and derived state (liftTypes, topLifts, tonnage, etc.).
 * Every piece of UI that touches lifting data — charts, PR tables, tonnage cards,
 * the AI assistant — is downstream of this provider.
 *
 * Context value exposed via {@link useUserLiftingData}:
 * @param {React.ReactNode} props.children
 *
 * @context parsedData {Array|null} - Processed lift objects. null until first load.
 *   Each entry: { date, liftType, reps, weight, unitType, isHistoricalPR, isGoal }
 * @context liftTypes {string[]} - Unique lift names in parsedData, sorted by frequency.
 * @context topLiftsByTypeAndReps {Object|null} - All-time PR table: liftType → reps → best lift.
 * @context topLiftsByTypeAndRepsLast12Months {Object|null} - Same, last 12 months only.
 * @context topTonnageByType {Object|null} - All-time heaviest tonnage session per lift type.
 * @context topTonnageByTypeLast12Months {Object|null} - Same, last 12 months only.
 * @context sessionTonnageLookup {Object|null} - date → per-lift and total tonnage; powers tonnage chart.
 * @context sheetInfo {Object|null} - { ssid, url, filename, modifiedTime, modifiedByMeTime } from localStorage.
 * @context selectSheet {(ssid: string) => void} - Link a Google Sheet by spreadsheet ID.
 * @context clearSheet {() => void} - Unlink the current sheet.
 * @context mutate {function} - SWR mutate — force a re-fetch.
 * @context isLoading {boolean} - True while SWR is fetching for the first time.
 * @context isValidating {boolean} - True during any background revalidation.
 * @context isError {boolean} - True if the last fetch attempt threw.
 * @context fetchFailed {boolean} - True after retries are exhausted (used by Layout for error toast).
 * @context apiError {{status, statusText, message}|null} - Structured error from the last failed fetch.
 * @context parseError {string|null} - Error message if sheet data failed to parse (sheet is auto-cleared).
 * @context isDemoMode {boolean} - True when demo data is active, either signed out or explicitly disconnected while signed in.
 * @context rawRows {number|null} - Row count from the last successful sheet fetch.
 * @context hasCachedSheetData {boolean} - True if SWR holds valid sheet values (even if stale).
 * @context dataSyncedAt {number|null} - Timestamp (Date.now()) of the last successful data load.
 */
export const UserLiftingDataProvider = ({ children }) => {
  // These are our key global state variables.
  // Keep this as minimal as possible. Don't put things here that components could derive quickly from 'parsedData'
  const [parsedData, setParsedData] = useState(null); // see @/lib/data-sources/sample-parsed-data.js for data structure design
  const [lastDataReceivedAt, setLastDataReceivedAt] = useState(null);
  const [parseError, setParseError] = useState(null);
  const [fetchFailed, setFetchFailed] = useState(false);

  // -- Imported file data (view-only, persisted in sessionStorage) ------------
  // Initialize as null (matches server) and hydrate after mount via layout effect
  // to avoid hydration mismatch — sessionStorage is client-only.
  const [importedParsedData, setImportedParsedData] = useState(null);
  const [importedFormatName, setImportedFormatName] = useState(null);

  useIsomorphicLayoutEffect(() => {
    try {
      const stored = sessionStorage.getItem("sj_importedData");
      if (stored) {
        setImportedParsedData(JSON.parse(stored));
        setImportedFormatName(
          sessionStorage.getItem("sj_importedFormat") || null,
        );
      }
    } catch {
      // sessionStorage unavailable or corrupt — stay with null
    }
  }, []);

  const importFile = useCallback(async (file) => {
    const { data: parsed, formatName } = await parseImportedFile(file);
    const processed = markHigherWeightAsHistoricalPRs(parsed);
    setImportedParsedData(processed);
    setImportedFormatName(formatName);
    try {
      sessionStorage.setItem("sj_importedData", JSON.stringify(processed));
      sessionStorage.setItem("sj_importedFormat", formatName);
    } catch {
      // sessionStorage full or unavailable — data still works for this session
    }
    return { count: processed.length, formatName };
  }, []);

  const clearImportedData = useCallback(() => {
    setImportedParsedData(null);
    setImportedFormatName(null);
    try {
      sessionStorage.removeItem("sj_importedData");
      sessionStorage.removeItem("sj_importedFormat");
    } catch {
      // ignore
    }
  }, []);

  const isImportedData = !!importedParsedData;

  const { data: session, status: authStatus } = useSession();

  // Single consolidated sheet state
  const [sheetInfo, setSheetInfo] = useLocalStorage(
    LOCAL_STORAGE_KEYS.SHEET_INFO,
    null,
    { initializeWithValue: false },
  );
  const [signedInDemoMode, setSignedInDemoMode] = useLocalStorage(
    LOCAL_STORAGE_KEYS.SIGNED_IN_DEMO_MODE,
    false,
    { initializeWithValue: false },
  );
  // Imported CSV data overrides demo mode — the user has real data loaded.
  const isDemoMode =
    !importedParsedData &&
    (authStatus === "unauthenticated" ||
      (authStatus === "authenticated" && !sheetInfo?.ssid && signedInDemoMode));

  // True when real user data is available from any source (gsheet or CSV import).
  // Use this for layout decisions (e.g. show personal charts first vs editorial first)
  // instead of checking authStatus directly.
  const hasUserData =
    isImportedData ||
    (authStatus === "authenticated" && !!sheetInfo?.ssid && !isDemoMode);

  // True when the current data source doesn't support writes (CSV, demo, or no data).
  // Use this to hide write-only UI (log buttons, sheet setup, etc.).
  const isReadOnly = !hasUserData || isImportedData;

  // True while we have localStorage evidence of a linked sheet but auth and/or
  // useLocalStorage haven't hydrated yet. Consumers use this to avoid flashing
  // onboarding UI for returning users during the initial load.
  //
  // Gated behind hasMounted so the initial render matches the server (which has
  // no localStorage). useLayoutEffect flips it before the browser paints, so
  // consumers still suppress onboarding UI before anything is visible.
  const [hasMounted, setHasMounted] = useState(false);
  useIsomorphicLayoutEffect(() => setHasMounted(true), []);

  const isReturningUserLoading =
    hasMounted &&
    _hadSheetOnLoad &&
    !(authStatus === "authenticated" && !!sheetInfo?.ssid) &&
    authStatus !== "unauthenticated";

  const selectSheet = useCallback(
    (ssid, metadata = {}) => {
      gaTrackSheetLinked();
      setSignedInDemoMode(false);
      setSheetInfo({
        ssid,
        url: metadata.url ?? null,
        filename: metadata.filename ?? null,
        modifiedTime: metadata.modifiedTime ?? null,
        modifiedByMeTime: metadata.modifiedByMeTime ?? null,
      });
    },
    [setSheetInfo, setSignedInDemoMode],
  );

  const clearSheet = useCallback(() => setSheetInfo(null), [setSheetInfo]);
  const enterSignedInDemoMode = useCallback(
    () => setSignedInDemoMode(true),
    [setSignedInDemoMode],
  );
  const exitSignedInDemoMode = useCallback(
    () => setSignedInDemoMode(false),
    [setSignedInDemoMode],
  );

  // Keep fetching the linked sheet even during imported preview mode.
  // The imported file still powers the visible UI, but import analysis and
  // dedupe need the live linked-sheet data in the background.
  const shouldFetch =
    authStatus === "authenticated" &&
    !!session?.accessToken &&
    !!sheetInfo?.ssid;

  useEffect(() => {
    if (authStatus === "unauthenticated" && signedInDemoMode) {
      setSignedInDemoMode(false);
    }
  }, [authStatus, signedInDemoMode, setSignedInDemoMode]);

  // -----------------------------------------------------------------------------------------------
  // Call gsheets API via our backend api route using useSWR
  // (we used to do from client but got intermittent CORS problems)
  // -----------------------------------------------------------------------------------------------
  // Why custom onErrorRetry instead of relying on SWR defaults + useEffect?
  //
  // SWR's default retry has a gap between each error and retry where
  // isError=true and isValidating=false simultaneously. A useEffect watching
  // those values fires in that gap — showing an error toast before the retry
  // succeeds. This is especially problematic on mobile where reopening Chrome
  // triggers a focus revalidation before WiFi has fully reconnected.
  //
  // By using onErrorRetry we control exactly when to surface errors:
  // - 4xx (auth revoked, sheet deleted): fail immediately, no retry
  // - Network/5xx: retry with backoff, only set fetchFailed after exhausting retries
  // - onSuccess clears fetchFailed so revalidateOnReconnect recovery works naturally
  //
  // Layout.js reads fetchFailed (not isError) for the error toast.
  const MAX_RETRIES = 3;

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    shouldFetch ? `/api/sheet/read?ssid=${sheetInfo.ssid}` : null,
    fetcher,
    {
      // Be explicit about mobile resume behavior. Chrome on Android may keep
      // the page alive, then trigger focus/reconnect revalidation on return.
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      revalidateIfStale: true,
      revalidateOnMount: true,
      onErrorRetry: (err, _key, _config, revalidate, { retryCount }) => {
        if (err.status >= 400 && err.status < 500) {
          setFetchFailed(true);
          gaEvent(GA_EVENT_TAGS.GSHEET_API_ERROR);
          return;
        }
        if (retryCount >= MAX_RETRIES) {
          setFetchFailed(true);
          gaEvent(GA_EVENT_TAGS.GSHEET_API_ERROR);
          return;
        }
        setTimeout(
          () => revalidate({ retryCount: retryCount + 1 }),
          Math.min(1000 * 2 ** retryCount, 30000),
        );
      },
      onSuccess: (freshData) => {
        setFetchFailed(false);
        if (authStatus === "authenticated" && freshData?.values) {
          setLastDataReceivedAt(Date.now());
        }
      },
    },
  );

  const rawRows = data?.values?.length ?? null;
  const isError = !!error;
  const hasCachedSheetData = Array.isArray(data?.values);

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

    // API errors: GA tracking is handled in onErrorRetry (only fires on genuine
    // failures, not transient retry gaps). Effect just logs and bails.
    if (isError) {
      const statusInfo = error?.status ? ` (${error.status})` : "";
      console.error(
        `%c✗ GSheet API Error${statusInfo}%c ${error.message} — will retry on next revalidation`,
        "color:#ef4444;font-weight:bold",
        "color:inherit",
      );
      setParseError(null);
      return;
    }

    const result = getParsedDataWithFallback({ authStatus, data, isDemoMode });

    if (result.parseError) {
      clearSheet();
    }

    setParsedData(result.parsedData);
    setParseError(result.parseError);
  }, [data, isLoading, isError, error, authStatus, clearSheet, isDemoMode]);

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

  // When imported file data is active, it overrides the normal parsedData pipeline.
  // All downstream computations (liftTypes, PRs, tonnage, etc.) derive from activeParsedData.
  const activeParsedData = importedParsedData || parsedData;

  // Calculate liftTypes from activeParsedData (computed automatically when data changes)
  const liftTypes = useMemo(
    () => (activeParsedData ? calculateLiftTypes(activeParsedData) : []),
    [activeParsedData],
  );

  // Calculate topLiftsByTypeAndReps from activeParsedData and liftTypes (computed automatically when they change)
  const { topLiftsByTypeAndReps, topLiftsByTypeAndRepsLast12Months } =
    useMemo(() => {
      if (!activeParsedData || !liftTypes.length) {
        return {
          topLiftsByTypeAndReps: null,
          topLiftsByTypeAndRepsLast12Months: null,
        };
      }
      return processTopLiftsByTypeAndReps(activeParsedData, liftTypes);
    }, [activeParsedData, liftTypes]);

  // Top tonnage sessions per lift type (all-time and last 12 months)
  const { topTonnageByType, topTonnageByTypeLast12Months } = useMemo(() => {
    if (!activeParsedData || !liftTypes.length) {
      return { topTonnageByType: null, topTonnageByTypeLast12Months: null };
    }
    return processTopTonnageByType(activeParsedData, liftTypes);
  }, [activeParsedData, liftTypes]);

  // Precomputed session tonnage lookup for fast getAverageLiftSessionTonnage / getAverageSessionTonnage
  const sessionTonnageLookup = useMemo(() => {
    if (!activeParsedData) return null;
    return processSessionTonnageLookup(activeParsedData);
  }, [activeParsedData]);

  // Flush accumulated pipeline timings once all processing is done
  useEffect(() => {
    if (!activeParsedData || !sessionTonnageLookup) return;
    flushTimings();
  }, [activeParsedData, sessionTonnageLookup]);

  return (
    <UserLiftingDataContext.Provider
      value={{
        isLoading,
        isError,
        fetchFailed,
        apiError,
        isValidating,
        isDemoMode,
        hasUserData,
        isReadOnly,
        isImportedData,
        importedFormatName,
        isReturningUserLoading,
        parseError,
        liftTypes,
        parsedData: activeParsedData,
        topLiftsByTypeAndReps,
        topLiftsByTypeAndRepsLast12Months,
        topTonnageByType,
        topTonnageByTypeLast12Months,
        sessionTonnageLookup,
        rawRows,
        hasCachedSheetData,
        dataSyncedAt: lastDataReceivedAt,
        mutate,
        sheetInfo,
        selectSheet,
        clearSheet,
        enterSignedInDemoMode,
        exitSignedInDemoMode,
        importFile,
        clearImportedData,
        sheetParsedData: parsedData,
      }}
    >
      {children}
    </UserLiftingDataContext.Provider>
  );
};

/**
 * Parses raw gsheet values into parsedData. Fires analytics on success/failure.
 * On parse error: returns parseError string (caller handles clearing sheet).
 * Uses demo data when unauthenticated or when the user explicitly disconnected their sheet while staying signed in.
 * When authenticated without usable sheet data and without explicit demo fallback, returns empty data so UI can nudge sheet connection.
 * Returns { parsedData, isDemoMode, parseError }.
 */
function getParsedDataWithFallback({ authStatus, data, isDemoMode }) {
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

  const shouldUseDemoData = isDemoMode;

  if (shouldUseDemoData) {
    parsedData = getDemoParsedData();
  } else if (!parsedData) {
    // Authenticated users without a selected/valid sheet should not see demo data.
    parsedData = [];
  }

  // As far as possible try to get components to do their own unique processing of parsedData
  // However if there are metrics commonly needed we can do it here just once to save CPU later

  // Before we set parsedData there are a few other global
  // state variables everything needs.
  parsedData = markHigherWeightAsHistoricalPRs(parsedData);

  return { parsedData, parseError };
}
