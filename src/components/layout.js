/** @format */

"use client";

import { useRef, useEffect } from "react";
import { useRouter } from "next/router";
import { useSession, signIn } from "next-auth/react";
import { NavBar } from "@/components/nav-bar";
import { Footer } from "@/components/footer";
import { AppBackground } from "@/components/app-background";
import { FeedbackWidget } from "@/components/feedback-widget";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { gaTrackSignInClick } from "@/lib/analytics";
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
    isError,
    isDemoMode,
    parseError,
    parsedData,
    dataSyncedAt,
    sheetInfo,
  } = useUserLiftingData();
  const { status: authStatus } = useSession();
  const router = useRouter();
  const { toast } = useToast();

  // Once-per-session guards
  const apiErrorShown = useRef(false);
  const dataLoadedShown = useRef(false);
  const parseErrorShown = useRef(false);
  const demoShown = useRef(false);

  // Toast 1: API Error
  useEffect(() => {
    if (apiErrorShown.current) return;
    if (isError && authStatus === "authenticated") {
      apiErrorShown.current = true;
      toast({
        variant: "destructive",
        title: "Uh oh! Something went wrong.",
        description: "Lift some weights and come back later.",
      });
    }
  }, [isError, authStatus, toast]);

  // Toast 2: Data Loaded (once per session, but not on "/" because home has
  // dedicated data-loading/status widgets with richer detail)
  useEffect(() => {
    if (dataLoadedShown.current) return;
    if (!dataSyncedAt) return;
    if (!parsedData || !parsedData.length) return;
    if (router.pathname === "/") return;

    dataLoadedShown.current = true;

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
  }, [dataSyncedAt, parsedData, sheetInfo, router.pathname, toast]);

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

  // Toast 4: Demo Mode (on specific pages when unauthenticated)
  useEffect(() => {
    if (demoShown.current) return;
    if (authStatus === "loading") return;
    if (!isDemoMode || authStatus !== "unauthenticated") return;

    const demoDataPaths = [
      "/visualizer",
      "/analyzer",
      "/barbell-strength-potential",
      "/tonnage",
      "/[lift]",
      "/strength-year-in-review",
    ];
    if (!demoDataPaths.includes(router.pathname)) return;

    demoShown.current = true;
    toast({
      title: "Demo Mode",
      description:
        "Sign in via Google to visualize your personal Google Sheet lifting data.",
      action: (
        <ToastAction
          altText="Google Login"
          onClick={() => {
            gaTrackSignInClick(router.pathname);
            signIn("google");
          }}
        >
          Google Sign in
        </ToastAction>
      ),
    });
  }, [authStatus, isDemoMode, router.pathname, toast]);

  return (
    <div className="relative min-h-screen w-full bg-background">
      <AppBackground />

      <div className="relative z-10">
        <NavBar />
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
    { value: differenceInYears(now, parsed), max: Number.POSITIVE_INFINITY, label: "year" },
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
