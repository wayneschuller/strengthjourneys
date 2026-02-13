import { useState, useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "motion/react";
import { format, differenceInSeconds, differenceInMinutes, differenceInHours, isToday } from "date-fns";
import { RefreshCw, Loader2 } from "lucide-react";
import { GOOGLE_SHEETS_ICON_URL } from "@/lib/google-sheets-icon";

function formatSyncTime(timestamp) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  const secsAgo = differenceInSeconds(Date.now(), date);
  const minsAgo = differenceInMinutes(Date.now(), date);

  if (secsAgo < 60) return "just now";
  if (minsAgo === 1) return "1 minute ago";
  if (minsAgo <= 15) return `${minsAgo} minutes ago`;
  if (isToday(date)) return `at ${format(date, "h:mm a")} today`;
  return `${format(date, "MMM d")} at ${format(date, "h:mm a")}`;
}

function getFreshnessColor(dataSyncedAt) {
  if (!dataSyncedAt) return "text-muted-foreground";
  const hoursAgo = differenceInHours(Date.now(), dataSyncedAt);
  return hoursAgo < 1 ? "text-green-600 dark:text-green-500" : "text-amber-600 dark:text-amber-500";
}

/**
 * Shows sync status with the user's Google Sheet (last synced time, row count) and a refresh button.
 *
 * @param {Object} props
 * @param {number|null} props.rawRows - Total raw rows from the sheet.
 * @param {Array} props.parsedData - Parsed workout entries.
 * @param {number|null} props.dataSyncedAt - Timestamp of last sync.
 * @param {boolean} props.isValidating - Whether SWR is revalidating.
 * @param {string|null} props.sheetURL - URL of the linked sheet.
 * @param {string|null} props.sheetFilename - Display name of the sheet.
 * @param {function} [props.mutate] - SWR mutate function for manual refresh.
 */
export function DataSheetStatus({
  rawRows,
  parsedData,
  dataSyncedAt,
  isValidating,
  sheetURL,
  sheetFilename,
  mutate,
}) {
  const rowLabel =
    rawRows != null ? `${rawRows.toLocaleString()} rows` : null;

  const sheetLabel = (sheetFilename || "Your Google Sheet").trim();
  const timeSuffix = formatSyncTime(dataSyncedAt);
  const freshnessColor = isValidating ? "text-muted-foreground" : getFreshnessColor(dataSyncedAt);
  const tooltipText = dataSyncedAt
    ? `Last synced: ${format(new Date(dataSyncedAt), "MMM d, h:mm a")}${rowLabel ? ` • ${rowLabel}` : ""}`
    : rowLabel || null;

  const sheetLinkContent = (
    <>
      <span className="2xl:hidden">Google Sheet</span>
      <span className="hidden 2xl:inline-block max-w-[20ch] min-[1920px]:max-w-none truncate align-bottom underline">{sheetLabel}</span>
    </>
  );

  const sheetLink = sheetURL ? (
    <a
      href={sheetURL}
      target="_blank"
      rel="noopener noreferrer"
      title={tooltipText}
      className={`underline ${freshnessColor} hover:text-foreground`}
    >
      {sheetLinkContent}
    </a>
  ) : (
    <span>{sheetLinkContent}</span>
  );

  const syncLabel = (
    <span title={tooltipText} className={freshnessColor}>
      {isValidating
        ? "Reading your workout data…"
        : timeSuffix
          ? <>✓ Synced with {sheetLink} {timeSuffix}</>
          : <>✓ Up to date with {sheetLink}</>}
    </span>
  );

  const parts = [syncLabel];
  if (rowLabel) parts.push(rowLabel);

  return (
    <div className="flex items-center justify-end gap-2 text-xs whitespace-nowrap">
      <img
        src={GOOGLE_SHEETS_ICON_URL}
        alt=""
        className="h-3.5 w-3.5 shrink-0"
        aria-hidden
      />
      <div className="text-right">
        {parts.map((part, i) => (
          <span key={i}>
            {i > 0 && " · "}
            {part}
          </span>
        ))}
      </div>
      {mutate && (
        <button
          type="button"
          onClick={() => mutate()}
          disabled={isValidating}
          title="Sync now"
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Sync now"
        >
          {isValidating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
        </button>
      )}
    </div>
  );
}

const FADE_DELAY_MS = 2500;

/**
 * Animated progress bar showing "Reading your workout data" with row count. Fades out after
 * progress completes. Re-triggers only when rowCount changes (new data arrived).
 *
 * @param {Object} props
 * @param {number|null} props.rowCount - Total rows to process.
 * @param {boolean} props.isProgressDone - Whether the animation has finished.
 * @param {function(boolean)} props.setIsProgressDone - Callback to mark progress complete.
 */
export function RowProcessingIndicator({
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
          <div className="text-sm text-muted-foreground grid grid-cols-[minmax(12rem,1fr)_auto] items-center gap-x-2">
            <div className="flex items-center justify-end gap-2 min-w-0">
              <img
                src={GOOGLE_SHEETS_ICON_URL}
                alt=""
                className="h-4 w-4 shrink-0"
                aria-hidden
              />
              {isProgressDone ? "Processed" : "Reading your workout data"}:
            </div>
            <div className="flex items-center gap-2">
              <span className="tabular-nums min-w-[20ch] inline-block text-left">
                {animatedCount.toLocaleString()} / {rowCount?.toLocaleString()}
              </span>
              <motion.span
                className={`shrink-0 ${isProgressDone ? "text-green-500" : "text-amber-400"}`}
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
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
