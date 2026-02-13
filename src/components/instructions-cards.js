"use client";

import { useState, useEffect, useContext, useCallback } from "react";
import { useRouter } from "next/router";
import { DrivePickerContainer } from "@/components/drive-picker-container";
import { handleOpenFilePicker } from "@/lib/handle-open-picker";
import { gaTrackSignInClick } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { devLog } from "@/lib/processing-utils";
import Image from "next/image";
import {
  ArrowDown,
  ArrowRight,
  ArrowBigDown,
  ArrowBigRight,
} from "lucide-react";
import { useSession, signIn, signOut } from "next-auth/react";
import Link from "next/link";

import SampleImage from "../../public/sample_google_sheet_fuzzy_border.png";
import { GoogleLogo } from "@/components/hero-section";
import { GOOGLE_SHEETS_ICON_URL } from "@/lib/google-sheets-icon";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// This is very similar to the ChooseSheetInstructionsCard but designed for the front page
export function OnBoardingDashboard() {
  const [openPicker, setOpenPicker] = useState(null);
  const [shouldLoadPicker, setShouldLoadPicker] = useState(false);
  const { data: session, status: authStatus } = useSession();
  const { selectSheet } = useUserLiftingData();

  const handlePickerReady = useCallback((picker) => {
    setOpenPicker(() => picker);
  }, []);

  // Load picker when component mounts (user needs it for onboarding)
  useEffect(() => {
    if (authStatus === "authenticated" && !shouldLoadPicker) {
      setShouldLoadPicker(true);
    }
  }, [authStatus, shouldLoadPicker]);

  return (
    <>
      {shouldLoadPicker && (
        <DrivePickerContainer
          onReady={handlePickerReady}
          trigger={shouldLoadPicker}
          oauthToken={session?.accessToken}
          selectSheet={selectSheet}
        />
      )}
      <div className="grid grid-cols-1 md:grid-cols-2">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <img
            src={GOOGLE_SHEETS_ICON_URL}
            alt=""
            className="h-6 w-6 shrink-0"
            aria-hidden
          />
          Successful sign-in! Let{"'"}s connect your lifting data
        </h2>
        <div className="flex flex-col gap-4">
          <div className="">
            In two quick steps, you’ll connect your personal Google Sheet so
            Strength Journeys can show your training insights — while your data
            stays yours.
          </div>
          <Button asChild className="w-fit self-center">
            <a
              href="https://docs.google.com/spreadsheets/d/14J9z9iJBCeJksesf3MdmpTUmo2TIckDxIQcTx1CPEO0/edit#gid=0"
              target="_blank"
              rel="noopener noreferrer"
            >
              Step 1 - Open Google Sheet Template
            </a>
          </Button>
          <div className="mb-6">
            In Google Sheets click <em>File → Make a copy</em>. Give it a good
            name and start entering your own lifts.
          </div>
          <Button
            className="w-fit self-center disabled:cursor-wait disabled:opacity-70"
            onClick={() => {
              if (openPicker) handleOpenFilePicker(openPicker);
            }}
            disabled={!openPicker}
            title={
              !openPicker
                ? "Loading Google Picker… (allow Google scripts if blocked)"
                : undefined
            }
          >
            {openPicker
              ? "Step 2 - Connect your Google Sheet to Strength Journeys"
              : "Step 2 - Connect your Google Sheet (loading…)"}
          </Button>

          <div className="text-sm">
            Strength Journeys does not collect or store your data. Instead we
            encourage every lifter to own the data of their personal strength
            journey.
          </div>
        </div>
      </div>
      <div className="md-auto flex flex-col md:ml-32">
        <figure className="">
          <a
            href="https://docs.google.com/spreadsheets/d/14J9z9iJBCeJksesf3MdmpTUmo2TIckDxIQcTx1CPEO0/edit#gid=0"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              className="w-96 rounded-lg shadow-sm"
              src={SampleImage}
              priority
              alt="Screenshot of sample Google Sheet data"
            />
          </a>
          <figcaption className="mt-2 self-start text-sm text-gray-500">
            Example of your lifting log — simple, editable, and yours.
          </figcaption>
        </figure>

        <div className="mt-4 text-sm leading-relaxed text-gray-500">
          <p className="font-semibold text-gray-700">
            Our sample format is intuitive and easy to update. Some tips:
          </p>
          <ul className="list-inside list-disc text-left">
            <li>Use either “kg” or “lb” — the app reads both.</li>
            <li>Insert new rows and put your latest session at the top.</li>
          </ul>
        </div>
      </div>
    </div>
    </>
  );
}

// This card is shown if the user goes to the visualizer or analyzer with google auth but no spreadsheet selected
export function ChooseSheetInstructionsCard() {
  const [openPicker, setOpenPicker] = useState(null);
  const [shouldLoadPicker, setShouldLoadPicker] = useState(false);
  const { data: session, status: authStatus } = useSession();

  const handlePickerReady = useCallback((picker) => {
    setOpenPicker(() => picker);
  }, []);

  // Load picker when component mounts (user needs it to choose sheet)
  useEffect(() => {
    if (session && !shouldLoadPicker) {
      setShouldLoadPicker(true);
    }
  }, [session, shouldLoadPicker]);

  const { selectSheet } = useUserLiftingData();

  if (!session) return null;

  return (
    <>
      {shouldLoadPicker && (
        <DrivePickerContainer
          onReady={handlePickerReady}
          trigger={shouldLoadPicker}
          oauthToken={session?.accessToken}
          selectSheet={selectSheet}
        />
      )}
      <Card className="md:w-2/3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <img
              src={GOOGLE_SHEETS_ICON_URL}
              alt=""
              className="h-5 w-5 shrink-0"
              aria-hidden
            />
            Hello {session.user.name}! You are logged in.
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="">
            Next step is to link your personal Google sheet of your lifting data.
          </div>
          <div className="">
            Our{" "}
            <a
              href="https://docs.google.com/spreadsheets/d/14J9z9iJBCeJksesf3MdmpTUmo2TIckDxIQcTx1CPEO0/edit#gid=0"
              target="_blank"
              className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
            >
              sample Google Sheet
            </a>{" "}
            format is intuitive and easy to update. Make a copy and start entering
            your lifts. (You can use {`"kg"`} or {`"lb"`})
          </div>
          <div className="">
            <a
              href="https://docs.google.com/spreadsheets/d/14J9z9iJBCeJksesf3MdmpTUmo2TIckDxIQcTx1CPEO0/edit#gid=0"
              target="_blank"
            >
              <Image
                className="w-5/6 md:w-1/2"
                src={SampleImage}
                priority={true}
                alt="Screenshot of sample google sheet data"
              />
            </a>
          </div>
          <div className="">
            Strength Journeys does not collect or store your data. Instead we
            encourage every lifter to own the data of their personal strength
            journey.
          </div>
          <div className="">
            Link a Google sheet then every time you use Strength Journeys your web
            client will read your data and bring insights and inspiration!
          </div>
        </CardContent>
        <CardFooter>
          <Button
            className="w-full disabled:cursor-wait disabled:opacity-70"
            onClick={() => {
              if (openPicker) handleOpenFilePicker(openPicker);
            }}
            disabled={!openPicker}
            title={
              !openPicker
                ? "Loading Google Picker… (allow Google scripts if blocked)"
                : undefined
            }
          >
            {openPicker ? "Choose Google Sheet" : "Choose Google Sheet (loading…)"}
          </Button>
        </CardFooter>
      </Card>
    </>
  );
}

export function GettingStartedCard() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const [openPicker, setOpenPicker] = useState(null);
  const [shouldLoadPicker, setShouldLoadPicker] = useState(false);

  const handlePickerReady = useCallback((picker) => {
    setOpenPicker(() => picker);
  }, []);

  // Load picker when user is authenticated and might use it
  useEffect(() => {
    if (authStatus === "authenticated" && !shouldLoadPicker) {
      setShouldLoadPicker(true);
    }
  }, [authStatus, shouldLoadPicker]);

  const { sheetInfo, selectSheet } = useUserLiftingData();

  const arrowSize = 75;
  return (
    <>
      {shouldLoadPicker && (
        <DrivePickerContainer
          onReady={handlePickerReady}
          trigger={shouldLoadPicker}
          oauthToken={session?.accessToken}
          selectSheet={selectSheet}
        />
      )}
      <Card className="hover:ring-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <img
              src={GOOGLE_SHEETS_ICON_URL}
              alt=""
              className="h-6 w-6 shrink-0"
              aria-hidden
            />
            Getting Started: Set Up Google Sheets and Connect with Strength
            Journeys
          </CardTitle>
        </CardHeader>
      <CardContent className="grid grid-cols-1 lg:grid-cols-7">
        <div className="">
          Lift progressively heavier things with a{" "}
          <a
            href="https://www.roguefitness.com/rogue-45lb-ohio-power-bar-bare-steel"
            target="_blank"
            className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
          >
            barbell
          </a>
          . <br></br>
          e.g.:{" "}
          <Link
            href="/barbell-squat-insights"
            className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
          >
            Squat
          </Link>
          ,{" "}
          <Link
            href="/barbell-bench-press-insights"
            className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
          >
            bench
          </Link>
          ,{" "}
          <Link
            href="/barbell-deadlift-insights"
            className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
          >
            deadlift
          </Link>
          ,{" "}
          <Link
            href="/barbell-strict-press-insights"
            className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
          >
            strict press
          </Link>
          . Just log any measurable lift movement and we can track it.
        </div>
        <div className="flex justify-center">
          <ArrowBigRight
            size={arrowSize}
            strokeWidth={0.5}
            className="hidden lg:block"
          />
          <ArrowBigDown
            size={arrowSize}
            strokeWidth={0.5}
            className="block lg:hidden"
          />
        </div>
        <div className="">
          Record your lifting progress in Google Sheets. Use simple columns:
          date, lift type, reps, weight. One set per row.
          <div>
            (
            <a
              href="https://docs.google.com/spreadsheets/d/14J9z9iJBCeJksesf3MdmpTUmo2TIckDxIQcTx1CPEO0/edit#gid=0"
              target="_blank"
              className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
            >
              sample Google Sheet
            </a>
            ). Use {`"lb"`} or {`"kg"`} with weight values.
          </div>
        </div>
        <div className="flex justify-center">
          <ArrowBigRight
            size={arrowSize}
            strokeWidth={0.5}
            className="hidden lg:block"
          />
          <ArrowBigDown
            size={arrowSize}
            strokeWidth={0.5}
            className="block lg:hidden"
          />
        </div>
        <div className="">
          {authStatus !== "authenticated" ? (
            <button
              onClick={() => {
                gaTrackSignInClick(router.pathname);
                signIn("google");
              }}
              className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
            >
              Sign in via Google
            </button>
          ) : (
            "Sign in via Google"
          )}{" "}
          and{" "}
          {authStatus === "authenticated" && !sheetInfo?.ssid ? (
            <button
              onClick={() => {
                if (openPicker) handleOpenFilePicker(openPicker);
              }}
              className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800 disabled:cursor-wait disabled:opacity-70"
              disabled={!openPicker}
              title={
                !openPicker
                  ? "Loading Google Picker… (allow Google scripts if blocked)"
                  : undefined
              }
            >
              {openPicker ? "select your Google Sheet" : "select your Google Sheet (loading…)"}
            </button>
          ) : (
            "select your Google Sheet"
          )}
          . We will read your data every couple of seconds. We do not keep a
          copy of your data.
        </div>
        <div className="flex justify-center">
          <ArrowBigRight
            size={arrowSize}
            strokeWidth={0.5}
            className="hidden lg:block"
          />
          <ArrowBigDown
            size={arrowSize}
            strokeWidth={0.5}
            className="block lg:hidden"
          />
        </div>
        <div className="">
          Explore the{" "}
          <Link
            href="/analyzer"
            className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
          >
            Analyzer
          </Link>{" "}
          or{" "}
          <Link
            href="/visualizer"
            className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
          >
            Visualizer
          </Link>{" "}
          for motivation, rewards and additional insights.
        </div>
      </CardContent>
      <CardFooter className="text-muted-foreground">
        <div>
          Strength Journeys securely accesses your Google Sheet for read-only
          purposes, ensuring your data is never altered or stored by us. Your
          original data remains intact and solely under your control. {` `}
          <Link
            href="/privacy-policy.html"
            className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
          >
            (Privacy Policy)
          </Link>
        </div>
      </CardFooter>
    </Card>
    </>
  );
}

/** Compact card for the 1000lb calculator page: See this with your data. */
export function GettingStartedCardCompact() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const [openPicker, setOpenPicker] = useState(null);
  const [shouldLoadPicker, setShouldLoadPicker] = useState(false);

  const handlePickerReady = useCallback((picker) => {
    setOpenPicker(() => picker);
  }, []);

  useEffect(() => {
    if (authStatus === "authenticated" && !shouldLoadPicker) {
      setShouldLoadPicker(true);
    }
  }, [authStatus, shouldLoadPicker]);

  const { sheetInfo, selectSheet } = useUserLiftingData();

  return (
    <>
      {shouldLoadPicker && (
        <DrivePickerContainer
          onReady={handlePickerReady}
          trigger={shouldLoadPicker}
          oauthToken={session?.accessToken}
          selectSheet={selectSheet}
        />
      )}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <img
              src={GOOGLE_SHEETS_ICON_URL}
              alt=""
              className="h-5 w-5 shrink-0"
              aria-hidden
            />
            See this with your data: PRs, charts, and insights
          </CardTitle>
          <CardDescription>
            Log your lifts in a Google Sheet. Connect it once. We never store your data.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {authStatus !== "authenticated" && (
            <p className="text-sm">
              Step 1:{" "}
              <a
                href="https://docs.google.com/spreadsheets/d/14J9z9iJBCeJksesf3MdmpTUmo2TIckDxIQcTx1CPEO0/edit#gid=0"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
              >
                Get the Google Sheet template
              </a>{" "}
              (File → Make a copy). Step 2: Sign in with Google and connect your sheet below.
            </p>
          )}
          {authStatus !== "authenticated" ? (
            <Button
              onClick={() => {
                gaTrackSignInClick(router.pathname);
                signIn("google");
              }}
            >
              Sign in with Google
            </Button>
          ) : !sheetInfo?.ssid ? (
            <Button
              onClick={() => {
                if (openPicker) handleOpenFilePicker(openPicker);
              }}
              disabled={!openPicker}
            >
              {openPicker ? "Connect your Google Sheet" : "Connect your sheet (loading…)"}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              You&apos;re connected. Explore the{" "}
              <Link href="/analyzer" className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800">
                Analyzer
              </Link>{" "}
              or{" "}
              <Link href="/visualizer" className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800">
                Visualizer
              </Link>{" "}
              for your insights.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export const SignInInvite = () => {
  const router = useRouter();
  const { status: authStatus } = useSession();

  // FIXME: add in a check for ssid and prompt for file picker if needed.
  if (authStatus === "authenticated") return null;

  return (
    <div>
      <button
        onClick={() => {
          gaTrackSignInClick(router.pathname);
          signIn("google");
        }}
        className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
      >
        Sign in
      </button>{" "}
      and link your Google Sheet lifting data to see your unique ratings for
      each lift.
    </div>
  );
};

/**
 * Vertical card for demo mode sidebars (e.g. Strength Year in Review).
 * Compact layout to fit narrow columns; other instruction cards are horizontal.
 */
export function DemoModeSignInCard() {
  const router = useRouter();
  const { status: authStatus } = useSession();

  if (authStatus === "authenticated") return null;

  return (
    <Card className="flex min-w-[14rem] flex-col md:min-w-[18rem]">
      <CardHeader className="space-y-2 pb-5 pt-6">
        <CardTitle className="flex items-center gap-2 text-lg">
          <img
            src={GOOGLE_SHEETS_ICON_URL}
            alt=""
            className="h-5 w-5 shrink-0"
            aria-hidden
          />
          See your year
        </CardTitle>
        <CardDescription className="text-sm leading-relaxed">
          This is sample data. Sign in and connect your Google Sheet to get your
          personalized recap.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 pb-8 pt-2">
        <Button
          size="default"
          className="flex w-full items-center justify-center gap-2"
          onClick={() => {
            gaTrackSignInClick(router.pathname);
            signIn("google");
          }}
        >
          <GoogleLogo size={18} />
          Sign in with Google
        </Button>
        <div className="space-y-5 text-sm text-muted-foreground">
          <p className="leading-relaxed">
            Your recap will show your sessions, tonnage, PRs, most-trained lifts,
            and seasonal patterns — all from your own data.
          </p>
          <ol className="space-y-3 list-decimal list-inside leading-relaxed">
            <li>
              <a
                href="https://docs.google.com/spreadsheets/d/14J9z9iJBCeJksesf3MdmpTUmo2TIckDxIQcTx1CPEO0/edit#gid=0"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
              >
                Open the template
              </a>{" "}
              — a simple Google Sheet with columns for date, lift, reps, and weight.
            </li>
            <li>
              In Google Sheets, go to <strong>File → Make a copy</strong>. Give it a
              name and start logging your lifts.
            </li>
            <li>
              After signing in above, connect your sheet — we&apos;ll prompt you to pick
              it from your Google Drive. We read your data directly and never store
              a copy.
            </li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
