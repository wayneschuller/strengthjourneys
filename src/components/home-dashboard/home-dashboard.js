// A home dashboard for the top level of the site, shown only when user is logged in.
// This will also help with onboarding.

import { useState, useEffect, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { HomeInspirationCards } from "./home-inspiration-cards";
import { DataSheetStatus, RowProcessingIndicator } from "./row-processing-indicator";
import { TheLatestSessionCard } from "@/components/home-dashboard/the-latest-session-card";
import { TheMonthInIronCard } from "@/components/home-dashboard/the-month-in-iron-card";
import { TheLongGameCard } from "@/components/home-dashboard/the-long-game-card";
import { motion } from "motion/react";
import { gaTrackHomeDashboardFirstView } from "@/lib/analytics";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";

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

  const { sheetInfo, parsedData, rawRows, dataSyncedAt, isValidating, mutate } =
    useUserLiftingData();
  const [isProgressDone, setIsProgressDone] = useState(false);
  const [hasDataLoaded, setHasDataLoaded] = useState(false);
  const [highlightDate, setHighlightDate] = useState(null);
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

  useEffect(() => {
    if (isProgressDone) setHasDataLoaded(true);
  }, [isProgressDone]);

  useEffect(() => {
    if (!sheetInfo?.ssid) setHasDataLoaded(false);
  }, [sheetInfo?.ssid]);

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
      {sheetInfo?.ssid && (
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
            {hasDataLoaded && (
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
          {hasDataLoaded && (
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
