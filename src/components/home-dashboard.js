// A home dashboard for the top level of the site, shown only when user is logged in.
// This will also help with onboarding.

import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { devLog } from "@/lib/processing-utils";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { SectionTopCards } from "./section-top-cards";
import { useLocalStorage } from "usehooks-ts";
import { Progress } from "./ui/progress";
import {
  ChooseSheetInstructionsCard,
  OnBoardingDashboard,
} from "./instructions-cards";

export function HomeDashboard() {
  const { data: session, status: authStatus } = useSession();

  const [ssid, setSsid] = useLocalStorage(LOCAL_STORAGE_KEYS.SSID, null, {
    initializeWithValue: false,
  });

  const [sheetURL, setSheetURL] = useLocalStorage(LOCAL_STORAGE_KEYS.SHEET_URL, null, {
    initializeWithValue: false,
  });
  const [sheetFilename, setSheetFilename] = useLocalStorage(
    LOCAL_STORAGE_KEYS.SHEET_FILENAME,
    null,
    { initializeWithValue: false },
  );

  const {
    parsedData,
    liftTypes,
    topLiftsByTypeAndReps,
    topLiftsByTypeAndRepsLast12Months,
    rawRows,
  } = useUserLiftingData();
  const [isProgressDone, setIsProgressDone] = useState(false);

  return (
    <div>
      <div className="mb-4 text-xl">
        Welcome <div className="inline font-bold">{session.user.name}</div>
      </div>
      {!ssid && <OnBoardingDashboard />}
      {ssid && rawRows && (
        <RowProcessingIndicator
          rowCount={rawRows}
          isProgressDone={isProgressDone}
          setIsProgressDone={setIsProgressDone}
        />
      )}
      {ssid && parsedData && isProgressDone && <SectionTopCards />}
    </div>
  );
}

function RowProcessingIndicator({
  rowCount,
  isProgressDone,
  setIsProgressDone,
}) {
  const [animatedCount, setAnimatedCount] = useState(0);

  useEffect(() => {
    // Reset whenever the incoming row count changes
    setAnimatedCount(0);
    setIsProgressDone(false);

    if (!rowCount || rowCount <= 0) {
      setIsProgressDone(true);
      return;
    }

    const durationMs = 1200; // total animation duration
    const start = performance.now();
    let frameId;

    const tick = (now) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / durationMs);
      const nextCount = Math.round(rowCount * progress);
      setAnimatedCount(nextCount);

      if (progress >= 1) {
        setIsProgressDone(true);
        return;
      }

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [rowCount, setIsProgressDone]);

  const percent =
    rowCount && rowCount > 0
      ? Math.min(100, Math.round((animatedCount / rowCount) * 100))
      : 0;

  const dotColor = isProgressDone
    ? "text-green-500"
    : "text-amber-400 animate-pulse"; // amber/yellow while processing

  return (
    <div className="flex flex-col items-center py-4">
      <Progress className="mb-2 h-2 w-4/5 md:w-3/5" value={percent} />
      <div className="text-sm text-muted-foreground">
        {isProgressDone ? "Processed" : "Processing"} Google Sheet rows:{" "}
        {animatedCount.toLocaleString()} / {rowCount?.toLocaleString()}
        <span className={`ml-2 ${dotColor}`}>●</span>
      </div>
    </div>
  );
}
