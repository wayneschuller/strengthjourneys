
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { DrivePickerContainer } from "@/components/drive-picker-container";
import { handleOpenFilePicker } from "@/lib/handle-open-picker";
import { gaTrackSignInClick } from "@/lib/analytics";
import { SESSION_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { openSheetSetupDialog } from "@/lib/open-sheet-setup";
import { Button } from "@/components/ui/button";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { devLog } from "@/lib/processing-utils";
import Image from "next/image";
import { BarChart3, Calendar, Check, Flame, FolderOpen, Table2 } from "lucide-react";
import { motion, useReducedMotion, useAnimationControls } from "motion/react";
import { useSession, signIn } from "next-auth/react";
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

/**
 * Two-column onboarding flow shown on the dashboard after a user signs in for the
 * first time. Walks them through copying the Google Sheet template and connecting it.
 *
 * @param {Object} props - No props; reads session and sheet context internally.
 */
// This is very similar to the ChooseSheetInstructionsCard but designed for the front page
export function OnBoardingDashboard() {
  const [openPicker, setOpenPicker] = useState(null);
  const [shouldLoadPicker, setShouldLoadPicker] = useState(false);
  // Gate Step 2 behind Step 1 so users see the sheet format before opening the
  // Drive picker. Without this, users who clicked "Connect" without having a sheet
  // ready would open the picker, find nothing suitable, and abandon (57% did in GA).
  //
  // Both unlock paths use sessionStorage so the gate resets on tab/browser close.
  // Even if they opened the template today, they might not have set up their sheet —
  // coming back tomorrow and finding Step 2 already unlocked would just land them
  // in the picker with nothing to select. The gate is cheap friction that pays off.
  const [templateOpened, setTemplateOpened] = useState(false);
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

  // Restore gate state on mount — sessionStorage survives page reloads within
  // the same tab (e.g. returning from the template tab) but resets on close.
  useEffect(() => {
    if (typeof window !== "undefined") {
      setTemplateOpened(!!sessionStorage.getItem(SESSION_STORAGE_KEYS.ONBOARDING_ESCAPE_HATCH));
    }
  }, []);

  const handleTemplateOpen = () => {
    sessionStorage.setItem(SESSION_STORAGE_KEYS.ONBOARDING_ESCAPE_HATCH, "1");
    setTemplateOpened(true);
  };

  const step2Disabled = !templateOpened || !openPicker;

  const step1Controls = useAnimationControls();
  const step2Controls = useAnimationControls();
  const prefersReducedMotion = useReducedMotion();

  // Wobble whichever step the user needs to click next
  useEffect(() => {
    if (prefersReducedMotion) return;
    const controls =
      !templateOpened ? step1Controls : (!step2Disabled ? step2Controls : null);
    if (!controls) return;
    const wobbleAnim = {
      rotate: [0, -7, 7, -5, 5, -2, 2, 0],
      transition: { duration: 0.55, ease: "easeInOut" },
    };
    let intervalId;
    const timeoutId = setTimeout(() => {
      controls.start(wobbleAnim);
      intervalId = setInterval(() => controls.start(wobbleAnim), 5000);
    }, 1500 + Math.random() * 2000);
    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [templateOpened, step2Disabled, prefersReducedMotion, step1Controls, step2Controls]);

  const step2Title = !templateOpened
    ? "Open the template first (Step 1 above)"
    : !openPicker
    ? "Loading Google Picker… (allow Google scripts if blocked)"
    : undefined;

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
          Successful sign-in! Let{"’"}s connect your lifting data
        </h2>
        <div className="flex flex-col gap-4">
          <div className="">
            In two quick steps, you’ll connect your personal Google Sheet so
            Strength Journeys can show your training insights — while your data
            stays yours.
          </div>
          <motion.div animate={step1Controls} className="self-center" style={{ display: "inline-block" }}>
            <Button asChild className="w-fit gap-2">
              <a
                href="https://docs.google.com/spreadsheets/d/14J9z9iJBCeJksesf3MdmpTUmo2TIckDxIQcTx1CPEO0/edit#gid=0"
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleTemplateOpen}
              >
                <img
                  src={GOOGLE_SHEETS_ICON_URL}
                  alt=""
                  className="h-4 w-4 shrink-0"
                  aria-hidden
                />
                Step 1 - Open Google Sheet Template
              </a>
            </Button>
          </motion.div>
          <div className="mb-6">
            In Google Sheets click <em>File → Make a copy</em>. Give it a good
            name and start entering your own lifts.
          </div>
          <motion.div animate={step2Controls} className="self-center" style={{ display: "inline-block" }}>
            <Button
              className="flex w-fit items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => {
                if (openPicker) handleOpenFilePicker(openPicker);
              }}
              disabled={step2Disabled}
              title={step2Title}
            >
              <FolderOpen className="h-4 w-4 shrink-0" aria-hidden />
              {openPicker
                ? "Step 2 - Connect your Google Sheet to Strength Journeys"
                : "Step 2 - Connect your Google Sheet (loading…)"}
            </Button>
          </motion.div>

          {/* Escape hatch for users who already have a sheet in the correct format. */}
          {!templateOpened && (
            <button
              className="self-center text-sm text-muted-foreground underline hover:text-foreground"
              onClick={() => {
                sessionStorage.setItem(SESSION_STORAGE_KEYS.ONBOARDING_ESCAPE_HATCH, "1");
                setTemplateOpened(true);
              }}
            >
              I already have a sheet →
            </button>
          )}

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

/**
 * Full-width card explaining the three-step setup process: log lifts in a Google Sheet,
 * sign in, connect the sheet, then explore the app. Adapts its CTAs to auth state.
 *
 * @param {Object} props - No props; reads session and sheet context internally.
 */
export function GettingStartedCard() {
  const router = useRouter();
  const { status: authStatus } = useSession();

  const { sheetInfo } = useUserLiftingData();
  const isConnected = !!sheetInfo?.ssid;

  return (
    <Card className="relative overflow-hidden border hover:ring-0">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        aria-hidden
      >
        <div className="from-primary/10 absolute -top-20 left-8 h-64 w-64 rounded-full bg-gradient-to-br to-transparent blur-3xl" />
        <div className="from-chart-2/15 absolute -right-16 bottom-0 h-72 w-72 rounded-full bg-gradient-to-tr to-transparent blur-3xl" />
      </div>
      <CardHeader className="relative">
        <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border bg-background/85 px-3 py-1 text-xs font-medium tracking-wide text-muted-foreground uppercase shadow-sm">
          <img
            src={GOOGLE_SHEETS_ICON_URL}
            alt=""
            className="h-4 w-4 shrink-0"
            aria-hidden
          />
          Google Sheets setup, simplified
        </div>
        <CardTitle className="max-w-2xl text-2xl tracking-tight md:text-3xl">
          Sign in once. We&apos;ll handle the lifting log setup.
        </CardTitle>
        <CardDescription className="max-w-2xl text-base leading-relaxed">
          Strength Journeys detects the sheet you already use or provisions a
          fresh one from our spreadsheet design, then turns it into dashboards,
          PR tracking, e1RM trends, and lift analysis.
        </CardDescription>
      </CardHeader>
      <CardContent className="relative grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              "Built for real lifting history, not generic workout fluff.",
              "Automatic setup whether you already log lifts or need a fresh start.",
              "Read-only sync into charts, PRs, trends, and session recaps.",
            ].map((copy) => (
              <div
                key={copy}
                className="bg-card/85 ring-border rounded-2xl p-4 text-sm leading-relaxed shadow-sm ring-1"
              >
                {copy}
              </div>
            ))}
          </div>
          <div className="bg-background/75 ring-border flex flex-col items-start gap-3 rounded-2xl p-5 shadow-sm ring-1">
            {authStatus !== "authenticated" ? (
              <Button
                size="lg"
                className="gap-2 px-6"
                onClick={() => {
                  gaTrackSignInClick(router.pathname, "getting_started_card");
                  signIn("google", { callbackUrl: "/" });
                }}
              >
                <GoogleLogo size={18} />
                Sign in and we&apos;ll set you up
              </Button>
            ) : isConnected ? (
              <div className="text-primary inline-flex items-center gap-2 text-sm font-medium">
                <Check className="h-4 w-4" />
                Your lifting log is connected.
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Signed in. Strength Journeys is setting up your dashboard above.
              </div>
            )}
            <p className="max-w-xl text-sm font-medium text-foreground">
              One big CTA. Sign in and start lifting.
            </p>
            <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
              Your sheet stays yours: Google Sheets, read-only access, no
              edits, no raw-data storage.{" "}
              <Link
                href="/privacy-policy.html"
                className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
              >
                Privacy Policy
              </Link>
            </p>
          </div>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.4 }}
          className="mx-auto w-full max-w-sm overflow-hidden rounded-3xl border bg-card/90 p-3 shadow-sm lg:mx-0 lg:ml-auto"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">The spreadsheet we set up for you</p>
              <p className="text-xs text-muted-foreground">
                Clean rows. Fast logging. Built to age well.
              </p>
            </div>
            <a
              href="https://docs.google.com/spreadsheets/d/14J9z9iJBCeJksesf3MdmpTUmo2TIckDxIQcTx1CPEO0/edit#gid=0"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
            >
              Preview design
            </a>
          </div>
          <div className="overflow-hidden rounded-2xl border bg-background shadow-inner">
            <Image
              src={SampleImage}
              alt="Preview of the Strength Journeys Google Sheets lifting log design"
              className="h-auto w-full scale-[1.01]"
              priority={false}
            />
          </div>
        </motion.div>
      </CardContent>
    </Card>
  );
}

/**
 * Compact card for pages like the 1000lb calculator that want a minimal sign-in/connect
 * prompt. Shows sign-in, picker, or a "you're connected" message depending on auth state.
 *
 * @param {Object} props - No props; reads session and sheet context internally.
 */
export function GettingStartedCardCompact() {
  const router = useRouter();
  const { status: authStatus } = useSession();

  const { sheetInfo } = useUserLiftingData();

  return (
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
            Sign in once. Strength Journeys will find your lifting log or create one from the template design for you.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {authStatus !== "authenticated" && (
            <p className="text-sm">
              Sign in with Google and Strength Journeys will either connect the
              lifting sheet you already use or provision a fresh one based on
              our{" "}
              <a
                href="https://docs.google.com/spreadsheets/d/14J9z9iJBCeJksesf3MdmpTUmo2TIckDxIQcTx1CPEO0/edit#gid=0"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800"
              >
                spreadsheet design
              </a>
              .
            </p>
          )}
          {authStatus !== "authenticated" ? (
            <Button
              onClick={() => {
                gaTrackSignInClick(router.pathname, "lift_page_card");
                signIn("google", { callbackUrl: "/" });
              }}
            >
              Sign in and we&apos;ll set you up
            </Button>
          ) : !sheetInfo?.ssid ? (
            <Button
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
          ) : (
            <p className="text-sm text-muted-foreground">
              You&apos;re connected. Explore the{" "}
              <Link href="/lift-explorer" className="text-blue-600 underline visited:text-purple-600 hover:text-blue-800">
                Lift Explorer
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
  );
}

/**
 * Inline sign-in prompt rendered as a text link. Returns null when the user is
 * already authenticated so it disappears automatically after sign-in.
 *
 * @param {Object} props - No props; reads auth status from session context.
 */
export const SignInInvite = () => {
  const router = useRouter();
  const { status: authStatus } = useSession();

  // FIXME: add in a check for ssid and prompt for file picker if needed.
  if (authStatus === "authenticated") return null;

  return (
    <div>
      <button
        onClick={() => {
          gaTrackSignInClick(router.pathname, "sign_in_invite");
          signIn("google", { callbackUrl: "/" });
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
 * Vertical card for the Strength Year in Review sidebar when user is signed in
 * but has not connected a Google Sheet yet. Prompts them to connect so they
 * can see their real recap instead of demo data.
 */
export function ConnectSheetRecapCard() {
  const { status: authStatus } = useSession();
  const { sheetInfo } = useUserLiftingData();

  if (authStatus !== "authenticated" || sheetInfo?.ssid) return null;

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
            See your year in review
          </CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            Demo mode is on. Set up your Google Sheet and we&apos;ll help you load
            your lifting history for a personalized recap.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 pb-8 pt-2">
          <Button
            size="default"
            className="flex w-full items-center justify-center gap-2"
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
          <p className="text-sm leading-relaxed text-muted-foreground">
            Your recap will show sessions, tonnage, PRs, most-trained lifts, and
            seasonal patterns — all from your own data.
          </p>
        </CardContent>
      </Card>
  );
}

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
            gaTrackSignInClick(router.pathname, "year_recap_card");
            signIn("google", { callbackUrl: "/" });
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
