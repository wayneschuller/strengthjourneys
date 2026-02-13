// A home dashboard for the top level of the site, shown only when user is logged in.
// This will also help with onboarding.

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { SectionTopCards } from "./section-top-cards";
import { MostRecentSessionCard } from "./most-recent-session-card";
import { DataSheetStatus, RowProcessingIndicator } from "./row-processing-indicator";
import { OnBoardingDashboard } from "@/components/instructions-cards";
import { ConsistencyGradesRow } from "./consistency-grades-row";
import { motion } from "motion/react";

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

export function HomeDashboard() {
  const { data: session, status: authStatus } = useSession();

  const quipRef = useRef(null);
  if (quipRef.current === null) {
    quipRef.current =
      WELCOME_QUIPS[Math.floor(Math.random() * WELCOME_QUIPS.length)];
  }

  const {
    sheetInfo,
    parsedData,
    liftTypes,
    topLiftsByTypeAndReps,
    topLiftsByTypeAndRepsLast12Months,
    rawRows,
    dataSyncedAt,
    isValidating,
    mutate,
  } = useUserLiftingData();
  const [isProgressDone, setIsProgressDone] = useState(false);
  const [hasDataLoaded, setHasDataLoaded] = useState(false);

  useEffect(() => {
    if (isProgressDone) setHasDataLoaded(true);
  }, [isProgressDone]);

  useEffect(() => {
    if (!sheetInfo?.ssid) setHasDataLoaded(false);
  }, [sheetInfo?.ssid]);

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
        {sheetInfo?.ssid && (
          <div className="flex justify-center 2xl:pointer-events-none 2xl:absolute 2xl:inset-0 2xl:items-start 2xl:justify-center">
            <div className="2xl:pointer-events-auto">
              <ConsistencyGradesRow
                parsedData={parsedData}
                isVisible={hasDataLoaded}
              />
            </div>
          </div>
        )}
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
      {!sheetInfo?.ssid && <OnBoardingDashboard />}
      {sheetInfo?.ssid && (
        <RowProcessingIndicator
          rowCount={rawRows}
          isProgressDone={isProgressDone}
          setIsProgressDone={setIsProgressDone}
          isValidating={isValidating}
        />
      )}
      {sheetInfo?.ssid && <SectionTopCards isProgressDone={hasDataLoaded} />}
      {sheetInfo?.ssid && <MostRecentSessionCard isProgressDone={hasDataLoaded} />}
    </div>
  );
}
