// A home dashboard for the top level of the site, shown only when user is logged in.
// This will also help with onboarding.

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

  const [ssid, setSsid] = useLocalStorage("ssid", null, {
    initializeWithValue: false,
  });

  const [sheetURL, setSheetURL] = useLocalStorage("sheetURL", null, {
    initializeWithValue: false,
  });
  const [sheetFilename, setSheetFilename] = useLocalStorage(
    "sheetFilename",
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
    // reset when rowCount changes
    setAnimatedCount(0);

    if (!rowCount || rowCount <= 0) return;

    let n = 0;
    const step = Math.max(1, Math.ceil(rowCount / 60)); // ~1s total, clamp to at least 1
    const interval = setInterval(() => {
      n = Math.min(n + step, rowCount);
      setAnimatedCount(n);
      if (n >= rowCount) {
        clearInterval(interval);
        setIsProgressDone(true);
      }
    }, 16); // ~60fps

    return () => clearInterval(interval);
  }, [rowCount]);

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
