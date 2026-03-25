import { Fragment, useMemo, useRef } from "react";
import { subMonths, subYears, format } from "date-fns";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import {
  useAthleteBio,
  getTopLiftStats,
  STRENGTH_LEVEL_EMOJI,
} from "@/hooks/use-athlete-biodata";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useSession } from "next-auth/react";
import {
  getReadableDateString,
  getDisplayWeight,
} from "@/lib/processing-utils";
import { estimateE1RM } from "@/lib/estimate-e1rm";
import { formatDateToYmdLocal } from "@/lib/date-utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useReadLocalStorage,
  useResizeObserver,
  useWindowSize,
} from "usehooks-ts";

const PERIOD_KEYS = ["1M", "6M", "1Y", "2Y", "5Y", "10Y"];

/**
 * Horizontal gradient bar (yellow → green) that visualises where a user sits on a
 * five-tier strength scale: Physically Active → Beginner → Intermediate → Advanced → Elite.
 *
 * Has two display modes:
 * - **Guest mode**: renders the labelled standards scale only, with no personal data.
 * - **Authenticated mode**: overlays interactive notches for the user's lifetime PR,
 *   lifetime best E1RM, and period-best E1RMs (last 1M / 6M / 1Y / 2Y / 5Y / 10Y).
 *   Nearby notches are clustered to avoid overlap. Each notch has a tooltip with the
 *   underlying set details. A strength rating label (e.g. "💪 Intermediate") is shown
 *   below the bar. The scale extends beyond Elite when the user surpasses that threshold.
 *
 * @param {Object} props
 * @param {string} props.liftType - The lift type to display (e.g. "Back Squat").
 * @param {boolean} [props.isYearly=false] - When true, uses last-12-months data instead of all-time.
 * @param {boolean} props.isMetric - Whether to display weights in kg (true) or lb (false).
 * @param {Object} props.standards - Standards object from `useAthleteBio()`, keyed by liftType,
 *   each value being `{ physicallyActive, beginner, intermediate, advanced, elite }` in the
 *   display unit.
 */
export function StandardsSlider({
  liftType,
  isYearly = false,
  isMetric,
  standards,
  hideRating = false,
  ratingRightSlot = null,
}) {
  const containerRef = useRef(null);
  const {
    isLoading: isUserDataLoading,
    sheetInfo,
    parsedData,
    topLiftsByTypeAndReps,
    topLiftsByTypeAndRepsLast12Months,
  } = useUserLiftingData();
  const { status: authStatus } = useSession();
  const { age, bodyWeight, sex } = useAthleteBio();
  const { width } = useWindowSize({ initializeWithValue: false });
  const { width: containerWidth = 0 } = useResizeObserver({
    ref: containerRef,
  });
  const e1rmFormula =
    useReadLocalStorage(LOCAL_STORAGE_KEYS.FORMULA, {
      initializeWithValue: false,
    }) ?? "Brzycki";

  const unitType = isMetric ? "kg" : "lb";

  // Determine the native unit type from the user's actual lift data for this lift type.
  // This may differ from unitType when the user has toggled isMetric away from their data's
  // native unit (e.g. lb data viewed in kg mode). All lift weights/e1rms from parsedData
  // and topLiftsByTypeAndReps are in this native unit and must be converted before comparing
  // against `standards`, which are always in the display unit (see useAthleteBioData).
  const firstLiftForType = (
    isYearly ? topLiftsByTypeAndRepsLast12Months : topLiftsByTypeAndReps
  )?.[liftType]?.[0]?.[0];
  const nativeUnitType = firstLiftForType?.unitType || unitType;
  const toDisplay = (w) =>
    getDisplayWeight({ weight: w, unitType: nativeUnitType }, isMetric).value;

  // --- Find the most recent session date for this lift type ---
  const latestSessionDate = useMemo(() => {
    if (authStatus !== "authenticated" || !parsedData?.length) return null;
    let latest = null;
    for (const entry of parsedData) {
      if (
        entry.isGoal ||
        entry.liftType !== liftType ||
        !entry.reps ||
        !entry.weight ||
        !entry.date
      )
        continue;
      if (!latest || entry.date > latest) latest = entry.date;
    }
    return latest;
  }, [authStatus, parsedData, liftType]);

  // --- Compute period-best E1RMs EXCLUDING the most recent session ---
  const periodBestNotches = useMemo(() => {
    if (authStatus !== "authenticated" || !parsedData?.length || !e1rmFormula)
      return [];

    const now = new Date();
    const thresholds = {
      "1M": format(subMonths(now, 1), "yyyy-MM-dd"),
      "6M": format(subMonths(now, 6), "yyyy-MM-dd"),
      "1Y": format(subYears(now, 1), "yyyy-MM-dd"),
      "2Y": format(subYears(now, 2), "yyyy-MM-dd"),
      "5Y": format(subYears(now, 5), "yyyy-MM-dd"),
      "10Y": format(subYears(now, 10), "yyyy-MM-dd"),
    };

    const bestByPeriod = {};
    PERIOD_KEYS.forEach((key) => (bestByPeriod[key] = null));

    parsedData.forEach((entry) => {
      if (entry.isGoal) return;
      if (entry.liftType !== liftType || !entry.reps || !entry.weight) return;
      if (!entry.date) return;
      // Exclude the most recent session so period markers show "where you were"
      if (latestSessionDate && entry.date === latestSessionDate) return;

      const e1rm = estimateE1RM(entry.reps, entry.weight, e1rmFormula);
      const id = `${entry.date}-${entry.reps}-${entry.weight}-${entry.unitType || ""}`;

      PERIOD_KEYS.forEach((key) => {
        if (entry.date < thresholds[key]) return;
        const current = bestByPeriod[key];
        if (!current || e1rm > current.e1rm) {
          bestByPeriod[key] = {
            e1rm,
            unitType: entry.unitType || unitType,
            date: entry.date,
            reps: entry.reps,
            weight: entry.weight,
            id,
          };
        }
      });
    });

    const periodMeta = {
      "1M": { label: "Last month", shortLabel: "1M" },
      "6M": { label: "Last 6 months", shortLabel: "6M" },
      "1Y": { label: "Last year", shortLabel: "1Y" },
      "2Y": { label: "Last 2 years", shortLabel: "2Y" },
      "5Y": { label: "Last 5 years", shortLabel: "5Y" },
      "10Y": { label: "Last 10 years", shortLabel: "10Y" },
    };

    // Keep the shortest period where a given best lift first appears.
    const seenIds = new Set();
    const summaries = [];
    PERIOD_KEYS.forEach((key) => {
      const best = bestByPeriod[key];
      if (!best || seenIds.has(best.id)) return;
      seenIds.add(best.id);
      summaries.push({
        periodKey: key,
        label: periodMeta[key].label,
        shortLabel: periodMeta[key].shortLabel,
        ...best,
      });
    });

    return summaries;
  }, [authStatus, parsedData, liftType, e1rmFormula, unitType, latestSessionDate]);

  // --- "Now" marker + 2 trailing dots for momentum ---
  const { nowNotch, trailDots } = useMemo(() => {
    if (
      authStatus !== "authenticated" ||
      !parsedData?.length ||
      !e1rmFormula ||
      !latestSessionDate
    )
      return { nowNotch: null, trailDots: [] };

    // Collect best E1RM per session date for this lift type
    const bestByDate = {};
    for (const entry of parsedData) {
      if (
        entry.isGoal ||
        entry.liftType !== liftType ||
        !entry.reps ||
        !entry.weight ||
        !entry.date
      )
        continue;

      const e1rm = estimateE1RM(entry.reps, entry.weight, e1rmFormula);
      const prev = bestByDate[entry.date];
      if (!prev || e1rm > prev.e1rm) {
        bestByDate[entry.date] = {
          date: entry.date,
          reps: entry.reps,
          weight: entry.weight,
          unitType: entry.unitType || unitType,
          e1rm,
        };
      }
    }

    // Sort dates descending to get the 3 most recent
    const sortedDates = Object.keys(bestByDate).sort((a, b) => (a > b ? -1 : 1));
    if (sortedDates.length === 0) return { nowNotch: null, trailDots: [] };

    const latest = bestByDate[sortedDates[0]];
    const threeMonthsAgoYmd = format(subMonths(new Date(), 3), "yyyy-MM-dd");

    let shortLabel;
    if (latest.date >= threeMonthsAgoYmd) {
      shortLabel = "Now";
    } else {
      shortLabel = getReadableDateString(latest.date);
    }

    // Build trail dots from the 2 prior sessions
    const dots = sortedDates.slice(1, 3).map((d) => bestByDate[d]);

    return {
      nowNotch: { ...latest, shortLabel, isNewPR: false, matchesPR: false },
      trailDots: dots,
    };
  }, [authStatus, parsedData, liftType, e1rmFormula, unitType, latestSessionDate]);

  // Prevent initial render on standards-only scale, then jumping once
  // authenticated user data (PR/E1RM) hydrates and expands min/max bounds.
  if (authStatus === "authenticated" && sheetInfo?.ssid && isUserDataLoading) {
    return (
      <div className="bg-muted/30 h-[7.5rem] w-full animate-pulse rounded" />
    );
  }

  if (!standards) return null;
  const originalData = standards[liftType];
  if (!originalData) return null;
  const liftTypeStandards = readableLabels(originalData);

  // Get all standard values for scale
  const standardValues = Object.values(originalData);
  const standardsMin = Math.min(...standardValues); // Usually 'physicallyActive'
  const eliteMax = originalData.elite; // Elite standard value

  // Use shared hook helper for top-lift stats (authenticated users only)
  let athleteRankingWeight = 0;
  let highestE1RM = 0;
  let strengthRating = null;
  let bestWeightTuple = null;
  let bestE1RMTuple = null;
  // Raw (native-unit) copies kept for dedup comparison against period notches
  let rawBestWeightTuple = null;
  let rawBestE1RMTuple = null;
  if (authStatus === "authenticated") {
    const topLifts = isYearly
      ? topLiftsByTypeAndRepsLast12Months?.[liftType]
      : topLiftsByTypeAndReps?.[liftType];
    const bioForDateRating =
      age && bodyWeight != null && sex != null
        ? { age, bodyWeight, sex, isMetric }
        : null;
    const stats = getTopLiftStats(
      topLifts,
      liftType,
      standards,
      e1rmFormula,
      bioForDateRating,
    );
    // Convert from native lift unit to display unit so positions on the slider
    // are consistent with the standards scale (which is already in display unit).
    athleteRankingWeight =
      stats.bestWeight > 0 ? toDisplay(stats.bestWeight) : 0;
    highestE1RM = stats.bestE1RM > 0 ? toDisplay(stats.bestE1RM) : 0;
    strengthRating = stats.strengthRating;
    // Keep raw (unconverted) copies for dedup comparison against period notches (also native unit)
    rawBestWeightTuple = stats.bestWeightTuple;
    rawBestE1RMTuple = stats.bestE1RMTuple;
    bestWeightTuple = stats.bestWeightTuple
      ? {
          ...stats.bestWeightTuple,
          weight: toDisplay(stats.bestWeightTuple.weight),
        }
      : null;
    bestE1RMTuple = stats.bestE1RMTuple
      ? {
          ...stats.bestE1RMTuple,
          weight: toDisplay(stats.bestE1RMTuple.weight),
          e1rm: toDisplay(stats.bestE1RMTuple.e1rm),
        }
      : null;
  }

  // Convert period notch e1rms to display unit before computing userMin,
  // so the scale is consistent with standards (which are in display unit).
  const periodMinE1RMDisplay =
    periodBestNotches.length > 0
      ? Math.min(
          ...periodBestNotches.map(
            (n) =>
              getDisplayWeight(
                { weight: n.e1rm, unitType: n.unitType || nativeUnitType },
                isMetric,
              ).value,
          ),
        )
      : Infinity;
  const nowE1RMDisplay = nowNotch
    ? getDisplayWeight(
        { weight: nowNotch.e1rm, unitType: nowNotch.unitType || nativeUnitType },
        isMetric,
      ).value
    : Infinity;
  const trailMinE1RMDisplay =
    trailDots.length > 0
      ? Math.min(
          ...trailDots.map(
            (d) =>
              getDisplayWeight(
                { weight: d.e1rm, unitType: d.unitType || nativeUnitType },
                isMetric,
              ).value,
          ),
        )
      : Infinity;
  const userMin =
    authStatus === "authenticated"
      ? Math.min(
          athleteRankingWeight > 0 ? athleteRankingWeight : Infinity,
          periodMinE1RMDisplay,
          nowE1RMDisplay,
          trailMinE1RMDisplay,
        )
      : Infinity;
  const effectiveMin = Number.isFinite(userMin)
    ? Math.min(standardsMin, userMin)
    : standardsMin;
  const shouldExtendLowerBound = effectiveMin < standardsMin;
  const lowerBuffer = shouldExtendLowerBound
    ? Math.max(1, Math.ceil(effectiveMin * 0.08)) // keep a little breathing room below the lowest point
    : 0;
  const minLift = shouldExtendLowerBound
    ? Math.max(0, Math.floor(effectiveMin - lowerBuffer))
    : standardsMin;

  // Extend max beyond Elite when user's record exceeds it (so E1RM/thumb stay on bar)
  const userMax = Math.max(highestE1RM || 0, athleteRankingWeight || 0);
  const maxLift =
    userMax > eliteMax
      ? Math.ceil(userMax * 1.05) // Slightly beyond user's record
      : eliteMax;

  // Helper to calculate proportional % from minLift to maxLift
  const getPercent = (val) =>
    maxLift === minLift ? 0 : ((val - minLift) / (maxLift - minLift)) * 100;

  // Proportional thumb position
  const thumbPosition = getPercent(athleteRankingWeight);

  // Level label data
  const levelLabels = Object.keys(liftTypeStandards);

  // --- Build unified notch array & cluster nearby labels ---
  const allNotches = [];

  if (athleteRankingWeight > 0) {
    allNotches.push({
      key: "PR",
      percent: thumbPosition,
      shortLabel: "PR",
      zIndex: 20,
      tooltipContent: bestWeightTuple ? (
        <div className="space-y-0.5">
          <div className="font-semibold">
            Lifetime PR: {bestWeightTuple.weight}
            {unitType}
          </div>
          <div className="text-muted-foreground">
            {bestWeightTuple.reps} × {bestWeightTuple.weight}
            {unitType}
            {bestWeightTuple.date && (
              <> · {getReadableDateString(bestWeightTuple.date)}</>
            )}
          </div>
        </div>
      ) : (
        <span>
          Lifetime PR: {athleteRankingWeight}
          {unitType}
        </span>
      ),
    });
  }

  if (
    authStatus === "authenticated" &&
    highestE1RM > 0 &&
    highestE1RM > athleteRankingWeight
  ) {
    allNotches.push({
      key: "E1RM",
      percent: getPercent(highestE1RM),
      shortLabel: "E1RM",
      zIndex: 30,
      tooltipContent: bestE1RMTuple ? (
        <div className="space-y-0.5">
          <div className="font-semibold">
            Lifetime best E1RM: ~{Math.round(bestE1RMTuple.e1rm)}
            {unitType}
          </div>
          <div className="text-muted-foreground">
            {bestE1RMTuple.reps} × {bestE1RMTuple.weight}
            {unitType}
            {bestE1RMTuple.date && (
              <> · {getReadableDateString(bestE1RMTuple.date)}</>
            )}
          </div>
        </div>
      ) : (
        <span>
          Lifetime best E1RM: ~{Math.round(highestE1RM)}
          {unitType}
        </span>
      ),
    });
  }

  // Skip period notches that duplicate the lifetime PR or E1RM.
  // Compare against raw (native-unit) tuples since period notch weights are also native.
  const isSameLift = (a, b) =>
    a && b && a.date === b.date && a.reps === b.reps && a.weight === b.weight;

  if (periodBestNotches.length > 0) {
    for (const notch of periodBestNotches) {
      if (
        isSameLift(notch, rawBestWeightTuple) ||
        isSameLift(notch, rawBestE1RMTuple)
      )
        continue;
      // Convert notch values to display unit (same unit as standards scale)
      const notchE1rmDisplay = getDisplayWeight(
        { weight: notch.e1rm, unitType: notch.unitType || nativeUnitType },
        isMetric,
      ).value;
      const notchWeightDisplay =
        typeof notch.weight === "number"
          ? getDisplayWeight(
              {
                weight: notch.weight,
                unitType: notch.unitType || nativeUnitType,
              },
              isMetric,
            ).value
          : notch.weight;
      const isSingle = Number(notch.reps) === 1;
      const headlineValue = isSingle
        ? Math.round(notchWeightDisplay)
        : Math.round(notchE1rmDisplay);
      const bodyweightRatioValue = isSingle
        ? notchWeightDisplay
        : notchE1rmDisplay;
      allNotches.push({
        key:
          notch.periodKey ||
          notch.label ||
          `extra-${getPercent(notchE1rmDisplay)}`,
        percent: getPercent(notchE1rmDisplay),
        shortLabel: notch.shortLabel || notch.periodKey,
        zIndex: 10,
        tooltipContent: (
          <div className="space-y-0.5">
            <div className="font-semibold">
              {notch.label} {isSingle ? "1RM" : "E1RM"}: {isSingle ? "" : "~"}
              {headlineValue}
              {unitType}
              {bodyWeight > 0 && (
                <span className="text-muted-foreground font-normal">
                  {" "}
                  ({(bodyweightRatioValue / bodyWeight).toFixed(2)}×BW)
                </span>
              )}
            </div>
            <div className="text-muted-foreground">
              {typeof notch.reps === "number" &&
                typeof notch.weight === "number" && (
                  <>
                    {notch.reps} × {notchWeightDisplay}
                    {unitType}
                  </>
                )}
              {typeof notch.reps === "number" &&
                typeof notch.weight === "number" &&
                notch.date &&
                " · "}
              {notch.date && getReadableDateString(notch.date)}
            </div>
          </div>
        ),
      });
    }
  }

  // --- "Now" marker: dominant pill style, shows most recent session ---
  if (nowNotch) {
    const nowE1rmDisp = getDisplayWeight(
      { weight: nowNotch.e1rm, unitType: nowNotch.unitType || nativeUnitType },
      isMetric,
    ).value;
    const nowWeightDisp = getDisplayWeight(
      { weight: nowNotch.weight, unitType: nowNotch.unitType || nativeUnitType },
      isMetric,
    ).value;
    const nowIsSingle = Number(nowNotch.reps) === 1;
    const nowHeadline = nowIsSingle
      ? Math.round(nowWeightDisp)
      : Math.round(nowE1rmDisp);
    const nowPercent = getPercent(nowE1rmDisp);

    // Detect PR relationship: compare Now against the best E1RM EXCLUDING
    // the latest session (i.e. the period markers). This way we can detect
    // when the most recent session IS the new PR vs matching an old one.
    const PR_MATCH_THRESHOLD = 0.02; // 2%
    const bestExcludingNow =
      periodBestNotches.length > 0
        ? Math.max(
            ...periodBestNotches.map(
              (n) =>
                getDisplayWeight(
                  { weight: n.e1rm, unitType: n.unitType || nativeUnitType },
                  isMetric,
                ).value,
            ),
          )
        : 0;
    const isNewPR =
      bestExcludingNow > 0 && nowE1rmDisp > bestExcludingNow * (1 + PR_MATCH_THRESHOLD);
    const matchesPR =
      !isNewPR &&
      bestExcludingNow > 0 &&
      nowE1rmDisp >= bestExcludingNow * (1 - PR_MATCH_THRESHOLD);

    let nowLabel = nowNotch.shortLabel;
    let tooltipHeadline = "Most recent";
    if (isNewPR) {
      nowLabel = "New PR!";
      tooltipHeadline = "New personal record!";
    } else if (matchesPR) {
      nowLabel = "PR · Now";
      tooltipHeadline = "Matched your all-time best!";
    }

    allNotches.push({
      key: `now-${nowNotch.date}-${nowNotch.reps}-${nowNotch.weight}`,
      percent: nowPercent,
      shortLabel: nowLabel,
      zIndex: 40,
      isDominant: true,
      isNewPR,
      matchesPR,
      tooltipContent: (
        <div className="space-y-0.5">
          <div className="font-semibold">
            {tooltipHeadline}: {nowIsSingle ? "" : "~"}
            {nowHeadline}
            {unitType}
            {nowIsSingle ? " 1RM" : " E1RM"}
          </div>
          <div className="text-muted-foreground">
            {nowNotch.reps} × {nowWeightDisp}
            {unitType}
            {nowNotch.date && (
              <> · {getReadableDateString(nowNotch.date)}</>
            )}
          </div>
          {isNewPR && bestExcludingNow > 0 && (
            <div className="text-green-400 font-medium">
              +{Math.round(nowE1rmDisp - bestExcludingNow)}
              {unitType} over previous best
            </div>
          )}
        </div>
      ),
    });
  }

  // Sort by percent position and group nearby notches into clusters
  allNotches.sort((a, b) => a.percent - b.percent);
  const MERGE_THRESHOLD = 4; // percent
  const notchClusters = [];
  for (const notch of allNotches) {
    const last = notchClusters[notchClusters.length - 1];
    if (
      last &&
      Math.abs(notch.percent - last[last.length - 1].percent) <= MERGE_THRESHOLD
    ) {
      last.push(notch);
    } else {
      notchClusters.push([notch]);
    }
  }

  const shouldUseCompactActiveLabel =
    containerWidth > 0 ? containerWidth < 1200 : true;

  return (
    <div ref={containerRef} className="mx-auto w-full">
      {/* Lift level labels */}
      <div className="relative mb-2 h-14 w-full">
        {levelLabels.map((level, index) => {
          // Only show 1st, 3rd, last on mobile
          if (
            width < 800 &&
            index !== 0 &&
            index !== 2 &&
            index !== levelLabels.length - 1
          )
            return null;
          const value = liftTypeStandards[level];
          const left = getPercent(value);

          // Alignment rules
          let labelStyle, labelClass;
          if (index === 0 && minLift === standardsMin) {
            // First (flush left)
            labelStyle = { left: "0%" };
            labelClass = "absolute flex flex-col items-start text-left";
          } else if (index === levelLabels.length - 1 && maxLift === eliteMax) {
            // Last (flush right) - only when scale ends at Elite
            labelStyle = { left: "100%", transform: "translateX(-100%)" };
            labelClass = "absolute flex flex-col items-end text-right";
          } else {
            // Centered for others, or last when scale extends beyond Elite
            labelStyle = { left: `${left}%`, transform: "translateX(-50%)" };
            labelClass = "absolute flex flex-col items-center";
          }

          return (
            <span key={level} className={labelClass} style={labelStyle}>
              <div className="md:text-base">
                {shouldUseCompactActiveLabel && level === "Physically Active"
                  ? "Active"
                  : level}
              </div>
              <div className="font-bold md:text-lg lg:text-xl">
                {liftTypeStandards[level]}
                {unitType}
              </div>
            </span>
          );
        })}
        {/* <div className="block md:hidden">Rating: </div> */}
      </div>
      <div className="relative mb-7 w-full">
        {/* Slider bar background */}
        <div className="relative h-2 w-full rounded-full bg-gradient-to-r from-yellow-500 via-green-300 to-green-800" />
        {/* Momentum trail: 2 fading dots from prior sessions */}
        {trailDots.map((dot, i) => {
          const dotE1rm = getDisplayWeight(
            { weight: dot.e1rm, unitType: dot.unitType || nativeUnitType },
            isMetric,
          ).value;
          const dotPercent = getPercent(dotE1rm);
          // Skip dots that overlap the Now marker (no visual story to tell)
          const nowPct = nowNotch
            ? getPercent(
                getDisplayWeight(
                  { weight: nowNotch.e1rm, unitType: nowNotch.unitType || nativeUnitType },
                  isMetric,
                ).value,
              )
            : null;
          if (nowPct !== null && Math.abs(dotPercent - nowPct) < 2) return null;
          // First trail dot (most recent prior) is more visible than second
          const opacity = i === 0 ? 0.5 : 0.25;
          const size = i === 0 ? "h-3 w-1.5" : "h-2.5 w-1";
          return (
            <div
              key={`trail-${dot.date}`}
              className="absolute top-0 h-full"
              style={{ left: `${dotPercent}%`, zIndex: 5 }}
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <div
                  className={`${size} bg-foreground rounded-full`}
                  style={{ opacity }}
                />
              </div>
            </div>
          );
        })}
        {/* Lifetime 1RM and E1RM notches */}
        <TooltipProvider>
          {notchClusters.map((cluster) => {
            const maxZ = Math.max(...cluster.map((n) => n.zIndex));
            const centerPercent =
              cluster.reduce((sum, n) => sum + n.percent, 0) / cluster.length;
            const mergedLabel = cluster.map((n) => n.shortLabel).join(" · ");
            const clusterKey = cluster.map((n) => n.key).join("-");
            const isMerged = cluster.length > 1;
            const hasDominant = cluster.some((n) => n.isDominant);
            const dominantNotch = cluster.find((n) => n.isDominant);

            return (
              <Fragment key={clusterKey}>
                {/* For merged clusters, render individual lines outside the group */}
                {isMerged &&
                  cluster.map((notch) => (
                    <div
                      key={`line-${notch.key}`}
                      className="absolute top-0 h-full"
                      style={{
                        left: `${notch.percent}%`,
                        zIndex: notch.zIndex,
                      }}
                    >
                      {notch.isDominant ? (
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                          <div
                            className={`h-3.5 w-1.5 rounded-full shadow-sm ring-1 transition-[left] duration-300 ${
                              notch.isNewPR
                                ? "bg-yellow-400 ring-yellow-600/50"
                                : "bg-foreground ring-background"
                            }`}
                          />
                        </div>
                      ) : (
                        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2">
                          <div className="bg-foreground ring-background/70 h-full w-px ring-1" />
                        </div>
                      )}
                    </div>
                  ))}
                <Tooltip>
                  <div
                    className="group absolute top-0 h-full w-6 -translate-x-1/2"
                    style={{ left: `${centerPercent}%`, zIndex: maxZ }}
                  >
                    <TooltipTrigger asChild>
                      <span
                        className={`absolute -bottom-6 left-1/2 -translate-x-1/2 rounded px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap shadow ${
                          hasDominant && dominantNotch?.isNewPR
                            ? "bg-yellow-400 text-yellow-950 group-hover:bg-yellow-300"
                            : hasDominant
                              ? "bg-foreground text-background group-hover:bg-primary group-hover:text-primary-foreground"
                              : "bg-background/80 text-foreground group-hover:bg-primary group-hover:text-primary-foreground"
                        }`}
                      >
                        {mergedLabel}
                      </span>
                    </TooltipTrigger>
                    {/* For single notch, render line or dominant pill inside group */}
                    {!isMerged && hasDominant ? (
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                        <div
                          className={`h-3.5 w-1.5 rounded-full shadow-sm ring-1 transition-[left] duration-300 ${
                            dominantNotch?.isNewPR
                              ? "bg-yellow-400 ring-yellow-600/50"
                              : "bg-foreground ring-background"
                          }`}
                        />
                      </div>
                    ) : (
                      !isMerged && (
                        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2">
                          <div className="bg-foreground ring-background/70 group-hover:bg-primary group-hover:ring-primary/30 h-full w-px ring-1" />
                        </div>
                      )
                    )}
                  </div>
                  <TooltipContent
                    side="bottom"
                    sideOffset={6}
                    className="max-w-xs text-xs"
                  >
                    {cluster.length === 1 ? (
                      cluster[0].tooltipContent
                    ) : (
                      <div className="space-y-2">
                        {cluster.map((notch) => (
                          <div key={notch.key}>{notch.tooltipContent}</div>
                        ))}
                      </div>
                    )}
                  </TooltipContent>
                </Tooltip>
              </Fragment>
            );
          })}
        </TooltipProvider>
      </div>
      {!hideRating && authStatus === "authenticated" && strengthRating && (
        <div className="text-muted-foreground mt-2 flex items-center justify-between gap-4 text-sm font-medium">
          <span>
            My lifetime {liftType} level:{" "}
            {strengthRating === "Elite" && userMax > eliteMax ? (
              <>{STRENGTH_LEVEL_EMOJI.Elite} Beyond Elite</>
            ) : (
              <>
                {STRENGTH_LEVEL_EMOJI[strengthRating] ?? ""} {strengthRating}
              </>
            )}
          </span>
          {ratingRightSlot}
        </div>
      )}
    </div>
  );
}

// Helper function to convert the object member names to more readable English labels
const readableLabels = (data) => {
  const labelMap = {
    physicallyActive: "Physically Active",
    beginner: "Beginner",
    intermediate: "Intermediate",
    advanced: "Advanced",
    elite: "Elite",
  };

  const newData = {};

  for (const [key, value] of Object.entries(data)) {
    const newKey = labelMap[key] || key; // Fallback to original key if not in labelMap
    newData[newKey] = value;
  }

  return newData;
};
