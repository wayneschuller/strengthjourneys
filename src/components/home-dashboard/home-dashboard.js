// A home dashboard for the top level of the site, shown only when user is logged in.
// This will also help with onboarding.

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { HomeInspirationCards } from "./home-inspiration-cards";
import { DataSheetStatus, RowProcessingIndicator } from "./row-processing-indicator";
import { TheLatestSessionCard } from "@/components/home-dashboard/the-latest-session-card";
import { TheMonthInIronCard } from "@/components/home-dashboard/the-month-in-iron-card";
import { TheLongGameCard } from "@/components/home-dashboard/the-long-game-card";
import { DrivePickerContainer } from "@/components/drive-picker-container";
import { handleOpenFilePicker } from "@/lib/handle-open-picker";
import { motion } from "motion/react";
import {
  gaTrackHomeDashboardFirstView,
  gaTrackSheetAutoprovisioned,
} from "@/lib/analytics";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, FolderOpen, LoaderCircle, Sparkles } from "lucide-react";

// Short, subtle quips that incorporate the user's first name.
// {name} is replaced at render time.
const WELCOME_QUIPS = [
  "Welcome back, {name}",
  "Good to see you, {name}",
  "Stay strong, {name}",
  "Built different, {name}",
  "Iron sharpens iron, {name}",
  "Brave choices, {name}",
  "Strong looks good on you, {name}",
  "Keep showing up, {name}",
  "One rep at a time, {name}",
  "Fortitude suits you, {name}",
  "No shortcuts, {name}",
  "Earned, not given, {name}",
  "Grit and grace, {name}",
  "Bold move logging in, {name}",
  "Discipline on display, {name}",
  "Steel resolve, {name}",
  "The bar doesn't lie, {name}",
  "Heart of a lifter, {name}",
  "Respect the process, {name}",
  "You showed up, {name}",
  "Stronger every week, {name}",
  "The weights remember you, {name}",
  "Consistency is your superpower, {name}",
  "Another day, another PR, {name}",
  "The rack awaits, {name}",
  "Not just lifting, living, {name}",
  "Quiet strength, {name}",
  "Trust the training, {name}",
  "Your future self thanks you, {name}",
  "Progress over perfection, {name}",
  "Relentless, {name}",
  "Hard things make strong people, {name}",
  "Still here, still growing, {name}",
  "Gravity fears you, {name}",
  "Uncommon discipline, {name}",
  "Plates don't move themselves, {name}",
  "The grind looks good on you, {name}",
  "Nothing worth having comes easy, {name}",
  "Proof is in the logbook, {name}",
  "Built with patience, {name}",
];

/**
 * Top-level home dashboard rendered when the user is authenticated and a Google Sheet is linked.
 * Shows a personalised welcome greeting, consistency grade circles, a data-sync status row, a
 * row-processing animation, top stat cards, and the most recent session card. Falls back to
 * OnBoardingDashboard when no sheet is connected.
 * Reads session and lifting data from context; takes no props.
 *
 * @param {Object} props
 */
export function HomeDashboard() {
  const { data: session, status: authStatus } = useSession();

  const quipRef = useRef(null);
  if (quipRef.current === null) {
    quipRef.current =
      WELCOME_QUIPS[Math.floor(Math.random() * WELCOME_QUIPS.length)];
  }

  const {
    sheetInfo,
    selectSheet,
    parsedData,
    rawRows,
    dataSyncedAt,
    isValidating,
    mutate,
  } = useUserLiftingData();
  const [isProgressDone, setIsProgressDone] = useState(false);
  const [hasDataLoaded, setHasDataLoaded] = useState(false);
  const [highlightDate, setHighlightDate] = useState(null);
  const [onboardingState, setOnboardingState] = useState("idle");
  const [provisionError, setProvisionError] = useState(null);
  const [openPicker, setOpenPicker] = useState(null);
  const [showIntroBanner, setShowIntroBanner] = useState(false);
  const provisioningStartedRef = useRef(false);

  const nonGoalSessionCount = useMemo(() => {
    if (!Array.isArray(parsedData)) return 0;
    const uniqueDates = new Set();
    parsedData.forEach((entry) => {
      if (!entry?.isGoal && entry?.date) uniqueDates.add(entry.date);
    });
    return uniqueDates.size;
  }, [parsedData]);

  const dataMaturityStage = useMemo(() => {
    if (nonGoalSessionCount === 0) return "no_sessions";
    if (nonGoalSessionCount <= 7) return "first_week";
    if (nonGoalSessionCount <= 20) return "first_month";
    return "mature";
  }, [nonGoalSessionCount]);

  const handlePickerReady = useCallback((picker) => {
    setOpenPicker(() => picker);
  }, []);

  useEffect(() => {
    if (isProgressDone) setHasDataLoaded(true);
  }, [isProgressDone]);

  useEffect(() => {
    if (!sheetInfo?.ssid) setHasDataLoaded(false);
  }, [sheetInfo?.ssid]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    if (sheetInfo?.ssid) return;
    if (provisioningStartedRef.current) return;

    provisioningStartedRef.current = true;
    let cancelled = false;

    async function provisionSheet() {
      setProvisionError(null);
      setOnboardingState("provisioning");
      try {
        const response = await fetch("/api/provision-sheet", {
          method: "POST",
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.ssid) {
          throw new Error(payload?.error || "Automatic setup failed");
        }
        if (cancelled) return;

        selectSheet(payload.ssid, {
          url: payload.webViewLink ?? null,
          filename: payload.name ?? null,
          modifiedTime: payload.modifiedTime ?? null,
          modifiedByMeTime: payload.modifiedByMeTime ?? null,
        });
        if (payload.wasCreated) gaTrackSheetAutoprovisioned();
        setOnboardingState("intro_oriented");
        setShowIntroBanner(true);
      } catch (error) {
        if (cancelled) return;
        setProvisionError(error?.message || "Automatic setup failed");
        setOnboardingState("fallback_error");
        provisioningStartedRef.current = false;
      }
    }

    provisionSheet();

    return () => {
      cancelled = true;
    };
  }, [authStatus, selectSheet, sheetInfo?.ssid]);

  useEffect(() => {
    if (sheetInfo?.ssid && hasDataLoaded && onboardingState === "intro_oriented") {
      setShowIntroBanner(true);
    }
  }, [sheetInfo?.ssid, hasDataLoaded, onboardingState]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (authStatus !== "authenticated") return;
    if (!sheetInfo?.ssid || !hasDataLoaded || !Array.isArray(parsedData)) return;

    const storageKey = LOCAL_STORAGE_KEYS.HOME_DASHBOARD_FIRST_VIEW_TRACKED;
    if (window.localStorage.getItem(storageKey) === "1") return;

    const parsedDataCount = parsedData.length;
    const nonGoalParsedDataCount = parsedData.reduce(
      (count, entry) => (entry?.isGoal ? count : count + 1),
      0,
    );

    gaTrackHomeDashboardFirstView({
      parsedDataCount,
      nonGoalParsedDataCount,
    });
    window.localStorage.setItem(storageKey, "1");
  }, [authStatus, sheetInfo?.ssid, hasDataLoaded, parsedData]);

  return (
    <div>
      <div className="relative mb-4 2xl:mb-6 text-xl">
        {/* 2xl: welcome left + status right in one row, vertically centered with circles */}
        <div className="2xl:flex 2xl:items-start 2xl:justify-between">
          <motion.div
            className="mb-2 text-center 2xl:mb-0 2xl:text-left"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
          >
            <span className="text-muted-foreground">
              {quipRef.current.split("{name}")[0]}
            </span>
            <span className="font-bold">
              {session.user.name?.split(" ")[0]}
            </span>
          </motion.div>
          {sheetInfo?.ssid && hasDataLoaded && (
            <div className="hidden 2xl:block">
              <DataSheetStatus
                rawRows={rawRows}
                parsedData={parsedData}
                dataSyncedAt={dataSyncedAt}
                isValidating={isValidating}
                sheetURL={sheetInfo?.url}
                sheetFilename={sheetInfo?.filename}
                mutate={mutate}
              />
            </div>
          )}
        </div>
        {/* Mobile: status below circles */}
        {sheetInfo?.ssid && hasDataLoaded && (
          <div className="mt-2 flex justify-center 2xl:hidden">
            <DataSheetStatus
              rawRows={rawRows}
              parsedData={parsedData}
              dataSyncedAt={dataSyncedAt}
              isValidating={isValidating}
              sheetURL={sheetInfo?.url}
              sheetFilename={sheetInfo?.filename}
              mutate={mutate}
            />
          </div>
        )}
      </div>
      {!sheetInfo?.ssid && (
        <>
          {(onboardingState === "provisioning" || onboardingState === "idle") && (
            <ProvisioningPanel />
          )}
          {onboardingState === "fallback_error" && (
            <>
              <FallbackConnectPanel
                openPicker={openPicker}
                onRetry={() => {
                  provisioningStartedRef.current = false;
                  setOnboardingState("idle");
                }}
                errorMessage={provisionError}
              />
              <DrivePickerContainer
                onReady={handlePickerReady}
                trigger={authStatus === "authenticated"}
                oauthToken={session?.accessToken}
                selectSheet={selectSheet}
              />
            </>
          )}
        </>
      )}
      {sheetInfo?.ssid && (
        <RowProcessingIndicator
          rowCount={rawRows}
          isProgressDone={isProgressDone}
          setIsProgressDone={setIsProgressDone}
        />
      )}
      {sheetInfo?.ssid && <HomeInspirationCards isProgressDone={hasDataLoaded} />}
      {sheetInfo?.ssid && hasDataLoaded && (
        <>
          {showIntroBanner && (
            <IntroOrientationBanner
              firstName={session?.user?.name?.split(" ")?.[0] || "there"}
              onDismiss={() => {
                setShowIntroBanner(false);
                setOnboardingState("normal_dashboard");
              }}
            />
          )}
          <section className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
            {/* Three headline cards intentionally begin with "The" and widen chronology:
                The Latest Session -> The Month in Iron -> The Long Game.
                Together they make the app experience feel badass and motivating, like chapters in an ongoing strength story. */}
            <TheLatestSessionCard
              highlightDate={highlightDate}
              setHighlightDate={setHighlightDate}
              dataMaturityStage={dataMaturityStage}
              sessionCount={nonGoalSessionCount}
            />
            <TheMonthInIronCard
              dataMaturityStage={dataMaturityStage}
              sessionCount={nonGoalSessionCount}
            />
            <TheLongGameCard
              dataMaturityStage={dataMaturityStage}
              sessionCount={nonGoalSessionCount}
            />
          </section>
        </>
      )}
    </div>
  );
}

function ProvisioningPanel() {
  return (
    <Card className="mb-4 border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <LoaderCircle className="h-5 w-5 animate-spin" />
          Setting up your personal lifting sheet
        </CardTitle>
        <CardDescription>
          Strength Journeys is creating your own Google Sheet and linking it automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        This usually takes a few seconds. You will land straight in your dashboard.
      </CardContent>
    </Card>
  );
}

function FallbackConnectPanel({ openPicker, onRetry, errorMessage }) {
  return (
    <Card className="mb-4 border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          Automatic setup needs help
        </CardTitle>
        <CardDescription>
          You can retry automatic setup or connect an existing sheet from Google Drive.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {errorMessage && (
          <p className="text-sm text-muted-foreground">{errorMessage}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button onClick={onRetry}>Retry automatic setup</Button>
          <Button
            variant="outline"
            disabled={!openPicker}
            onClick={() => {
              if (openPicker) handleOpenFilePicker(openPicker);
            }}
          >
            <FolderOpen className="mr-2 h-4 w-4" />
            Connect an existing sheet
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function IntroOrientationBanner({ firstName, onDismiss }) {
  return (
    <Card className="mb-4 border-emerald-600/30 bg-emerald-600/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base md:text-lg">
          <Sparkles className="h-5 w-5" />
          Your dashboard is ready, {firstName}
        </CardTitle>
        <CardDescription>
          Start with your next training session and watch these cards evolve as your data grows.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2 pt-0">
        <Button size="sm" variant="outline" onClick={onDismiss}>
          Continue to dashboard
        </Button>
      </CardContent>
    </Card>
  );
}
