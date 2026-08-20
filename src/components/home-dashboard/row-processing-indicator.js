/*
 * Home dashboard loading/status indicators for linked-sheet sync and initial data hydration.
 * Keep source-specific wording accurate so imported preview mode never looks sheet-backed.
 * The load indicator and the synced-sheet line share one fixed-height header slot, so handing
 * over from one to the other never shifts the dashboard underneath.
 */
import { useState, useEffect, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { format, differenceInSeconds, differenceInMinutes, differenceInHours, isToday } from "date-fns";
import { FileUp, RefreshCw, Loader2 } from "lucide-react";
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

// One extra 0 on the end so a wheel can roll past 9 and wrap without snapping back.
const ODOMETER_WHEEL_DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

// The digit pitch is shorter than the window, so the neighbouring numbers peek in at the
// edges the way a mechanical counter shows the wheel curving away.
const ODOMETER_WINDOW_EM = 1.35;
const ODOMETER_DIGIT_EM = 1;
const ODOMETER_PEEK_EM = (ODOMETER_WINDOW_EM - ODOMETER_DIGIT_EM) / 2;
const ODOMETER_MASK =
  "linear-gradient(to bottom, transparent 0%, #000 20%, #000 80%, transparent 100%)";

// A real odometer gears each wheel off the one below it: only the fastest wheel turns freely,
// and the rest sit crisp until their neighbour is about to wrap, then snap-roll with it.
const ODOMETER_ROLL_GATE = 0.9;

function odometerWheelOffset(value, place) {
  if (place === 0) return value % 10;
  const scaled = value / 10 ** place;
  const fraction = scaled - Math.floor(scaled);
  const roll =
    fraction > ODOMETER_ROLL_GATE
      ? (fraction - ODOMETER_ROLL_GATE) / (1 - ODOMETER_ROLL_GATE)
      : 0;
  return (Math.floor(scaled) % 10) + roll;
}

/**
 * Mechanical-style rolling counter. Each wheel is geared to its own decimal place, so the
 * ones wheel spins while the higher wheels creep round and settle as the count lands.
 *
 * @param {Object} props
 * @param {number} props.value - Current count, kept fractional so wheels roll between digits.
 * @param {number} [props.layoutValue] - Widest count to lay out for, so nothing reflows mid-roll.
 */
function OdometerCount({ value, layoutValue }) {
  const prefersReducedMotion = useReducedMotion();
  const safeValue = Math.max(0, value ?? 0);
  const displayValue = Math.floor(safeValue).toLocaleString();
  // Never shrink below the number currently showing, so a roll past a digit boundary
  // (9,999 -> 10,000) widens early instead of clipping.
  const widthSource = Math.max(Math.ceil(safeValue), Math.max(0, layoutValue ?? 0));

  if (prefersReducedMotion) {
    return <span className="tabular-nums">{displayValue}</span>;
  }

  // Walk the formatted width from the right so each digit knows its decimal place, and keep
  // whatever separators the locale produced sitting still between the moving wheels.
  const reversedChars = [...widthSource.toLocaleString()].reverse();
  const wheels = reversedChars
    .map((char, index) => {
      if (!/\d/.test(char)) return { key: index, separator: char };
      const place = reversedChars
        .slice(0, index)
        .filter((earlier) => /\d/.test(earlier)).length;
      return {
        key: index,
        offset: odometerWheelOffset(safeValue, place),
        isLeadingZero: safeValue < 10 ** place,
      };
    })
    .reverse();

  return (
    <span className="inline-flex items-center tabular-nums">
      {/* Zero-width reference digit: the wheels are overflow-hidden boxes with no usable
          baseline of their own, so this gives the inline-flex box a real text baseline and
          keeps the counter sitting on the same line as the copy around it. */}
      <span aria-hidden className="w-0 overflow-hidden opacity-0 select-none">
        0
      </span>
      <span className="sr-only">{displayValue}</span>
      {wheels.map((wheel) =>
        wheel.separator ? (
          <span key={wheel.key} aria-hidden>
            {wheel.separator}
          </span>
        ) : (
          <span
            key={wheel.key}
            aria-hidden
            className={`inline-block overflow-hidden transition-opacity duration-500 ${
              wheel.isLeadingZero ? "opacity-25" : "opacity-100"
            }`}
            style={{
              height: `${ODOMETER_WINDOW_EM}em`,
              maskImage: ODOMETER_MASK,
              WebkitMaskImage: ODOMETER_MASK,
            }}
          >
            <span
              className="block will-change-transform"
              style={{
                transform: `translateY(${ODOMETER_PEEK_EM - wheel.offset}em)`,
              }}
            >
              {ODOMETER_WHEEL_DIGITS.map((digit, digitIndex) => (
                <span
                  key={digitIndex}
                  className="block text-center"
                  style={{
                    height: `${ODOMETER_DIGIT_EM}em`,
                    lineHeight: `${ODOMETER_DIGIT_EM}em`,
                  }}
                >
                  {digit}
                </span>
              ))}
            </span>
          </span>
        ),
      )}
    </span>
  );
}

const ROW_COUNT_ROLL_MS = 900;

/**
 * Eases a number towards a new target so an odometer has something to roll between.
 * The first real value lands without a roll: the wheels are there to show a count changing,
 * not to re-announce the same number on every mount.
 *
 * @param {number|null} target - Value to settle on.
 * @param {number} [durationMs] - Roll duration.
 * @returns {number|null} Current value, fractional while rolling.
 */
function useRollingCount(target, durationMs = ROW_COUNT_ROLL_MS) {
  const [value, setValue] = useState(target ?? null);
  const valueRef = useRef(target ?? null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const from = valueRef.current;

    if (target === null || target === undefined) {
      valueRef.current = null;
      setValue(null);
      return;
    }

    if (from === null || prefersReducedMotion) {
      valueRef.current = target;
      setValue(target);
      return;
    }

    if (from === target) return;

    const start = performance.now();
    let frameId;

    const tick = (now) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - progress) ** 3;
      valueRef.current = progress >= 1 ? target : from + (target - from) * eased;
      setValue(valueRef.current);
      if (progress < 1) frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [target, durationMs, prefersReducedMotion]);

  return value;
}

/**
 * Shows sync status with the user's Google Sheet (last synced time, row count) and a refresh button.
 * The row count rolls on its odometer whenever a sync brings back a different number of rows.
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
  const rollingRows = useRollingCount(rawRows);

  const rowText = rawRows != null ? `${rawRows.toLocaleString()} rows` : null;
  const rowLabel =
    rawRows != null ? (
      <span className="inline-flex items-center gap-1">
        <OdometerCount value={rollingRows ?? rawRows} layoutValue={rawRows} />
        rows
      </span>
    ) : null;

  const sheetLabel = (sheetFilename || "Your Google Sheet").trim();
  const timeSuffix = formatSyncTime(dataSyncedAt);
  const freshnessColor = isValidating ? "text-muted-foreground" : getFreshnessColor(dataSyncedAt);
  const tooltipText = dataSyncedAt
    ? `Last synced: ${format(new Date(dataSyncedAt), "MMM d, h:mm a")}${rowText ? ` • ${rowText}` : ""}`
    : rowText || null;

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

/**
 * Compact progress pill for the initial data load. Sized to sit in the dashboard header slot
 * beside the greeting, so it never occupies a row of its own. Supports sheet rows and imported
 * preview entries so one visual treatment works without implying every source is Google Sheets.
 *
 * @param {Object} props
 * @param {"sheet"|"preview"} [props.mode] - Source type powering the load indicator.
 * @param {number|null} props.count - Total rows/entries to process.
 * @param {boolean} props.isProgressDone - Whether the animation has finished.
 * @param {function(boolean)} props.setIsProgressDone - Callback to mark progress complete.
 */
export function RowProcessingIndicator({
  mode = "sheet",
  count,
  isProgressDone,
  setIsProgressDone,
}) {
  const [animatedCount, setAnimatedCount] = useState(0);
  const isPreviewMode = mode === "preview";
  const countLabel = isPreviewMode ? "entries" : "rows";
  const loadingLabel = isPreviewMode
    ? "Preparing imported preview"
    : "Reading your workout data";
  const completedLabel = isPreviewMode ? "Preview ready" : "Processed";

  useEffect(() => {
    // Reset whenever the incoming count changes
    setAnimatedCount(0);
    setIsProgressDone(false);

    if (count === null || count === undefined) {
      setIsProgressDone(false);
      return;
    }

    if (count <= 0) {
      setIsProgressDone(true);
      return;
    }

    const durationMs = 1200; // total animation duration
    const start = performance.now();
    let frameId;

    const tick = (now) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / durationMs);
      // Fractional on purpose: the odometer wheels roll between whole numbers.
      const nextCount = count * progress;
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
  }, [count, setIsProgressDone]);

  const percent =
    count && count > 0
      ? Math.min(100, Math.round((animatedCount / count) * 100))
      : 0;

  if (count === null || count === undefined) {
    return <Skeleton className="h-5 w-56 rounded-full" />;
  }

  return (
    <div
      className="relative flex items-center gap-2 overflow-hidden rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-xs whitespace-nowrap"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={count}
      aria-valuenow={Math.floor(animatedCount)}
      aria-label={`${loadingLabel}: ${Math.floor(animatedCount).toLocaleString()} of ${count.toLocaleString()} ${countLabel}`}
    >
      {/* The fill sweeps behind the text instead of sitting above it as its own bar, so the
          pill stays the same height as the synced-sheet line it hands over to. */}
      <span
        aria-hidden
        className="bg-primary/15 absolute inset-y-0 left-0"
        style={{ width: `${percent}%` }}
      />
      <span className="relative flex items-center gap-2">
        {isPreviewMode ? (
          <FileUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
        ) : (
          <img
            src={GOOGLE_SHEETS_ICON_URL}
            alt=""
            className="h-3.5 w-3.5 shrink-0"
            aria-hidden
          />
        )}
        <span className="text-muted-foreground hidden sm:inline">
          {isProgressDone ? completedLabel : loadingLabel}:
        </span>
        <span className="flex items-center gap-1 tabular-nums">
          <OdometerCount value={animatedCount} layoutValue={count} />
          <span className="text-muted-foreground">
            / {count.toLocaleString()} {countLabel}
          </span>
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
      </span>
    </div>
  );
}

// Beat between the count landing and the synced-sheet line taking over, so the finished
// count is readable rather than flashing past.
const STATUS_HANDOVER_MS = 700;

/**
 * Fixed-height header slot holding the load indicator and then the synced-sheet line.
 * Both render into the same grid cell, so the handover is a crossfade in place and the
 * dashboard below never moves.
 *
 * @param {Object} props
 * @param {boolean} props.isProgressDone - Whether the initial count has finished.
 * @param {React.ReactNode} props.indicator - Load indicator shown first.
 * @param {React.ReactNode} [props.status] - Sheet status line; omit for sources without one.
 */
export function DashboardHeaderStatus({ isProgressDone, indicator, status }) {
  const [hasHandedOver, setHasHandedOver] = useState(false);

  useEffect(() => {
    if (!isProgressDone) {
      setHasHandedOver(false);
      return;
    }
    const timer = setTimeout(() => setHasHandedOver(true), STATUS_HANDOVER_MS);
    return () => clearTimeout(timer);
  }, [isProgressDone]);

  const handedOver = isProgressDone && hasHandedOver;

  return (
    <div className="grid min-h-6 w-full items-center 2xl:ml-auto 2xl:w-auto">
      <AnimatePresence initial={false}>
        <motion.div
          key={handedOver ? "status" : "indicator"}
          className="col-start-1 row-start-1 flex items-center justify-center 2xl:justify-end"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          {handedOver ? status : indicator}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
