
import {
  useRef,
  useState,
  useEffect,
  useContext,
  useMemo,
} from "react";
import Link from "next/link";
import { format } from "date-fns";
import { useLocalStorage, useReadLocalStorage } from "usehooks-ts";
import { useSession } from "next-auth/react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import {
  useAthleteBio,
  getStrengthLevelForWorkouts,
  getStandardForLiftDate,
  STRENGTH_LEVEL_EMOJI,
} from "@/hooks/use-athlete-biodata";
import {
  LOCAL_STORAGE_KEYS,
  getSheetScopedStorageKey,
} from "@/lib/localStorage-keys";
import { GOOGLE_SHEETS_ICON_URL } from "@/lib/google-sheets-icon";
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
  getAverageLiftSessionTonnageFromPrecomputed,
} from "@/lib/processing-utils";
import { LoaderCircle, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { SessionExerciseBlock } from "@/components/analyzer/session-exercise-block";
import { DemoModeBadge } from "@/components/demo-mode-badge";

// "The Latest Session" when on the most recent date.
// "The Feb 6 Session" for an earlier date in the current year.
// "Feb 6, 2024 Session" (no "The") for a date in a previous year.
function getSessionCardTitle(sessionDate, isLastDate) {
  if (isLastDate || !sessionDate) return "The Latest Session";
  const sessionYear = parseInt(sessionDate.substring(0, 4), 10);
  const currentYear = new Date().getFullYear();
  const d = new Date(sessionDate + "T00:00:00");
  if (sessionYear === currentYear) return `The ${format(d, "MMM d")} Session`;
  return `${format(d, "MMM d, yyyy")} Session`;
}

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
export function TheLatestSessionCard({
  highlightDate = null,
  setHighlightDate,
  dashboardStage = "established",
  dataMaturityStage = "mature",
  sessionCount = 0,
}) {
  const {
    isDemoMode,
    parsedData,
    topLiftsByTypeAndReps,
    topLiftsByTypeAndRepsLast12Months,
    sessionTonnageLookup,
    sheetInfo,
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
  // Session ratings are cached by date, so they must also be scoped to the
  // linked sheet. Different sheets can share the same dates, and a global cache
  // would let one dataset's adlibs bleed into another.
  const [sessionRatingCache, setSessionRatingCache] = useLocalStorage(
    getSheetScopedStorageKey(
      LOCAL_STORAGE_KEYS.SESSION_RATING_CACHE,
      sheetInfo?.ssid,
    ),
    {},
    { initializeWithValue: false },
  );
  const [persistCacheTrigger, setPersistCacheTrigger] = useState(0);
  const pendingCacheUpdateRef = useRef(null);
  const hasLoggedSessions = useMemo(
    () => Array.isArray(parsedData) && parsedData.some((entry) => !entry?.isGoal),
    [parsedData],
  );
  const isStarterSampleStage = dashboardStage === "starter_sample";
  const isFirstRealWeekStage = dashboardStage === "first_real_week";
  const showPerLiftTonnage = dashboardStage === "established";

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

  const perLiftTonnageStats = useMemo(() => {
    if (!analyzedSessionLifts || !sessionDate || !sessionTonnageLookup) return null;

    return Object.fromEntries(
      Object.entries(analyzedSessionLifts).map(([liftType, workouts]) => {
        const nativeUnitType = workouts?.[0]?.unitType ?? "lb";
        const currentLiftTonnage =
          sessionTonnageLookup.sessionTonnageByDateAndLift?.[sessionDate]?.[
            liftType
          ]?.[nativeUnitType] ??
          workouts.reduce(
            (sum, workout) => sum + (workout.weight ?? 0) * (workout.reps ?? 0),
            0,
          );
        const { average: avgLiftTonnage, sessionCount } =
          getAverageLiftSessionTonnageFromPrecomputed(
            sessionTonnageLookup.sessionTonnageByDateAndLift,
            sessionTonnageLookup.allSessionDates,
            sessionDate,
            liftType,
            nativeUnitType,
          );

        return [
          liftType,
          {
            currentLiftTonnage,
            avgLiftTonnage,
            sessionCount,
            pctDiff:
              avgLiftTonnage > 0
                ? ((currentLiftTonnage - avgLiftTonnage) / avgLiftTonnage) * 100
                : null,
            unitType: nativeUnitType,
          },
        ];
      }),
    );
  }, [analyzedSessionLifts, sessionDate, sessionTonnageLookup]);

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
      <Card className="flex h-full flex-col overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <CardTitle className="flex flex-wrap items-center gap-2">
                {isDemoMode && (
                  <DemoModeBadge size="sm" />
                )}
                {getSessionCardTitle(sessionDate, isLastDate)}
                {isValidating && (
                  <LoaderCircle className="inline-flex h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </CardTitle>
              <CardDescription className="mt-1">
                {!hasLoggedSessions &&
                  (dataMaturityStage === "no_sessions"
                    ? "Your first session will appear here as soon as you log a set."
                    : "This card will populate automatically as your sessions roll in.")}
                {hasLoggedSessions &&
                  analyzedSessionLifts &&
                  isStarterSampleStage &&
                  "Starter sample data. Open your sheet and replace this row with your real training."}
                {hasLoggedSessions &&
                  analyzedSessionLifts &&
                  !isStarterSampleStage &&
                  isLastDate &&
                  getReadableDateString(sessionDate, true)}
                {hasLoggedSessions &&
                analyzedSessionLifts &&
                !isDemoMode &&
                !isStarterSampleStage &&
                sessionRatingRef.current
                  ? `${isLastDate ? " · " : ""}${sessionRatingRef.current}`
                  : ""}
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
                    disabled={isValidating || isFirstDate || !hasLoggedSessions}
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
                    disabled={isValidating || isLastDate || !hasLoggedSessions}
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
        <CardContent className="flex-1 space-y-6 pt-0">
          {!hasLoggedSessions && (
            <p className="rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
              Start simple: add one training session in your sheet with Date, Lift Type, Reps, and Weight.
            </p>
          )}
          {hasLoggedSessions && !analyzedSessionLifts && (
            <Skeleton className="h-[50vh] rounded-lg" />
          )}
          {analyzedSessionLifts &&
            (Object.keys(analyzedSessionLifts).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(analyzedSessionLifts).map(
                  ([liftType, workouts]) => (
                    <SessionExerciseBlock
                      key={liftType}
                      variant="compact"
                      liftType={liftType}
                      workouts={workouts}
                      perLiftTonnageStats={perLiftTonnageStats}
                      showPerLiftTonnage={showPerLiftTonnage}
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
                {isStarterSampleStage && sheetInfo?.url && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                    <div className="flex flex-col gap-4">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">
                          This session is starter sample data
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Open your Google Sheet, replace this row with your own
                          first workout, and add future sessions as new rows.
                          The dashboard will refresh from there.
                        </p>
                      </div>
                      <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                        <p className="rounded-md border bg-background/80 px-3 py-2">
                          1. Open the sheet
                        </p>
                        <p className="rounded-md border bg-background/80 px-3 py-2">
                          2. Edit the sample row
                        </p>
                        <p className="rounded-md border bg-background/80 px-3 py-2">
                          3. Add new sessions as you train
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-muted-foreground">
                          Tip: keep your latest session near the top so the log stays easy to update.
                        </p>
                        <Button asChild className="shrink-0">
                          <a
                            href={sheetInfo.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <img
                              src={GOOGLE_SHEETS_ICON_URL}
                              alt=""
                              className="h-4 w-4 shrink-0"
                              aria-hidden
                            />
                            Open Google Sheet
                          </a>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                No workouts available for the most recent date.
              </p>
            ))}
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-4 pt-0">
          {authStatus === "authenticated" && hasLoggedSessions && sessionDate && (
            <Button asChild variant="outline" className="gap-2">
              <Link href={`/log?date=${sessionDate}`}>
                <Pencil className="h-4 w-4" />
                Edit session
              </Link>
            </Button>
          )}
        </CardFooter>
      </Card>
    </TooltipProvider>
  );
}

// --- Supporting components and functions ---

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
