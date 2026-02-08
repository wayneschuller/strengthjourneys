"use client";

import Link from "next/link";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { estimateE1RM } from "@/lib/estimate-e1rm";
import { PlayCircle, StickyNote, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { LiftTypeIndicator, bigFourURLs } from "@/components/lift-type-indicator";
import { getLiftSvgPath } from "@/components/year-recap/lift-svg";
import {
  getStrengthLevelForWorkouts,
  getStandardForLiftDate,
  STRENGTH_LEVEL_EMOJI,
} from "@/hooks/use-athlete-biodata";

export function SessionExerciseBlock({
  variant = "full",
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
  let bestE1rm = 0;
  const e1rms = workouts.map((w) =>
    estimateE1RM(w.reps ?? 0, w.weight ?? 0, formula),
  );
  workouts.forEach((w, i) => {
    const e1rm = e1rms[i];
    if (e1rm > bestE1rm) bestE1rm = e1rm;
  });
  // All indices with equal best e1rm (e.g. 3x5 top sets) get highlighted
  const bestE1rmIndices = new Set(
    workouts
      .map((w, i) => (e1rms[i] >= bestE1rm - 1e-6 ? i : null))
      .filter((i) => i != null),
  );

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

  // Initially highlighted: PRs or all sets with best e1rm (full variant only)
  const initiallyHighlighted = new Set(
    workouts
      .map((w, i) =>
        w.lifetimeRanking !== -1 || bestE1rmIndices.has(i) ? i : null,
      )
      .filter((i) => i != null),
  );
  const highlightedIndices = new Set();
  groups.forEach((group) => {
    if (group.some((i) => initiallyHighlighted.has(i))) {
      group.forEach((i) => highlightedIndices.add(i));
    }
  });

  const highlightClass = "border-emerald-500/30 bg-emerald-500/5";
  const isCompact = variant === "compact";

  // Compact: big four uses SVG; full always uses LiftTypeIndicator
  const svgPath = isCompact ? getLiftSvgPath(liftType) : null;

  const pills = (
    <div className={isCompact ? "ml-4 flex min-w-0 flex-1 flex-wrap content-center gap-2" : "flex flex-wrap gap-2"}>
      {workouts.map((workout, index) => {
        const isTopSet = bestE1rmIndices.has(index);
        const isHighlighted = !isCompact ? highlightedIndices.has(index) : isTopSet;
        const size = isCompact ? { text: "text-sm", pad: "px-2.5 py-2" } : getSizeForE1rm(e1rms[index]);
        const padClass = isHighlighted && !isCompact ? "px-3.5 py-2.5" : size.pad;
        const textClass = isCompact && isTopSet
          ? "font-semibold text-emerald-600 dark:text-emerald-400"
          : isHighlighted && !isCompact
            ? "font-semibold"
            : "";

        return (
          <div
            key={index}
            className={`flex flex-col gap-1 rounded-lg border transition-colors ${padClass} ${
              isHighlighted ? highlightClass : "border-border/60 bg-muted/30"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`tabular-nums ${size.text} ${textClass}`}>
                {workout.reps}×{workout.weight}
                {workout.unitType}
              </span>
              {!isCompact && workout.URL && (
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
              {!isCompact && workout.notes && (
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
            {!isCompact &&
              (workout.lifetimeSignificanceAnnotation ||
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
  );

  if (isCompact) {
    const liftTypeArea = svgPath ? (
      <div className="flex h-full min-h-16 shrink-0 items-center">
        <img
          src={svgPath}
          alt={`${liftType} diagram`}
          className="h-full w-auto max-h-24 object-contain"
        />
      </div>
    ) : (
      <LiftTypeIndicator liftType={liftType} className="text-base" />
    );

    return (
      <div className="flex h-full min-h-0 flex-row rounded-xl border bg-muted/20 p-4">
        {svgPath && bigFourURLs[liftType] ? (
          <Link href={bigFourURLs[liftType]} className="flex shrink-0 transition-opacity hover:opacity-80">
            {liftTypeArea}
          </Link>
        ) : (
          liftTypeArea
        )}
        {pills}
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <div className="space-y-3">
        <LiftTypeIndicator liftType={liftType} className="text-lg" />
        {pills}
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
