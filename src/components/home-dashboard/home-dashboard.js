// A home dashboard for the top level of the site, shown only when user is logged in.
// This will also help with onboarding.

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { SectionTopCards } from "./section-top-cards";
import { MostRecentSessionCard } from "./most-recent-session-card";
import { DataSheetStatus, RowProcessingIndicator } from "./row-processing-indicator";
import { OnBoardingDashboard } from "@/components/instructions-cards";
import { ConsistencyGradesRow } from "./consistency-grades-row";

export function HomeDashboard() {
  const { data: session, status: authStatus } = useSession();

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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xl">
        <span>
          Welcome <span className="font-bold">{session.user.name}</span>
        </span>
        {sheetInfo?.ssid && (
          <div className="flex flex-1 justify-center">
            <ConsistencyGradesRow
              parsedData={parsedData}
              isVisible={hasDataLoaded}
            />
          </div>
        )}
        {sheetInfo?.ssid && hasDataLoaded && (
          <DataSheetStatus
            rawRows={rawRows}
            parsedData={parsedData}
            dataSyncedAt={dataSyncedAt}
            isValidating={isValidating}
            sheetURL={sheetInfo?.url}
            sheetFilename={sheetInfo?.filename}
            mutate={mutate}
          />
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
