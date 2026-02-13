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

  // Toast 2: Data Loaded (once per session, not on the home page)
  useEffect(() => {
    if (dataLoadedShown.current) return;
    if (!dataSyncedAt) return;
    if (!parsedData || !parsedData.length) return;
    if (router.pathname === "/") return;

    dataLoadedShown.current = true;

    // Build relative date string from the latest entry
    const latestDate = parsedData[parsedData.length - 1].date;
    const parsed = parseISO(latestDate);
    const now = new Date();
    const daysAgo = differenceInDays(now, parsed);
    const weeksAgo = differenceInWeeks(now, parsed);
    const monthsAgo = differenceInMonths(now, parsed);
    const yearsAgo = differenceInYears(now, parsed);

    let latestDateString = "";
    let gymInviteString = "";

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

    if (daysAgo > 7) {
      gymInviteString = "🏋️‍♂️ It's been a while! Time to hit the gym?";
    }

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
