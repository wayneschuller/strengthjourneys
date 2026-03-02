/** @format */


import { useRef, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { useSession, signIn } from "next-auth/react";
import { NavBar } from "@/components/nav-bar";
import { Footer } from "@/components/footer";
import { AppBackground } from "@/components/app-background";
import { FeedbackWidget } from "@/components/feedback";
import { DrivePickerContainer } from "@/components/drive-picker-container";
import { GoogleLogo } from "@/components/hero-section";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { gaTrackSignInClick } from "@/lib/analytics";
import { handleOpenFilePicker } from "@/lib/handle-open-picker";
import { GOOGLE_SHEETS_ICON_URL } from "@/lib/google-sheets-icon";
import {
  isToday,
  parseISO,
  differenceInDays,
  differenceInWeeks,
  differenceInMonths,
  differenceInYears,
} from "date-fns";

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
    parseError,
    parsedData,
    rawRows,
    syncKey,
    hasCachedSheetData,
    dataSyncedAt,
    sheetInfo,
  } = useUserLiftingData();
  const { status: authStatus } = useSession();
  const router = useRouter();
  const { toast } = useToast();

  // Once-per-session guards
  const apiErrorShown = useRef(false);
  const prevSyncKeyRef = useRef(null);
  const parseErrorShown = useRef(false);
  const demoShown = useRef(false);

  // Toast 1: API Error — uses fetchFailed from useSWR's onErrorRetry callback,
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

    const statusLabel = apiError?.status
      ? `HTTP ${apiError.status}${apiError?.statusText ? ` ${apiError.statusText}` : ""}`
      : "Request failed";
    apiErrorShown.current = true;

    toast({
      variant: "destructive",
      title: `Google Sheet sync failed (${statusLabel})`,
      description: apiError?.message || "No error details were provided.",
    });
  }, [fetchFailed, authStatus, apiError, rawRows, hasCachedSheetData, toast]);

  // Toast 2: Data Loaded — fires when sheet data actually changes (new rows OR
  // cell edits detected via Drive modifiedByMeTime), not on every SWR
  // revalidation. Skipped on "/" (home has its own widgets).
  // syncKey is computed atomically from SWR data (row count + modification
  // time), so there is no timing gap between the two signals.
  useEffect(() => {
    if (!syncKey) return;
    if (!parsedData || !parsedData.length) return;

    const isNewData = syncKey !== prevSyncKeyRef.current;
    prevSyncKeyRef.current = syncKey;

    if (!isNewData) return;
    if (router.pathname === "/") return;

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
  }, [syncKey, parsedData, sheetInfo, router.pathname, toast]);

  // Toast 3: Parse Error
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

  // Toast 4: Demo mode nudge (delayed, on data pages when unauthenticated)
  useEffect(() => {
    if (demoShown.current) return;
    if (authStatus === "loading") return;
    if (!isDemoMode || authStatus !== "unauthenticated") return;

    if (!DATA_ACCESS_BANNER_PATHS.includes(router.pathname)) return;

    const timeoutId = setTimeout(() => {
      if (demoShown.current) return;
      demoShown.current = true;
      const nudgeMessage = getRandomDemoModeNudgeMessage();
      toast({
        title: nudgeMessage.title,
        description: nudgeMessage.description,
        duration: DEMO_MODE_NUDGE_TOAST_DURATION_MS,
        action: (
          <ToastAction
            altText="Google Login"
            className="inline-flex items-center gap-2"
            onClick={() => {
              gaTrackSignInClick(router.pathname);
              signIn("google");
            }}
          >
            <GoogleLogo size={14} />
            Google Sign in
          </ToastAction>
        ),
      });
    }, getRandomDemoModeNudgeDelayMs());

    return () => clearTimeout(timeoutId);
  }, [authStatus, isDemoMode, router.pathname, toast]);

  return (
    <div className="bg-background relative min-h-screen w-full">
      <AppBackground />

      <div className="relative z-10">
        <NavBar />
        <DataAccessBanner pathname={router.pathname} />
        <main className="mx-0 md:mx-[3vw] lg:mx-[4vw] xl:mx-[5vw]">
          {children}
        </main>
        <Footer />
        <FeedbackWidget />
      </div>
    </div>
  );
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

const DATA_ACCESS_BANNER_PATHS = [
  "/visualizer",
  "/analyzer",
  "/barbell-strength-potential",
  "/tonnage",
  "/[lift]",
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
function DataAccessBanner({ pathname }) {
  const { data: session, status: authStatus } = useSession();
  const { sheetInfo, selectSheet } = useUserLiftingData();
  const [openPicker, setOpenPicker] = useState(null);
  const [shouldLoadPicker, setShouldLoadPicker] = useState(false);

  const isDataPage = DATA_ACCESS_BANNER_PATHS.includes(pathname);
  const showSignInCta = isDataPage && authStatus === "unauthenticated";
  const showConnectSheetCta =
    isDataPage && authStatus === "authenticated" && !sheetInfo?.ssid;

  useEffect(() => {
    if (showConnectSheetCta) {
      setShouldLoadPicker(true);
    }
  }, [showConnectSheetCta]);

  const handlePickerReady = useCallback((picker) => {
    setOpenPicker(() => picker);
  }, []);

  if (!showSignInCta && !showConnectSheetCta) return null;

  return (
    <>
      {showConnectSheetCta && shouldLoadPicker && (
        <DrivePickerContainer
          onReady={handlePickerReady}
          trigger={shouldLoadPicker}
          oauthToken={session?.accessToken}
          selectSheet={selectSheet}
        />
      )}
      <section className="mb-3 border-y bg-amber-100/60">
        <div className="mx-0 flex flex-col items-center justify-center gap-3 px-4 py-3 text-center md:mx-[3vw] lg:mx-[4vw] xl:mx-[5vw]">
          <p className="text-sm leading-tight text-amber-950">
            {showSignInCta
              ? "You are viewing demo data. Sign in with Google to unlock your personal lifting history."
              : "You are signed in. Connect your Google Sheet to load your own lifting history."}
          </p>
          {showSignInCta ? (
            <Button
              size="sm"
              className="flex items-center gap-2"
              onClick={() => {
                gaTrackSignInClick(pathname);
                signIn("google");
              }}
            >
              <GoogleLogo size={16} />
              Sign in with Google
            </Button>
          ) : (
            <Button
              size="sm"
              className="flex items-center gap-2"
              disabled={!openPicker}
              onClick={() => {
                if (openPicker) {
                  handleOpenFilePicker(openPicker);
                }
              }}
            >
              <img
                src={GOOGLE_SHEETS_ICON_URL}
                alt=""
                className="h-4 w-4 shrink-0"
                aria-hidden
              />
              {openPicker
                ? "Connect Google Sheet"
                : "Loading Google Sheet picker..."}
            </Button>
          )}
        </div>
      </section>
    </>
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
