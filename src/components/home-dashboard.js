// A home dashboard for the top level of the site, shown only when user is logged in.
// This will also help with onboarding.

import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { SectionTopCards } from "./section-top-cards";
import { MostRecentSessionCard } from "./most-recent-session-card";
import { useLocalStorage } from "usehooks-ts";
import { Progress } from "./ui/progress";
import { Skeleton } from "./ui/skeleton";
import { motion } from "motion/react";
import { format, differenceInMinutes, isToday } from "date-fns";
import { OnBoardingDashboard } from "./instructions-cards";

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
    dataSyncedAt,
    isValidating,
  } = useUserLiftingData();
  const [isProgressDone, setIsProgressDone] = useState(false);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xl">
        <div>
          Welcome <span className="font-bold">{session.user.name}</span>
        </div>
        {ssid && isProgressDone && (
          <DataSheetStatus
            rawRows={rawRows}
            parsedData={parsedData}
            dataSyncedAt={dataSyncedAt}
            isValidating={isValidating}
          />
        )}
      </div>
      {!ssid && <OnBoardingDashboard />}
      {ssid && (
        <RowProcessingIndicator
          rowCount={rawRows}
          isProgressDone={isProgressDone}
          setIsProgressDone={setIsProgressDone}
        />
      )}
      {ssid && <SectionTopCards isProgressDone={isProgressDone} />}
      {ssid && isProgressDone && <MostRecentSessionCard />}
    </div>
  );
}

function formatSyncTime(timestamp) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  const minsAgo = differenceInMinutes(Date.now(), date);

  if (minsAgo < 1) return "Data synced in the last minute";
  if (minsAgo === 1) return "Data synced 1 minute ago";
  if (minsAgo <= 15) return `Data synced ${minsAgo} minutes ago`;
  if (isToday(date)) return `Data synced at ${format(date, "h:mm a")} today`;
  return `Data synced ${format(date, "MMM d")} at ${format(date, "h:mm a")}`;
}

function DataSheetStatus({
  rawRows,
  parsedData,
  dataSyncedAt,
  isValidating,
}) {
  const rowLabel =
    parsedData &&
    rawRows != null &&
    parsedData.length !== rawRows
      ? `${parsedData.length.toLocaleString()} valid of ${rawRows.toLocaleString()} rows`
      : rawRows != null
        ? `${rawRows.toLocaleString()} rows`
        : null;

  const syncLabel = isValidating
    ? "Syncing…"
    : formatSyncTime(dataSyncedAt) || "Data synced";

  const parts = [syncLabel];
  if (rowLabel) parts.push(rowLabel);

  return (
    <div className="text-right text-xs text-muted-foreground">
      {parts.join(" · ")}
    </div>
  );
}

const FADE_DELAY_MS = 2500;

function RowProcessingIndicator({
  rowCount,
  isProgressDone,
  setIsProgressDone,
}) {
  const [animatedCount, setAnimatedCount] = useState(0);
  const [shouldFadeOut, setShouldFadeOut] = useState(false);

  useEffect(() => {
    if (!isProgressDone) {
      setShouldFadeOut(false);
      return;
    }
    const timer = setTimeout(() => setShouldFadeOut(true), FADE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isProgressDone]);

  useEffect(() => {
    // Reset whenever the incoming row count changes
    setAnimatedCount(0);
    setIsProgressDone(false);

    if (rowCount === null || rowCount === undefined) {
      setIsProgressDone(false);
      return;
    }

    if (rowCount <= 0) {
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

  if (rowCount === null || rowCount === undefined) {
    return (
      <div className="flex flex-col items-center py-4">
        <Skeleton className="mb-2 h-2 w-4/5 md:w-3/5" />
        <Skeleton className="h-4 w-64" />
      </div>
    );
  }

  return (
    <motion.div
      className="grid overflow-hidden"
      initial={false}
      animate={{
        gridTemplateRows: shouldFadeOut ? "0fr" : "1fr",
        opacity: shouldFadeOut ? 0 : 1,
      }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <div className="min-h-0 overflow-hidden">
        <motion.div
          className="flex flex-col items-center py-4"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 180, damping: 22 }}
        >
          <Progress className="mb-2 h-2 w-4/5 md:w-3/5" value={percent} />
          <div className="text-sm text-muted-foreground flex items-center">
            {isProgressDone ? "Processed" : "Processing"} Google Sheet rows:{" "}
            {animatedCount.toLocaleString()} / {rowCount?.toLocaleString()}
            <motion.span
              className={`ml-2 ${isProgressDone ? "text-green-500" : "text-amber-400"}`}
              animate={
                isProgressDone
                  ? {}
                  : {
                      opacity: [1, 0.4, 1],
                      scale: [1, 1.1, 1],
                    }
              }
              transition={{
                duration: 1.8,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              ●
            </motion.span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
