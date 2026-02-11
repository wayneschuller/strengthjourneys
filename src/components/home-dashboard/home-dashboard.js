// A home dashboard for the top level of the site, shown only when user is logged in.
// This will also help with onboarding.

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { SectionTopCards } from "./section-top-cards";
import { MostRecentSessionCard } from "./most-recent-session-card";
import { DataSheetStatus, RowProcessingIndicator } from "./row-processing-indicator";
import { OnBoardingDashboard } from "@/components/instructions-cards";

export function HomeDashboard() {
  const { data: session, status: authStatus } = useSession();

  const {
    ssid,
    sheetURL,
    sheetFilename,
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
    if (!ssid) setHasDataLoaded(false);
  }, [ssid]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xl">
        <div>
          Welcome <span className="font-bold">{session.user.name}</span>
        </div>
        {ssid && hasDataLoaded && (
          <DataSheetStatus
            rawRows={rawRows}
            parsedData={parsedData}
            dataSyncedAt={dataSyncedAt}
            isValidating={isValidating}
            sheetURL={sheetURL}
            sheetFilename={sheetFilename}
            mutate={mutate}
          />
        )}
      </div>
      {!ssid && <OnBoardingDashboard />}
      {ssid && (
        <RowProcessingIndicator
          rowCount={rawRows}
          isProgressDone={isProgressDone}
          setIsProgressDone={setIsProgressDone}
          isValidating={isValidating}
        />
      )}
      {ssid && <SectionTopCards isProgressDone={hasDataLoaded} />}
      {ssid && <MostRecentSessionCard isProgressDone={hasDataLoaded} />}
    </div>
  );
}
