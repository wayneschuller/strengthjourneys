/** @format */


import { useRef, useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { NavBar } from "@/components/nav-bar";
import { Footer } from "@/components/footer";
import { AppBackground } from "@/components/app-background";
import { FeedbackWidget } from "@/components/feedback";
import {
  GoogleSignInButton,
  GoogleSignInToastAction,
} from "@/components/google-sign-in";
import { SheetSetupDialog } from "@/components/sheet-setup-dialog";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { devLog } from "@/lib/processing-utils";
import { GOOGLE_SHEETS_ICON_URL } from "@/lib/google-sheets-icon";
import { openSheetSetupDialog } from "@/lib/open-sheet-setup";
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
    parseError,
    parsedData,
    rawRows,
    hasCachedSheetData,
    dataSyncedAt,
    sheetInfo,
  } = useUserLiftingData();
  const { status: authStatus } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const feedbackLabels = router.pathname === "/log"
    ? {
        triggerLabels: [
          "Logging is new. Feedback?",
          "Logging is in beta. Thoughts?",
          "New logging feature. Comments?",
        ],
        tooltipMessages: ["Logging is in beta. Leave feedback or bug reports."],
        introTitle: "Logging is in beta. How's it feeling?",
        introDescription:
          "If anything feels confusing, broken, or worth polishing in the log, please leave feedback.",
        commentPlaceholder: "Bug report, rough edge, or idea about logging...",
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
    if ((router.pathname === "/" || router.pathname === "/log") && !shouldForceToastOnHome) return;
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
          <GoogleSignInToastAction altText="Google Login" cta="demo_toast">
            Google Sign in
          </GoogleSignInToastAction>
        ),
      });
    }, getRandomDemoModeNudgeDelayMs());

    return () => clearTimeout(timeoutId);
  }, [authStatus, isDemoMode, router.asPath, router.pathname, toast]);

  return (
    <div className="bg-background relative min-h-screen w-full">
      <AppBackground />

      <div className="relative z-10">
        <NavBar />
        <DataAccessBanner pathname={router.pathname} />
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

const DATA_ACCESS_BANNER_PATHS = [
  "/visualizer",
  "/lift-explorer",
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
  const { status: authStatus } = useSession();
  const { sheetInfo, isDemoMode } = useUserLiftingData();

  const isDataPage = DATA_ACCESS_BANNER_PATHS.includes(pathname);
  const showSignInCta = isDataPage && authStatus === "unauthenticated";
  const showSetupSheetCta =
    isDataPage && authStatus === "authenticated" && !sheetInfo?.ssid;

  if (!showSignInCta && !showSetupSheetCta) return null;

  return (
    <>
      <section className="mb-3 border-y bg-amber-100/60">
        <div className="mx-0 flex flex-col items-center justify-center gap-3 px-4 py-3 text-center md:mx-[3vw] lg:mx-[4vw] xl:mx-[5vw]">
          <p className="text-sm leading-tight text-amber-950">
            {showSignInCta
              ? "You are viewing demo data. Sign in with Google to unlock your personal lifting history."
              : isDemoMode
                ? "Demo mode is on. Set up your Google Sheet and Strength Journeys will help you get it ready so your own lifting history appears here."
                : "Set up your Google Sheet and Strength Journeys will help you get it ready so your own lifting history appears here."}
          </p>
          {showSignInCta ? (
            <GoogleSignInButton
              size="sm"
              cta="demo_banner"
            >
              Sign in with Google
            </GoogleSignInButton>
          ) : (
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
