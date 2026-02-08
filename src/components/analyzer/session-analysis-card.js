"use client";

import {
  useRef,
  useState,
  useEffect,
  useContext,
  useMemo,
  useDeferredValue,
} from "react";
import { useLocalStorage, useReadLocalStorage } from "usehooks-ts";
import Link from "next/link";
import { devLog } from "@/lib/processing-utils";
import { useSession } from "next-auth/react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import {
  useAthleteBioData,
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
} from "@/lib/processing-utils";
import { estimateE1RM } from "@/lib/estimate-e1rm";
import {
  LoaderCircle,
  ChevronLeft,
  ChevronRight,
  PlayCircle,
  StickyNote,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { LiftTypeIndicator } from "@/components/lift-type-indicator";

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
  const { age, bodyWeight, sex, standards, isMetric } = useAthleteBioData();
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

  const deferredHighlightDate = useDeferredValue(highlightDate);

  useEffect(() => {
    sessionRatingRef.current = null; // Reset the session rating when the highlight date changes
  }, [deferredHighlightDate]);

  let sessionDate = deferredHighlightDate;
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
    <TooltipProvider>
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
                    <ExerciseBlock
                      key={liftType}
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
              />
          )}
        </CardFooter>
      </Card>
    </TooltipProvider>
  );
}

// --- Supporting components and functions ---

function ExerciseBlock({
  liftType,
  workouts,
  perLiftTonnageStats,
  authStatus,
  hasBioData,
  standards,
  e1rmFormula,
  sessionDate,
  age,
  bodyWeight,
  sex,
  isMetric,
}) {
  const formula = e1rmFormula || "Brzycki";
  let bestE1rmIndex = 0;
  let bestE1rm = 0;
  const e1rms = workouts.map((w) =>
    estimateE1RM(w.reps ?? 0, w.weight ?? 0, formula),
  );
  workouts.forEach((w, i) => {
    const e1rm = e1rms[i];
    if (e1rm > bestE1rm) {
      bestE1rm = e1rm;
      bestE1rmIndex = i;
    }
  });

  const e1rmMin = Math.min(...e1rms);
  const e1rmMax = Math.max(...e1rms);
  const e1rmRange = e1rmMax - e1rmMin || 1;

  function getSizeForE1rm(e1rm) {
    const t = (e1rm - e1rmMin) / e1rmRange;
    if (t < 0.2) return { text: "text-xs", pad: "px-2 py-1.5" };
    if (t < 0.4) return { text: "text-sm", pad: "px-2.5 py-2" };
    if (t < 0.6) return { text: "text-base", pad: "px-3 py-2" };
    if (t < 0.8) return { text: "text-lg", pad: "px-3.5 py-2.5" };
    return { text: "text-xl", pad: "px-4 py-3" };
  }

  // Groups: consecutive sets with same reps×weight (e.g. 3x5 of 60kg)
  const groups = [];
  let currentGroup = [];
  let currentKey = null;
  workouts.forEach((w, i) => {
    const key = `${w.reps}×${w.weight}`;
    if (key !== currentKey) {
      if (currentGroup.length > 0) groups.push(currentGroup);
      currentGroup = [i];
      currentKey = key;
    } else {
      currentGroup.push(i);
    }
  });
  if (currentGroup.length > 0) groups.push(currentGroup);

  // Initially highlighted: PRs or highest e1rm set
  const initiallyHighlighted = new Set(
    workouts
      .map((w, i) => (w.lifetimeRanking !== -1 || i === bestE1rmIndex ? i : null))
      .filter((i) => i != null),
  );
  // Expand: if any set in a group is highlighted, highlight the whole group
  const highlightedIndices = new Set();
  groups.forEach((group) => {
    if (group.some((i) => initiallyHighlighted.has(i))) {
      group.forEach((i) => highlightedIndices.add(i));
    }
  });

  const highlightClass = "border-emerald-500/30 bg-emerald-500/5";

  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <div className="space-y-3">
        <LiftTypeIndicator liftType={liftType} className="text-lg" />
        <div className="flex flex-wrap gap-2">
          {workouts.map((workout, index) => {
            const isHighlighted = highlightedIndices.has(index);
            const size = getSizeForE1rm(e1rms[index]);
            const padClass = isHighlighted ? "px-3.5 py-2.5" : size.pad;
            return (
            <div
              key={index}
              className={`flex flex-col gap-1 rounded-lg border transition-colors ${padClass} ${
                isHighlighted ? highlightClass : "border-border/60 bg-muted/30"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`tabular-nums ${size.text} ${
                    isHighlighted ? "font-semibold" : ""
                  }`}
                >
                  {workout.reps}×{workout.weight}
                  {workout.unitType}
                </span>
                {workout.URL && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a
                        href={workout.URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded p-0.5 hover:bg-muted"
                      >
                        <PlayCircle
                          className={
                            isHighlighted
                              ? "h-4 w-4 text-muted-foreground"
                              : "h-3.5 w-3.5 text-muted-foreground"
                          }
                        />
                      </a>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        Click to open user video (
                        {workout.URL.length > 25
                          ? `${workout.URL.slice(0, 22)}…`
                          : workout.URL}
                        )
                      </p>
                    </TooltipContent>
                  </Tooltip>
                )}
                {workout.notes && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help text-muted-foreground">
                        <StickyNote
                          className={
                            isHighlighted ? "h-4 w-4" : "h-3.5 w-3.5"
                          }
                        />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        <span className="font-semibold">Note: </span>
                        {workout.notes}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              {(workout.lifetimeSignificanceAnnotation ||
                workout.yearlySignificanceAnnotation) && (
                <span
                  className={
                    isHighlighted
                      ? "text-sm text-muted-foreground"
                      : "text-xs text-muted-foreground"
                  }
                >
                  {workout.lifetimeSignificanceAnnotation}
                  {workout.lifetimeSignificanceAnnotation &&
                    workout.yearlySignificanceAnnotation &&
                    ", "}
                  {workout.yearlySignificanceAnnotation &&
                    `${workout.yearlySignificanceAnnotation} of the year`}
                </span>
              )}
            </div>
            );
          })}
        </div>
        {perLiftTonnageStats?.[liftType] && (
          <LiftTonnageRow
            liftType={liftType}
            stats={perLiftTonnageStats[liftType]}
          />
        )}
        {authStatus === "authenticated" &&
          hasBioData &&
          standards[liftType] && (
            <LiftStrengthLevel
              liftType={liftType}
              workouts={workouts}
              standards={standards}
              e1rmFormula={e1rmFormula}
              sessionDate={sessionDate}
              age={age}
              bodyWeight={bodyWeight}
              sex={sex}
              isMetric={isMetric}
            />
          )}
      </div>
    </div>
  );
}

function LiftTonnageRow({ liftType, stats }) {
  const {
    currentLiftTonnage,
    avgLiftTonnage,
    sessionCount,
    pctDiff,
    unitType,
  } = stats;

  if (
    !currentLiftTonnage ||
    !sessionCount ||
    sessionCount <= 1 ||
    pctDiff === null
  ) {
    return (
      <p className="text-xs text-muted-foreground">
        Not enough history yet to compare {liftType.toLowerCase()} tonnage over
        the last year.
      </p>
    );
  }

  const isUp = pctDiff > 0;

  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${isUp ? "text-sm" : "text-xs"}`}
    >
      <span className="text-muted-foreground">
        Tonnage: {Math.round(currentLiftTonnage).toLocaleString()}
        {unitType} vs {Math.round(avgLiftTonnage).toLocaleString()}
        {unitType} avg
      </span>
      <Badge
        variant="outline"
        className={
          isUp
            ? "gap-0.5 border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : "gap-0.5 border-red-500/60 bg-red-500/10 text-red-600 dark:text-red-400"
        }
      >
        {isUp ? (
          <>
            <ArrowUpRight className="h-4 w-4" />
            {Math.abs(pctDiff).toFixed(1)}%
          </>
        ) : (
          <>
            <ArrowDownRight className="h-3 w-3" />
            {Math.abs(pctDiff).toFixed(1)}%
          </>
        )}
      </Badge>
    </div>
  );
}

/**
 * Shows strength level for a single lift type based on the highest e1RM across
 * all sets in the session. Uses age at session date for accurate age-adjusted
 * rating when viewing historical sessions.
 */
function LiftStrengthLevel({
  liftType,
  workouts,
  standards,
  e1rmFormula,
  sessionDate,
  age,
  bodyWeight,
  sex,
  isMetric,
}) {
  const standard =
    sessionDate && age && bodyWeight != null && sex != null
      ? getStandardForLiftDate(
          age,
          sessionDate,
          bodyWeight,
          sex,
          liftType,
          isMetric ?? false,
        )
      : standards?.[liftType];
  const standardsForLift = standard ? { [liftType]: standard } : {};
  const result = getStrengthLevelForWorkouts(
    workouts,
    liftType,
    standardsForLift,
    e1rmFormula || "Brzycki",
  );
  if (!result) return null;

  const { rating, bestE1RM } = result;
  const eliteMax = standard?.elite ?? 0;
  const isBeyondElite = rating === "Elite" && bestE1RM > eliteMax;

  return (
    <Link
      href="/strength-level-calculator"
      className="inline-flex items-center gap-1.5 rounded-md py-1 text-base font-medium text-muted-foreground transition-colors hover:text-foreground hover:underline"
    >
      {liftType} strength level:{" "}
      {isBeyondElite ? (
        <span className="font-semibold text-foreground">
          {STRENGTH_LEVEL_EMOJI.Elite} Beyond Elite
        </span>
      ) : (
        <span className="font-semibold text-foreground">
          {STRENGTH_LEVEL_EMOJI[rating] ?? ""} {rating}
        </span>
      )}
    </Link>
  );
}

function SessionTonnage({
  analyzedSessionLifts,
  sessionTonnageLookup,
  sessionDate,
}) {
  const equivalentRef = useRef(null);

  if (!analyzedSessionLifts) return null;

  const flatLifts = Object.values(analyzedSessionLifts).flat();

  const tonnage = flatLifts.reduce(
    (acc, lift) => acc + (lift.weight ?? 0) * (lift.reps ?? 0),
    0,
  );

  const firstLift = flatLifts?.[0];
  const unitType = firstLift?.unitType ?? "lb"; // default to lb

  // Rolling 365-day session-level baseline (from precomputed lookup)
  const { average: avgSessionTonnage, sessionCount: sessionCountLastYear } =
    sessionTonnageLookup
      ? getAverageSessionTonnageFromPrecomputed(
          sessionTonnageLookup.sessionTonnageByDate,
          sessionTonnageLookup.allSessionDates,
          sessionDate,
          unitType,
        )
      : { average: 0, sessionCount: 0 };

  const { low: rangeMin, high: rangeMax } = sessionTonnageLookup
    ? getSessionTonnagePercentileRangeFromPrecomputed(
        sessionTonnageLookup.sessionTonnageByDate,
        sessionTonnageLookup.allSessionDates,
        sessionDate,
        unitType,
      )
    : { low: 0, high: 0 };

  const overallPctDiff =
    avgSessionTonnage > 0
      ? ((tonnage - avgSessionTonnage) / avgSessionTonnage) * 100
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

  const unitEquivalents = equivalents[unitType] ?? equivalents["lb"]; // defult to lb
  const equivalentKey = `${sessionDate}-${unitType}`;

  if (!equivalentRef.current || equivalentRef.current.key !== equivalentKey) {
    // Filter to only equivalents that would give >= 0.1 when divided
    const validEquivalents = unitEquivalents.filter(
      (eq) => tonnage / eq.weight >= 0.1,
    );

    // If no valid equivalents (tonnage is very small), use the smallest one
    const candidates =
      validEquivalents.length > 0 ? validEquivalents : unitEquivalents;

    const randomIndex = Math.floor(Math.random() * candidates.length);
    const chosenEquivalent = candidates[randomIndex];
    const chosenCount = tonnage / chosenEquivalent.weight;

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

  const hasRange = sessionCountLastYear > 1 && rangeMax > 0;
  const scaleMax = hasRange
    ? Math.max(tonnage, rangeMax) * 1.3 || 1
    : Math.max(tonnage * 1.3, 1);
  const currentPct = Math.min(100, (tonnage / scaleMax) * 100);
  const rawRangeWidth =
    hasRange && rangeMax > 0 ? (rangeMax - rangeMin) / scaleMax : 0;
  const rangeLeftPct = hasRange ? (rangeMin / scaleMax) * 100 : 0;
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
          {Math.round(tonnage).toLocaleString()}
          {unitType}
        </span>
        {hasRange && overallPctDiff !== null ? (
          <>
            <span className="text-muted-foreground">
              vs {Math.round(avgSessionTonnage).toLocaleString()}
              {unitType} avg over last 12 months
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
          rangeMin={rangeMin}
          rangeMax={rangeMax}
          unitType={unitType}
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
