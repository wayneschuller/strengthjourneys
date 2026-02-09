"use client";

import Link from "next/link";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { estimateE1RM } from "@/lib/estimate-e1rm";
import {
  PlayCircle,
  StickyNote,
  ArrowUpRight,
  ArrowDownRight,
  Trophy,
  Medal,
} from "lucide-react";
import { LiftTypeIndicator, bigFourURLs } from "@/components/lift-type-indicator";
import { getLiftSvgPath } from "@/components/year-recap/lift-svg";
import {
  getStrengthLevelForWorkouts,
  getStandardForLiftDate,
  STRENGTH_LEVEL_EMOJI,
} from "@/hooks/use-athlete-biodata";

/**
 * Renders a block of workout sets for a single lift type. Shows reps×weight pills with
 * PR indicators (lifetime/yearly), notes, and video links. In "full" variant also shows
 * tonnage comparison and strength level when bio data is available.
 *
 * @param {Object} props
 * @param {"full"|"compact"} [props.variant="full"] - Display mode. "full" shows full layout with
 *   tonnage and strength level; "compact" shows a condensed row of pills, used in MostRecentSessionCard.
 * @param {string} props.liftType - Display name of the lift (e.g. "Bench Press").
 * @param {Array<{reps: number, weight: number, unitType?: string, lifetimeRanking?: number, yearlyRanking?: number, notes?: string, URL?: string, lifetimeSignificanceAnnotation?: string, yearlySignificanceAnnotation?: string}>} props.workouts - Array of set objects.
 * @param {Object} [props.perLiftTonnageStats] - Map of liftType -> {currentLiftTonnage, avgLiftTonnage, sessionCount, pctDiff, unitType}. Used in full variant for tonnage comparison.
 * @param {string} [props.authStatus] - Session auth status; strength level shown only when "authenticated".
 * @param {boolean} [props.hasBioData] - Whether athlete bio (age, bodyweight, sex) is available for strength standards.
 * @param {Object} [props.standards] - Map of liftType -> strength standard objects for age/bodyweight adjustment.
 * @param {string} [props.e1rmFormula="Brzycki"] - E1RM formula for estimates (Brzycki, Epley, etc.).
 * @param {string} [props.sessionDate] - Session date (YYYY-MM-DD) for age-at-time-of-lift in strength standards.
 * @param {number} [props.age] - Athlete age for strength standards.
 * @param {number} [props.bodyWeight] - Athlete bodyweight for strength standards.
 * @param {string} [props.sex] - Athlete sex for strength standards.
 * @param {boolean} [props.isMetric] - Whether to use kg for strength standards.
 * @param {boolean} [props.hideSvg=false] - When true, hides the lift type SVG/diagram in compact variant.
 * @param {string} [props.label] - Optional label (e.g. date string) shown before the pills.
 */
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
  hideSvg = false,
  label,
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
  const svgPath = isCompact && !hideSvg ? getLiftSvgPath(liftType) : null;

  const pills = (
    <div className={isCompact ? "flex min-w-0 flex-1 flex-wrap content-center items-center gap-2" : "flex flex-wrap gap-2"}>
      {label && (
        <span className="shrink-0 text-sm font-medium text-muted-foreground">{label}</span>
      )}
      {workouts.map((workout, index) => {
        const isHighlighted = highlightedIndices.has(index);
        const size = isCompact ? { text: "text-sm", pad: "px-2.5 py-2" } : getSizeForE1rm(e1rms[index]);
        const padClass = isHighlighted && !isCompact ? "px-3.5 py-2.5" : size.pad;
        const textClass = isCompact && isHighlighted
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
              <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
                {workout.lifetimeRanking !== -1 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className="text-amber-600 transition-transform hover:scale-110 hover:text-amber-500 dark:text-amber-500 dark:hover:text-amber-400"
                        aria-label="Lifetime PR"
                      >
                        <Trophy
                          className={
                            isCompact
                              ? "h-4 w-4 sm:h-3 sm:w-3"
                              : isHighlighted
                                ? "h-4 w-4 sm:h-4 sm:w-4"
                                : "h-4 w-4 sm:h-3.5 sm:w-3.5"
                          }
                        />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        Lifetime PR
                        {workout.lifetimeSignificanceAnnotation
                          ? `: ${workout.lifetimeSignificanceAnnotation}`
                          : ""}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                )}
                {workout.yearlyRanking != null &&
                  workout.yearlyRanking !== -1 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className="text-blue-600 transition-transform hover:scale-110 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                          aria-label="12-month PR"
                        >
                          <Medal
                            className={
                              isCompact
                                ? "h-4 w-4 sm:h-3 sm:w-3"
                                : isHighlighted
                                  ? "h-4 w-4 sm:h-4 sm:w-4"
                                  : "h-4 w-4 sm:h-3.5 sm:w-3.5"
                            }
                          />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          12-month PR
                          {workout.yearlySignificanceAnnotation
                            ? `: ${workout.yearlySignificanceAnnotation} of the year`
                            : ""}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                {workout.notes && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className="text-muted-foreground transition-transform hover:scale-110 hover:text-foreground"
                        aria-label="Note"
                      >
                        <StickyNote
                          className={
                            isCompact
                              ? "h-4 w-4 sm:h-3 sm:w-3"
                              : isHighlighted
                                ? "h-4 w-4 sm:h-4 sm:w-4"
                                : "h-4 w-4 sm:h-3.5 sm:w-3.5"
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
                {workout.URL && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a
                        href={workout.URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex rounded p-0.5 text-muted-foreground transition-transform hover:scale-110 hover:bg-muted hover:text-foreground"
                        aria-label="Video"
                      >
                        <PlayCircle
                          className={
                            isCompact
                              ? "h-4 w-4 sm:h-3 sm:w-3"
                              : isHighlighted
                                ? "h-4 w-4 sm:h-4 sm:w-4"
                                : "h-4 w-4 sm:h-3.5 sm:w-3.5"
                          }
                        />
                      </a>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        Click to open video
                        {workout.URL.length > 40
                          ? ` (${workout.URL.slice(0, 37)}…)`
                          : ""}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
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
    ) : !hideSvg ? (
      <LiftTypeIndicator liftType={liftType} className="text-base" />
    ) : null;

    return (
      <div className={`flex h-full min-h-0 flex-row rounded-xl border bg-muted/20 ${liftTypeArea ? "p-4" : "px-2 py-1.5"} ${liftTypeArea ? "" : "gap-2"}`}>
        {liftTypeArea && (svgPath && bigFourURLs[liftType] ? (
          <Link href={bigFourURLs[liftType]} className="flex shrink-0 transition-opacity hover:opacity-80">
            {liftTypeArea}
          </Link>
        ) : (
          liftTypeArea
        ))}
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
