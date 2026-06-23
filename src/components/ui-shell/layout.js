/**
 * App-wide layout shell and preview-import banner.
 * Keep rare save-recovery rails thin here; this file should surface them only
 * through focused CTA handoffs, not as a first-class app mode.
 */

import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { NavBar } from "@/components/ui-shell/nav-bar";
import { Footer } from "@/components/ui-shell/footer";
import { AppBackground } from "@/components/ui-shell/app-background";
import { FeedbackWidget } from "@/components/feedback";
import {
  GoogleSignInButton,
  GoogleSignInToastAction,
} from "@/components/onboarding/google-sign-in";
import { SheetSetupDialog } from "@/components/onboarding/sheet-setup-dialog";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  AppBanner,
  AppBannerActionGroup,
  AppBannerActions,
  AppBannerContent,
  AppBannerCopy,
  AppBannerHint,
  AppBannerMessage,
  bannerAccentButtonClassName,
  bannerGhostButtonClassName,
} from "@/components/ui/app-banner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertTriangle, FileUp, Loader2, X } from "lucide-react";
import { devLog } from "@/lib/processing-utils";
import { cn } from "@/lib/utils";
import { GOOGLE_SHEETS_ICON_URL } from "@/lib/google-sheets-icon";
import { analyzeImportedEntries } from "@/lib/import/dedupe";
import { postImportHistory } from "@/lib/import-history-client";
import { openSheetSetupDialog } from "@/lib/open-sheet-setup";
import { PENDING_SHEET_ACTIONS } from "@/lib/pending-sheet-action";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import {
  isToday,
  parseISO,
  differenceInDays,
  differenceInWeeks,
  differenceInMonths,
  differenceInYears,
} from "date-fns";

const FORCE_SHEET_SYNC_TOAST_KEY = "SJ_forceNextSheetSyncToast";

/**
 * Root layout wrapper for the app. Renders nav, main content area, footer, and app background.
 * Also owns all toast notifications that were previously in useUserLiftingData.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Page content rendered inside the main element.
 */
export function Layout({ children }) {
  const {
    fetchFailed,
    apiError,
    isDemoMode,
    isImportedData,
    importedFormatName,
    clearImportedData,
    parseError,
    parsedData,
    rawRows,
    hasCachedSheetData,
    dataSyncedAt,
    sheetInfo,
    dataQualityWarnings,
    fixDataQualityWarning,
  } = useUserLiftingData();
  const { status: authStatus } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const feedbackLabels =
    router.pathname === "/log"
      ? {
          triggerLabels: [
            "How's the logging?",
            "Log feel right?",
            "Set tracking thoughts?",
            "Logging working for you?",
          ],
          tooltipMessages: [
            "How's logging your sets feeling? Tell us.",
            "Spot a rough edge in the log? Let us know.",
            "Logging ideas, bugs, or wishes welcome.",
          ],
          introTitle: "How's the logging treating you?",
          introDescription:
            "Anything awkward between sets, missing from the flow, or worth polishing? We tweak this page often and your notes go straight to the top of the list.",
          commentPlaceholder:
            "What's working, what's clunky, what's missing in the log...",
        }
      : undefined;

  // Once-per-session guards
  const apiErrorShown = useRef(false);
  const prevRawRowsRef = useRef(null);
  const parseErrorShown = useRef(false);
  const demoShown = useRef(false);

  // Sheet fetch error — uses fetchFailed from useSWR's onErrorRetry callback,
  // which only fires after retries are exhausted (not during transient gaps
  // between SWR's error/retry cycles). See use-userlift-data.js for details.
  //
  // When data is already loaded (either parsed in local state or still present
  // in SWR cache during a failed revalidation), revalidation failures are
  // silent. This avoids false destructive toasts on mobile resume where SWR
  // may return stale cached data + an error at the same time.
  useEffect(() => {
    if (apiErrorShown.current) return;
    if (!fetchFailed || authStatus !== "authenticated") return;
    if (rawRows != null || hasCachedSheetData) return;

    apiErrorShown.current = true;
    const { title, description } = buildApiErrorToast(apiError);
    toast({ variant: "destructive", title, description });
  }, [fetchFailed, authStatus, apiError, rawRows, hasCachedSheetData, toast]);

  // New sheet data — fires when new rows arrive, not on every SWR revalidation.
  // Skipped on "/" (home has its own widgets).
  // dataSyncedAt (set in SWR onSuccess) acts as the "fetch completed" heartbeat
  // that guarantees this effect runs on every successful revalidation.
  // rawRows provides deduplication — toast only shows when row count changed.
  useEffect(() => {
    if (!dataSyncedAt || rawRows == null) return;
    if (!parsedData || !parsedData.length) return;

    const isNewData = rawRows !== prevRawRowsRef.current;
    const shouldForceToastOnHome =
      typeof window !== "undefined" &&
      window.sessionStorage.getItem(FORCE_SHEET_SYNC_TOAST_KEY) === "true";
    devLog(
      `New sheet data check — rawRows: ${rawRows}, prev: ${prevRawRowsRef.current}, isNewData: ${isNewData}, dataSyncedAt: ${dataSyncedAt}, pathname: ${router.pathname}`,
    );
    prevRawRowsRef.current = rawRows;

    if (!isNewData && !shouldForceToastOnHome) return;
    if (
      (router.pathname === "/" || router.pathname === "/log") &&
      !shouldForceToastOnHome
    )
      return;
    if (shouldForceToastOnHome && typeof window !== "undefined") {
      window.sessionStorage.removeItem(FORCE_SHEET_SYNC_TOAST_KEY);
    }

    // Build relative date copy from the latest entry
    const latestDate = parsedData[parsedData.length - 1].date;
    const { latestDateString, gymInviteString } =
      buildLatestDataMessages(latestDate);

    toast({
      title: "Data updated from Google Sheets",
      description: (
        <>
          {sheetInfo?.url ? (
            <a
              href={sheetInfo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
            >
              {sheetInfo?.filename || "File name unknown"}
            </a>
          ) : (
            sheetInfo?.filename || "File name unknown"
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
  }, [dataSyncedAt, rawRows, parsedData, sheetInfo, router.pathname, toast]);

  // Sheet parse error
  useEffect(() => {
    if (parseErrorShown.current) return;
    if (!parseError) return;

    parseErrorShown.current = true;
    toast({
      variant: "destructive",
      title: "Data Parsing Error",
      description: parseError,
    });
  }, [parseError, toast]);

  // Sign-in nudge — delayed prompt on data pages when unauthenticated
  useEffect(() => {
    if (demoShown.current) return;
    if (authStatus === "loading") return;
    if (!isDemoMode || authStatus !== "unauthenticated") return;

    if (!PERSONALIZED_DATA_CTA_PATHS.includes(router.pathname)) return;

    const timeoutId = setTimeout(() => {
      if (demoShown.current) return;
      demoShown.current = true;
      const nudgeMessage = getRandomDemoModeNudgeMessage();
      toast({
        title: nudgeMessage.title,
        description: nudgeMessage.description,
        duration: DEMO_MODE_NUDGE_TOAST_DURATION_MS,
        action: (
          <GoogleSignInToastAction altText="Google Login" cta="demo_toast">
            Google Sign in
          </GoogleSignInToastAction>
        ),
      });
    }, getRandomDemoModeNudgeDelayMs());

    return () => clearTimeout(timeoutId);
  }, [authStatus, isDemoMode, router.asPath, router.pathname, toast]);

  return (
    <div className="bg-background relative min-h-screen w-full overflow-x-hidden">
      <AppBackground />

      <div className="relative z-10">
        <NavBar />
        {isImportedData ? (
          <ImportedDataBanner
            formatName={importedFormatName}
            entryCount={parsedData?.length || 0}
            onClear={clearImportedData}
          />
        ) : (
          <DataAccessBanner
            pathname={router.pathname}
            currentPath={router.asPath}
          />
        )}
        <DataQualityBanner
          warnings={dataQualityWarnings}
          onFix={fixDataQualityWarning}
        />
        <SheetSetupDialog />
        <main className="mx-0 md:mx-[3vw] lg:mx-[4vw] xl:mx-[5vw]">
          {children}
        </main>
        <Footer />
        <FeedbackWidget labels={feedbackLabels} />
      </div>
    </div>
  );
}

function buildApiErrorToast(apiError) {
  const status = apiError?.status;
  const statusLabel = status ? `HTTP ${status}` : "Request failed";
  const title = `Google Sheet sync failed (${statusLabel})`;

  if (status === 401 || status === 403) {
    return {
      title,
      description:
        "Your Google authorization may have expired. Try signing out and back in.",
    };
  }
  if (status === 404) {
    return {
      title,
      description: "Sheet not found — it may have been deleted or unshared.",
    };
  }
  return {
    title,
    description: apiError?.message || "No error details were provided.",
  };
}

function buildLatestDataMessages(latestDateISO) {
  const parsed = parseISO(latestDateISO);
  const now = new Date();
  const daysAgo = differenceInDays(now, parsed);

  if (isToday(parsed)) {
    return {
      latestDateString: "Latest data: Today",
      gymInviteString: getTodayInviteMessage(now),
    };
  }

  if (daysAgo === 1) {
    return {
      latestDateString: "Latest data: Yesterday",
      gymInviteString: "",
    };
  }

  const relativeUnits = [
    { value: daysAgo, max: 7, label: "day" },
    { value: differenceInWeeks(now, parsed), max: 3, label: "week" },
    { value: differenceInMonths(now, parsed), max: 11, label: "month" },
    {
      value: differenceInYears(now, parsed),
      max: Number.POSITIVE_INFINITY,
      label: "year",
    },
  ];

  const selected = relativeUnits.find(
    (unit) => unit.value >= 1 && unit.value <= unit.max,
  ) || { value: daysAgo, label: "day" };

  const latestDateString = `Latest data: ${selected.value} ${pluralizeUnit(selected.label, selected.value)} ago`;

  const gymInviteString =
    daysAgo > 7
      ? "🏋️‍♂️ It's been a while! Time to hit the gym?"
      : "Heading into the gym today, right?";

  return { latestDateString, gymInviteString };
}

function pluralizeUnit(unit, value) {
  return value === 1 ? unit : `${unit}s`;
}

const TODAY_INVITE_MESSAGES = [
  "💪 You're crushing it today! Keep going!",
  "🔥 Great momentum today. Keep stacking quality reps.",
  "🏋️ Nice work showing up today. Your future self will thank you.",
  "⚡ You're on a roll today. Keep the bar moving.",
  "✅ Solid session today. Keep building that consistency.",
  "🎯 You're dialed in today. Stay sharp and finish strong.",
  "🚀 Big energy today. Keep that training focus.",
  "👏 You're putting in real work today. One set at a time.",
  "📈 Strong progress today. Keep owning the session.",
  "💥 Excellent effort today. Keep the streak alive.",
];

function getTodayInviteMessage(now = new Date()) {
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now - startOfYear) / 86400000);
  return TODAY_INVITE_MESSAGES[dayOfYear % TODAY_INVITE_MESSAGES.length];
}

// Routes where demo mode needs explicit context plus the primary next-step CTAs.
// Keep this limited to core analysis pages that interpret a user's lifting data,
// so demo visitors understand they are seeing sample output and can either sign
// in or jump straight to preview-mode import.
const PERSONALIZED_DATA_CTA_PATHS = [
  "/log",
  "/visualizer",
  "/lift-explorer",
  "/tonnage",
  "/progress-guide/[lift]",
  "/strength-year-in-review",
];
const DEMO_MODE_NUDGE_DELAY_MIN_MS = 20000;
const DEMO_MODE_NUDGE_DELAY_MAX_MS = 30000;
const DEMO_MODE_NUDGE_TOAST_DURATION_MS = 12000;
const DEMO_MODE_NUDGE_MESSAGES = [
  {
    title: "Demo Data",
    description:
      "You are exploring demo data. Sign in to see your own lifting history here.",
  },
  {
    title: "Sample Lifts",
    description:
      "This chart is using sample lifts. Connect your data to make it personal.",
  },
  {
    title: "Your Numbers",
    description:
      "Most lifters want to see their numbers here. Sign in when you are ready.",
  },
  {
    title: "Make It Yours",
    description: "This gets more interesting once it is your training history.",
  },
  {
    title: "Strength Over Time",
    description:
      "See how your strength has changed over time. Sign in to unlock it.",
  },
  {
    title: "Best With Your Data",
    description: "These insights work best with your own lifts behind them.",
  },
  {
    title: "How Would Yours Look?",
    description: "Wondering how this would look with your data?",
  },
  {
    title: "Personal Best Sessions",
    description: "Curious what your best sessions would look like here?",
  },
  {
    title: "Viewing Demo Data",
    description: "Viewing demo data. Sign in to personalize.",
  },
];

// Internal banner shown on data pages when the user is unauthenticated or has no sheet connected.
function DataAccessBanner({ pathname, currentPath }) {
  const { status: authStatus } = useSession();
  const { sheetInfo, isDemoMode } = useUserLiftingData();

  const isDataPage = PERSONALIZED_DATA_CTA_PATHS.includes(pathname);
  const showSignInCta = isDataPage && authStatus === "unauthenticated";
  const showSetupSheetCta =
    isDataPage && authStatus === "authenticated" && !sheetInfo?.ssid;

  if (!showSignInCta && !showSetupSheetCta) return null;

  return (
    <AppBanner tint="amber">
      <AppBannerContent density="comfortable">
        <AppBannerMessage>
          {showSignInCta
            ? "You are viewing demo data. Want to see your own lifts, trends, and PRs here? Sign in with Google or import a data export from popular lifting apps instantly in preview mode."
            : isDemoMode
              ? "Demo mode is on. Connect your data to replace the sample view with your own lifting history here."
              : "Connect your data to replace the sample view with your own lifting history here."}
        </AppBannerMessage>
        {showSignInCta ? (
          <AppBannerActions>
            <AppBannerActionGroup>
              <GoogleSignInButton size="sm" cta="demo_banner">
                Sign in with Google
              </GoogleSignInButton>
              <AppBannerHint className="mt-1.5">
                Free forever. Your data stays yours.
              </AppBannerHint>
            </AppBannerActionGroup>
            <AppBannerActionGroup>
              <Button size="sm" variant="outline" asChild>
                <Link
                  href={{
                    pathname: "/import",
                    query: { returnTo: currentPath },
                  }}
                  className="flex items-center gap-2"
                >
                  <FileUp className="h-4 w-4" />
                  Import From Another Fitness App
                </Link>
              </Button>
              <AppBannerHint className="mt-1.5">
                Instant preview. No sign-in required.
              </AppBannerHint>
            </AppBannerActionGroup>
          </AppBannerActions>
        ) : (
          <AppBannerActions>
            <AppBannerActionGroup>
              <Button
                size="sm"
                className="flex items-center gap-2"
                onClick={() => {
                  openSheetSetupDialog("bootstrap");
                }}
              >
                <img
                  src={GOOGLE_SHEETS_ICON_URL}
                  alt=""
                  className="h-4 w-4 shrink-0"
                  aria-hidden
                />
                Set Up Google Sheet
              </Button>
              <AppBannerHint className="mt-1.5">
                Free forever. Your data stays yours.
              </AppBannerHint>
            </AppBannerActionGroup>
            <AppBannerActionGroup>
              <Button size="sm" variant="outline" asChild>
                <Link
                  href={{
                    pathname: "/import",
                    query: { returnTo: currentPath },
                  }}
                  className="flex items-center gap-2"
                >
                  <FileUp className="h-4 w-4" />
                  Import From Another Fitness App
                </Link>
              </Button>
              <AppBannerHint className="mt-1.5">
                Instant preview first. Save or merge when you&apos;re ready.
              </AppBannerHint>
            </AppBannerActionGroup>
          </AppBannerActions>
        )}
      </AppBannerContent>
    </AppBanner>
  );
}

function DataQualityBanner({ warnings, onFix }) {
  const { toast } = useToast();
  const [dismissed, setDismissed] = useState(null);
  const [workingSignature, setWorkingSignature] = useState(null);

  useEffect(() => {
    try {
      setDismissed(
        JSON.parse(
          localStorage.getItem(
            LOCAL_STORAGE_KEYS.DISMISSED_DATA_QUALITY_WARNINGS,
          ) || "{}",
        ),
      );
    } catch {
      setDismissed({});
    }
  }, []);

  const warning = useMemo(() => {
    if (!dismissed || !Array.isArray(warnings)) return null;
    return warnings.find((item) => !dismissed[item.signature]) || null;
  }, [dismissed, warnings]);

  const dismissWarning = useCallback(() => {
    if (!warning?.signature) return;
    setDismissed((prev) => {
      const next = {
        ...(prev || {}),
        [warning.signature]: Date.now(),
      };
      try {
        localStorage.setItem(
          LOCAL_STORAGE_KEYS.DISMISSED_DATA_QUALITY_WARNINGS,
          JSON.stringify(next),
        );
      } catch {
        // localStorage unavailable — still dismiss for this render tree
      }
      return next;
    });
  }, [warning]);

  const handleFix = useCallback(async () => {
    if (!warning || !onFix) return;
    setWorkingSignature(warning.signature);
    try {
      await onFix(warning);
      toast({
        title: "Date fixed",
        description: `Updated ${warning.affectedSetCount.toLocaleString()} ${warning.affectedSetCount === 1 ? "set" : "sets"}.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Could not fix date",
        description:
          error?.message ||
          "Refresh your data and try again. If it still fails, send feedback.",
      });
    } finally {
      setWorkingSignature(null);
    }
  }, [onFix, toast, warning]);

  if (!warning) return null;

  const isWorking = workingSignature === warning.signature;
  const affectedLabel =
    warning.actionLabel ||
    (warning.affectedSetCount === 1
      ? "Fix date"
      : `Fix ${warning.affectedSetCount.toLocaleString()} sets`);

  return (
    <AppBanner tint="amberAlert">
      <AppBannerContent density="compact">
        <AppBannerMessage className="max-w-4xl">
          <AlertTriangle className="-mt-0.5 mr-1.5 inline-block h-4 w-4" />
          {warning.message}
        </AppBannerMessage>
        <AppBannerActions className="flex-row flex-wrap">
          <Button
            size="sm"
            className={cn(
              "h-7 text-xs",
              bannerAccentButtonClassName({ tint: "amberAlert" }),
            )}
            disabled={isWorking}
            onClick={handleFix}
          >
            {isWorking && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            {isWorking ? "Fixing..." : affectedLabel}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={bannerGhostButtonClassName({ tint: "amberAlert" })}
            disabled={isWorking}
            onClick={dismissWarning}
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Dismiss
          </Button>
        </AppBannerActions>
      </AppBannerContent>
    </AppBanner>
  );
}

// Blue banner shown across the app when the user has imported CSV data (view-only mode).
// Offers contextual CTAs based on auth state:
// - Not signed in: sign-in CTA (data will be saved to a new GSheet)
// - Signed in + no sheet: "Save to Google Sheet" button
// - Signed in + has sheet: "Merge into your sheet" button
function ImportedDataBanner({ formatName, entryCount, onClear }) {
  const router = useRouter();
  const { status: authStatus } = useSession();
  const {
    sheetInfo,
    parsedData,
    sheetParsedData,
    isLoading,
    mutate,
    clearImportedData,
  } = useUserLiftingData();
  const { toast } = useToast();
  const [working, setWorking] = useState(false);

  const isAuthenticated = authStatus === "authenticated";
  const hasSsid = !!sheetInfo?.ssid;
  const importAnalysis = useMemo(() => {
    if (!hasSsid) return null;
    return analyzeImportedEntries(parsedData || [], sheetParsedData);
  }, [hasSsid, parsedData, sheetParsedData]);
  const mergeEntryCount = importAnalysis?.newEntriesCount ?? 0;
  const duplicateCount = importAnalysis?.duplicateCount ?? 0;
  const isFullyDuplicate = importAnalysis?.status === "already_in_linked_sheet";
  const isPartialOverlap = importAnalysis?.status === "partial_overlap";
  const isSheetComparisonPending =
    hasSsid && isAuthenticated && isLoading && !Array.isArray(sheetParsedData);

  const handleMergeFromBanner = useCallback(async () => {
    if (!parsedData || !sheetInfo?.ssid) return;
    if (isSheetComparisonPending) {
      toast({
        title: "Still checking your sheet",
        description: "Wait a moment so Strength Journeys can compare this preview against your linked data.",
      });
      return;
    }

    const { newEntries, duplicateCount: skippedCount } = analyzeImportedEntries(
      parsedData,
      sheetParsedData,
    );

    if (newEntries.length === 0) {
      toast({
        title: "Nothing new to merge",
        description: `All ${skippedCount} entries already exist in your linked sheet.`,
      });
      return;
    }

    setWorking(true);
    try {
      const apiEntries = newEntries.map((e) => ({
        date: e.date,
        liftType: e.liftType,
        reps: e.reps,
        weight: e.weight,
        unitType: e.unitType || "kg",
        ...(e.notes ? { notes: e.notes } : {}),
      }));
      const res = await postImportHistory({
        ssid: sheetInfo.ssid,
        entries: apiEntries,
      }, {
        source: "preview_banner_merge",
        formatName,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Merge failed");

      const skippedNote =
        skippedCount > 0
          ? ` Skipped ${skippedCount} duplicate${skippedCount === 1 ? "" : "s"}.`
          : "";
      toast({
        title: "Data merged!",
        description: `Added ${data.insertedRows} rows across ${data.dateCount} date${data.dateCount === 1 ? "" : "s"}.${skippedNote}`,
      });
      clearImportedData();
      mutate();
    } catch (err) {
      toast({
        title: "Merge failed",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setWorking(false);
    }
  }, [
    parsedData,
    sheetParsedData,
    sheetInfo,
    isSheetComparisonPending,
    clearImportedData,
    formatName,
    mutate,
    toast,
  ]);

  const handleCreateFromBanner = useCallback(() => {
    if (!parsedData || parsedData.length === 0) return;

    // Keep preview save orchestration inside the shared dialog so the missing-
    // scope fallback remains a narrow recovery rail instead of a banner mode.
    openSheetSetupDialog("bootstrap", {
      action: PENDING_SHEET_ACTIONS.CREATE_SHEET_FROM_IMPORT,
    });
  }, [parsedData]);

  return (
    <AppBanner tint="blue">
      <AppBannerContent density="compact">
        <AppBannerCopy>
          <AppBannerMessage>
            <FileUp className="-mt-0.5 mr-1.5 inline-block h-4 w-4" />
            {hasSsid && isFullyDuplicate
              ? `This preview file already matches your linked sheet.`
              : hasSsid && isPartialOverlap
                ? `This preview adds ${mergeEntryCount.toLocaleString()} new ${mergeEntryCount === 1 ? "entry" : "entries"}; ${duplicateCount.toLocaleString()} already exist in your linked sheet.`
                : hasSsid
                  ? `This preview has ${entryCount.toLocaleString()} ${entryCount === 1 ? "lift" : "lifts"} ready for your linked sheet.`
                  : `You're in preview mode with ${entryCount.toLocaleString()} ${entryCount === 1 ? "lift" : "lifts"}.`}
            {!hasSsid && (
              <span className="hidden sm:inline">
                {" "}
                Save your data to turn this into a full training log with auto
                warm-ups and progression targets.
              </span>
            )}
          </AppBannerMessage>
          <AppBannerHint size="2xs">
            {hasSsid && isFullyDuplicate
              ? "No merge is needed unless you import a different file."
              : "Preview data will be lost when you leave."}
          </AppBannerHint>
        </AppBannerCopy>
        <AppBannerActions className="flex-row flex-wrap">
          {/* Not signed in: primary save CTA */}
          {!isAuthenticated && authStatus !== "loading" && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <GoogleSignInButton
                    size="sm"
                    cta="preview_banner"
                    className="h-7 text-xs"
                  >
                    Save my data
                  </GoogleSignInButton>
                </TooltipTrigger>
                <TooltipContent>
                  Google will ask for Drive access. Approve it to save your
                  sheet.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {/* Signed in + has sheet: merge */}
          {isAuthenticated && hasSsid && !isFullyDuplicate && (
            <Button
              size="sm"
              className={cn(
                "h-7 text-xs",
                bannerAccentButtonClassName({ tint: "blue" }),
              )}
              disabled={working || isSheetComparisonPending}
              onClick={handleMergeFromBanner}
            >
              {isSheetComparisonPending
                ? "Checking sheet..."
                : working
                  ? "Saving..."
                  : `Merge ${mergeEntryCount.toLocaleString()} ${mergeEntryCount === 1 ? "entry" : "entries"}`}
            </Button>
          )}
          {/* Signed in + no sheet: create */}
          {isAuthenticated && !hasSsid && (
            <Button
              size="sm"
              className={cn(
                "h-7 text-xs",
                bannerAccentButtonClassName({ tint: "blue" }),
              )}
              onClick={handleCreateFromBanner}
            >
              Save my data
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className={bannerGhostButtonClassName({ tint: "blue" })}
            onClick={onClear}
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Clear preview
          </Button>
        </AppBannerActions>
      </AppBannerContent>
    </AppBanner>
  );
}

function getRandomDemoModeNudgeMessage() {
  const index = Math.floor(Math.random() * DEMO_MODE_NUDGE_MESSAGES.length);
  return DEMO_MODE_NUDGE_MESSAGES[index];
}

function getRandomDemoModeNudgeDelayMs() {
  return (
    Math.floor(
      Math.random() *
        (DEMO_MODE_NUDGE_DELAY_MAX_MS - DEMO_MODE_NUDGE_DELAY_MIN_MS + 1),
    ) + DEMO_MODE_NUDGE_DELAY_MIN_MS
  );
}
