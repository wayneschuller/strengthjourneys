import { useState, useEffect, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { HomeInspirationCards } from "./home-inspiration-cards";
import { DataSheetStatus, RowProcessingIndicator } from "./row-processing-indicator";
import { TheLatestSessionCard } from "@/components/home-dashboard/the-latest-session-card";
import { TheWeekInIronCard } from "@/components/home-dashboard/the-week-in-iron-card";
import { TheMonthInIronCard } from "@/components/home-dashboard/the-month-in-iron-card";
import { TheLongGameCard } from "@/components/home-dashboard/the-long-game-card";
import { motion } from "motion/react";
import {
  gaTrackHomeDashboardFirstView,
  gaTrackHomeDashboardStageEntered,
} from "@/lib/analytics";
import {
  LOCAL_STORAGE_KEYS,
  getSheetScopedStorageKey,
} from "@/lib/localStorage-keys";
import { getDashboardStage } from "@/lib/home-dashboard/dashboard-stage";

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
 * Top-level authenticated home dashboard for a linked Google Sheet.
 *
 * This component is the orchestration layer for the staged home experience. It:
 * - reads the linked sheet + parsed lifting data from context
 * - derives the current `dashboardStage` via `getDashboardStage()`
 * - sends first-view and stage-entry analytics per linked sheet
 * - decides when to show onboarding-first layouts versus the mature dashboard
 * - passes the stage signal down to the three main home cards
 *
 * The stage model lets the home page behave differently for:
 * - untouched auto-provisioned starter sheets
 * - genuine first-week users
 * - first-month users
 * - lifters with established history
 *
 * There are no props; everything comes from auth + lifting-data context.
 *
 * @returns {JSX.Element}
 */
export function HomeDashboard() {
  const { data: session, status: authStatus } = useSession();

  const quipRef = useRef(null);
  if (quipRef.current === null) {
    quipRef.current =
      WELCOME_QUIPS[Math.floor(Math.random() * WELCOME_QUIPS.length)];
  }

  const { sheetInfo, parsedData, rawRows, dataSyncedAt, isValidating, mutate, hasUserData, isImportedData } =
    useUserLiftingData();
  const [isProgressDone, setIsProgressDone] = useState(false);
  const [hasDataLoaded, setHasDataLoaded] = useState(false);
  const previewEntryCount = useMemo(
    () =>
      Array.isArray(parsedData)
        ? parsedData.reduce(
            (count, entry) => (entry?.isGoal ? count : count + 1),
            0,
          )
        : null,
    [parsedData],
  );
  // `dashboardStage` drives onboarding vs mature behavior. Keep all stage
  // branching anchored here so child cards receive one consistent signal.
  const { dashboardStage, starterSheetState, sessionCount, dataMaturityStage } =
    useMemo(
      () =>
        getDashboardStage({
          parsedData,
          rawRows,
          sheetInfo,
        }),
      [parsedData, rawRows, sheetInfo],
    );

  useEffect(() => {
    if (isProgressDone) setHasDataLoaded(true);
  }, [isProgressDone]);

  useEffect(() => {
    if (!hasUserData) setHasDataLoaded(false);
  }, [hasUserData]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (authStatus !== "authenticated") return;
    if (!sheetInfo?.ssid || !hasDataLoaded || !Array.isArray(parsedData)) return;

    // Track first loaded dashboard view once per linked sheet so switching data
    // sources does not suppress onboarding analytics for a new sheet.
    const storageKey = getSheetScopedStorageKey(
      LOCAL_STORAGE_KEYS.HOME_DASHBOARD_FIRST_VIEW_TRACKED,
      sheetInfo?.ssid,
    );
    if (window.localStorage.getItem(storageKey) === "1") return;

    const parsedDataCount = parsedData.length;
    const nonGoalParsedDataCount = parsedData.reduce(
      (count, entry) => (entry?.isGoal ? count : count + 1),
      0,
    );

    gaTrackHomeDashboardFirstView({
      parsedDataCount,
      nonGoalParsedDataCount,
      dashboardStage,
      starterSheetState,
      sessionCount,
    });
    window.localStorage.setItem(storageKey, "1");
  }, [
    authStatus,
    sheetInfo?.ssid,
    hasDataLoaded,
    parsedData,
    dashboardStage,
    starterSheetState,
    sessionCount,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (authStatus !== "authenticated") return;
    if (!sheetInfo?.ssid || !hasDataLoaded || !Array.isArray(parsedData)) return;
    if (typeof dashboardStage !== "string" || dashboardStage.length === 0) return;

    // Track stage entry once per sheet so we can see users progressing from
    // starter sample -> first real week -> first month -> established.
    const storageKey = getSheetScopedStorageKey(
      LOCAL_STORAGE_KEYS.HOME_DASHBOARD_LAST_TRACKED_STAGE,
      sheetInfo?.ssid,
    );
    const previousDashboardStage = window.localStorage.getItem(storageKey);
    if (previousDashboardStage === dashboardStage) return;

    gaTrackHomeDashboardStageEntered({
      dashboardStage,
      previousDashboardStage,
      starterSheetState,
      sessionCount,
    });
    window.localStorage.setItem(storageKey, dashboardStage);
  }, [
    authStatus,
    sheetInfo?.ssid,
    hasDataLoaded,
    parsedData,
    dashboardStage,
    starterSheetState,
    sessionCount,
  ]);

  return (
    <div>
      {hasUserData && (
        <div className="relative mb-4 2xl:mb-6 text-xl">
          {/* 2xl: welcome left + status right in one row, vertically centered with circles */}
          <div className="2xl:flex 2xl:items-start 2xl:justify-between">
            {session?.user?.name && (
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
            )}
            {hasDataLoaded && !isImportedData && (
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
          {hasDataLoaded && !isImportedData && (
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
      )}
      {hasUserData && (
        <RowProcessingIndicator
          mode={isImportedData ? "preview" : "sheet"}
          count={isImportedData ? previewEntryCount : rawRows}
          isProgressDone={isProgressDone}
          setIsProgressDone={setIsProgressDone}
        />
      )}
      {/* The first week is intentionally quieter: skip the inspiration row until
          the user has enough real data for those cards to feel earned. */}
      {hasUserData && dashboardStage !== "starter_sample" && dashboardStage !== "first_real_week" && (
        <HomeInspirationCards
          isProgressDone={hasDataLoaded}
          dashboardStage={dashboardStage}
          sessionCount={sessionCount}
        />
      )}
      {hasUserData && hasDataLoaded && (
        <>
          <section className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
            {/* Three headline cards intentionally begin with "The" and widen chronology:
                The Week in Iron -> The Month in Iron -> The Long Game.
                Together they make the app experience feel badass and motivating, like chapters in an ongoing strength story. */}
            <TheWeekInIronCard
              dashboardStage={dashboardStage}
              dataMaturityStage={dataMaturityStage}
              sessionCount={sessionCount}
            />
            <TheMonthInIronCard
              dashboardStage={dashboardStage}
              dataMaturityStage={dataMaturityStage}
              sessionCount={sessionCount}
            />
            <TheLongGameCard
              dashboardStage={dashboardStage}
              dataMaturityStage={dataMaturityStage}
              sessionCount={sessionCount}
            />
          </section>
        </>
      )}
    </div>
  );
}
