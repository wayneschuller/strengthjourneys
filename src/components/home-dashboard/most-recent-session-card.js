
import { useState, useMemo } from "react";
import { useReadLocalStorage } from "usehooks-ts";
import Link from "next/link";
import { motion } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArrowUpRight, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useSession } from "next-auth/react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { useAthleteBio } from "@/hooks/use-athlete-biodata";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { differenceInDays } from "date-fns";
import {
  getReadableDateString,
  getAnalyzedSessionLifts,
  getSessionDatesContainingLiftType,
} from "@/lib/processing-utils";
import { SessionExerciseBlock } from "@/components/analyzer/session-exercise-block";
import { getLiftSvgPath } from "@/components/year-recap/lift-svg";

const RECENT_SESSIONS_COUNT = 3;

/**
 * Displays the most recent workout session or recent sessions for a specific lift type.
 * When used on a lift-specific page (e.g. /bench-press), shows the last 3 sessions for that lift.
 * When used on the home dashboard, shows the single most recent session across all lifts with
 * prev/next navigation to browse sessions.
 *
 * @param {Object} props
 * @param {string|null} [props.liftType=null] - When set (e.g. "Bench Press"), filters to show only
 *   that lift type. On lift pages this shows the last 3 sessions containing the lift; on home
 *   it shows the most recent session filtered to that lift.
 * @param {string|null} [props.highlightDate=null] - ISO date string (YYYY-MM-DD) for the session
 *   to display. When used with setHighlightDate, enables controlled mode for parent-driven
 *   session navigation (e.g. syncing with a chart hover).
 * @param {function(string)|null} [props.setHighlightDate] - Callback to update the displayed session
 *   date. When provided, the component runs in controlled mode. When omitted, uses internal state
 *   for prev/next navigation.
 * @param {boolean} [props.isProgressDone=true] - When false, renders a skeleton placeholder while
 *   the home dashboard row-count animation is still running.
 */
export function MostRecentSessionCard({
  liftType = null,
  highlightDate: highlightDateProp = null,
  setHighlightDate: setHighlightDateProp,
  isProgressDone = true,
}) {
  const { status: authStatus } = useSession();
  const [internalHighlightDate, setInternalHighlightDate] = useState(null);
  const [visibleCount, setVisibleCount] = useState(RECENT_SESSIONS_COUNT);

  const isControlled = setHighlightDateProp != null;
  const highlightDate = isControlled ? highlightDateProp : internalHighlightDate;
  const setHighlightDate = isControlled ? setHighlightDateProp : setInternalHighlightDate;

  const {
    parsedData,
    topLiftsByTypeAndReps,
    topLiftsByTypeAndRepsLast12Months,
  } = useUserLiftingData();
  const e1rmFormula =
    useReadLocalStorage(LOCAL_STORAGE_KEYS.FORMULA, {
      initializeWithValue: false,
    }) ?? "Brzycki";

  const { age, bodyWeight, sex, standards, isMetric } = useAthleteBio();
  const hasBioData =
    age && bodyWeight && standards && Object.keys(standards).length > 0;

  const { recentSessions, singleSession, isFirstDate, isLastDate, datesForNav } =
    useMemo(() => {
      if (!parsedData?.length)
        return {
          recentSessions: [],
          singleSession: null,
          isFirstDate: true,
          isLastDate: true,
          datesForNav: [],
        };

      let sessionDate = null;
      let datesForNav = [];

      if (liftType) {
        datesForNav = getSessionDatesContainingLiftType(parsedData, liftType);
        const recentDates = datesForNav.slice().reverse();
        const recentSessions = recentDates
          .map((date) => {
            const allAnalyzed = getAnalyzedSessionLifts(
              date,
              parsedData,
              topLiftsByTypeAndReps,
              topLiftsByTypeAndRepsLast12Months,
            );
            const analyzedSessionLifts = allAnalyzed[liftType]
              ? { [liftType]: allAnalyzed[liftType] }
              : {};
            return { sessionDate: date, analyzedSessionLifts };
          })
          .filter((s) => Object.keys(s.analyzedSessionLifts).length > 0);

        return {
          recentSessions,
          singleSession: null,
          isFirstDate: true,
          isLastDate: true,
          datesForNav,
        };
      }

      if (highlightDate) {
        sessionDate = highlightDate;
      } else {
        for (let i = parsedData.length - 1; i >= 0; i--) {
          if (!parsedData[i].isGoal) {
            sessionDate = parsedData[i].date;
            break;
          }
        }
      }

      const isFirstDate =
        parsedData?.length > 0 && sessionDate === parsedData[0]?.date;
      const isLastDate =
        parsedData?.length > 0 &&
        sessionDate === parsedData[parsedData.length - 1]?.date;

      if (!sessionDate)
        return {
          recentSessions: [],
          singleSession: null,
          isFirstDate: true,
          isLastDate: true,
          datesForNav: [],
        };

      const allAnalyzed = getAnalyzedSessionLifts(
        sessionDate,
        parsedData,
        topLiftsByTypeAndReps,
        topLiftsByTypeAndRepsLast12Months,
      );

      return {
        recentSessions: [],
        singleSession: { sessionDate, analyzedSessionLifts: allAnalyzed },
        isFirstDate,
        isLastDate,
        datesForNav,
      };
    }, [
      parsedData,
      topLiftsByTypeAndReps,
      topLiftsByTypeAndRepsLast12Months,
      highlightDate,
      liftType,
    ]);

  if (!isProgressDone) {
    return <MostRecentSessionCardSkeleton />;
  }

  const prevDate = () => {
    const sessionDate = singleSession?.sessionDate;
    if (!sessionDate) return;
    if (parsedData) {
      const currentIndex = parsedData.findIndex((entry) => entry.date === sessionDate);
      for (let i = currentIndex - 1; i >= 0; i--) {
        if (parsedData[i].date !== sessionDate) {
          setHighlightDate(parsedData[i].date);
          break;
        }
      }
    }
  };

  const nextDate = () => {
    const sessionDate = singleSession?.sessionDate;
    if (!sessionDate) return;
    if (parsedData) {
      const currentIndex = parsedData.findIndex((entry) => entry.date === sessionDate);
      for (let i = currentIndex + 1; i < parsedData.length; i++) {
        if (parsedData[i].date !== sessionDate) {
          setHighlightDate(parsedData[i].date);
          break;
        }
      }
    }
  };

  const showMultipleSessions = liftType && recentSessions.length > 0;

  if (showMultipleSessions) {
    const titlePrefix = `Recent ${liftType} sessions`;
    const svgPath = getLiftSvgPath(liftType);
    return (
      <TooltipProvider delayDuration={300} skipDelayDuration={1000}>
        <Card className="mt-4 rounded-xl border">
          <CardHeader className="pb-1.5">
            <div className="flex items-start justify-between gap-4">
              <CardTitle className="text-lg">
                {authStatus !== "authenticated" && (
                  <span className="mr-2 font-bold">Demo Mode:</span>
                )}
                {titlePrefix}
              </CardTitle>
              <Link
                href="/analyzer"
                className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                View full analysis
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
              {svgPath && (
                <div className="flex shrink-0 items-center justify-center sm:w-14 md:w-16">
                  <img
                    src={svgPath}
                    alt={`${liftType} diagram`}
                    className="h-12 w-12 object-contain sm:h-14 sm:w-14 md:h-16 md:w-16"
                  />
                </div>
              )}
              <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                {recentSessions.slice(0, visibleCount).map(({ sessionDate, analyzedSessionLifts }, sessionIndex) => {
                  const liftEntries = Object.entries(analyzedSessionLifts);
                  if (liftEntries.length === 0) return null;
                  return (
                    <motion.div
                      key={sessionDate}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: sessionIndex * 0.04, duration: 0.2 }}
                      className="rounded-lg"
                    >
                      {liftEntries.map(([lt, workouts]) => (
                        <SessionExerciseBlock
                          key={lt}
                          variant="compact"
                          liftType={lt}
                          workouts={workouts}
                          e1rmFormula={e1rmFormula}
                          hideSvg
                          authStatus={authStatus}
                          hasBioData={hasBioData}
                          standards={standards}
                          sessionDate={sessionDate}
                          age={age}
                          bodyWeight={bodyWeight}
                          sex={sex}
                          isMetric={isMetric}
                          label={getReadableDateString(sessionDate, true)}
                        />
                      ))}
                    </motion.div>
                  );
                })}
                {visibleCount < recentSessions.length && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1 self-start text-muted-foreground"
                    onClick={() => setVisibleCount((c) => c + 1)}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Show one more session
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </TooltipProvider>
    );
  }

  const sessionDate = singleSession?.sessionDate;
  const analyzedSessionLifts = singleSession?.analyzedSessionLifts;
  const isWithinLastMonth =
    sessionDate &&
    differenceInDays(new Date(), new Date(sessionDate + "T00:00:00")) <= 30;
  const titlePrefix =
    sessionDate
      ? isLastDate
        ? "Most recent session"
        : isWithinLastMonth
          ? "Recent session"
          : "Session"
      : "Most recent session";

  if (!sessionDate || !analyzedSessionLifts) {
    return (
      <Card className="mt-4 rounded-xl border">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">
            {authStatus !== "authenticated" && (
              <span className="mr-2 font-bold">Demo Mode:</span>
            )}
            {titlePrefix}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
            {liftType
              ? `No ${liftType} sessions logged yet.`
              : "No sessions logged yet."}
          </p>
        </CardContent>
      </Card>
    );
  }

  const liftEntries = Object.entries(analyzedSessionLifts);
  if (liftEntries.length === 0) {
    return (
      <Card className="mt-4 rounded-xl border">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">
            {authStatus !== "authenticated" && (
              <span className="mr-2 font-bold">Demo Mode:</span>
            )}
            {titlePrefix}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
            {liftType
              ? `No ${liftType} workouts for the most recent date.`
              : "No workouts available for the most recent date."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={1000}>
      <Card className="mt-4 rounded-xl border">
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
            <div className="min-w-0 flex-1">
              <CardTitle className="flex flex-wrap items-center gap-2 text-lg leading-tight">
                {authStatus !== "authenticated" && (
                  <span className="mr-2 font-bold">Demo Mode:</span>
                )}
                {titlePrefix} — {getReadableDateString(sessionDate, true)}
              </CardTitle>
            </div>
            <div className="flex shrink-0 items-center gap-2 md:gap-6">
              <div className="flex items-center gap-0.5 md:gap-3 rounded-lg border bg-muted/30 p-0.5 md:px-1.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={prevDate}
                      disabled={isFirstDate}
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
                      disabled={isLastDate}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Next session</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Link
                href="/analyzer"
                className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                View full analysis
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 xl:flex-row xl:flex-wrap xl:items-stretch">
            {liftEntries.map(([lt, workouts], index) => (
              <motion.div
                key={lt}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.06, duration: 0.25 }}
                className="w-full min-w-0 xl:min-w-[200px]"
                style={{ flex: `${Math.max(1, Math.ceil(workouts.length / 3))} 1 200px` }}
              >
                <SessionExerciseBlock
                  variant="compact"
                  liftType={lt}
                  workouts={workouts}
                  e1rmFormula={e1rmFormula}
                  authStatus={authStatus}
                  hasBioData={hasBioData}
                  standards={standards}
                  sessionDate={sessionDate}
                  age={age}
                  bodyWeight={bodyWeight}
                  sex={sex}
                  isMetric={isMetric}
                />
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

// Skeleton placeholder shown while MostRecentSessionCard waits for data to be ready.
function MostRecentSessionCardSkeleton() {
  return (
    <Card className="mt-4 rounded-xl border">
      <CardHeader className="px-4 py-2 pb-1.5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <Skeleton className="h-5 w-40" />
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pt-1 pb-3">
        <div className="flex flex-col gap-2 xl:flex-row xl:flex-wrap xl:items-stretch">
          <div className="min-w-[160px] flex-1 rounded-lg border bg-muted/30 px-3 py-2">
            <Skeleton className="mb-2 h-4 w-32" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
