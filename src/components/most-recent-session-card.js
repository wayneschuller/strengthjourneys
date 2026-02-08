"use client";

import { useState, useMemo } from "react";
import { useReadLocalStorage } from "usehooks-ts";
import Link from "next/link";
import { motion } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useUserLiftingData } from "@/hooks/use-userlift-data";
import { LOCAL_STORAGE_KEYS } from "@/lib/localStorage-keys";
import { differenceInDays } from "date-fns";
import {
  getReadableDateString,
  getAnalyzedSessionLifts,
  getSessionDatesContainingLiftType,
} from "@/lib/processing-utils";
import { SessionExerciseBlock } from "@/components/analyzer/session-exercise-block";

export function MostRecentSessionCard({
  liftType = null,
  highlightDate: highlightDateProp = null,
  setHighlightDate: setHighlightDateProp,
}) {
  const [internalHighlightDate, setInternalHighlightDate] = useState(null);

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

  const { sessionDate, analyzedSessionLifts, isFirstDate, isLastDate, datesForNav } =
    useMemo(() => {
      if (!parsedData?.length)
        return {
          sessionDate: null,
          analyzedSessionLifts: null,
          isFirstDate: true,
          isLastDate: true,
          datesForNav: [],
        };

      let sessionDate = null;
      let datesForNav = [];

      if (liftType) {
        datesForNav = getSessionDatesContainingLiftType(parsedData, liftType);
        if (highlightDate && datesForNav.includes(highlightDate)) {
          sessionDate = highlightDate;
        } else {
          sessionDate = datesForNav[datesForNav.length - 1] ?? null;
        }
      } else if (highlightDate) {
        sessionDate = highlightDate;
      } else {
        for (let i = parsedData.length - 1; i >= 0; i--) {
          if (!parsedData[i].isGoal) {
            sessionDate = parsedData[i].date;
            break;
          }
        }
      }

      const isFirstDate = liftType
        ? datesForNav.length > 0 && sessionDate === datesForNav[0]
        : parsedData?.length > 0 && sessionDate === parsedData[0]?.date;
      const isLastDate = liftType
        ? datesForNav.length > 0 && sessionDate === datesForNav[datesForNav.length - 1]
        : parsedData?.length > 0 &&
          sessionDate === parsedData[parsedData.length - 1]?.date;

      if (!sessionDate)
        return {
          sessionDate: null,
          analyzedSessionLifts: null,
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

      const analyzedSessionLifts = liftType
        ? allAnalyzed[liftType]
          ? { [liftType]: allAnalyzed[liftType] }
          : {}
        : allAnalyzed;

      return { sessionDate, analyzedSessionLifts, isFirstDate, isLastDate, datesForNav };
    }, [
      parsedData,
      topLiftsByTypeAndReps,
      topLiftsByTypeAndRepsLast12Months,
      highlightDate,
      liftType,
    ]);

  const prevDate = () => {
    if (!sessionDate) return;
    if (liftType && datesForNav.length > 0) {
      const idx = datesForNav.indexOf(sessionDate);
      if (idx > 0) setHighlightDate(datesForNav[idx - 1]);
    } else if (parsedData) {
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
    if (!sessionDate) return;
    if (liftType && datesForNav.length > 0) {
      const idx = datesForNav.indexOf(sessionDate);
      if (idx >= 0 && idx < datesForNav.length - 1)
        setHighlightDate(datesForNav[idx + 1]);
    } else if (parsedData) {
      const currentIndex = parsedData.findIndex((entry) => entry.date === sessionDate);
      for (let i = currentIndex + 1; i < parsedData.length; i++) {
        if (parsedData[i].date !== sessionDate) {
          setHighlightDate(parsedData[i].date);
          break;
        }
      }
    }
  };

  const isWithinLastMonth =
    sessionDate &&
    differenceInDays(new Date(), new Date(sessionDate + "T00:00:00")) <= 30;
  const titlePrefix =
    liftType
      ? isLastDate
        ? `Most recent ${liftType} session`
        : isWithinLastMonth
          ? `Recent ${liftType} session`
          : `${liftType} session`
      : "Most recent session";

  if (!sessionDate || !analyzedSessionLifts) {
    return (
      <Card className="mt-4 rounded-xl border">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{titlePrefix}</CardTitle>
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
          <CardTitle className="text-lg">{titlePrefix}</CardTitle>
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
    <TooltipProvider>
      <Card className="mt-4 rounded-xl border">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                {titlePrefix} — {getReadableDateString(sessionDate, true)}
              </CardTitle>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="flex items-center gap-0.5 rounded-lg border bg-muted/30 p-0.5">
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
                    <p>{liftType ? `Previous ${liftType} session` : "Previous session"}</p>
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
                    <p>{liftType ? `Next ${liftType} session` : "Next session"}</p>
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
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-stretch">
          {liftEntries.map(([liftType, workouts], index) => (
            <motion.div
              key={liftType}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.06, duration: 0.25 }}
              className="min-w-[160px] flex-1"
            >
              <SessionExerciseBlock
                variant="compact"
                liftType={liftType}
                workouts={workouts}
                e1rmFormula={e1rmFormula}
              />
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
    </TooltipProvider>
  );
}
