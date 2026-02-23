
import {
  useRef,
  useState,
  useEffect,
  useContext,
  useMemo,
} from "react";
import { useLocalStorage, useReadLocalStorage } from "usehooks-ts";
import Link from "next/link";
import { devLog } from "@/lib/processing-utils";
import { useSession } from "next-auth/react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import {
  useAthleteBio,
  getStrengthLevelForWorkouts,
  getStandardForLiftDate,
  STRENGTH_LEVEL_EMOJI,
} from "@/hooks/use-athlete-biodata";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { Skeleton } from "@/components/ui/skeleton";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";

import {
  TooltipProvider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  findLiftPositionInTopLifts,
  getCelebrationEmoji,
  getReadableDateString,
  getAnalyzedSessionLifts,
  getAverageSessionTonnageFromPrecomputed,
  getAverageLiftSessionTonnageFromPrecomputed,
  getSessionTonnagePercentileRangeFromPrecomputed,
  getDisplayWeight,
} from "@/lib/processing-utils";
import {
  LoaderCircle,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { LiftTypeIndicator } from "@/components/lift-type-indicator";
import { SessionExerciseBlock } from "@/components/analyzer/session-exercise-block";

/**
 * Displays a detailed analysis of a single workout session. Shows exercises with sets,
 * PR indicators, tonnage comparison vs last year, and a creative session rating.
 * Used on the Analyzer page; highlight date can be driven by the Visualizer chart hover.
 *
 * @param {Object} props
 * @param {string|null} [props.highlightDate=null] - ISO date string (YYYY-MM-DD) for the session
 *   to display. When null, defaults to the most recent non-goal session in parsedData.
 * @param {function(string)} props.setHighlightDate - Callback to update the displayed session date.
 *   Called when user clicks prev/next or when parent (e.g. Visualizer) wants to sync.
 */
export function SessionAnalysisCard({
  highlightDate = null,
  setHighlightDate,
}) {
  const {
    parsedData,
    topLiftsByTypeAndReps,
    topLiftsByTypeAndRepsLast12Months,
    sessionTonnageLookup,
    isValidating,
  } = useUserLiftingData();
  const { status: authStatus } = useSession();
  const { age, bodyWeight, sex, standards, isMetric } = useAthleteBio();
  const e1rmFormula =
    useReadLocalStorage(LOCAL_STORAGE_KEYS.FORMULA, {
      initializeWithValue: false,
    }) ?? "Brzycki";
  const hasBioData =
    age && bodyWeight && standards && Object.keys(standards).length > 0;

  const sessionRatingRef = useRef(null); // Used to avoid randomised rating changes on rerenders
  const lastUsedAdlibRef = useRef({}); // Tracks last-used indices to avoid repeats when switching sessions
  const isDemoMode = authStatus === "unauthenticated";
  const [sessionRatingCache, setSessionRatingCache] = useLocalStorage(
    LOCAL_STORAGE_KEYS.SESSION_RATING_CACHE,
    {},
    { initializeWithValue: false },
  );
  const [persistCacheTrigger, setPersistCacheTrigger] = useState(0);
  const pendingCacheUpdateRef = useRef(null);

  useEffect(() => {
    sessionRatingRef.current = null; // Reset the session rating when the highlight date changes
  }, [highlightDate]);

  let sessionDate = highlightDate;
  const isFirstDate =
    parsedData?.length > 0 && sessionDate === parsedData[0]?.date;
  let isLastDate =
    parsedData?.length > 0 &&
    sessionDate === parsedData[parsedData.length - 1]?.date;

  // The Visualizer will normally set the highlight date prop based on chart mouseover.
  // The PR Analyzer defaults to no highlight date prop expecting to get the most recent session
  if (!sessionDate) {
    // Iterate backwards to find the most recent non-goal entry date
    for (let i = parsedData?.length - 1; i >= 0; i--) {
      if (!parsedData[i].isGoal) {
        sessionDate = parsedData[i].date;
        break; // Stop as soon as we find the most recent non-goal entry
      }
    }
    isLastDate = true;
  }

  const analyzedSessionLifts = useMemo(() => {
    if (!sessionDate || !parsedData) return null;

    return getAnalyzedSessionLifts(
      sessionDate,
      parsedData,
      topLiftsByTypeAndReps,
      topLiftsByTypeAndRepsLast12Months,
    );
  }, [
    sessionDate,
    parsedData,
    topLiftsByTypeAndReps,
    topLiftsByTypeAndRepsLast12Months,
  ]);

  // devLog(analyzedSessionLifts);

  if (analyzedSessionLifts && !sessionRatingRef.current && !isDemoMode) {
    const tupleCountForDate = parsedData?.filter(
      (e) => e.date === sessionDate && !e.isGoal,
    ).length ?? 0;

    const cache = sessionRatingCache;
    const stored = cache?.[sessionDate];
    if (stored?.tupleCount === tupleCountForDate) {
      sessionRatingRef.current = stored.rating;
    }

    if (!sessionRatingRef.current) {
      const strengthContext =
        hasBioData && standards && Object.keys(standards).length > 0
          ? {
              standards,
              e1rmFormula,
              sessionDate,
              age,
              bodyWeight,
              sex,
              isMetric,
            }
          : null;
      sessionRatingRef.current = getCreativeSessionRating(
        analyzedSessionLifts,
        strengthContext,
        lastUsedAdlibRef,
      );

      pendingCacheUpdateRef.current = {
        sessionDate,
        rating: sessionRatingRef.current,
        tupleCount: tupleCountForDate,
      };
      setPersistCacheTrigger((t) => t + 1);
    }
  }

  useEffect(() => {
    const pending = pendingCacheUpdateRef.current;
    if (!pending) return;
    pendingCacheUpdateRef.current = null;

    setSessionRatingCache((prev) => {
      const next = { ...(prev || {}) };
      next[pending.sessionDate] = {
        rating: pending.rating,
        tupleCount: pending.tupleCount,
      };
      const keys = Object.keys(next);
      if (keys.length > 200) {
        keys.sort();
        for (let i = 0; i < keys.length - 200; i++) {
          delete next[keys[i]];
        }
      }
      return next;
    });
  }, [persistCacheTrigger, setSessionRatingCache]);

  // Precompute per-lift tonnage stats for this session vs last year
  const perLiftTonnageStats = useMemo(() => {
    if (!analyzedSessionLifts || !sessionDate) return {};

    const lookup = sessionTonnageLookup;
    if (!lookup) return {};

    return Object.entries(analyzedSessionLifts).reduce(
      (acc, [liftType, lifts]) => {
        const currentLiftTonnage = lifts.reduce(
          (sum, lift) => sum + (lift.weight ?? 0) * (lift.reps ?? 0),
          0,
        );

        const firstLift = lifts?.[0];
        const unitTypeForLift = firstLift?.unitType ?? "lb";

        const { average: avgLiftTonnage, sessionCount } =
          getAverageLiftSessionTonnageFromPrecomputed(
            lookup.sessionTonnageByDateAndLift,
            lookup.allSessionDates,
            sessionDate,
            liftType,
            unitTypeForLift,
          );

        const pctDiff =
          avgLiftTonnage > 0
            ? ((currentLiftTonnage - avgLiftTonnage) / avgLiftTonnage) * 100
            : null;

        acc[liftType] = {
          currentLiftTonnage,
          avgLiftTonnage,
          sessionCount,
          pctDiff,
          unitType: unitTypeForLift,
        };

        return acc;
      },
      {},
    );
  }, [analyzedSessionLifts, sessionDate, sessionTonnageLookup]);

  const prevDate = () => {
    if (!parsedData || !sessionDate) return;

    // Find the index of the current session date
    const currentIndex = parsedData.findIndex(
      (entry) => entry.date === sessionDate,
    );

    // Iterate backward to find the previous unique date
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (parsedData[i].date !== sessionDate) {
        setHighlightDate(parsedData[i].date); // Update the highlight date
        break;
      }
    }
  };

  const nextDate = () => {
    if (!parsedData || !sessionDate) return;

    // Find the index of the current session date
    const currentIndex = parsedData.findIndex(
      (entry) => entry.date === sessionDate,
    );

    // Iterate forward to find the next unique date
    for (let i = currentIndex + 1; i < parsedData.length; i++) {
      if (parsedData[i].date !== sessionDate) {
        setHighlightDate(parsedData[i].date); // Update the highlight date
        break;
      }
    }
  };

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={1000}>
      <Card className="flex-1 overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <CardTitle className="flex flex-wrap items-center gap-2 text-xl font-bold tracking-tight">
                {authStatus === "unauthenticated" && (
                  <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">
                    Demo Mode
                  </span>
                )}
                {analyzedSessionLifts &&
                  getReadableDateString(sessionDate, true)}{" "}
                Session
                {isValidating && (
                  <LoaderCircle className="inline-flex h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </CardTitle>
              <CardDescription className="mt-1">
                {analyzedSessionLifts && !isDemoMode
                  ? sessionRatingRef.current
                  : "Session overview and analysis"}
              </CardDescription>
            </div>
            <div className="flex shrink-0 items-center gap-0.5 rounded-lg border bg-muted/30 p-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={prevDate}
                    disabled={isValidating || isFirstDate}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Previous session</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={nextDate}
                    disabled={isValidating || isLastDate}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Next session</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-0">
          {!analyzedSessionLifts && <Skeleton className="h-[50vh] rounded-lg" />}
          {analyzedSessionLifts &&
            (Object.keys(analyzedSessionLifts).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(analyzedSessionLifts).map(
                  ([liftType, workouts]) => (
                    <SessionExerciseBlock
                      key={liftType}
                      variant="full"
                      liftType={liftType}
                      workouts={workouts}
                      perLiftTonnageStats={perLiftTonnageStats}
                      authStatus={authStatus}
                      hasBioData={hasBioData}
                      standards={standards}
                      e1rmFormula={e1rmFormula}
                      sessionDate={sessionDate}
                      age={age}
                      bodyWeight={bodyWeight}
                      sex={sex}
                      isMetric={isMetric}
                    />
                  ),
                )}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                No workouts available for the most recent date.
              </p>
            ))}
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-4 pt-0">
          {analyzedSessionLifts && (
              <SessionTonnage
                analyzedSessionLifts={analyzedSessionLifts}
                sessionTonnageLookup={sessionTonnageLookup}
                sessionDate={sessionDate}
                isMetric={isMetric}
              />
          )}
        </CardFooter>
      </Card>
    </TooltipProvider>
  );
}

// --- Supporting components and functions ---

// Displays total session tonnage with a comparison bar vs. the rolling 12-month average.
function SessionTonnage({
  analyzedSessionLifts,
  sessionTonnageLookup,
  sessionDate,
  isMetric = false,
}) {
  const equivalentRef = useRef(null);

  if (!analyzedSessionLifts) return null;

  const flatLifts = Object.values(analyzedSessionLifts).flat();

  const tonnage = flatLifts.reduce(
    (acc, lift) => acc + (lift.weight ?? 0) * (lift.reps ?? 0),
    0,
  );

  const firstLift = flatLifts?.[0];
  const nativeUnitType = firstLift?.unitType ?? "lb";
  const displayUnit = isMetric ? "kg" : "lb";
  const tonnageDisplay = getDisplayWeight({ weight: tonnage, unitType: nativeUnitType }, isMetric).value;

  // Rolling 365-day session-level baseline (from precomputed lookup, in native unit)
  const { average: avgSessionTonnage, sessionCount: sessionCountLastYear } =
    sessionTonnageLookup
      ? getAverageSessionTonnageFromPrecomputed(
          sessionTonnageLookup.sessionTonnageByDate,
          sessionTonnageLookup.allSessionDates,
          sessionDate,
          nativeUnitType,
        )
      : { average: 0, sessionCount: 0 };

  const { low: rangeMin, high: rangeMax } = sessionTonnageLookup
    ? getSessionTonnagePercentileRangeFromPrecomputed(
        sessionTonnageLookup.sessionTonnageByDate,
        sessionTonnageLookup.allSessionDates,
        sessionDate,
        nativeUnitType,
      )
    : { low: 0, high: 0 };

  // Convert comparison values to display unit
  const avgSessionTonnageDisplay = avgSessionTonnage
    ? getDisplayWeight({ weight: avgSessionTonnage, unitType: nativeUnitType }, isMetric).value
    : 0;
  const rangeMinDisplay = rangeMin
    ? getDisplayWeight({ weight: rangeMin, unitType: nativeUnitType }, isMetric).value
    : 0;
  const rangeMaxDisplay = rangeMax
    ? getDisplayWeight({ weight: rangeMax, unitType: nativeUnitType }, isMetric).value
    : 0;

  const overallPctDiff =
    avgSessionTonnageDisplay > 0
      ? ((tonnageDisplay - avgSessionTonnageDisplay) / avgSessionTonnageDisplay) * 100
      : null;

  // real-world equivalents (per unit type)
  const equivalents = {
    kg: [
      { name: "blue whale", weight: 150000, emoji: "🐋" },
      { name: "elephant", weight: 6000, emoji: "🐘" },
      { name: "car", weight: 1500, emoji: "🚗" },
      { name: "cow", weight: 700, emoji: "🐄" },
      { name: "grand piano", weight: 300, emoji: "🎹" },
      { name: "vending machine", weight: 250, emoji: "🥤" },
      { name: "Eddie Hall", weight: 180, emoji: "🦍" },
      { name: "Labrador Retriever", weight: 30, emoji: "🐕" },
      { name: "rotisserie chicken", weight: 1.5, emoji: "🍗" },
    ],
    lb: [
      { name: "blue whale", weight: 330000, emoji: "🐋" },
      { name: "elephant", weight: 13200, emoji: "🐘" },
      { name: "car", weight: 3300, emoji: "🚗" },
      { name: "cow", weight: 1540, emoji: "🐄" },
      { name: "grand piano", weight: 660, emoji: "🎹" },
      { name: "vending machine", weight: 550, emoji: "🥤" },
      { name: "Eddie Hall", weight: 400, emoji: "🦍" },
      { name: "Labrador Retriever", weight: 66, emoji: "🐕" },
      { name: "rotisserie chicken", weight: 3.3, emoji: "🍗" },
    ],
  };

  const unitEquivalents = equivalents[displayUnit] ?? equivalents["lb"];
  const equivalentKey = `${sessionDate}-${displayUnit}`;

  if (!equivalentRef.current || equivalentRef.current.key !== equivalentKey) {
    // Filter to only equivalents that would give >= 0.1 when divided
    const validEquivalents = unitEquivalents.filter(
      (eq) => tonnageDisplay / eq.weight >= 0.1,
    );

    // If no valid equivalents (tonnage is very small), use the smallest one
    const candidates =
      validEquivalents.length > 0 ? validEquivalents : unitEquivalents;

    const randomIndex = Math.floor(Math.random() * candidates.length);
    const chosenEquivalent = candidates[randomIndex];
    const chosenCount = tonnageDisplay / chosenEquivalent.weight;

    equivalentRef.current = {
      key: equivalentKey,
      equivalent: chosenEquivalent,
      equivalentCount: chosenCount,
    };
  }

  const { equivalent, equivalentCount } = equivalentRef.current;

  // Format with commas; show one decimal place if < 100, no decimals if >= 100
  const countValue = parseFloat(equivalentCount);
  const formattedCount = countValue.toLocaleString("en-US", {
    minimumFractionDigits: countValue >= 100 ? 0 : 1,
    maximumFractionDigits: countValue >= 100 ? 0 : 1,
  });

  const hasRange = sessionCountLastYear > 1 && rangeMaxDisplay > 0;
  const scaleMax = hasRange
    ? Math.max(tonnageDisplay, rangeMaxDisplay) * 1.3 || 1
    : Math.max(tonnageDisplay * 1.3, 1);
  const currentPct = Math.min(100, (tonnageDisplay / scaleMax) * 100);
  const rawRangeWidth =
    hasRange && rangeMaxDisplay > 0 ? (rangeMaxDisplay - rangeMinDisplay) / scaleMax : 0;
  const rangeLeftPct = hasRange ? (rangeMinDisplay / scaleMax) * 100 : 0;
  const rangeWidthPct = hasRange
    ? (rawRangeWidth > 0 ? rawRangeWidth * 100 : 3)
    : 0;

  return (
    <div className="rounded-lg border bg-muted/30 px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-semibold text-foreground">
          Session Tonnage:
        </span>
        <span className="tabular-nums font-bold">
          {Math.round(tonnageDisplay).toLocaleString()}
          {displayUnit}
        </span>
        {hasRange && overallPctDiff !== null ? (
          <>
            <span className="text-muted-foreground">
              vs {Math.round(avgSessionTonnageDisplay).toLocaleString()}
              {displayUnit} avg over last 12 months
            </span>
            <Badge
              variant="outline"
              className={
                overallPctDiff > 0
                  ? "gap-0.5 border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "gap-0.5 border-red-500/60 bg-red-500/10 text-red-600 dark:text-red-400"
              }
            >
              {overallPctDiff > 0 ? (
                <>
                  <ArrowUpRight className="h-3 w-3" />
                  {Math.abs(overallPctDiff).toFixed(1)}%
                </>
              ) : (
                <>
                  <ArrowDownRight className="h-3 w-3" />
                  {Math.abs(overallPctDiff).toFixed(1)}%
                </>
              )}
            </Badge>
          </>
        ) : (
          <span className="text-lg text-foreground">
            — About {formattedCount} {equivalent.name}
            {parseFloat(equivalentCount) != 1 ? "s" : ""} lifted {equivalent.emoji}
          </span>
        )}
      </div>
      <div className="mt-3 space-y-1">
        <TonnageRangeSlider
          currentPct={currentPct}
          rangeLeftPct={rangeLeftPct}
          rangeWidthPct={rangeWidthPct}
          showRange={hasRange}
          rangeMin={rangeMinDisplay}
          rangeMax={rangeMaxDisplay}
          unitType={displayUnit}
        />
        {hasRange ? (
          <p className="text-lg text-foreground">
            About {formattedCount} {equivalent.name}
            {parseFloat(equivalentCount) != 1 ? "s" : ""} lifted {equivalent.emoji}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Not enough history yet to compare your session tonnage over the last
            year.
          </p>
        )}
      </div>
    </div>
  );
}

// Visual track bar showing today's tonnage as a solid bar against a dashed 25th–90th percentile band.
function TonnageRangeSlider({
  currentPct,
  rangeLeftPct,
  rangeWidthPct,
  showRange,
  rangeMin,
  rangeMax,
  unitType,
}) {
  const [isHovered, setIsHovered] = useState(false);
  const formatVal = (n) => Math.round(n).toLocaleString() + unitType;

  return (
    <div className="space-y-1">
      <div
        className="group relative h-6 w-full cursor-default"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Track background */}
        <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-muted" />
        {/* Dashed range (min–max over last 12 months) — taller band like Fitbit */}
        {showRange && (
          <div
            className="absolute inset-x-0 top-1/2 h-5 -translate-y-1/2"
          >
            <div
              className="absolute top-0 h-full rounded-md border-2 border-dashed border-muted-foreground/40 bg-muted-foreground/5"
              style={{
                left: `${rangeLeftPct}%`,
                width: `${rangeWidthPct}%`,
              }}
            />
          </div>
        )}
        {/* Solid bar (today's tonnage) */}
        <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-full">
          <div
            className="h-full rounded-full bg-violet-500 dark:bg-violet-600"
            style={{ width: `${currentPct}%` }}
          />
        </div>
        {/* Hover overlay: range numbers appear on hover */}
        {isHovered && showRange && (
          <div className="absolute inset-0 pointer-events-none animate-in fade-in duration-150">
            <span
              className="absolute top-1/2 whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium tabular-nums text-foreground bg-background/70 dark:bg-background/70"
              style={{
                left: `${rangeLeftPct + rangeWidthPct / 2}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              {formatVal(rangeMin)} – {formatVal(rangeMax)}
            </span>
          </div>
        )}
      </div>
      {showRange && (
        <p className="text-[10px] text-muted-foreground">
          Dashed range: typical session tonnage (25th–90th percentile, last 12 months)
        </p>
      )}
    </div>
  );
}

function pickWithoutRepeat(arr, lastUsedRef, key) {
  if (!arr?.length) return "";
  if (!lastUsedRef?.current) return arr[Math.floor(Math.random() * arr.length)];
  const last = lastUsedRef.current[key];
  let idx;
  if (arr.length === 1) idx = 0;
  else if (last !== undefined) {
    idx = Math.floor(Math.random() * (arr.length - 1));
    if (idx >= last) idx++;
  } else {
    idx = Math.floor(Math.random() * arr.length);
  }
  lastUsedRef.current = { ...lastUsedRef.current, [key]: idx };
  return arr[idx];
}

function getCreativeSessionRating(workouts, strengthContext, lastUsedAdlibRef) {
  if (!workouts) return "";

  let yearlyRank1 = false;
  let yearlyTop10 = false;
  let yearlyTop20 = false;
  let yearlyOther = false;
  let lifetimeRank1 = false;
  let lifetimeTop10 = false;
  let lifetimeTop20 = false;
  let lifetimeOther = false;

  Object.values(workouts).forEach((lifts) => {
    lifts.forEach((lift) => {
      const yr = lift.yearlyRanking;
      const lt = lift.lifetimeRanking;
      if (yr === 0) yearlyRank1 = true;
      else if (yr >= 1 && yr <= 9) yearlyTop10 = true;
      else if (yr >= 10 && yr <= 19) yearlyTop20 = true;
      else if (yr >= 20) yearlyOther = true;
      if (lt === 0) lifetimeRank1 = true;
      else if (lt >= 1 && lt <= 9) lifetimeTop10 = true;
      else if (lt >= 10 && lt <= 19) lifetimeTop20 = true;
      else if (lt >= 20) lifetimeOther = true;
    });
  });

  const totalSetCount = Object.values(workouts).reduce(
    (sum, lifts) => sum + lifts.length,
    0,
  );

  const r = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const p = (arr, key) =>
    pickWithoutRepeat(arr, lastUsedAdlibRef, key);

  // Strength level: best rating across session (when bio data available)
  let bestStrengthRating = null;
  if (strengthContext) {
    const tierOrder = [
      "Physically Active",
      "Beginner",
      "Intermediate",
      "Advanced",
      "Elite",
    ];
    for (const [liftType, lifts] of Object.entries(workouts)) {
      const standard =
        strengthContext.sessionDate &&
        strengthContext.age != null &&
        strengthContext.bodyWeight != null &&
        strengthContext.sex
          ? getStandardForLiftDate(
              strengthContext.age,
              strengthContext.sessionDate,
              strengthContext.bodyWeight,
              strengthContext.sex,
              liftType,
              strengthContext.isMetric ?? false,
            )
          : strengthContext.standards?.[liftType];
      if (!standard) continue;
      const result = getStrengthLevelForWorkouts(
        lifts,
        liftType,
        { [liftType]: standard },
        strengthContext.e1rmFormula || "Brzycki",
      );
      if (
        result?.rating &&
        tierOrder.indexOf(result.rating) >
          (bestStrengthRating ? tierOrder.indexOf(bestStrengthRating) : -1)
      ) {
        bestStrengthRating = result.rating;
      }
    }
  }
  const strength =
    bestStrengthRating && bestStrengthRating !== "Physically Active"
      ? {
          rating: bestStrengthRating,
          emoji: STRENGTH_LEVEL_EMOJI[bestStrengthRating] ?? "",
        }
      : null;

  const buildMsg = (msg) =>
    typeof msg === "function" ? msg(p, strength) : msg;

  // Low volume, no PRs
  if (
    !yearlyRank1 &&
    !yearlyTop10 &&
    !yearlyTop20 &&
    !yearlyOther &&
    !lifetimeRank1 &&
    !lifetimeTop10 &&
    !lifetimeTop20 &&
    !lifetimeOther &&
    totalSetCount <= 5
  ) {
    return buildMsg(r(lowVolumeMessages));
  }

  // No PRs at all
  if (
    !yearlyRank1 &&
    !yearlyTop10 &&
    !yearlyTop20 &&
    !yearlyOther &&
    !lifetimeRank1 &&
    !lifetimeTop10 &&
    !lifetimeTop20 &&
    !lifetimeOther
  ) {
    return buildMsg(r(mehEncouragements));
  }

  // Tier 1: Lifetime #1 – biggest celebration
  if (lifetimeRank1) return buildMsg(r(lifetimeRank1Messages));

  // Tier 2: Lifetime top 10
  if (lifetimeTop10) return buildMsg(r(lifetimeTop10Messages));

  // Tier 3: Lifetime top 20
  if (lifetimeTop20) return buildMsg(r(lifetimeTop20Messages));

  // Tier 4: Lifetime other (top 21+)
  if (lifetimeOther) return buildMsg(r(lifetimeOtherMessages));

  // Tier 5: Yearly #1 – celebrate well
  if (yearlyRank1) return buildMsg(r(yearlyRank1Messages));

  // Tier 6: Yearly top 10
  if (yearlyTop10) return buildMsg(r(yearlyTop10Messages));

  // Tier 7: Yearly top 20
  if (yearlyTop20) return buildMsg(r(yearlyTop20Messages));

  // Tier 8: Yearly other
  return buildMsg(r(yearlyOtherMessages));
}

const victoriousNouns = [
  "champion",
  "winner",
  "hero",
  "savage",
  "baddie",
  "top dog",
  "beast",
  "big kahuna",
  "boss",
  "legend",
];

const celebrationTreat = [
  "beers",
  "champagne",
  "grass-fed steak",
  "freshly brewed coffee",
  "whey protein",
  "milk by the gallon",
];

const lowVolumeMessages = [
  "Good start. More sets = more gains.",
  "Touching base. Now add volume.",
  (p) => `You showed up. Now become the ${p(victoriousNouns, "noun")}.`,
];

const mehEncouragements = [
  "You're beating everyone on the couch.",
  "Arnold nods approvingly.",
  "Protein time.",
  "Captain America underpants incoming.",
  "Not a marathon runner. ✓",
  "Next time.",
  "Another brick in the wall.",
  "Consistency beats perfection.",
  (p) => `No PRs today. Still counts, ${p(victoriousNouns, "noun")}.`,
];

const yearlyRank1Messages = [
  (p, s) =>
    s?.rating === "Elite"
      ? `${s.emoji} Elite lift of the year. What a ${p(victoriousNouns, "noun")}.`
      : s?.rating === "Advanced"
        ? `${s.emoji} Advanced territory. Lift of the year.`
        : `Lift of the year. What a ${p(victoriousNouns, "noun")}.`,
  "Yearly #1. Nice.",
  (p, s) =>
    s?.rating === "Elite"
      ? `Best lift of the year. Elite ${p(victoriousNouns, "noun")} energy.`
      : `Best lift of the year. ${p(victoriousNouns, "noun")} energy.`,
  (p, s) =>
    s?.rating === "Advanced"
      ? `${s.emoji} Advanced ${p(victoriousNouns, "noun")}. Top of the year.`
      : `Top of the year. You're the ${p(victoriousNouns, "noun")}.`,
];

const yearlyTop10Messages = [
  (p, s) =>
    s?.rating === "Elite"
      ? `${s.emoji} Elite strength. Yearly top 10.`
      : "Yearly top 10. Strong.",
  (p) => `Building that annual highlight reel, ${p(victoriousNouns, "noun")}.`,
  "Some of this year's best lifts.",
];

const yearlyTop20Messages = [
  "Yearly top 20. Solid progress.",
  "Moving up the yearly ranks.",
  (p, s) =>
    s?.rating === "Advanced"
      ? `${s.emoji} Advanced lifter. Annual PRs stacking up.`
      : "Annual PRs stacking up.",
];

const yearlyOtherMessages = [
  "Yearly PR. On the climb.",
  (p) => `Another notch, ${p(victoriousNouns, "noun")}.`,
  "Strong year. Strong session.",
];

const lifetimeRank1Messages = [
  (p, s) =>
    s?.rating === "Elite"
      ? `${s.emoji} Elite ${p(victoriousNouns, "noun")}. Lifetime PR. Legendary.`
      : s?.rating === "Advanced"
        ? `${s.emoji} Advanced legend. Lifetime PR.`
        : `Lifetime PR. Legendary ${p(victoriousNouns, "noun")}.`,
  (p, s) =>
    s?.rating === "Elite"
      ? `All-time best. Get this Elite ${p(victoriousNouns, "noun")} some ${p(celebrationTreat, "treat")}.`
      : `All-time best. Get this ${p(victoriousNouns, "noun")} some ${p(celebrationTreat, "treat")}.`,
  (p, s) =>
    s?.rating === "Elite"
      ? `${s.emoji} Lifetime #1. Elite ${p(victoriousNouns, "noun")} mode.`
      : `Lifetime #1. ${p(victoriousNouns, "noun")} mode.`,
  (p, s) =>
    s?.rating === "Advanced"
      ? `${s.emoji} Advanced ${p(victoriousNouns, "noun")}. New lifetime peak.`
      : `New lifetime peak. What a ${p(victoriousNouns, "noun")}.`,
];

const lifetimeTop10Messages = [
  (p, s) =>
    s?.rating === "Elite"
      ? `${s.emoji} Elite territory. Lifetime top 10.`
      : s?.rating === "Advanced"
        ? `${s.emoji} Advanced ${p(victoriousNouns, "noun")}. Lifetime top 10.`
        : `Lifetime top 10. ${p(victoriousNouns, "noun")} territory.`,
  (p, s) =>
    s?.rating === "Elite"
      ? `${s.emoji} Elite territory. All-time top 10.`
      : s?.rating === "Advanced"
        ? `${s.emoji} Advanced. All-time top 10.`
        : "All-time top 10. Strong.",
  (p, s) =>
    s?.rating === "Advanced"
      ? `Lifetime PR. Advanced ${p(victoriousNouns, "noun")} energy.`
      : `Lifetime PR. ${p(victoriousNouns, "noun")} energy.`,
];

const lifetimeTop20Messages = [
  (p, s) =>
    s?.rating === "Advanced"
      ? `${s.emoji} Advanced ${p(victoriousNouns, "noun")} climbing the ranks.`
      : `Lifetime top 20. This ${p(victoriousNouns, "noun")} is climbing.`,
  "All-time ranking improved.",
  "Moving up the lifetime list.",
];

const lifetimeOtherMessages = [
  (p, s) =>
    s?.rating === "Advanced"
      ? `${s.emoji} Advanced ${p(victoriousNouns, "noun")}. Building the legacy.`
      : `Lifetime PR. Building the ${p(victoriousNouns, "noun")} legacy.`,
  "All-time best list expanded.",
  "Lifetime PR. Solid.",
];
